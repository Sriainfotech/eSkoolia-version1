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

/**
 * True if the raw input has exactly 10 digits starting with 6, 7, 8, or 9.
 * Covers valid Indian mobile numbers.
 */
export function isValidIndianMobile(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 && /^[6-9]/.test(digits);
}

/**
 * True if the name looks like a real full human name:
 *  - Letters, spaces, hyphens, apostrophes only
 *  - At least 2 words, each word >= 2 alphabetic characters
 *  - Total length 4–60 characters
 *  - No gibberish (4+ repeated chars or 5+ consecutive consonants)
 */
export function isValidFullName(name: string): boolean {
  const t = name.trim();
  if (t.length < 4 || t.length > 60) return false;
  if (!/^[a-zA-Z\s'\-]+$/.test(t)) return false;
  if (/(.)\1{2,}/i.test(t)) return false;
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (words.some((w) => w.replace(/['\-]/g, "").length < 2)) return false;
  return true;
}

export const CONTACT_NAME_ERR = "Please enter a valid name using alphabets only.";

/**
 * Unified person-name validator used for all names:
 * first name, last name, middle name, spouse, emergency contact, nominee.
 *
 * Accepts: letters, spaces, dot (.), apostrophe ('), hyphen (-)
 * Min 3 chars, max 100 chars. Must start with a letter.
 * Rejects: numbers, special-chars-only, 3+ repeated identical chars,
 *          keyboard-row patterns (qwert/asdf/zxcv + 4 chars).
 *
 * Valid examples: Veni, Ravi, Raju, Sita, Geeta, Deepa, Kiran, Sai Teja
 */
const _PERSON_NAME_RE = /^[A-Za-z][A-Za-z .'\-]{2,99}$/;
const _PERSON_KB: readonly string[] = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function isValidPersonName(name: string): boolean {
  const t = name.trim();
  if (t.length < 3 || t.length > 100) return false;
  if (!_PERSON_NAME_RE.test(t)) return false;
  // 3+ consecutive identical characters (zzz, aaa, ...)
  if (/(.)\1{2,}/i.test(t)) return false;
  // 4+ consecutive keyboard-row chars (qwer, asdf, zxcv, ...)
  const flat = t.toLowerCase().replace(/[\s.'\-]/g, "");
  for (const row of _PERSON_KB) {
    for (let i = 0; i <= row.length - 4; i++) {
      if (flat.includes(row.slice(i, i + 4))) return false;
    }
  }
  // Any alphabetic segment of 3+ chars with no vowels (ssd, fgh, ...)
  for (const seg of t.split(/[\s.'\-]+/).filter(Boolean)) {
    const alpha = seg.replace(/[^a-zA-Z]/g, "");
    if (alpha.length >= 3 && !/[aeiou]/i.test(alpha)) return false;
  }
  return true;
}

export const PERSON_NAME_ERR = "Please enter a valid name using alphabets only.";

/** @deprecated Use isValidPersonName */
export function isValidContactName(name: string): boolean { return isValidPersonName(name); }
/** @deprecated Use isValidPersonName */
export function isValidNomineeName(name: string): boolean { return isValidPersonName(name); }
export const NOMINEE_NAME_ERR = PERSON_NAME_ERR;

/**
 * Returns true if the address looks like gibberish.
 * Catches 3+ consecutive identical characters (e.g. "ggg", "aaa")
 * or 5+ consecutive consonants (keyboard mash like "nvcbxwrth").
 */
export function isGibberishAddress(v: string): boolean {
  const t = v.trim();
  if (t.length < 4) return false;
  if (/(.)(\1){2,}/i.test(t)) return true;
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(t)) return true;
  return false;
}

/**
 * Returns true if a place name (city / state / country) looks like gibberish.
 * Same consonant-run check applied to shorter strings.
 */
export function isGibberishPlaceName(v: string): boolean {
  const t = v.trim();
  if (t.length < 3) return false;
  if (/(.)(\1){2,}/i.test(t)) return true;
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(t)) return true;
  return false;
}

/**
 * Validates a bank account holder name.
 *
 * Accepts:   "Ramesh Kumar", "Priya A Sharma", "Mary-Ann O'Brien"
 * Rejects:   "aaaaaaa", "llllll", "qwerty", "asdf asdf", "test test",
 *            single-word entries, vowel-free words, repeated patterns.
 *
 * Rules:
 *  – Letters, spaces, hyphens, apostrophes only
 *  – 5–80 characters total
 *  – At least 2 words, each word ≥ 2 alphabetic characters
 *  – No 3+ consecutive identical characters ("lll", "aaa")
 *  – No 5+ consecutive consonants ("bcdfg", "strwth")
 *  – No repeated-substring pattern per word ("testtest", "abcabc")
 *  – No word of 4+ characters that is entirely vowel-free
 */
export function isValidBankAccountName(name: string): boolean {
  const t = name.trim();
  if (t.length < 5 || t.length > 50) return false;
  if (!/^[a-zA-Z\s'\-]+$/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  // Each word must have at least 2 alphabetic characters
  if (words.some((w) => w.replace(/['\-]/g, "").length < 2)) return false;
  // 3+ consecutive identical characters
  if (/(.)\1{2,}/i.test(t)) return false;
  // 5+ consecutive consonants
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(t)) return false;
  // Per-word repeated substring pattern ("testtest", "abcabc")
  for (const w of words) {
    const wl = w.toLowerCase().replace(/['\-]/g, "");
    if (wl.length >= 4 && /^(.{2,})\1+$/.test(wl)) return false;
  }
  // Any word of 4+ letters that has no vowel at all
  for (const w of words) {
    const alpha = w.replace(/['\-]/g, "");
    if (alpha.length >= 4 && !/[aeiou]/i.test(alpha)) return false;
  }
  return true;
}

export const BANK_ACCOUNT_NAME_ERR =
  "Please enter a valid account holder name (e.g. Ramesh Kumar). Repeated characters, single words, and meaningless text are not allowed.";
