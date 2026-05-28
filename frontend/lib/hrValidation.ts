/**
 * Shared validation utilities for the HR onboarding module.
 * Keep these pure functions — no side effects, no React imports.
 */

/** Returns true if v is a properly formatted email address. */
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/**
 * Returns true if the raw phone input is a valid phone number.
 * Strips non-digit characters before checking length (exactly 10 digits).
 */
export function isValidPhoneDigits(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10;
}

/**
 * Returns true if the pin is a valid postal code: 5 or 6 digits only.
 * Covers Indian PIN (6 digits) and common international postal codes.
 */
export function isValidPin(pin: string): boolean {
  return /^\d{5,6}$/.test(pin.trim());
}

/**
 * Returns true if the value contains at least one alphanumeric character.
 * Used to reject addresses that are only special characters.
 */
export function hasAlphanumeric(v: string): boolean {
  return /[a-zA-Z0-9]/.test(v.trim());
}
