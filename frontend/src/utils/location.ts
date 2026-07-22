// Pickup/delivery city and state are stored as separate fields (contact = city,
// address = state) — this combines them for display so city isn't silently dropped.
export function formatLocation(address?: string | null, contact?: string | null): string {
  if (contact && address) return `${contact}, ${address}`;
  return contact || address || '';
}
