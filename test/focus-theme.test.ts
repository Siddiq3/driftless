import { contrast } from '../src/design-tokens';
import { focusTheme } from '../src/focus/theme';

const c = focusTheme.color;
it.each([c.background, c.canvasWarm, c.canvasMid, c.surface, c.hero, c.heroHighlight])(
  'keeps Focus text readable on %s, including the brightest hero gradient stop',
  (background) => {
    expect(contrast(c.text, background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.muted, background)).toBeGreaterThanOrEqual(4.5);
  },
);
it('keeps selected controls readable and unselected control boundaries discernible', () => {
  expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(c.controlBorder, c.background)).toBeGreaterThanOrEqual(3);
});
