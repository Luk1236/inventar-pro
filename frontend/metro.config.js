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
  // Force CJS resolution for zustand on web to avoid the .mjs files that
  // contain `import.meta.env.MODE` (Vite-style). The CJS build at
  // node_modules/zustand/<sub>.js does not use import.meta.
  if (moduleName === "zustand") {
    return {
      filePath: path.resolve(__dirname, "node_modules/zustand/index.js"),
      type: "sourceFile",
    };
  }
  if (moduleName.startsWith("zustand/")) {
    return {
      filePath: path.resolve(
        __dirname,
        "node_modules/zustand",
        moduleName.slice("zustand/".length) + ".js"
      ),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Fix: three-mesh-bvh worker files use import.meta — include them in Babel
// transformation so the transform-import-meta plugin can process them.
// Keep the Expo default exception list AND add three-mesh-bvh / stats-gl,
// otherwise expo-router / react-native stop being transformed.
config.transformer.transformIgnorePatterns = [
  "node_modules/(?!(@react-native|react-native|expo(-[a-z]+)?|@expo|@unimodules|unimodules|sentry-expo|native-base|react-native-svg|three-mesh-bvh|stats-gl|zustand)/)",
];

module.exports = config;
