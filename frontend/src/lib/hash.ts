// Fingerprinting: SHA-256 computed in the browser so content never leaves the device.
// Articles are normalized first (spec FR-001a); images are hashed byte for byte.

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function toHex(buf: ArrayBuffer): string {
  return (
    "0x" +
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// CRLF / CR -> LF, then trim leading and trailing whitespace of the whole text.
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

export async function hashText(text: string): Promise<string> {
  const normalized = normalizeText(text);
  if (normalized === "") throw new Error("Content is empty");
  const bytes = new TextEncoder().encode(normalized);
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

export async function hashFile(file: File): Promise<string> {
  if (file.size === 0) throw new Error("Content is empty");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("File is larger than 10 MB");
  return toHex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
}
