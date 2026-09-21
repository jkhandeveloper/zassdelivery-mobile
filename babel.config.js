module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      // `jsxImportSource: "nativewind"` is what lets a plain <View className="…">
      // work: NativeWind's jsx runtime reads the prop. Without it every styled
      // component would have to be wrapped in `styled()` by hand.
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
