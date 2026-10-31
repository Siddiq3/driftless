export const ACCESSIBILITY_SHEET_TITLE = 'Allow Accessibility permission to count Reels and Shorts';

/** Short summary; shown above the buttons without expanding the full disclosure. */
export const ACCESSIBILITY_SHEET_POINTS = [
  {
    title: 'What it reads',
    body: 'Only in Instagram and YouTube: app and scroll events and screen structure. On Reels and Shorts screens it also reads visible text and content descriptions. This is used to count the Reels and Shorts you watch, measure your time on them, show your count, goal alerts and meme breaks, and apply pauses you set. This runs even when ScrollSnooze is closed.',
  },
  {
    title: 'Diagnostics and detection status',
    body: 'From these events the service works out, on this phone, whether it is running, whether a Reel or Short was recognised, and whether a day’s count is experimental. This keeps your status and counts correct. No crash or performance reports are collected through Accessibility.',
  },
  {
    title: 'Stored on this phone',
    body: 'Video and ad counts, viewing time and dates, plus timestamped viewing events kept for about 30 days.',
  },
  {
    title: 'After you sign in',
    body: 'Daily and per-app video counts, ad counts, minutes and goals are backed up automatically, with the date, your timezone and a random device ID. Our servers keep request logs for 30 days (route, status, duration, request ID and error type). Signing in shares nothing with friends. If you accept an invitation, or someone accepts yours, that friend can see your daily Reels and Shorts count, including experimental counts. If you don’t sign in, this data stays on this phone.',
  },
  {
    title: 'Screen content never leaves your phone',
    body: 'Including messages and passwords. No screenshots are taken.',
  },
  {
    title: 'Your choice',
    body: 'Turn this off anytime in Android Settings > Accessibility.',
  },
] as const;

/** Version 4 disclosure. Keep all sections visible before consent and on return visits. */
export const ACCESSIBILITY_DISCLOSURE = [
  {
    title: 'Why we use Android AccessibilityService',
    body: 'ScrollSnooze uses Android AccessibilityService for one purpose: to count the Instagram Reels and YouTube Shorts you watch and measure the time you spend on them, so it can show your count, goal alerts, meme breaks and the pauses you configure, even when ScrollSnooze is closed. The service receives events only from Instagram and YouTube. Video detection is experimental. Separate Usage Access, if you allow it, supplies Instagram and YouTube app minutes.',
  },
  {
    title: 'What is processed temporarily',
    body: 'In Instagram and YouTube, the service reads app and foreground-window activity, accessibility events for window changes and scrolling, resource IDs, view classes, visibility and interface structure to recognize players. Only while a Reels or Shorts player is on screen, it also reads visible interface text and content descriptions to detect item changes and identify ads. Text is processed in memory for detection and converted into salted one-way identifiers, held in memory only, to avoid counting the same item twice. Raw text and captions are not saved. Meme breaks use your phone’s language setting; which memes you have seen is stored locally so they don’t repeat, and is not included in account backup.',
  },
  {
    title: 'Diagnostics and detection status',
    body: 'From these events the service works out, on this phone, whether it is running, whether a Reel or Short was recognised, and whether a day’s count is experimental, so it can show correct status and counts. This status is not sent as a separate report; backup keeps verified video totals apart from experimental ones. No crash, performance or analytics reports are collected through Accessibility. Our servers separately keep request logs for 30 days (route, status, duration, request ID and error type), which are not Accessibility data.',
  },
  {
    title: 'What stays on this phone',
    body: 'We save counts, ad counts, viewing time and dates per app, plus timestamped viewing events for about 30 days to show hourly activity and your daily recap, and whether a day’s count is experimental. Signed-in accounts also keep local account-limit totals and event IDs. Developer debug builds can create local event exports and interface-structure captures for accuracy testing, shared only when explicitly requested.',
  },
  {
    title: 'What is backed up when you sign in',
    body: 'Guest progress stays on this phone unless you sign in. Signing in automatically backs up daily and per-app video counts, ad counts, minutes and goals to your ScrollSnooze account on Amazon Web Services, with the date, timezone and a random device ID that keeps each phone’s totals separate and supports account-wide limits. Private video totals can include experimental counts. Progress already on this phone can be added to your account when you sign in. Screen content never leaves your phone: raw accessibility text, captions, UI trees and viewing events are not included in account backup. Signing in shares nothing with friends. When you accept an invitation, or someone accepts yours, that friend can see your daily Reels and Shorts count from that day on, including experimental counts, and your Google account name. Delete the friend to stop. Sign out to stop automatic account backup.',
  },
  {
    title: 'Pauses and your choice',
    body: 'Optional feed pauses cover a detected Reels or Shorts player. The Leave feed button performs Android Back only when you press it; system navigation remains available. Choose Not now or go back to decline without enabling accessibility tracking. You can keep using the app, and Instagram and YouTube minutes work if you separately allow Usage Access. To revoke access at any time, turn off ScrollSnooze in Android Accessibility settings. You can read this explanation again from Privacy.',
  },
] as const;
