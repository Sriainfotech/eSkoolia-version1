export type MeaningfulValidationResult = {
  valid: boolean;
  error: string | null;
};

const keyboardPatterns = ["qwerty", "asdf", "zxcv", "qazwsx", "poiuy", "lkjh", "mnbv", "abcdef", "abcd", "jkl", "12345", "123456"];

export function validateMeaningfulText(value: string, fieldName: string): MeaningfulValidationResult {
  const text = String(value || "").trim();
  if (!text) {
    return { valid: true, error: null };
  }

  // Must contain at least one letter
  if (!/[A-Za-z]/.test(text)) {
    return { valid: false, error: `${fieldName} must contain at least one letter.` };
  }

  // Check for repeated character spam (aaa, fff, etc.)
  const repeatedCharTest = /(.)\1{2,}/;
  if (repeatedCharTest.test(text)) {
    return { valid: false, error: `Please enter a meaningful ${fieldName.toLowerCase()}.` };
  }

  // Check for keyboard patterns
  const lowered = text.toLowerCase().replace(/\s+/g, "");
  for (const pattern of keyboardPatterns) {
    if (lowered.includes(pattern)) {
      return { valid: false, error: `Please enter a meaningful ${fieldName.toLowerCase()}.` };
    }
  }

  // Check if mostly repeated character sequences
  const charGroups = lowered.match(/(.)\1*/g) || [];
  let repetitionScore = 0;
  for (const group of charGroups) {
    if (group.length >= 2) {
      repetitionScore += group.length;
    }
  }
  
  // If more than 40% repeated sequences, it's likely spam
  if (lowered.length >= 3 && repetitionScore > lowered.length * 0.4) {
    return { valid: false, error: `Please enter a meaningful ${fieldName.toLowerCase()}.` };
  }

  return { valid: true, error: null };
}
