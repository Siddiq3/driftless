# Local meme breaks

Current selection/copy behavior is documented in [MEME-POPUPS.md](../MEME-POPUPS.md). The following
notes describe the original visual/interaction implementation; its static-art, three-caption and
phone-language-only selection descriptions are superseded by that document.

## Original visual implementation

Every newly crossed 50-video milestone (50, 100, 150, …) in the combined Reels + Shorts daily count can show a native animated card over the detected player. The bundled original reaction art and short caption automatically follow the phone’s configured languages, preferring the first supported regional language over English. There is no language selector and old manual overrides are ignored. Telugu uses a dramatic facepalm illustration; other supported languages use a side-eye reaction. Captions rotate over three milestones. Supported caption/button languages: Telugu, English, Hindi, Tamil, Kannada, Malayalam. Phones with no supported regional language configured fall back to English; the country alone never selects a language. No location/state inference or location permission is used.

Cards work offline and without login, using the already-consented accessibility service and floating counter setting. Counter → Meme breaks disables cards. Outside tap, ×, and Continue scrolling dismiss; Take a break opens Driftless. These controls never simulate input or pause media in another app. The underlying player can still play audio; the app does not control it.

The counter pauses recording while the card is visible; surface classification continues so leaving the player dismisses the card. The overlay is removed on leaving the recognized player, screen lock/off, revoked consent, counter disable, interruption, or service shutdown. New crossings only: old milestones are not replayed on reconnect or a new day. The last shown milestone/date persist locally, and are removed by Delete everything on this phone. Counts marked unconfirmed retain that label; visual feedback does not certify tracking accuracy or change goal results. Entrance animations follow the Android animator setting.

Reference: inspected eight frames from the user's 8.6-second video dated 19 October, 16:54. Rounded dark card, count pill, meme, caption and two actions reproduce the interaction structure. Original illustrations replace the reference's movie clip. No backend, media downloads, geo lookup, or additional permissions are needed.
