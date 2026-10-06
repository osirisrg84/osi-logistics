// Several tables rely on SQLite's `datetime('now')` as a column DEFAULT,
// which stores UTC as "YYYY-MM-DD HH:MM:SS" with no 'T' and no timezone
// marker. Browsers (V8/Chrome, used by the Android WebView this app mostly
// runs in) parse that exact shape as LOCAL time instead of UTC, so every one
// of those timestamps reads off by the device's UTC offset -- in Miami,
// consistently ~4 hours, which is why "just now" notifications were
// showing up as "4 hours ago/in 4 hours" no matter when they were created.
// Timestamps built explicitly with `new Date().toISOString()` already end in
// 'Z' and are unaffected -- this only normalizes the ambiguous shape before
// handing it to `new Date(...)`.
export function parseServerDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) {
    return new Date(value.replace(' ', 'T') + 'Z');
  }
  return new Date(value);
}
