/**
 * UUID utility function with HTTP compatibility
 * Always uses Math.random() - works on HTTP and HTTPS environments
 * crypto.randomUUID() requires HTTPS/localhost, so we avoid it entirely
 */

export function generateUUID(): string {
  // Always use Math.random() based UUID - works everywhere!
  // This is the ONLY reliable method for HTTP environments like Azure VM
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}