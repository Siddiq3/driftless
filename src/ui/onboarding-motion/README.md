# Onboarding motion

Tune every duration and distance in `constants.ts` (`ONBOARDING_MOTION`). Defaults:

- Words: 120 ms apart, 200 ms from muted ink to normal ink.
- Question pause: 250 ms after the previous options fade out (140 ms).
- Options: 70 ms stagger, 220 ms fade, 8 dp rise.
- Character: 4 dp bob over a 2 second cycle; 160 ms talking half-cycle.
- Selection: scale to 0.97 and back; light impact haptic.
- Continue: 250 ms disabled/enabled fade; 0.98 press scale; medium impact haptic.
- Reduced motion: full question and options fade in, without stagger, typing or movement.

`useTypewriter(text, msPerWord, { onDone, active, reducedMotion, paused })` exposes
`isTyping`, word tokens and a UI-thread elapsed clock. `TypewriterText` reserves the
native paragraph height, measures native word positions, and fades normal ink over
muted ink. Each word is a real native Text view because Fabric virtual inline spans
cannot reliably animate opacity with Reanimated. Measurements respect font scaling
and native line wrapping; only opacity and transforms animate.

`AnimatedCharacter` accepts any character as its child, and stops its loop when the
screen loses focus or the app backgrounds. The existing question mascot uses `still`
so its original idle animation does not combine with the new wrapper.

`QuestionContent` owns the pause, typing, option reveal and exit sequence. Its exit
promise resolves on unmount too. `SetupFlow` retains answer selection and persistence;
the synchronous navigation guard and Continue press lock prevent duplicate saves.

Native dependencies require rebuilding a development client (`npx expo run:android`,
or an iOS development build). Babel uses Expo's automatic Worklets plugin setup.
