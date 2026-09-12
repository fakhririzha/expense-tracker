# FinHealth on your iPhone through TestFlight

Prepared on September 11, 2026. You already have an Apple Developer membership and an Expo account.

## Goal

Build a signed iOS app on your MacBook using EAS Build's `--local` option, upload it to App Store Connect, and install it through a private TestFlight internal-testing group containing only you. This bypasses Expo's cloud build queue. Uploading a build to TestFlight does not publish it on the App Store. Internal testing does not require external Beta App Review. [Expo TestFlight guide](https://docs.expo.dev/submit/testflight/)

**TestFlight builds expire after 90 days.** Upload and install a fresh build before expiry, even if you have made no app changes. [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview)

This document is a guide for later execution. No build, Apple registration, submission, or signing setup was performed when it was written. Finish the current implementation and security review before building a release.

## 1. Prepare the repository

First prepare your Mac:

- Install full Xcode, open it once, and complete its license and component installation. Install an iOS SDK compatible with the project's Expo SDK and Apple's current upload requirements.
- In Xcode → Settings → Locations, select the installed Xcode version under Command Line Tools.
- Install Node and pnpm matching the repository requirements, plus CocoaPods and Fastlane. If you use Homebrew, `brew install cocoapods fastlane` installs the latter two.

Check that the native tools are available:

```bash
xcodebuild -version
pod --version
fastlane --version
```

Local builds use your installed tool versions; EAS cloud image settings do not install or select those tools for you. You still need internet access for dependencies, Expo project/signing access, and submission. [Expo local-build requirements](https://docs.expo.dev/build-reference/local-builds/)

Use the completed, reviewed release. From the repository root:

```bash
cd "/Users/fakhri/Developer/Personal Project/expense-tracker"
pnpm install --frozen-lockfile
pnpm contracts:typecheck
pnpm mobile:lint
pnpm mobile:typecheck
pnpm test:mobile-server
```

Confirm that the deployed HTTPS backend includes the mobile API and any required database migrations. The native app connects to that backend; building the app does not deploy the server.

Run all EAS commands below from the mobile directory. EAS configuration belongs there because this is a monorepo. Keep the entire repository available, including `packages/contracts` and the root lockfile. [Expo monorepo build guidance](https://docs.expo.dev/build-reference/build-with-monorepos/)

```bash
cd apps/mobile
```

## 2. Connect the Expo project

```bash
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest whoami
pnpm dlx eas-cli@latest init
pnpm dlx eas-cli@latest build:configure --platform ios
```

Choose your Expo account and create or link the FinHealth project. Preserve the project ID added to the app configuration. If the project is already linked, use that project rather than creating another.

Choose a permanent, unique iOS bundle identifier, for example `chat.finhealth.mobile`, if available under your Apple team. Configure it as `expo.ios.bundleIdentifier` in `apps/mobile/app.json`, or in the existing dynamic `apps/mobile/app.config.ts` if it overrides that setting. Merge the field into the existing iOS configuration; preserve icons, permissions, and plugins.

Inspect the resolved configuration:

```bash
pnpm exec expo config --type public
```

Confirm the bundle identifier, app name, icon, and Expo project ID. EAS generates the native iOS project during the build. You do not need to maintain an `ios/` directory or manually archive through Xcode; the local build uses Xcode's installed tools. [EAS build setup](https://docs.expo.dev/build/setup/), [local builds](https://docs.expo.dev/build-reference/local-builds/)

## 3. Set the backend URL

The local build commands below explicitly pass `EXPO_PUBLIC_API_URL=https://finhealth.chat`. Replace that value if your backend uses another domain. Use the base URL without `/api/mobile/v1` appended.

Also configure the same public URL in the EAS production environment, so an optional cloud build uses the same backend:

```bash
pnpm dlx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://finhealth.chat --environment production --visibility plaintext
```

Keep the URL consistent with any existing production-profile environment settings. The local `apps/mobile/.env.local` file is not a substitute for configuring cloud builds. `EXPO_PUBLIC_` values are embedded in the app, so this URL is deliberately public. Never add database credentials, `AUTH_SECRET`, encryption keys, or OCR credentials to the mobile environment. A later URL change requires a new build in this workflow. [EAS environment configuration](https://docs.expo.dev/eas/environment-variables/manage/), [environment variable usage](https://docs.expo.dev/eas/environment-variables/usage/)

## 4. Configure the TestFlight build profile

Merge this configuration into `apps/mobile/eas.json`, preserving any profiles already present:

```json
{
  "cli": {
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "distribution": "store",
      "environment": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

TestFlight uses `distribution: "store"`, including for your private internal-testing group. Do not use EAS `distribution: "internal"`, which produces a different kind of installation. No `expo-dev-client` dependency is needed for this production build. [Expo TestFlight guide](https://docs.expo.dev/submit/testflight/)

Remote version management and `autoIncrement` give subsequent uploads increasing iOS build numbers. Keep the user-facing version in the app configuration; the repository changelog version is not automatically used as the native app version. [EAS configuration reference](https://docs.expo.dev/eas/json/)

## 5. Build the signed iOS app on your MacBook

From `apps/mobile`:

```bash
EXPO_PUBLIC_API_URL=https://finhealth.chat \
pnpm dlx eas-cli@latest build \
  --platform ios \
  --profile production \
  --local \
  --output /private/tmp/finhealth.ipa
```

Follow the prompts to sign in to Apple, complete two-factor authentication, select the correct Apple team, and allow EAS to manage the distribution certificate and provisioning profile. Reuse appropriate existing credentials when offered.

Wait for the terminal to report success. The signed app is written to `/private/tmp/finhealth.ipa`; this is a temporary output location, so upload it promptly or move it somewhere durable if you want to retain it. Choose another output filename if you need to retain a previous build.

Compilation happens on your Mac, without joining Expo's cloud build queue. Signing can still use credentials managed by EAS. A JavaScript export alone does not verify native compilation. [Expo local builds](https://docs.expo.dev/build-reference/local-builds/)

## 6. Upload the completed build

```bash
pnpm dlx eas-cli@latest submit \
  --platform ios \
  --profile production \
  --path /private/tmp/finhealth.ipa
```

Run this only after step 5 succeeds, so you upload the newly built file. Follow the Apple authentication and App Store Connect prompts. If you have no app record yet, follow the CLI creation flow or create one in [App Store Connect](https://appstoreconnect.apple.com/) using the same bundle identifier. Apple's processing time still applies after upload.

For repeatable submissions, find the app's numeric **Apple ID** in App Store Connect → App Information and add it under `submit.production.ios.ascAppId` in `eas.json`. This is the app's numeric ID, not your Apple login email or team ID. [EAS submission configuration](https://docs.expo.dev/eas/json/)

## 7. Enable your personal TestFlight access

1. Open App Store Connect → Apps → FinHealth → TestFlight.
2. Wait for Apple to finish processing the build.
3. Resolve any **Missing Compliance** questions using the app's actual encryption behavior. Do not declare an exemption merely to dismiss the prompt.
4. Create an **Internal Testing** group named `Personal`.
5. Add your own App Store Connect user as a tester and add the processed build to the group. Enable automatic distribution if desired.
6. Install Apple's TestFlight app on your iPhone and accept the invitation sent to your tester email.
7. Open TestFlight and install FinHealth.

Your Account Holder user can be an internal tester. No public testing link, external group, device UDID registration, or public App Store release is needed for this route. [Apple internal tester instructions](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)

## 8. Verify the installed app

Check login, session restoration after closing the app, dashboard and account totals, transaction creation/edit/delete, camera and photo-library receipt scans, map pins, location permission denial, and logout.

The installed app runs without Expo Go or a running Metro development server. Its network features still need access to the FinHealth backend. Treat transactions entered here as real data if the configured URL points to your production account.

## Later updates and expiry renewal

After reviewing changes and rerunning the mobile checks, run from `apps/mobile`:

```bash
EXPO_PUBLIC_API_URL=https://finhealth.chat \
pnpm dlx eas-cli@latest build \
  --platform ios \
  --profile production \
  --local \
  --output /private/tmp/finhealth.ipa
```

Once the build succeeds, upload it:

```bash
pnpm dlx eas-cli@latest submit \
  --platform ios \
  --profile production \
  --path /private/tmp/finhealth.ipa
```

Check App Store Connect after processing, add the new build to your `Personal` group if needed, and update through TestFlight. Set yourself a reminder before the 90-day expiry. You can rebuild unchanged source with a new build number to renew testing access. [Expo build and submit workflow](https://docs.expo.dev/submit/testflight/), [Apple build expiry](https://developer.apple.com/help/app-store-connect/reference/app-build-statuses/)

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Sign-in fails | Confirm the build's production API URL, backend reachability, credentials, and deployed mobile API. |
| Build succeeds but app is absent from TestFlight | Confirm submission succeeded, the correct Apple team/app was selected, processing finished, and compliance questions were answered. |
| App is visible but you cannot install | Add your user and the build to the internal group; accept the tester invitation; check build expiry and iOS compatibility. |
| Duplicate build number | Confirm remote version management and `autoIncrement`; upload a fresh build. |
| Signing fails | Run `pnpm dlx eas-cli@latest credentials --platform ios` and inspect the selected team, certificate, and provisioning profile. |
| Xcode, CocoaPods, or Fastlane is missing | Complete the Mac setup in step 1 and verify each tool is available in the terminal. |
| Local native compilation fails | Read the first relevant Xcode error in the build output; verify your Xcode/iOS SDK and local dependency versions. |
| Workspace dependency is missing | Build from `apps/mobile` within the full monorepo; ensure ignore rules do not exclude `packages/contracts` or required workspace files. |

Save the intended app configuration and `eas.json` through the repository's normal review workflow. Do not commit signing certificates, provisioning profiles, API private keys, or passwords.

## Optional: use Expo cloud builds instead

If you later prefer cloud compilation, run from `apps/mobile`:

```bash
pnpm dlx eas-cli@latest build --platform ios --profile production --auto-submit
```

This uses the EAS production environment configured in step 3 and joins Expo's build queue. Both routes deliver the app to the same TestFlight setup.
