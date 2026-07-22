// Pickup/delivery city and state are stored as separate fields (contact = city,
// address = state) — this combines them for display so city isn't silently dropped.
// Older orders (created before the city/state split) stored a full street address
// in `address` and an unrelated contact phone in `contact` — only combine the two
// when `address` looks like a bare 2-letter state code, otherwise the address is
// already complete and `contact` shouldn't be glued onto it.
export function formatLocation(address?: string | null, contact?: string | null): string {
  const isStateCodeOnly = !!address && address.trim().length <= 2;
  if (contact && isStateCodeOnly) return `${contact}, ${address}`;
  return address || contact || '';
}
