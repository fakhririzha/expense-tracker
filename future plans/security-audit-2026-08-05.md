# FinHealth Security Audit and Future Remediation Plan

**Audit date:** 2026-08-05

**Repository:** `fakhririzha/expense-tracker`

**Audit type:** Read-only source, configuration, dependency, and financial-integrity review

**Status:** Findings documented; remediation not yet implemented

## Executive summary

The audit found no critical vulnerabilities, unauthenticated financial-data access, confirmed cross-user IDOR, or committed production secrets. Authentication, ownership filtering, cron authorization, core encryption primitives, push endpoint SSRF protection, CSV bounds, and service-worker cache isolation were generally implemented well.

The largest risks are financial-ledger integrity failures. Several authenticated operations can corrupt the current user's balances through malformed runtime input, retries, concurrent requests, or cascading deletion. Two recurring-processing defects can affect many users when a scheduled run overlaps or retries. A legacy encryption migration also leaves plaintext in the database while producing ciphertext that normal runtime code cannot decrypt.

Severity in this report reflects impact to a personal-finance product. Unless a finding explicitly says otherwise, the financial-integrity findings do not let one user change another user's records; they allow same-user corruption through a crafted client, an accidental retry, or concurrent legitimate requests.

## Scope and method

The review covered:

- Authentication, registration, session propagation, middleware, and rate limiting.
- All Server Actions and API routes, including ownership and IDOR checks.
- Transactions, accounts, liability payments, investments, receivables, deposito, recurring processing, imports, exports, budgets, goals, and notifications.
- Encryption, migration scripts, secrets, TOTP, push subscriptions, OCR, and weekly AI insights.
- XSS, unsafe navigation, CSV injection, uploads, browser storage, service workers, CORS, CSRF assumptions, security headers, and deployment configuration.
- Production dependency advisories reported by `pnpm audit --prod` on the audit date.

Five focused review tracks were run in parallel, followed by a separate consolidation pass that checked exploit preconditions, ownership scope, database constraints, and false positives.

## High-severity findings

### SEC-01: Legacy encryption migration retains plaintext and creates incompatible ciphertext

**Scope:** Confidentiality; operational migration

**Precondition:** An operator runs `src/scripts/migrate-encryption.ts` against legacy plaintext rows.

`src/scripts/migrate-encryption.ts:66` encrypts transaction descriptions with `encrypt(description, userKey)` and writes only `descriptionEncrypted` at line 69. It neither derives the field-specific key used by normal runtime encryption nor clears the plaintext `description` column. The same defect affects trade notes at lines 138-141.

Normal writes use `encryptUserField`, which derives a field-specific key. Normal reads use the corresponding field-specific decryption path. As a result, migrated ciphertext cannot be decrypted normally, the plaintext remains readable during a database compromise, and the non-null encrypted column prevents a simple idempotent rerun. Runtime plaintext fallback can mask the failure.

**Required remediation:**

1. Prevent further use of the legacy script until repaired.
2. Encrypt with `encryptUserField(userId, exactFieldName, plaintext)` or the equivalent field-specific primitive.
3. Clear plaintext and write ciphertext atomically.
4. Create a repair migration for rows already touched by this script.
5. Add a round-trip migration test proving that plaintext is null and runtime decryption succeeds.

### SEC-02: Deleting a destination-only account erases ledger entries without restoring balances

**Scope:** Same-user ledger integrity

**Precondition:** An account is referenced only as `Transaction.toAccountId`, such as the destination of an inbound transfer.

`src/actions/account-actions.ts:373-394` blocks deletion only when transactions reference the account through `accountId`. It does not count `toAccountId`. Both the source and destination transaction foreign keys use cascading deletion (`prisma/schema.prisma:403-407`).

For example, after transfer A -> B, deleting B can cascade-delete the transfer while A remains debited. The ledger and account balances then disagree. Inbound liability-payment history and related audit relationships can also be removed unexpectedly.

**Required remediation:** Check both source and destination references inside the deletion transaction, prefer restrictive foreign keys for settled ledger rows, and recheck references immediately before deletion. Consider archival/inactivation instead of physical deletion.

### SEC-03: Transaction updates do not validate runtime input

**Scope:** Same-user ledger integrity

**Precondition:** An authenticated caller invokes the Server Action directly or a compromised/malformed client submits values the UI would not normally send.

