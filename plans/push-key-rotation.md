# Push key rotation

Deploy v5.7.3 stale-key detection before retiring the exposed key. Merging code does not rotate production secrets.

1. Back up the database. Pause push cron jobs and registration traffic; drain in-flight dispatches.
2. In the production secret-management environment, generate a replacement pair with `web-push.generateVAPIDKeys()`. Write directly to the secret manager; never print or paste the private key into logs, command arguments, or chat.
3. Update `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` together, retaining the valid contact subject. Rebuild/redeploy every instance and client bundle. Record a UTC cutoff before allowing new registrations.
4. With replacement configuration and the production database selected, run `pnpm exec tsx src/scripts/retire-push-subscriptions.ts --before=<UTC-cutoff>` for a dry run. Inspect the count, then repeat with `--apply`. This global administrative operation disables old subscriptions while preserving encrypted records. Keep traffic paused until completion.
5. Resume registration and scheduled dispatch. Users open Profile and choose Repair This Browser once per device. Repeating retirement with the same cutoff excludes subscriptions newly created or refreshed after the cutoff.
6. On an iOS Home Screen installation, check local display and remote tests in foreground, background, and locked states. Inspect safe `push_dispatch` logs for provider status, Apple reason, and APNs ID. Acceptance is not proof of display.

Do not roll back to the exposed private key. If deployment fails, keep dispatch paused and repair configuration using the replacement pair.
