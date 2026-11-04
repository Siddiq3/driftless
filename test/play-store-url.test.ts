import { PLAY_STORE_ID, playStoreUrl } from '../src/config/website';

test('play listing link matches the app package', () => {
  expect(playStoreUrl()).toBe(
    'https://play.google.com/store/apps/details?id=com.siddiqkolimi.scrollsnooze',
  );
  expect(PLAY_STORE_ID).toBe('com.siddiqkolimi.scrollsnooze');
});

test('shared links carry an encoded install referrer', () => {
  const url = new URL(playStoreUrl('wrapped_share'));
  expect(url.searchParams.get('id')).toBe(PLAY_STORE_ID);
  expect(url.searchParams.get('referrer')).toBe('utm_source=wrapped_share&utm_medium=share');
});