Creation validates positive amounts and exchange rates in `src/actions/transaction-actions.ts:338-399`. `updateTransaction`, beginning at line 649, accepts a TypeScript `Partial<TransactionInput>` but never parses a runtime update schema. It derives `nextAmount`, `nextType`, currency, and balance effects directly from untrusted runtime values, then persists them at lines 973-1001.

A negative expense amount, for example, reverses the old expense and then credits the account while storing a negative expense record.

**Required remediation:** Parse a strict partial update schema, merge validated values with the stored record, and validate the complete resulting transaction before any balance change. Apply length, currency, coordinate, and URL constraints in the same schema.

### SEC-04: Concurrent transaction edits can reverse the same old balance more than once

**Scope:** Same-user ledger integrity; race condition

**Precondition:** Two edits of the same balance-affecting transaction overlap.

The existing transaction is loaded before the Prisma transaction at `src/actions/transaction-actions.ts:657-686`. The later database transaction reverses that stale snapshot and applies a new effect at lines 958-1001. There is no in-transaction reload, row version, or conditional `updatedAt` predicate.

Two edits can therefore each reverse the original value, while only one final transaction value remains stored. The account balance no longer matches the winning ledger record.

**Required remediation:** Reload or lock the ledger row inside the transaction and use optimistic concurrency with a version or `updatedAt` predicate. Reject and safely retry stale edits.

### SEC-05: Generic transaction creation accepts liability payments but applies one-sided accounting

**Scope:** Same-user ledger and audit integrity

**Precondition:** An authenticated caller submits `type: LIABILITY_PAYMENT` to the generic transaction action.

The generic schema permits `LIABILITY_PAYMENT` at `src/actions/transaction-actions.ts:338-399`. Destination ownership is loaded only for `TRANSFER` at lines 450-454. The creation data then discards the supplied destination for non-transfer types at lines 589-615, and the generic balance helper updates only the source account.

This creates a liability-payment record without reducing the liability, bypasses the dedicated payment audit and validation path, and leaves one-sided accounting.

**Required remediation:** Reject `LIABILITY_PAYMENT` in generic create/update actions and route all such mutations through the dedicated liability-payment service.

### SEC-06: Liability-payment reference de-duplication is ineffective

**Scope:** Same-user ledger integrity; replay/idempotency

**Precondition:** A payment is retried or submitted twice with the same reference number.

`src/lib/liability-payment-validation.ts:336-351` checks uniqueness against plaintext `Transaction.referenceNumber`. New payments in `src/actions/liability-payment-actions.ts:125-155` always store that column as null and store only randomized encrypted ciphertext. The schema uniqueness constraint therefore applies to a column that is null for new payments.

The same reference can pass validation repeatedly, debit the funding account repeatedly, and pay the liability repeatedly.

**Required remediation:** Add a deterministic keyed reference hash or blind index with a user-scoped unique constraint. Enforce the constraint inside the payment transaction and return an idempotent result for a replayed request. A separate client mutation ID is also recommended.

### SEC-07: Liability-payment validation becomes stale before balances move

**Scope:** Same-user ledger integrity; state transition race

**Precondition:** Account state, funds, liability balance, type, or currency changes between prevalidation and transaction execution.

Full validation occurs before the Prisma transaction at `src/actions/liability-payment-actions.ts:90-104`. The transaction re-reads both accounts at lines 107-120 but does not recheck ownership, type, active state, sufficient funds, payoff limit, or currency compatibility before applying raw decrement/increment operations at lines 158-170.

This can produce negative cash, overpayment that was not authorized by the submitted option, or raw numeric movement between accounts using different currencies.

**Required remediation:** Perform all current-state checks inside the same transaction that moves balances. Use conditional balance updates, require matching currencies unless an explicit conversion flow is implemented, and ensure account ownership/type/state predicates are part of the transactional reads or updates.

### SEC-08: Deposito opening and closing have double-spend and double-close races

**Scope:** Same-user ledger integrity; race condition

**Precondition:** Duplicate or concurrent open/close submissions.

Opening validates a funding balance before the transaction at `src/actions/deposito-actions.ts:302-333`, then later decrements it without a current-balance condition at lines 358-424. Concurrent opens can both pass the stale check and overdraw the funding account.

Closing similarly loads status and balance before the transaction at lines 595-649, then uses the captured balance to credit the destination and set closed status at lines 659-712. Parallel closes can credit the destination twice.

