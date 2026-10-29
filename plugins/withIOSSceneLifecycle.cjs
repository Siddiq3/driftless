const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

/** Keep the generated native app compatible with iOS 27's scene lifecycle. */
function sceneAppDelegate(contents) {
  let result = contents;
  if (!result.includes('ExpoAppDelegate, ExpoReactNativeFactoryProvider')) {
    result = result.replace(
      'class AppDelegate: ExpoAppDelegate {',
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
    );
  }
  const legacyWindow =
    /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?launchOptions: launchOptions\)\s*#endif/;
  result = result.replace(
    legacyWindow,
    '// ExpoAppSceneDelegate creates the window and starts React Native.',
  );
  if (
    !result.includes('ExpoAppDelegate, ExpoReactNativeFactoryProvider') ||
    result.includes('window = UIWindow(frame: UIScreen.main.bounds)')
  ) {
    throw new Error('Unrecognized Expo AppDelegate; update the iOS scene lifecycle plugin.');
  }
  return result;
}

module.exports = function withIOSSceneLifecycle(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return mod;
  });
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') throw new Error('Expected a Swift AppDelegate.');
    mod.modResults.contents = sceneAppDelegate(mod.modResults.contents);
    return mod;
  });
};
module.exports.sceneAppDelegate = sceneAppDelegate;
