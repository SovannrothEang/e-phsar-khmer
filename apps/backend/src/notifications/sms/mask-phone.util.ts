/**
 * Masks a phone number for the `sms_deliveries` audit trail — enough to
 * recognise which number an attempt went to without the table itself being
 * a usable list of real numbers. Keeps the last 2 digits, replaces the rest
 * with `*`. `null`/empty stays `null` (no phone to mask — `isPrimary` was
 * never set, or the lookup came back empty).
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 2)}${digits.slice(-2)}`;
}