**Required remediation:** Move all checks inside the transaction, atomically claim the open/close state with conditional updates, require sufficient current funds, and add idempotency keys for user submissions.

### SEC-09: Recurring transfers have no destination and automatically lose money

**Scope:** Same-user ledger integrity; scheduled processing

**Precondition:** A user creates a recurring rule with type `TRANSFER`.

`src/actions/recurring-actions.ts:15-27` permits `TRANSFER` but the rule has no destination account field. `src/lib/recurring-processing-service.ts:63-83` creates a transfer with only a source account and decrements only that source.

**Required remediation:** Immediately reject recurring transfers until a destination account, ownership/currency validation, and double-entry processing are implemented. Repair or disable any existing transfer rules before the next cron execution.

### SEC-10: Overlapping recurring cron runs can duplicate every due occurrence

**Scope:** Service-wide ledger integrity; scheduled retry/concurrency

**Precondition:** Two authorized cron requests or platform retries overlap after both have selected the same due rule.

Due rules are selected before the per-rule transaction at `src/lib/recurring-processing-service.ts:15-22`. The transaction at lines 52-96 does not atomically claim or revalidate the scheduled due date before creating a transaction. No unique `(rule, scheduledDueDate)` occurrence key is stored.

Two runs can create duplicate transactions and balance changes for the same scheduled occurrence across affected users.

**Required remediation:** Create a deterministic occurrence key, enforce it with a database unique constraint, and atomically claim the exact rule/due-date pair before creating the transaction. Treat unique conflicts as successful idempotent completion.

### SEC-11: Self-hosting guidance permits insecure production HTTP

**Scope:** Deployment-conditional confidentiality and account takeover

**Precondition:** A self-hosted production instance is directly exposed over HTTP or its proxy accepts HTTP without redirecting it to HTTPS.

`README.md:306-313` instructs operators to use `pnpm start` and describes HTTPS only in terms of PWA and push behavior. `package.json` starts a plain HTTP server, while no application-level HTTPS redirect or HSTS policy is configured.

On an affected deployment, a network attacker can observe or alter credentials, session cookies, and financial data.

**Required remediation:** Document HTTPS as mandatory for production. Terminate TLS at a trusted edge, redirect all HTTP before it reaches Next.js, use an HTTPS `AUTH_URL`, and configure HSTS at the HTTPS-serving edge. This finding is not exploitable when Vercel or the production proxy already enforces these controls.

## Medium-severity findings

### SEC-12: Recurring-rule updates bypass runtime validation

`src/actions/recurring-actions.ts:127-223` accepts a `Partial<RecurringRuleInput>`, never calls `safeParse`, and spreads the input into Prisma. A crafted authenticated request can store a negative amount or other invalid state, which scheduled processing later turns into an inverse balance change.

**Remediation:** Validate a strict partial schema, merge with the stored rule, and validate the full resulting rule before persistence.

### SEC-13: Precise transaction locations are stored unencrypted

`prisma/schema.prisma:381-384` stores location text, latitude, longitude, and Google Maps links in plaintext. Create and update paths write these values directly at `src/actions/transaction-actions.ts:596-599` and `986-989`.

A leaked backup, read-only database compromise, or overly broad database access exposes transaction-linked physical history.

**Remediation:** Add encrypted companions, field classifications, migration/backfill support, and authenticated decryption for display/export. Null the legacy plaintext after verified migration.

### SEC-14: OCR provider error bodies are logged verbatim

`src/actions/transaction-ocr-actions.ts:314-319` logs `await response.text()` when the configured OCR provider returns an error. A provider or proxy can include receipt-derived data, prompt content, or request echoes that then persist in infrastructure logs.

**Remediation:** Log only status, a bounded provider request ID, and a sanitized error code. Never log the provider response body or raw receipt/model content.

### SEC-15: Trusted-proxy rate limiting can trust a spoofed leftmost address

When `AUTH_TRUST_PROXY=true`, `src/lib/auth-rate-limit.ts:40-52` uses the first `X-Forwarded-For` value. If a proxy appends rather than overwrites inbound forwarding headers, an attacker can rotate a supplied leftmost IP and bypass IP-based login/registration throttles. Per-email throttles still constrain direct password brute force.

**Remediation:** Require the trusted proxy to strip and replace inbound forwarding headers, or consume a dedicated canonical header set only by known proxies. Vercel uses a separate branch, and correctly configured self-hosted proxies are not affected.

