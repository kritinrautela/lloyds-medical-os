/*
 * The hospital number.
 *
 * Every person registered at the clinic gets one number for life. It is
 * printed on the card they keep, so it has to survive being read aloud across
 * a counter, copied onto a paper form, and typed back in by someone who is not
 * a confident reader.
 *
 * Format: LM-000148-7
 *   LM      the facility prefix
 *   000148  a sequential number, never reused
 *   7       a Luhn check digit
 *
 * The check digit is what makes the number worth having. A single mistyped
 * digit, and almost every transposition of two digits, fails the check
 * immediately, so the clerk is told at the counter instead of a second record
 * being opened for a patient who already exists.
 */

const PREFIX = 'LM';
const SERIAL_LENGTH = 6;

function luhnCheckDigit(digits) {
  let sum = 0;
  let double = true; // the check digit sits to the right, so doubling starts here
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits.charCodeAt(i) - 48;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

function formatHospitalNumber(serial) {
  const digits = String(serial).padStart(SERIAL_LENGTH, '0');
  return `${PREFIX}-${digits}-${luhnCheckDigit(digits)}`;
}

function isValidHospitalNumber(value) {
  if (typeof value !== 'string') return false;
  const match = value.trim().toUpperCase().match(/^([A-Z]{2})-(\d{4,10})-(\d)$/);
  if (!match) return false;
  return luhnCheckDigit(match[2]) === Number(match[3]);
}

// Accepts what a person actually types: lower case, missing dashes, spaces.
function normaliseHospitalNumber(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toUpperCase().replace(/[\s.]/g, '');
  const compact = cleaned.match(/^([A-Z]{2})-?(\d{4,10})-?(\d)$/);
  if (!compact) return null;
  const candidate = `${compact[1]}-${compact[2]}-${compact[3]}`;
  return isValidHospitalNumber(candidate) ? candidate : null;
}

module.exports = {
  PREFIX,
  SERIAL_LENGTH,
  formatHospitalNumber,
  isValidHospitalNumber,
  normaliseHospitalNumber,
  luhnCheckDigit
};
