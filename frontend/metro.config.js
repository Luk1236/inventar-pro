const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.maxWorkers = 2;

// Fix: Expo 54 uses the ESM exports field of three.js which contains
// import.meta — Metro can't handle this. Force the CJS build instead.
// Also redirect nested three copies inside stats-gl to the same CJS build.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return {
      filePath: path.resolve(
        __dirname,
        "node_modules/three/build/three.cjs"
      ),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Fix: three-mesh-bvh worker files use import.meta — include them in Babel
// transformation so the transform-import-meta plugin can process them.
const defaultIgnore = config.transformer.transformIgnorePatterns || [
  "node_modules/(?!(@react-native|react-native|expo(-[a-z]+)?|@expo|@unimodules|unimodules|sentry-expo|native-base|react-native-svg)/)",
];
// Replace or append: exclude three-mesh-bvh and stats-gl from being ignored
config.transformer.transformIgnorePatterns = [
  "node_modules/(?!(three-mesh-bvh|stats-gl)/)",
];

module.exports = config;
