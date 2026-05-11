/**
 * Tests — Utility / Helper Functions
 * ====================================
 * Pure function tests — no DOM, no API calls. Fast.
 */

// ---------------------------------------------------------------------------
// Fee formatting helpers (common across Fees, Finance, Reports)
// ---------------------------------------------------------------------------
describe('Currency formatting', () => {
  const formatCurrency = (amount: number, currency = 'INR'): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toContain('0');
  });

  it('formats a typical fee amount', () => {
    const result = formatCurrency(5000);
    expect(result).toContain('5,000');
  });

  it('formats large amounts with Indian comma grouping', () => {
    const result = formatCurrency(100000);
    expect(result).toContain('1,00,000');
  });
});

// ---------------------------------------------------------------------------
// Admission number validation
// ---------------------------------------------------------------------------
describe('Admission number validation', () => {
  const isValidAdmissionNumber = (num: string): boolean => {
    return /^[A-Z0-9-]{4,20}$/.test(num.trim().toUpperCase());
  };

  it('accepts standard format ADM-001', () => {
    expect(isValidAdmissionNumber('ADM-001')).toBe(true);
  });

  it('accepts all-numeric admission numbers', () => {
    expect(isValidAdmissionNumber('20250001')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidAdmissionNumber('')).toBe(false);
  });

  it('rejects numbers that are too short', () => {
    expect(isValidAdmissionNumber('A1')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidAdmissionNumber('ADM@001')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Date utilities (used across Attendance, Exams, Fees)
// ---------------------------------------------------------------------------
describe('Date utilities', () => {
  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const isValidDateString = (d: string): boolean => {
    return !isNaN(Date.parse(d));
  };

  it('formats ISO date to readable format', () => {
    const result = formatDate('2025-06-01');
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2025/);
  });

  it('validates a correct ISO date string', () => {
    expect(isValidDateString('2025-04-01')).toBe(true);
  });

  it('rejects an invalid date string', () => {
    expect(isValidDateString('not-a-date')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phone number validation (India)
// ---------------------------------------------------------------------------
describe('Phone number validation', () => {
  const isValidIndianPhone = (phone: string): boolean => {
    return /^[6-9]\d{9}$/.test(phone.replace(/\s|-/g, ''));
  };

  it('accepts valid 10-digit Indian mobile number', () => {
    expect(isValidIndianPhone('9876543210')).toBe(true);
  });

  it('accepts number starting with 6', () => {
    expect(isValidIndianPhone('6500001234')).toBe(true);
  });

  it('rejects numbers starting with 5', () => {
    expect(isValidIndianPhone('5123456789')).toBe(false);
  });

  it('rejects 11-digit number', () => {
    expect(isValidIndianPhone('98765432100')).toBe(false);
  });

  it('rejects 9-digit number', () => {
    expect(isValidIndianPhone('987654321')).toBe(false);
  });

  it('handles numbers with spaces', () => {
    expect(isValidIndianPhone('98765 43210')).toBe(true);
  });
});
