module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    'expo-secure-store': '<rootDir>/__mocks__/expo-secure-store.js',
    'expo-modules-core': '<rootDir>/__mocks__/expo-modules-core.js',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.js',
    '^expo/src/winter/runtime\\.native(\\.ts)?$': '<rootDir>/__mocks__/empty.js',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.js',
  },
};
