export type MeaningfulValidationResult = {
  valid: boolean;
  error: string | null;
};

const keyboardPatterns = ["qwerty", "asdf", "zxcv", "qazwsx", "poiuy", "lkjh", "mnbv", "abcdef", "abcd", "jkl"];

export function validateMeaningfulText(value: string, fieldName: string): MeaningfulValidationResult {
  const text = String(value || "").trim();
  if (!text) {
    return { valid: true, error: null };
  }

  if (!/[A-Za-z]/.test(text)) {
    return { valid: false, error: `${fieldName} must contain at least one letter.` };
  }

  if (/(.)\1{2,}/.test(text)) {
    return { valid: false, error: `Please enter a meaningful ${fieldName.toLowerCase()}.` };
  }

  const lowered = text.toLowerCase().replace(/\s/g, "");
  for (const pattern of keyboardPatterns) {
    if (lowered.includes(pattern)) {
      return { valid: false, error: `Please enter a meaningful ${fieldName.toLowerCase()}.` };
    }
  }

  if (text.length >= 2 && /^(.)\1+$/.test(text.replace(/\s/g, ""))) {
    return { valid: false, error: `Please enter a meaningful ${fieldName.toLowerCase()}.` };
  }

  return { valid: true, error: null };
}
