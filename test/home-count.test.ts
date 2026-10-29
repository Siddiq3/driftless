import { homeCountMessage } from '@/ui/homeCount';

test('shows friendly loading, empty and permission states without inventing a count', () => {
  expect(homeCountMessage('loading', null, false)?.title).toBe('Getting today ready');
  expect(homeCountMessage('error', null, false)?.title).toBe('Let’s reconnect');
  expect(homeCountMessage('ok', 0, true)?.title).toBe('A fresh start');
  expect(homeCountMessage('ok', null, false)?.detail).toBe('Enable counting to see your activity.');
  expect(homeCountMessage('ok', null, true)?.title).toBe('Ready when you are');
  expect(homeCountMessage('ok', 12, true)).toBeNull();
});
