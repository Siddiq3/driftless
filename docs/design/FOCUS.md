# Focus visual redesign

The Android Focus route is `app/blocking.tsx`; iOS continues to use its existing Screen Time screen.

## Audit and structure

Previously: decorative hero and small App pauses switch, separate readiness card, app grid,
allowance chip grid, schedule card, configuration button, feed-controls card, help and permission buttons.

Now: plain header → status/action hero → horizontal app tiles → daily-limit number and stepper
→ divided schedule group → feed segment → collapsed More options → plain help/permission rows.
The hero is the only elevated surface. A cocoa-to-near-black canvas gradient, richer
amber-brown hero and softly filled app tiles/stepper controls give the screen warmth.
Schedule and secondary groups retain hairline outlines and dividers.
The Included chip, selected-count badge and filler footer were removed.

## Shared implementation

- `src/focus/theme.ts`: warm canvas `#120D0A`, two hero gradient stops, neutral text, amber
  selection/action roles, 4/8-point spacing, radii, touch sizes, type scale and motion durations.
- `src/focus/FocusControls.tsx`: StatusHero, AppTile, LimitSelector, SettingRow,
  SegmentedControl, CollapsibleSection and the supporting text, section and action-row primitives.
- Native switches remain in schedule/settings rows; the large master switch and app-tile
  borders use Reanimated. Collapsibles animate height/layout and opacity. Reduced motion
  removes those transitions. Text scales with the OS, with rows stacking their controls for larger text.
- The existing readiness component supports an inline presentation in the hero; other routes
  retain their existing presentation and readiness rules.

## Behavior retained and scope limits

The settings hook, serialized save queue, rollback, storage, native bridge and route destinations
are unchanged. Setup stays editable with App pauses off; its settings still save and the hero
explains that they apply when enabled. Only genuinely disabled controls, such as stepper endpoints,
are dimmed to 50% and disabled semantically. Limits include 15, 20, 30, 45, 60, 90 and 120;
non-preset saved values remain visible and are preserved until edited.

Preserved: unavailable-app selections, schedule presets/custom-schedule removal, feed modes,
goal navigation/enforcement, break frequency/duration, bypass count/duration, experimental detection,
account-allowance notices, unsupported-build feedback and all load/save retry paths.

There is no existing schedule time editor. Preset switches and Configure app pauses keep their
existing behavior. No new time-editing feature or misleading edit-time chevron was introduced.

## Other routes using the old filled-card pattern

Confirmed remaining routes:

- `app/app-pauses.tsx`: repeated filled sections for app selection, daily allowance and advanced controls.
- `app/progress.tsx`: stacked chart, totals, focus promotion and app-summary surfaces with separate card treatments.

Goals, tracking, privacy, settings and stats use the shared open, divided `Section`,
so they are not filled-card stacks. `src/social/BattleInbox.tsx` still contains repeated
legacy `Card` markup, but no current route imports that component.

## Verification

Run `npm run typecheck`, `npm run lint`, and focused Jest tests for the screen,
Focus theme contrast, protection status, schedules and shared design tokens.
Typecheck and lint pass; 78 focused tests pass across five suites. Android emulator
checks cover off/enabled-with-missing-permission states, selected app tiles, More options,
320dp width at 130% font size, 200% font size and reduced motion. Font, size and animation
settings are restored after the check. Native screenshot evidence is in
`../output/focus-redesign-20261029/`. Healthy protection-on readiness is covered in Jest;
this emulator has counting permission disabled. No physical-device or TalkBack run was performed.
