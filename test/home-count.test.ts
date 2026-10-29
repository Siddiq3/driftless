import { homeCountMessage } from '@/ui/homeCount';

test('shows friendly loading, empty and permission states without inventing a count', () => {
  expect(homeCountMessage('loading', null, false)?.title).toBe('Getting today ready');
  expect(homeCountMessage('error', null, false)?.title).toBe('Let’s reconnect');
  expect(homeCountMessage('ok', 0, true)?.title).toBe('A fresh start');
  expect(homeCountMessage('ok', null, false)?.detail).toBe('Enable counting to see your activity.');
  expect(homeCountMessage('ok', null, true)?.title).toBe('Ready when you are');
  expect(homeCountMessage('ok', 12, true)).toBeNull();
});

test('iPhone missing activity points to app pauses rather than unavailable video counting', () => {
  const message = homeCountMessage('ok', null, false, 'ios');
  expect(message?.detail).toContain('take a pause');
  expect(message?.detail).not.toContain('Enable counting');
  expect(homeCountMessage('ok', 12, false, 'ios')).toBeNull();
  expect(homeCountMessage('loading', null, false, 'ios')?.title).toBe('Getting today ready');
});
