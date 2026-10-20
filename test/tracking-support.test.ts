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
