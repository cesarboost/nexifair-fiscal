// Regla fiscal (IVA) para servicios prestados desde Chipre — decisión EN SERVIDOR.
// Fuente única: https://github.com/cesarboost/nexifair-fiscal (importar siempre por etiqueta de versión).
//
// CRITERIO (confirmado por la asesoría fiscal el 24/08/2026, vigente desde el 01/07/2026): el IVA se
// determina por el PAÍS del cliente y por si tiene un número de IVA válido en VIES.
//   · Empresa UE (no-CY) con VAT válido en VIES -> inversión del sujeto pasivo, 0%.
//   · Cliente en Chipre -> 19% (tenga o no VAT).
//   · Particular o empresa SIN VIES, dentro de la UE -> IVA del país del cliente
//     (España 21%, Alemania 19%, Francia 20%, ...), declarado por OSS.
//   · Canarias/Ceuta/Melilla -> fuera del territorio IVA de la UE -> 0%.
//   · Fuera de la UE -> no sujeta -> 0%.
// NO es 21% para todo: cada país de la UE tiene su tipo.

export type TaxTreatment =
  | 'cyprus_domestic' | 'es_vat_21' | 'es_out_of_scope'
  | 'reverse_charge'  | 'eu_b2c_vat' | 'export_no_eu';

export interface TaxInput {
  country_code: string | null;
  postal_code: string | null;
  customer_type: string | null; // 'empresa' | 'particular'
  tax_id: string | null;
  vies_valid: boolean | null;
}
export interface TaxDecision { treatment: TaxTreatment; rate: number; note: string; }

export const TAX_INFO: Record<TaxTreatment, { rate: number; note: string }> = {
  cyprus_domestic: { rate: 0.19, note: 'IVA 19% (Chipre)' },
  es_vat_21:       { rate: 0.21, note: 'IVA 21% (España)' },
  es_out_of_scope: { rate: 0,    note: 'Operación no sujeta — Canarias/Ceuta/Melilla' },
  reverse_charge:  { rate: 0,    note: 'Inversión del sujeto pasivo — Art. 196 Directiva 2006/112/CE' },
  eu_b2c_vat:      { rate: 0,    note: 'IVA del país de destino (OSS)' },   // IVA del país de destino vía OSS desde el 01/07/2026 (criterio confirmado el 24/08/2026)
  export_no_eu:    { rate: 0,    note: 'Operación no sujeta — exportación de servicios' },
};

const EU = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
const ES_OUT_OF_SCOPE_CP = ['35','38','51','52']; // Canarias, Ceuta, Melilla
// Tipo general de IVA por país UE (para B2C / sin VIES, vía OSS). Criterio confirmado el 24/08/2026 (vigente desde 01/07/2026).
const EU_B2C_RATES: Record<string, number> = {
  AT:0.20, BE:0.21, BG:0.20, HR:0.25, CZ:0.21, DK:0.25, EE:0.22, FI:0.255,
  FR:0.20, DE:0.19, GR:0.24, HU:0.27, IE:0.23, IT:0.22, LV:0.21, LT:0.21,
  LU:0.17, MT:0.18, NL:0.21, PL:0.23, PT:0.23, RO:0.19, SK:0.23, SI:0.22, SE:0.25,
};

const esEmpresa = (t: string | null) => t === 'empresa';
const viesValido = (p: TaxInput) =>
  p.vies_valid === true && !!String(p.tax_id ?? '').trim() && esEmpresa(p.customer_type);

// Fallback seguro: 21% (España) ante un dato incompleto — nunca conceder 0%
// por falta de dato, y es el mercado principal.
function fallback21(motivo: string): TaxDecision {
  console.warn(`[tax] fallback es_vat_21 (${motivo})`);
  return { treatment: 'es_vat_21', rate: 0.21, note: TAX_INFO.es_vat_21.note };
}

export function resolveTax(p: TaxInput): TaxDecision {
  const pais = String(p.country_code ?? '').trim().toUpperCase();
  const cpRaw = String(p.postal_code ?? '').trim();
  if (!pais) return fallback21('sin país');

  // 1) Chipre (doméstico) -> 19%.
  if (pais === 'CY') return { treatment:'cyprus_domestic', rate:0.19, note:TAX_INFO.cyprus_domestic.note };

  // 2) España.
  if (pais === 'ES') {
    const cp = cpRaw ? cpRaw.padStart(5, '0') : '';
    // 2a) Canarias/Ceuta/Melilla: fuera del territorio IVA de la UE -> 0% (fija la etiqueta).
    if (cp && ES_OUT_OF_SCOPE_CP.some((pre) => cp.startsWith(pre)))
      return { treatment:'es_out_of_scope', rate:0, note:TAX_INFO.es_out_of_scope.note };
    // 2b) Empresa con VAT válido en VIES -> reverse charge (0%). NO depende del CP:
    //     con VIES válido el tipo es 0% tanto en península como en Canarias.
    if (viesValido(p)) return { treatment:'reverse_charge', rate:0, note:TAX_INFO.reverse_charge.note };
    // 2c) Sin VIES válido y sin CP no podemos descartar Canarias -> 21% (fallback seguro).
    if (!cpRaw) return fallback21('ES sin código postal');
    // 2d) Resto: IVA español.
    return { treatment:'es_vat_21', rate:0.21, note:TAX_INFO.es_vat_21.note };
  }

  // 3) Otro país de la UE.
  if (EU.has(pais)) {
    if (viesValido(p)) return { treatment:'reverse_charge', rate:0, note:TAX_INFO.reverse_charge.note };
    const rate = EU_B2C_RATES[pais];
    if (rate != null) return { treatment:'eu_b2c_vat', rate, note:`IVA ${Math.round(rate*100)}% (${pais}, OSS)` };
    return fallback21(`UE ${pais} sin tipo en el mapa`);
  }

  // 4) Fuera de la UE -> exportación de servicios, 0%.
  return { treatment:'export_no_eu', rate:0, note:TAX_INFO.export_no_eu.note };
}
