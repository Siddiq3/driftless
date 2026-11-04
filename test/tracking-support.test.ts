jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));
import { requireOptionalNativeModule } from 'expo';

it('an absent native binary reports no supported tracking features', () => {
  jest.isolateModules(() => {
    jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
    const { Tracking } = require('tracking-android');
    expect(Tracking.runtimeSupport()).toEqual({ counting: false, minutes: false, blocking: false });
  });
});
it('older binaries report only methods that actually exist', () => {
  jest.isolateModules(() => {
    jest
      .mocked(requireOptionalNativeModule)
      .mockReturnValue({ getHealth: jest.fn(), getDaily: jest.fn() });
    const { Tracking } = require('tracking-android');
    expect(Tracking.runtimeSupport()).toEqual({ counting: true, minutes: false, blocking: false });
  });
});
it('meme on/off and language setters keep each other, and old binaries default to auto', () => {
  jest.isolateModules(() => {
    let saved = { enabled: true, language: 'te' };
    const native = {
      memePreferences: jest.fn(() => saved),
      setMemePreferences: jest.fn((enabled: boolean, language: string) => {
        saved = { enabled, language };
      }),
    };
    jest.mocked(requireOptionalNativeModule).mockReturnValue(native);
    const { Tracking } = require('tracking-android');
    Tracking.setMemePreferences(false);
    expect(saved).toEqual({ enabled: false, language: 'te' });
    Tracking.setMemeLanguage('hi');
    expect(saved).toEqual({ enabled: false, language: 'hi' });
    native.memePreferences.mockReturnValue({ enabled: true } as typeof saved);
    expect(Tracking.memePreferences()).toEqual({ enabled: true, language: 'auto' });
  });
});
