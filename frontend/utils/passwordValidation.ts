export function validatePasswordChange(current: string, newPw: string, confirm: string): string | null {
  if (!current) {
    return 'Bitte aktuelles Passwort eingeben.';
  }
  if (newPw.length < 8) {
    return 'Neues Passwort muss mindestens 8 Zeichen lang sein.';
  }
  if (newPw !== confirm) {
    return 'Neues Passwort und Bestätigung stimmen nicht überein.';
  }
  return null;
}
