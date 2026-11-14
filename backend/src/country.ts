// Paises que opera OSI Logistics. Se guardan siempre con el mismo texto en users.country.
//   Dispatchers: Estados Unidos y Colombia.   Drivers: Estados Unidos y Canada.
export const COUNTRIES = ['United States', 'Colombia', 'Canada'] as const;
export type Country = (typeof COUNTRIES)[number];

function key(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Devuelve el nombre canonico del pais, o '' si no es uno de los tres conocidos. */
export function canonicalCountry(raw: unknown): Country | '' {
  const k = key(raw);
  if (['colombia', 'co'].includes(k)) return 'Colombia';
  if (['canada', 'ca'].includes(k)) return 'Canada';
  if (['united states', 'usa', 'us', 'u.s.', 'u.s.a.', 'estados unidos', 'eeuu', 'ee.uu.'].includes(k)) return 'United States';
  return '';
}

// ---------------------------------------------------------------------------
// Drivers de Canada (ver Project 1.0/info/canada-requisitos-driver.md)
// ---------------------------------------------------------------------------
export const CA_PROVINCES = ['ON', 'QC', 'AB', 'BC', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'] as const;
export const CA_SCOPES = ['domestic', 'interprovincial', 'cross_border'] as const;
export const CA_LICENSE_CLASSES = ['1', 'A', 'D', 'DZ', 'G', 'other'] as const;

/** Errores de validacion de un registro de driver canadiense (lista vacia = todo bien). */
export function validateCanadianDriver(input: {
  province?: string; operating_scope?: string; license_class?: string; carrier_number?: string;
  business_number?: string; gst_hst_number?: string; dot_number?: string; cbsa_carrier_code?: string;
  heavy: boolean;
}): string[] {
  const errs: string[] = [];
  if (!(CA_PROVINCES as readonly string[]).includes(String(input.province))) errs.push('Provincia no válida');
  if (!(CA_SCOPES as readonly string[]).includes(String(input.operating_scope))) errs.push('Alcance de operación no válido');
  if (!(CA_LICENSE_CLASSES as readonly string[]).includes(String(input.license_class))) errs.push('Clase de licencia no válida');
  // Equipo pesado (tractor-remolque): hace falta el numero del perfil de carrier de la provincia (NSC / SFC / CVOR / NIR).
  if (input.heavy && !String(input.carrier_number || '').trim()) errs.push('Falta el número NSC / CVOR / NIR de la provincia');
  const bn = String(input.business_number || '').replace(/\s/g, '');
  if (bn && !/^\d{9}(RC\d{4})?$/i.test(bn)) errs.push('El Business Number (BN) tiene 9 dígitos');
  const gst = String(input.gst_hst_number || '').replace(/\s/g, '');
  if (gst && !/^\d{9}RT\d{4}$/i.test(gst)) errs.push('El número GST/HST tiene el formato 123456789RT0001');
  if (input.operating_scope === 'cross_border') {
    if (!String(input.dot_number || '').trim()) errs.push('Para cruzar a EE. UU. hace falta el número USDOT');
    if (!/^[A-Z0-9]{4}$/i.test(String(input.cbsa_carrier_code || '').trim())) errs.push('El código de carrier de CBSA tiene 4 caracteres');
  }
  return errs;
}
