# Product Specification — Driftless (working name)

Status: Draft for Phase 0 review · Reviewed 2026-10-18

## 1. Product identity
- **Name:** Driftless (placeholder; requires trademark + store-name search — D-001).
- **Promise:** "See how much you drift into short-video feeds, and steer back." Calm, non-shaming tone.
- **Mascot:** an original character — a small, lantern-like brain sprite called **"Wick"** whose glow brightens with mindful days and dims (never "rots") with heavy-scroll days. All artwork, animation and copy are original; nothing is derived from the reference app's branding, UI, or assets.
- **Visual language:** deep indigo night background, warm amber glow accents, rounded geometric type (candidate: Inter for UI, an open-licence display face for headings — licence check in Phase 1).

## 2. Target users
Adults (18+ for the initial release, D-010) who want to reduce compulsive short-video use on their own device. No parent/child monitoring in v1.

## 3. Features and tiers

| # | Feature | Tier | Android | iOS | Notes |
|---|---|---|---|---|---|
| F1 | Short-video view count (Reels, Shorts) | Free | PoC-gated (G-2) | **Not offered** | Per supported app + version; shows a coverage/quality badge |
| F2 | Per-app daily time in selected apps | Free | UsageStats | DeviceActivityReport (display-only) | |
| F3 | Daily goal (count or minutes) + reminders | Free | ✓ | Minutes only (threshold events) | |
| F4 | Streaks & milestones | Free | ✓ | ✓ (from threshold "goal kept" signal, local only) | |
| F5 | Wick brain progression | Free | ✓ | ✓ | Driven by goal adherence, not raw usage |
| F6 | Daily history & basic charts | Free | ✓ | ✓ (iOS charts live in report extension) | |
| F7 | Weekly/monthly analytics, trends | Pro | ✓ | ✓ (in extension) | |
| F8 | App blocking at limit | Pro | Own blocking screen via accessibility (user can always exit/disable) | ManagedSettings shield | |
| F9 | Schedules (focus hours, bedtime) | Pro | ✓ | ✓ DeviceActivitySchedule | |
| F10 | Friends, invites | Free | ✓ | ✓ | |
| F11 | Challenges & leaderboards | Free (join) / Pro (create custom) | Shared aggregate counts (consented) | **Self-reported check-ins only** unless G-5 passes | |
| F12 | Themes / Wick customisation | Pro | ✓ | ✓ | |
| F13 | Cloud backup & multi-device history | Free with account | ✓ | ✓ (only non-Screen-Time data) | |
| F14 | Privacy centre: export, delete account, sync toggle | Free | ✓ | ✓ | |

**Rule:** free tracking never depends on Pro, and blocking never depends on the backend being reachable.

## 4. Definitions (counting) — authoritative
- **Candidate short-video surface:** a foreground window of a supported app classified as its short-video player.
- **Confirmed item transition:** the surface's current item fingerprint changes to a fingerprint not seen in the current session's recent window, observed by ≥ 2 independent signals (D-007).
- **Counted view:** a confirmed item transition whose item stayed in the foreground ≥ **1.5 s** (dwell threshold; tunable after PoC). Ads count separately as `ad_view` and are excluded from the headline number.
- **Unknown content:** surface detected but item identity cannot be established → contributes to *time on surface* but not to view count.
- **Tracking unavailable:** service disabled, permission missing, unsupported app version → no counts; UI shows a gap, never zeros.
An app merely being open is never evidence a video was watched.

## 5. Non-goals (v1)
Monitoring other people; web/desktop; content analysis; reading messages; tablets for iOS Screen Time beyond what the API supports; Wear OS.

## 6. Success metrics
D7 retention, % of days with goal kept, permission-health rate (% of active days with tracking available), accuracy on labelled sessions (G-2).
