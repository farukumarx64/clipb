export function hashText(value: string): string {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(16);
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const safeBytes = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", safeBytes.buffer);

  const hashArray = Array.from(new Uint8Array(digest));

  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}