import crypto from "node:crypto";
import { env } from "@/config/env.js";

// AES-256-GCM field-level encryption for at-rest sensitive fields (retailer
// bank account numbers). This is a stopgap for a demo/mock payout flow — a
// production build should route bank/UPI details through a PCI-compliant
// processor (Razorpay/Stripe Connect) and never persist raw account numbers
// at all, encrypted or not.

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(env.FIELD_ENCRYPTION_KEY, "hex");

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptField(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed encrypted field payload");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Last 4 digits only — safe to send to any client that just needs to confirm identity. */
export function maskAccountNumber(accountNumber: string): string {
  return accountNumber.slice(-4).padStart(accountNumber.length, "•");
}
