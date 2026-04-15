// Type stubs for packages that are in package.json but may not be installed locally.
// Remove this file once 'npm install' has been run and all dependencies are present.

declare module 'expo-secure-store' {
  export function getItemAsync(key: string): Promise<string | null>;
  export function setItemAsync(key: string, value: string): Promise<void>;
  export function deleteItemAsync(key: string): Promise<void>;
}
