import { isValidBase64Image } from '../utils/imageUtils';

describe('isValidBase64Image', () => {
  // Test 1: returns true for valid data:image/ string
  it('returns true for valid data:image/ string', () => {
    expect(isValidBase64Image('data:image/jpeg;base64,/9j/abc123')).toBe(true);
  });

  // Test 2: returns false for empty string
  it('returns false for empty string', () => {
    expect(isValidBase64Image('')).toBe(false);
  });

  // Test 3: returns false for plain text
  it('returns false for plain text', () => {
    expect(isValidBase64Image('hello world')).toBe(false);
  });
});
