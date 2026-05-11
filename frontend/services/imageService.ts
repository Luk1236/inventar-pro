import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.72;

/**
 * Compresses an image URI to max 1200px width at 72% JPEG quality.
 * Returns the compressed URI, or the original URI on failure.
 */
export async function compressImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_WIDTH } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    return uri;
  }
}

/**
 * Compresses an image URI and returns it as a base64 string (without data URI prefix).
 */
export async function compressImageToBase64(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_WIDTH } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return result.base64 ?? '';
  } catch {
    return '';
  }
}
