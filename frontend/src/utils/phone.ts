// Formats a US phone number for display as "(305) 335-8114". Numbers are
// stored/typed in a mix of raw and partially-formatted shapes across the
// app (registration forms, demo seed data, driver profiles), so this just
// strips to digits and re-formats rather than assuming an input shape.
// Anything that isn't a recognizable 10 (or 1+10) digit US number is
// returned unchanged, so it degrades safely for non-US formats instead of
// mangling them.
export function formatPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
