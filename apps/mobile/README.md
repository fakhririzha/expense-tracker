# FinHealth Mobile

The native FinHealth client is an Expo Router app for the phone-first transaction workflow.

It connects to the existing FinHealth web backend through the versioned mobile API. The mobile
app supports sign-in, a focused financial dashboard, transaction history and detail, ordinary
income/expense/transfer CRUD, receipt scanning for form prefilling, native location pins,
account balances and summary, and sign-out. Web-only features such as
budgets, goals, investments, liabilities, recurring rules, account management, split editing,
and offline mutation queues remain out of scope.

## Configuration

Create `apps/mobile/.env.local` and set the only required mobile environment variable before starting Expo:

```bash
EXPO_PUBLIC_API_URL=https://finhealth.chat
```

Use HTTPS for physical devices and production builds. Local HTTP is limited to simulator/emulator loopback hosts during development. For LAN testing, run the backend with `pnpm dev:https`, use a certificate valid for the LAN hostname, trust its issuer on the iOS or Android device, and set `EXPO_PUBLIC_API_URL` to that trusted `https://` hostname.

Expo Go supplies its own native map configuration. Before creating a standalone Android build,
also set a Google Maps SDK for Android key in the build environment:

```bash
GOOGLE_MAPS_API_KEY=your-restricted-android-key
```

Restrict this key to the Android application ID and signing certificate used for the release.

The app stores only its bearer session token and expiry in `expo-secure-store`. It never receives
database credentials, encryption keys, or OCR provider credentials.

## Get started

Install dependencies from the repository root and start with Expo Go:

```bash
pnpm install
pnpm mobile:start
```

The app uses Expo Router and keeps its routes in `src/app`. Receipt scanning uses the Expo camera,
photo picker, modern ImageManipulator, File, and `expo/fetch` APIs. The native location picker uses
foreground location permission and a tappable map; it is supported in Expo Go on iOS and Android.

## Useful commands

```bash
pnpm mobile:start
pnpm mobile:android
pnpm mobile:ios
pnpm mobile:lint
pnpm mobile:typecheck
```

## Install on iPhone

The iOS app uses the bundle identifier `chat.finhealth.mobile`. Link it to the Expo account once
from `apps/mobile`, then configure the public backend URL in both EAS environments:

```bash
pnpm dlx eas-cli@latest init
pnpm dlx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_API_URL --value https://finhealth.chat --visibility plaintext
pnpm dlx eas-cli@latest env:set --environment production --name EXPO_PUBLIC_API_URL --value https://finhealth.chat --visibility plaintext
```

For a direct device installation, register the iPhone and create an internal preview build:

```bash
pnpm dlx eas-cli@latest device:create
pnpm eas:build:ios:preview --local
```

Use the `pnpm eas:build:*` scripts rather than calling `eas-cli` directly. Those
scripts keep local iOS builds from picking up conflicting command-line tools.

Open the build URL on the registered iPhone and tap Install. This ad hoc build is intended for
quick personal testing and requires an Apple Developer membership.

For private TestFlight distribution, create and submit the store build instead:

```bash
pnpm eas:build:ios:production
pnpm eas:submit:ios
```

After Apple processes the build, add it to an internal TestFlight group in App Store Connect,
install Apple's TestFlight app on the iPhone, and accept the invitation. TestFlight builds do not
require a running Expo development server but expire after 90 days.

Native mutations require a network connection. Cached GET responses remain available while
offline, and the app shows an offline indicator instead of queueing financial changes.
