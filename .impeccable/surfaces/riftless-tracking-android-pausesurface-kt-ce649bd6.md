---
version: 1
slug: "riftless-tracking-android-pausesurface-kt-ce649bd6"
primary_target: "modules/tracking-android/android/src/main/java/app/driftless/tracking/android/PauseSurface.kt"
related_targets: []
---

# Pause screen (feed overlay and full-screen app pause)

Scope: the shared native pause surface, PauseSurface.kt, shown by FeedPauseOverlay over the Reels/Shorts feed and by PauseActivity for whole-app pauses. Mode: operate; the person decides to leave, take 5 more minutes, or open the app. Must feel like a playful buddy, never strict or punishing. Inherits the app's world: near-black ground, LilitaOne display, warm amber, purple brain.

## Direction contract

THESIS: A pause is an invitation to do something better, not a wall. The screen offers three tiny side quests instead of only saying stop, refusing the category default of a centered icon, a scolding headline and a stack of buttons.

OWN-WORLD: Ground #0B0B08, quest tiles and secondary button #29271F with 20dp corners, amber #FFD18E for the primary action and live numbers, muted #B4B3AA for supporting copy, cream #FFFFF8 text; LilitaOne for the headline and the bubble; the purple brain with a cream speech bubble. Emoji appear only inside quest tiles, as the brand's playful voice.

STORY: The person reads the brain's bubble and the headline, sees why the feed paused (limit, focus time, break with countdown, video goal with count), picks a side quest or leaves, or deliberately takes 5 more minutes.

FIRST VIEWPORT: The brain left of a cream speech bubble ("Side quest unlocked!") at the top; LilitaOne headline and one supporting line; for breaks and goals an amber pill with the countdown or today's count; "Pick a side quest" with three square tiles in a row (💧 Drink water, 🧘 Stretch, 💬 Text a friend); then Leave feed (amber), 5 more minutes · N left (dark), Open ScrollSnooze (text). Signature move: the three tiles pop in one after another when the pause appears.

FORM: Side quests, position 3 on the ranked list (dealt as candidate 3), seed key 5df98a09.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
