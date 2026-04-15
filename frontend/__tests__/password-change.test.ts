// frontend/__tests__/password-change.test.ts

import { validatePasswordChange } from '../utils/passwordValidation';

describe('validatePasswordChange', () => {
  it('returns error when new password is less than 8 characters', () => {
    const result = validatePasswordChange('currentPass', 'short', 'short');
    expect(result).toBe('Neues Passwort muss mindestens 8 Zeichen lang sein.');
  });

  it('returns error when new password and confirm password do not match', () => {
    const result = validatePasswordChange('currentPass', 'newpassword1', 'newpassword2');
    expect(result).toBe('Neues Passwort und Bestätigung stimmen nicht überein.');
  });

  it('returns error when current password is empty', () => {
    const result = validatePasswordChange('', 'newpassword1', 'newpassword1');
    expect(result).toBe('Bitte aktuelles Passwort eingeben.');
  });

  it('returns null when all inputs are valid', () => {
    const result = validatePasswordChange('currentPass', 'newpassword1', 'newpassword1');
    expect(result).toBeNull();
  });
});