## Low-severity and hardening findings

### SEC-16: Transaction map links allow deceptive or non-web destinations

`googleMapsLink` accepts any string in `src/actions/transaction-actions.ts`, survives CSV import, and is displayed with the trusted label "Open in Maps" in `src/components/transactions/TransactionTable.tsx:234-243` and `src/components/export/ImportPreview.tsx:98-106`.

An imported CSV can supply a `data:` or unrelated HTTPS destination. The user must import the file and click the link, and `rel="noreferrer"` limits opener abuse, but the label can support phishing.

**Remediation:** Require HTTPS and restrict to approved Google Maps hosts, or generate the URL exclusively from validated coordinates.

### SEC-17: Subscription cancellation URLs permit non-web schemes

`src/actions/subscription-actions.ts:829-834` and `951-956` use `new URL()` as syntactic validation but do not require HTTPS. Values such as `javascript:` and `data:` are syntactically valid and later rendered in `src/components/subscriptions/SubscriptionDetailDrawer.tsx:219-230`.

The value is private to the account owner, which limits attacker delivery, but it remains an unsafe navigation primitive.

**Remediation:** Centralize an external-link validator that permits only HTTPS, rejects embedded credentials/control characters, and is used by both form and server validation.

### SEC-18: OCR upload validation trusts MIME and filename instead of file bytes

`src/actions/transaction-ocr-actions.ts:111-121` accepts either a claimed MIME type or allowed filename extension. Arbitrary data below 1 MB can be labeled as an image and forwarded to the configured provider.

**Remediation:** Verify magic bytes, decode and re-encode accepted images server-side, and enforce pixel-dimension limits. Keep the existing authentication, size limit, timeout, and daily quota.

### SEC-19: Calendar financial events are written to the browser console

`src/app/(dashboard)/dashboard/calendar/page.tsx:43-45` logs the full event array, including amounts, dates, categories, decrypted recurring names, and account names.

**Remediation:** Remove the production `console.log`.

### SEC-20: Application-wide browser security headers are absent

`next.config.ts:12-35` configures headers only for `/sw.js`. No repository-defined application-wide CSP, anti-framing rule, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or HSTS policy exists.

This does not create an XSS by itself, but it increases the blast radius of a future injection and leaves clickjacking/referrer behavior to deployment defaults.

**Remediation:** Configure headers at the application or trusted edge. Refactor the inline click handler in `public/offline.html` before deploying a strict CSP. Verify actual production responses because Vercel or another edge may already inject some controls.

### SEC-21: New passwords use bcrypt cost 10

`src/actions/auth-actions.ts:50` hashes new passwords with bcrypt cost 10. The existing 12-character minimum and bcrypt 72-byte enforcement are positive controls, but stolen hashes are cheaper to attack than with a measured cost of 12 or a suitable memory-hard password KDF.

**Remediation:** Benchmark production hardware, raise the cost for new passwords, and opportunistically rehash lower-cost hashes after successful login.

## Dependency advisory results

The 2026-08-05 `pnpm audit --prod` run reported two production-tree advisories:

1. **`fast-uri@3.1.4` — high advisory, CVE-2026-18446 / GHSA-7p8r-x3mc-p8w7.** The vulnerable package is an indirect dependency under Prisma tooling. The vulnerable behavior concerns disagreement between URI host validation and Node URL handling. No application code was found using `fast-uri` as a security boundary before `fetch`, so direct reachability was not established. Upgrade to at least `3.1.5`.
2. **`postcss@8.5.18` — moderate advisory, CVE-2026-69153 / GHSA-fxqj-rqcc-2cmp.** The vulnerable behavior can read `.map` files when attacker-controlled CSS is processed without a `from` path. FinHealth does not accept or process user-supplied CSS, so direct application reachability was not established. The package is explicitly pinned by an override and should be upgraded to a patched release (`8.5.23` or later according to the audit output).

These advisories should be resolved, but their upstream severity should not be interpreted as confirmed application exploitability without a reachable vulnerable call path.

## Verified protections and non-findings

