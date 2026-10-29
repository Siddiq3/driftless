describe('Screen Time bridge build availability', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('expo');
  });

  test('UI-only build does not offer or call authorization and blocking', () => {
    const native = {
      controlsAvailable: () => false,
      authorize: jest.fn(),
      chooseApps: jest.fn(),
      setPaused: jest.fn(),
    };
    jest.doMock('expo', () => ({ requireOptionalNativeModule: () => native }));
    const { ScreenTime } = require('../modules/screen-time/src');
    expect(ScreenTime.supported()).toBe(false);
    expect(() => ScreenTime.authorize()).toThrow('UI-testing build');
    expect(() => ScreenTime.chooseApps()).toThrow('UI-testing build');
    expect(() => ScreenTime.setPaused(true)).toThrow('UI-testing build');
    expect(native.authorize).not.toHaveBeenCalled();
    expect(native.chooseApps).not.toHaveBeenCalled();
    expect(native.setPaused).not.toHaveBeenCalled();
  });

  test('normal native build retains authorization support', () => {
    const native = { controlsAvailable: () => true, authorize: jest.fn() };
    jest.doMock('expo', () => ({ requireOptionalNativeModule: () => native }));
    const { ScreenTime } = require('../modules/screen-time/src');
    expect(ScreenTime.supported()).toBe(true);
    ScreenTime.authorize();
    expect(native.authorize).toHaveBeenCalledTimes(1);
  });
});
