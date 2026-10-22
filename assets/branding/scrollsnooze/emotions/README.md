# ScrollSnooze emotional character set

These are the earlier peach source masters. The active runtime uses the matching [purple set](../purple/README.md).

Generated with the built-in image_gen tool from `../mascot-v1.png`, preserving the S-shaped crown, palette, proportions and clay illustration style. All files are transparent PNGs.

| File | Usage |
| --- | --- |
| `fresh.png` | Default/wave pose in onboarding and home; native floating counter and meme-card header below the enabled video limit |
| `drained.png` | Home and native counter/meme-card header at or above the enabled video limit; existing drained quote deck |
| `tired.png` | Recap screens showing increased usage or the longest session |
| `focused.png` | Focus illustration and native feed-pause screen |
| `privacy.png` | Privacy onboarding |
| `wrapped.png` | Daily/weekly recap introductions |
| `friends.png` | Social illustration |

Count thresholds, goal validation, permissions, consent and sync are unchanged. Home and native badge retain the same two-state count mood: below the smallest enabled positive video limit = fresh; at or above it = drained. No enabled video limit = fresh. Other poses describe screen context rather than changing count semantics.

Native copies live in `modules/tracking-android/android/src/main/res/drawable-nodpi/scrollsnooze_{fresh,drained,focused}.png`. Recopy the corresponding masters after changing them, and recalibrate the native eyelid bounds if face geometry changes. New native artwork requires an Android rebuild.

## Final prompts

### fresh

Use case: identity-preserve. Asset: one transparent full-body ScrollSnooze mascot PNG for a real mobile app. Use the reference mascot as the exact character identity. Preserve its large peach brain-cloud head, prominent S-shaped crown curl, same brain lobe arrangement, cocoa eyes and facial features, warm peach/apricot/coral colors, cream belly, tiny body, arms and feet, matte soft-clay 3D style, lighting and square composition. Change only expression and pose as specified. Whole body and feet fully visible, centered, same scale as reference, generous transparent margins. Genuine transparent alpha background; no scenery, floor, extra shadows, words, symbols or other characters. Maintain consistent identity rather than inventing another mascot. State: FRESH / HAPPY. Bright open eyes looking toward the viewer, relaxed lifted brows, warm cheerful closed-mouth smile. Upright energetic posture, one hand waving, other hand by its side. Looks rested, ready for a new day and friendly, not manic. Keep same S curl and head silhouette.

### drained

Use case: identity-preserve. Asset: one transparent full-body ScrollSnooze mascot PNG for a real mobile app. Use the reference mascot as the exact character identity. Preserve its large peach brain-cloud head, prominent S-shaped crown curl, same brain lobe arrangement, cocoa eyes and facial features, warm peach/apricot/coral colors, cream belly, tiny body, arms and feet, matte soft-clay 3D style, lighting and square composition. Change only expression and pose as specified. Whole body and feet fully visible, centered, same scale as reference, generous transparent margins. Genuine transparent alpha background; no scenery, floor, extra shadows, words, symbols or other characters. Maintain consistent identity rather than inventing another mascot. State: DRAINED / DAILY LIMIT REACHED. Very heavy drooping eyelids with small tired visible pupils, worried soft brows, tiny gently downturned mouth, slumped shoulders, both arms hanging loosely at sides and knees slightly bent. Looks comically out of energy and asks for a kind break, never ill, injured or frightening. Slightly muted peach shading but same peach skin and S curl; no gray recoloring, no tears, no text. Same upright full-body framing and identity.

### focused

Use case: identity-preserve. Asset: one transparent full-body ScrollSnooze mascot PNG for a real mobile app. Use the reference mascot as the exact character identity. Preserve its large peach brain-cloud head, prominent S-shaped crown curl, same brain lobe arrangement, cocoa eyes and facial features, warm peach/apricot/coral colors, cream belly, tiny body, arms and feet, matte soft-clay 3D style, lighting and square composition. Change only expression and pose as specified. Whole body and feet fully visible, centered, same scale as reference, generous transparent margins. Genuine transparent alpha background; no scenery, floor, extra shadows, words, symbols or other characters. Maintain consistent identity rather than inventing another mascot. State: FOCUSED / TAKING A BREAK. Calm gently closed eyes, relaxed eyebrows, subtle satisfied smile. Both small hands resting together over its cream belly, feet comfortably planted, upright peaceful pose. It has chosen to pause scrolling and feels centered. Preserve exact S-shaped crown, peach palette and face/body proportions. No hat, no accessories, no extra symbols.

### tired

