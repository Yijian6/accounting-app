# Mobile App Notes

This folder is the Capacitor mobile shell for 拾序记账.

## Current Direction

- Keep the existing React/Vite app as the source interface.
- Use Capacitor to package the app for Android first.
- Keep local-first data storage and the existing backup/import flow.
- Do not add cloud sync, push notifications, or background sync in this phase.

## Android

- App ID: `com.shiyu.accounting`
- App name: `拾序记账`
- Web output: `dist`
- Native project: `android/`

Run after web changes:

```bash
npm run build
npx cap sync android
```

## iOS

iOS packaging is not configured in this Windows workspace. Continue later on macOS with Xcode and an Apple Developer account.
