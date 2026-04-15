import { Alert } from 'react-native';

// We'll manipulate Platform.OS via jest.mock
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  return {
    ...rn,
    Platform: { ...rn.Platform, OS: 'ios' },
    Alert: { alert: jest.fn() },
  };
});

describe('printScreen', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('on web platform, calls window.print()', () => {
    // Set Platform.OS to 'web' before importing
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
      Alert: { alert: jest.fn() },
    }));

    const printMock = jest.fn();
    (global as any).window = { print: printMock };

    const { printScreen } = require('../utils/printUtils');
    printScreen();

    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it('on non-web platform, does not throw', () => {
    const alertMock = jest.fn();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
      Alert: { alert: alertMock },
    }));

    const { printScreen } = require('../utils/printUtils');

    expect(() => printScreen()).not.toThrow();
    expect(alertMock).toHaveBeenCalledWith('Info', 'Drucken ist nur im Browser verfügbar.');
  });
});