Use case: identity-preserve. Asset: one transparent full-body ScrollSnooze mascot PNG for a real mobile app. Use the reference mascot as the exact character identity. Preserve its large peach brain-cloud head, prominent S-shaped crown curl, same brain lobe arrangement, cocoa eyes and facial features, warm peach/apricot/coral colors, cream belly, tiny body, arms and feet, matte soft-clay 3D style, lighting and square composition. Change only expression and pose as specified. Whole body and feet fully visible, centered, same scale as reference, generous transparent margins. Genuine transparent alpha background; no scenery, floor, extra shadows, words, symbols or other characters. Maintain consistent identity rather than inventing another mascot. State: TIRED / A LITTLE TOO MUCH SCROLLING. Sleepy half-open eyes, one small hand rubbing one eye, the other arm hanging by its side, a gentle small yawn with a rounded mouth. Still standing, mildly drowsy and endearing rather than completely drained. Distinctly more tired than the reference's cheeky smile but not as sad as the drained state. Same peach head with S curl and cream belly.

### privacy

Use case: identity-preserve. Asset: one transparent full-body ScrollSnooze mascot PNG for a real mobile app. Use the reference mascot as the exact character identity. Preserve its large peach brain-cloud head, prominent S-shaped crown curl, same brain lobe arrangement, cocoa eyes and facial features, warm peach/apricot/coral colors, cream belly, tiny body, arms and feet, matte soft-clay 3D style, lighting and square composition. Change only expression and pose as specified. Whole body and feet fully visible, centered, same scale as reference, generous transparent margins. Genuine transparent alpha background; no scenery, floor, extra shadows, words, symbols or other characters. Maintain consistent identity rather than inventing another mascot. State: PRIVACY / REASSURING. Soft open attentive eyes and a warm reassuring closed-mouth smile. Holds a small simple sage-green rounded shield snugly in front of its cream belly with both hands. Shield has just one cream check mark, no lettering. Feet visible, same full-body pose and size. Keep S-shaped crown and peach brain identity unchanged. Mood is safe, trustworthy and friendly.

### wrapped

Use case: identity-preserve. Asset: one transparent full-body ScrollSnooze mascot PNG for a real mobile app. Use the reference mascot as the exact character identity. Preserve its large peach brain-cloud head, prominent S-shaped crown curl, same brain lobe arrangement, cocoa eyes and facial features, warm peach/apricot/coral colors, cream belly, tiny body, arms and feet, matte soft-clay 3D style, lighting and square composition. Change only expression and pose as specified. Whole body and feet fully visible, centered, same scale as reference, generous transparent margins. Genuine transparent alpha background; no scenery, floor, extra shadows, words, symbols or other characters. Maintain consistent identity rather than inventing another mascot. State: WRAPPED / DAILY OR WEEKLY RECAP. Friendly thoughtful face, calm open eyes and a small encouraging smile. Holds a small cream rounded recap card in both hands in front of its belly. The card has three simple rounded apricot bars and one subtle cocoa horizontal rule, no numbers and no words. Not a celebration of high usage, simply reviewing the day kindly. Keep same S-shaped crown, colors, full-body framing and feet visible.

### friends

Use case: identity-preserve. Asset: one transparent full-body ScrollSnooze mascot PNG for a real mobile app. Use the reference mascot as the exact character identity. Preserve its large peach brain-cloud head, prominent S-shaped crown curl, same brain lobe arrangement, cocoa eyes and facial features, warm peach/apricot/coral colors, cream belly, tiny body, arms and feet, matte soft-clay 3D style, lighting and square composition. Change only expression and pose as specified. Whole body and feet fully visible, centered, same scale as reference, generous transparent margins. Genuine transparent alpha background; no scenery, floor, extra shadows, words, symbols or other characters. Maintain consistent identity rather than inventing another mascot. State: FRIENDS / SUPPORTIVE PAIR. Two versions of this same ScrollSnooze character standing side by side giving each other a high five. Both have the exact same S-shaped crown and brain-cloud identity, cream belly and tiny feet. One warm apricot, the other slightly more coral, both within the same palette. Happy open eyes and encouraging smiles. Two whole bodies fully visible in a square composition, centered pair fills 85 percent of frame with transparent margins. This is a friend illustration for social challenges, not a celebration of scrolling. No confetti, trophies, floating symbols, or words.


## Runtime animation

`BrainCharacter` now draws a transparent SVG facial layer over each PNG, calibrated in 1254px artwork coordinates. Fresh, privacy and recap poses blink and have a subtle cheek response. Tired has a slower blink and widening yawn; drained has heavy eyelids and a small animated frown. Focused keeps its eyes peacefully closed and breathes more slowly. Motion is suspended on screen blur, backgrounding, `still`, and the OS Reduce Motion setting. The friend pair has gentle idle movement only, without individual facial animation.

Native floating-counter eyes use artwork-coordinate Canvas eyelids with a heavier drained blink and matching small frown. Native assets require an Android rebuild. The app name, package IDs and launcher branding are not renamed by this character update.

Validation: 257 Jest tests passed, including animation lifecycle and mood/quote behavior; Android floating badge 3 tests passed. TypeScript, targeted lint and formatting passed. Final facial alignment and motion still need visual review on a device; automated tests do not establish pixel-perfect animation quality.
