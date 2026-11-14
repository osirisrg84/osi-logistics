// Documento fiscal del dispatcher segun su pais.
// Se guarda en users.ssn (nombre historico de la columna) junto con users.tax_id_type.
//   EE. UU.  -> SSN                       (formulario 1099)
//   Colombia -> Cedula de Ciudadania o NIT/RUT (no tiene SSN)

export type TaxIdType = 'ssn' | 'cedula' | 'nit';

export function isColombia(country?: string | null): boolean {
  const c = (country || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return c === 'colombia' || c === 'co';
}

export function effectiveTaxType(country?: string | null, stored?: string | null): TaxIdType {
  if (isColombia(country)) return stored === 'nit' ? 'nit' : 'cedula';
  return 'ssn';
}

// Valida y devuelve un mensaje de error (o '' si esta bien). Solo revisa el formato basico.
export function validateTaxId(type: TaxIdType, value: string): string {
  const digits = value.replace(/\D/g, '');
  if (type === 'ssn') return digits.length === 9 ? '' : 'invalidSsn';
  if (type === 'cedula') return digits.length >= 6 && digits.length <= 10 && /^[\d.\s]+$/.test(value.trim()) ? '' : 'invalidCedula';
  // NIT colombiano: 9 digitos + digito de verificacion (opcional con guion)
  return digits.length >= 9 && digits.length <= 11 && /^[\d.\s-]+$/.test(value.trim()) ? '' : 'invalidNit';
}

export function maskTaxId(type: TaxIdType, value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.length < 4) return value;
  return type === 'ssn' ? `***-**-${d.slice(-4)}` : `${'•'.repeat(Math.max(d.length - 4, 3))}${d.slice(-4)}`;
}
