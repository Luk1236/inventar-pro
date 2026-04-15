// Fix for Expo 54 + Jest: expo/winter/runtime.native.ts uses import.meta
// which doesn't exist in Jest's CommonJS environment
global.__ExpoImportMetaRegistry = new Map();

// React Native globals required by @testing-library/react-native
global.__DEV__ = false;
