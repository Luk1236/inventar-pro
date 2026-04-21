module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Transforms import.meta (used by three.js ESM) to CJS-compatible code
      'transform-import-meta',
    ],
  }
}
