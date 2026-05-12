import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(pin, salt, 64).toString("hex");

  return `${salt}:${derivedKey}`;
}

export function verifyPin(pin: string, storedHash?: string | null) {
  if (!storedHash) {
    return false;
  }

  const [salt, storedKey] = storedHash.split(":");

  if (!salt || !storedKey) {
    return false;
  }

  const derivedKey = scryptSync(pin, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(derivedKey, "hex"), Buffer.from(storedKey, "hex"));
}
