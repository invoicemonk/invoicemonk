# Mobile Build & Release Runbook

Placeholder — filled in by Claude Code once `eas init` is run.

## Prerequisites

- Node 20+
- Bun or npm
- Xcode 16+ (for iOS)
- Android Studio + JDK 17 (for Android)
- Expo account + `eas login`

## First-time setup

```bash
cd mobile
npm install
npx expo prebuild --clean         # only when adding native deps
eas init                          # creates the EAS project id (fill into app.json)
eas credentials                   # generate iOS certs + Android keystore
```

## Local dev

```bash
npx expo start                    # metro bundler
# then press i / a to open on simulator, or scan QR with Expo Go / dev client
```

The mobile app **shares** the Supabase project with the web app
(`skcxogeaerudoadluexz`). Any change you make appears in the web too.

## Builds

```bash
# Internal (TestFlight + Play Internal) — auto-updated via OTA
eas build --profile preview --platform all
eas submit --profile preview --platform all

# Production
eas build --profile production --platform all
eas submit --profile production --platform all
```

## OTA updates

```bash
eas update --branch preview --message "Fix scan retry backoff"
```

Non-native changes ship instantly to installed builds on the matching channel.

## Env vars

None on the device. Supabase URL + anon key are baked into `mobile/src/lib/supabase.ts`.
`LOVABLE_API_KEY` lives only in the `scan-document` edge function.

## Testing

```bash
npm test                          # vitest unit + component
npm run e2e:ios                   # Detox
npm run e2e:android               # Detox
```

## Bundle IDs

- iOS: `com.invoicemonk.app`
- Android: `app.invoicemonk`

Change only if the user provides different IDs.
