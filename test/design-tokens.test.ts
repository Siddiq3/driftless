import { contrast, dark, light, TEXT_PAIRS, type Theme } from '../src/design-tokens';

describe('contrast()', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });
  it('rejects malformed colours', () => {
    expect(() => contrast('red', '#fff')).toThrow();
  });
});

describe.each([
  ['dark', dark],
  ['light', light],
] as const)('%s theme meets WCAG AA (4.5:1) for every text pair', (_name, theme: Theme) => {
  const cases: Array<[keyof Theme, keyof Theme]> = TEXT_PAIRS.map(([fg, bg]) => [fg, bg]);
  it.each(cases)('%s on %s', (fg: keyof Theme, bg: keyof Theme) => {
    expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
