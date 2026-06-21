module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Worklets plugin MUST be last. Reanimated 4 moved the babel plugin from
    // react-native-reanimated/plugin to react-native-worklets/plugin.
    plugins: ["react-native-worklets/plugin"],
  };
};
