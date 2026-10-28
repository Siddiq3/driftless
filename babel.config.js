module.exports = function (api) {
  api.cache(true);
  // Expo adds react-native-worklets/plugin for Reanimated 4 automatically.
  return { presets: ['babel-preset-expo'] };
};
