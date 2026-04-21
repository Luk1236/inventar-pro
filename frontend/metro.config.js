const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.maxWorkers = 2;

// Fix: Expo 54 uses the ESM exports field of three.js which contains
// import.meta — Metro can't handle this. Force the CJS build instead.
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

module.exports = config;
