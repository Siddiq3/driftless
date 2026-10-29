# Settings redesign

The signed-in Settings route remains `app/settings.tsx`. Its previous profile block,
collapsed sharing section, account status, device support and three full-width pill
buttons are reorganized into a plain header, compact initial/name profile, grouped
Focus/privacy navigation, expandable device support, and a separate sign-out
text action. The user subsequently requested removing both Progress sharing and
Account backup sections; neither appears in Settings.

`src/settings/theme.ts` inherits the warm canvas, neutral surfaces, amber accent,
spacing, typography and geometry from Focus. `SettingsControls.tsx` supplies the
canvas, section, row, divider and text primitives. Groups use hairline borders,
48dp minimum actions and 56dp minimum rows. Text scales with Android and rows grow with wrapped content. The canvas has a subtle warm gradient and no
drop shadows. No new assets, dependencies or decorative animation were added.

Profile fetching, foreground refresh, generation/cancellation fences, entitlement
caching, capability reporting, route destinations and sign-out are unchanged.
Loading and offline/retry remain. Background account backup and stored sharing
consent are unchanged; this screen no longer imports the backup coordinator or
provides a sharing-consent control. Capability details remain under Device support.

Validation: TypeScript and Expo lint pass; all 498 tests across 59 suites pass.
The standalone arm64 Android APK builds successfully and is installed over the
existing local test build, preserving sign-in and app data. Physical OnePlus
checks cover rendered Settings, Focus/privacy navigation, device-support expansion
and 200% font size. System font scale is restored to 1.0 afterward. Sharing consent and sign-out were not changed during visual testing. Evidence is saved in
`../output/settings-redesign-20261029/` at the workspace root. This is a locally
signed test build, not a Play release submission.
