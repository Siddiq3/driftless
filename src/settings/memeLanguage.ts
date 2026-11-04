import type { MemeLanguage } from 'tracking-android';

/** Native names so people can find their language without reading English. */
export const MEME_LANGUAGES: { value: MemeLanguage; label: string }[] = [
  { value: 'auto', label: 'Same as my phone' },
  { value: 'en', label: 'English' },
  { value: 'te', label: 'తెలుగు' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'kn', label: 'ಕನ್ನಡ' },
  { value: 'ml', label: 'മലയാളം' },
];

export const memeLanguageLabel = (value: MemeLanguage) =>
  MEME_LANGUAGES.find((l) => l.value === value)?.label ?? 'Same as my phone';
