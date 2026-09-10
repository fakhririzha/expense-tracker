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

Native mutations require a network connection. Cached GET responses remain available while
offline, and the app shows an offline indicator instead of queueing financial changes.
