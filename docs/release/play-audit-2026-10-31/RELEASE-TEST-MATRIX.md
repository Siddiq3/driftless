# Release test matrix: OnePlus CPH2569, Android 15

Evidence here is from debug test builds in this work or `ACCESSIBILITY_V3_DEVICE_VERIFICATION_2026-10-30.md` (older code).
**All must be re-run on the Play-installed release build.**

| Test | Existing evidence | Status |
|---|---|---|
| Fresh install | None | REQUIRED |
| Upgrade from Play 1.0.1 | None | REQUIRED |
| Disclosure, full sheet, Accept | Older UI only; new sheet not seen on device | REQUIRED |
| Deny, Not sure, re-trigger | Tests only | REQUIRED |
| Accessibility revocation | Older build | REQUIRED |
| Instagram Reels count | Test copy: 64, DB match, ads separate | Re-run |
| YouTube Shorts | Older build | REQUIRED |
| Wrong-screen: DMs, home feed, normal YouTube | None | REQUIRED |
| Time limit, video goal | None | REQUIRED |
| Feed break | Observed once (25 videos) | Re-run with new screen |
| New pause screen, Back, Home, Skip, Leave | Not seen | REQUIRED |
| Disable pauses | None | REQUIRED |
| Usage Access on and off | None | REQUIRED |
| Floating count | Seen in test copy | Re-run |
| Notifications | None | REQUIRED |
| Background, reboot, force stop (service toggled off on force stop observed) | Partial | REQUIRED |
| Offline | None | REQUIRED |
| Google sign-in, guest migration, sign-out, re-login, account switch | None on this build | REQUIRED |
| Deletion, in-app and web | None | REQUIRED, test account |
| Multi-device limits | None | REQUIRED |
| Daily wrap on a completed day, slides 3-5 | Partial | REQUIRED |
| TalkBack, large fonts, small screen | None | REQUIRED |
| In-app Legal pages, black restyle | Before restyle only | REQUIRED |
| super.money warning on Play build | Developer reported none on internal test | Re-confirm |

Automated: Jest 548 pass; native 247 pass at last run. Re-run all after Stage 2.
