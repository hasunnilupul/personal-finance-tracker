import { createHmac } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, "").toUpperCase();

  let bits = "";

  for (const char of clean) {
    const value = BASE32.indexOf(char);

    if (value === -1) {
      throw new Error(`Not a base32 character: ${char}`);
    }

    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

/**
 * The code an authenticator app would show right now (RFC 6238: HMAC-SHA1,
 * 30-second steps, six digits — what the plugin issues by default).
 *
 * Written out rather than imported so the suite is checking the app against the
 * standard and not against the library the app is built on.
 */
export function totp(secretBase32: string, at: number = Date.now()): string {
  const counter = Math.floor(at / 1000 / 30);

  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", base32Decode(secretBase32)).update(message).digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return String(binary % 1_000_000).padStart(6, "0");
}
