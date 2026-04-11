// frontend/__tests__/apiService.test.ts
/**
 * Tests für apiService.ts — URL-Logik und Auth-Header
 */
import { getBackendUrl, setBackendUrl } from '../services/apiService';

describe('apiService URL-Logik', () => {
  afterEach(() => {
    // Reset runtime override nach jedem Test
    setBackendUrl('http://localhost:8000');
  });

  it('getBackendUrl() gibt Standard-URL zurück', () => {
    // Nach Reset soll Standard-URL gelten
    const url = getBackendUrl();
    expect(url).toMatch(/^http/);
    expect(url).not.toContain(' ');
    expect(url).not.toContain('undefined');
  });

  it('setBackendUrl() überschreibt die URL', () => {
    setBackendUrl('http://192.168.1.100:8002');
    expect(getBackendUrl()).toBe('http://192.168.1.100:8002');
  });

  it('setBackendUrl() entfernt trailing slash', () => {
    setBackendUrl('http://192.168.1.100:8002/');
    expect(getBackendUrl()).toBe('http://192.168.1.100:8002');
  });

  it('getBackendUrl() gibt keine undefined oder leere URL zurück', () => {
    const url = getBackendUrl();
    expect(url).toBeTruthy();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(5);
  });
});
