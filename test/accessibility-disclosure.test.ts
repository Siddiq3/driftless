import {
  ACCESSIBILITY_DISCLOSURE,
  ACCESSIBILITY_SHEET_POINTS,
} from '@/permissions/accessibilityDisclosure';

const sheet = ACCESSIBILITY_SHEET_POINTS.map((p) => `${p.title} ${p.body}`).join(' ');
const full = ACCESSIBILITY_DISCLOSURE.map((p) => `${p.title} ${p.body}`).join(' ');

test.each([
  ['consent sheet', sheet],
  ['full disclosure', full],
])('%s states diagnostics and what is actually backed up', (_name, text) => {
  expect(text).toContain('Diagnostics and detection status');
  expect(text).toMatch(/whether it is running/);
  expect(text).toMatch(/No crash.* performance.* reports are collected through Accessibility/);
  expect(text).toMatch(/video counts, ad counts/);
  expect(text).toMatch(/request logs for 30 days/);
  expect(text).toMatch(/Reels and Shorts|Reels or Shorts/);
  expect(text).not.toMatch(/Only your daily totals|battle/i);
  expect(text).toMatch(/Signing in shares nothing with friends/);
  expect(text).toMatch(/including experimental counts/);
});

test('no wording claims the invitation page shows a name', () => {
  expect(`${sheet} ${full}`).not.toMatch(/invitation page/i);
});
