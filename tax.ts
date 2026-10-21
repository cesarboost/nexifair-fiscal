// nexifair-fiscal · regla única de IVA para los servicios de Nexifair Limited (ReforLeads y Market).
// Importar SIEMPRE por etiqueta (inmutable): https://cdn.jsdelivr.net/gh/cesarboost/nexifair-fiscal@vX.Y.Z/tax.ts
//
// v1.1.0 (21/10/2026) — regla al emitir la factura, decidida por el propietario:
//   · Cliente en Chipre → 19 %.
//   · Cliente UE con VAT válido en VIES → 0 %, inversión del sujeto pasivo (empresa o autónomo: basta el NIF válido).
//   · Cliente UE sin VAT válido (empresa o particular) → tipo de su país, OSS (España 21 %).
//   · Canarias, Ceuta y Melilla → 0 % (fuera del territorio de IVA de la UE).
//   · Fuera de la UE → 0 %.
//   · Sin país → NO se decide: `reglaIva` devuelve un problema (la factura no se emite sola). `resolveTax` (cálculo del
//     importe antes de cobrar, que nunca se bloquea) sigue usando 21 % con aviso.
//   · España sin código postal → 21 % con aviso (no se puede descartar Canarias).
//   · Tipos generales revisados contra la tabla oficial de la Comisión Europea (Your Europe, «VAT rules and rates»,
//     revisada el 13/07/2026): Estonia 24 % (desde 01/07/2025) y Rumanía 21 % (desde 01/08/2025); el resto, sin cambios.
//   · Grecia: ISO «GR»; la UE y VIES usan «EL». Se aceptan los dos.
// v1.0.1 (24/08/2026): primera versión común.

export type TaxTreatment =
  | 'cyprus_domestic' | 'es_vat_21' | 'es_out_of_scope'
  | 'reverse_charge'  | 'eu_b2c_vat' | 'export_no_eu';

export interface TaxInput {
  country_code: string | null;
  postal_code: string | null;
  customer_type: string | null; // 'empresa' | 'particular' (informativo desde v1.1.0: no decide el tipo)
  tax_id: string | null;
  vies_valid: boolean | null;
}

export interface TaxDecision { treatment: TaxTreatment; rate: number; note: string; aviso?: string; }
export type IvaRegla = ({ ok: true } & TaxDecision) | { ok: false; problema: string };

export const TAX_INFO: Record<TaxTreatment, { rate: number; note: string }> = {
  cyprus_domestic: { rate: 0.19, note: 'IVA 19% (Chipre)' },
  es_vat_21:       { rate: 0.21, note: 'IVA 21% (España)' },
  es_out_of_scope: { rate: 0,    note: 'Operación no sujeta — Canarias/Ceuta/Melilla' },
  reverse_charge:  { rate: 0,    note: 'Inversión del sujeto pasivo — Art. 196 Directiva 2006/112/CE' },
  eu_b2c_vat:      { rate: 0,    note: 'IVA del país de destino (OSS)' },
  export_no_eu:    { rate: 0,    note: 'Operación no sujeta — exportación de servicios' },
};

const EU = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
const ES_OUT_OF_SCOPE_CP = ['35','38','51','52']; // Canarias, Ceuta, Melilla

// Tipos generales (fuente: Comisión Europea, Your Europe, revisada el 13/07/2026). España y Chipre se tratan aparte.
export const EU_B2C_RATES: Record<string, number> = {
  AT:0.20, BE:0.21, BG:0.20, HR:0.25, CZ:0.21, DK:0.25, EE:0.24, FI:0.255,
  FR:0.20, DE:0.19, GR:0.24, HU:0.27, IE:0.23, IT:0.22, LV:0.21, LT:0.21,
  LU:0.17, MT:0.18, NL:0.21, PL:0.23, PT:0.23, RO:0.21, SK:0.23, SI:0.22, SE:0.25,
};

export const paisIso = (c: string | null) => {
  const p = String(c ?? '').trim().toUpperCase();
  return p === 'EL' ? 'GR' : p;
};
const viesValido = (p: TaxInput) => p.vies_valid === true && !!String(p.tax_id ?? '').trim();

/** Regla al emitir. Nunca decide por defecto: sin país devuelve { ok:false, problema }. */
export function reglaIva(p: TaxInput): IvaRegla {
  const pais = paisIso(p.country_code);
  const cpRaw = String(p.postal_code ?? '').trim();
  if (!pais) return { ok: false, problema: 'falta el país del cliente' };
  if (pais === 'CY') return { ok: true, treatment: 'cyprus_domestic', rate: 0.19, note: TAX_INFO.cyprus_domestic.note };
  if (pais === 'ES') {
    const cp = cpRaw ? cpRaw.padStart(5, '0') : '';
    if (cp && ES_OUT_OF_SCOPE_CP.some((pre) => cp.startsWith(pre)))
      return { ok: true, treatment: 'es_out_of_scope', rate: 0, note: TAX_INFO.es_out_of_scope.note };
    if (viesValido(p)) return { ok: true, treatment: 'reverse_charge', rate: 0, note: TAX_INFO.reverse_charge.note };
    return { ok: true, treatment: 'es_vat_21', rate: 0.21, note: TAX_INFO.es_vat_21.note,
      ...(cpRaw ? {} : { aviso: 'cliente de España sin código postal: se aplica el 21 % (no se puede descartar Canarias, Ceuta o Melilla)' }) };
  }
  if (EU.has(pais)) {
    if (viesValido(p)) return { ok: true, treatment: 'reverse_charge', rate: 0, note: TAX_INFO.reverse_charge.note };
    const rate = EU_B2C_RATES[pais];
    return { ok: true, treatment: 'eu_b2c_vat', rate, note: `IVA ${Math.round(rate * 1000) / 10}% (${pais}, OSS)` };
  }
  return { ok: true, treatment: 'export_no_eu', rate: 0, note: TAX_INFO.export_no_eu.note };
}

/** Cálculo del importe ANTES de cobrar (checkout, presupuesto): nunca bloquea; sin país usa 21 % con aviso. */
export function resolveTax(p: TaxInput): TaxDecision {
  const r = reglaIva(p);
  if (r.ok) { const { ok: _ok, ...d } = r; return d; }
  console.warn(`[tax] ${r.problema}: se calcula al 21 % (la factura se revisará al emitir)`);
  return { treatment: 'es_vat_21', rate: 0.21, note: TAX_INFO.es_vat_21.note, aviso: `${r.problema}: calculado al 21 %` };
}