- No confirmed unauthenticated financial-data access or cross-user IDOR was found.
- Reviewed user-owned reads and mutations authenticate and generally apply `userId` ownership filters before ID-only mutations.
- Login errors and duplicate registration responses do not expose whether an email exists.
- Login and registration inputs are normalized and bounded; new passwords require at least 12 characters and respect bcrypt's 72-byte limit.
- Cron routes share a bearer-secret gate and fail closed when `CRON_SECRET` is missing.
- Core field encryption uses AES-256-GCM, random 96-bit IVs, authenticated tags, a validated 32-byte master key, per-user salts, and field-specific derivation. Production startup fails closed without the master key.
- TOTP secrets are encrypted, recovery codes are random and stored as HMACs, invalid attempts are limited, and accepted TOTP time steps are single-use.
- No tracked `.env`, private key, or literal production secret was found. Local development certificates are ignored by Git.
- Push subscription endpoints are HTTPS-only, provider-allowlisted, DNS-checked, restricted to public IP addresses, and accessed with a safe outbound agent.
- OCR and weekly AI requests use server-configured destinations rather than user-provided endpoints, are time-bounded, and have size/quota or data-minimization controls.
- No direct HTML injection sinks (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function`) were found. User text is rendered through React escaping.
- Repository changelog Markdown is rendered without raw HTML support.
- CSV imports are bounded to 512 KB, 1,000 rows, 32 columns, and 2,048 characters per cell. Exports quote values and neutralize spreadsheet formula prefixes.
- The service worker bypasses authenticated pages, API routes, and non-static resources. It caches only public static assets and has a non-cacheable worker script.
- No permissive CORS policy or source-evidenced CSRF bypass was found. Next.js Server Action origin controls and Auth.js cookie protections remain important deployment assumptions.

## Remediation order

### Phase 0: Containment before the next release

1. Disable the legacy encryption migration and determine whether it has ever run in any environment.
2. Disable recurring transfers and audit existing recurring transfer rules.
3. Prevent duplicate recurring executions with an occurrence key or temporarily ensure only one scheduler can run.
4. Block physical account deletion when either transaction foreign key references the account.
5. Verify every production deployment redirects HTTP to HTTPS and serves HSTS at the edge.

### Phase 1: Ledger integrity

1. Add strict runtime schemas for transaction and recurring-rule updates.
2. Reject liability payments from generic transaction actions.
3. Add idempotency keys and database uniqueness for payments, recurring occurrences, deposito operations, and other balance-moving submissions.
4. Move all mutable-state validation into the same transactions that change balances.
5. Add optimistic concurrency or conditional state transitions for transaction edits and deposito close/open flows.
6. Enforce same-currency rules or explicit conversion for every double-entry flow.
7. Replace cascading ledger foreign keys with restrictive or archival behavior where appropriate.

### Phase 2: Privacy and logging

1. Repair and verify encryption migration behavior.
2. Encrypt transaction location fields and backfill existing rows.
3. Remove provider response bodies and financial event objects from logs.

### Phase 3: Browser, upload, deployment, and dependency hardening

1. Restrict external link schemes and map hosts.
2. Verify uploaded image bytes and dimensions.
3. Add application-wide security headers and test CSP compatibility.
4. Raise the password hashing cost after benchmarking.
5. Upgrade the two audited vulnerable dependencies and rerun the production audit.

## Required regression coverage

- Two concurrent edits of one transaction result in exactly one valid final balance effect.
- Negative, zero, non-finite, oversized, invalid-enum, foreign-account, and cross-currency update payloads are rejected server-side.
- Deleting an account referenced as a source or destination cannot erase settled ledger history.
- Retrying the same liability payment, recurring occurrence, deposito open, or deposito close is idempotent.
- Two overlapping recurring cron invocations produce one transaction and one balance change per due occurrence.
- A recurring transfer is rejected until complete double-entry support exists.
- Encryption migration round-trips through normal runtime helpers and leaves no plaintext.
- Location fields are encrypted at rest while authenticated UI and export paths still work.
- OCR errors never place provider bodies or receipt-derived content in logs.
- External links reject non-HTTPS schemes and map links reject unapproved hosts.
- Production responses enforce HTTPS and the intended security-header policy.

## Audit verification record

The targeted authentication, encryption, cron, TOTP, and push-security test run completed with 13 passing tests and no failures:

```text
src/lib/auth-input.test.ts
src/lib/auth-rate-limit.test.ts
src/lib/cron-auth.test.ts
src/lib/encryption.test.ts
src/lib/push-subscription-security.test.ts
src/lib/account-mutation-totp.test.ts
```

This document intentionally records findings only. It does not claim that remediation has been implemented.
