// Pruebas de la regla v1.1.0. Ejecutar: deno test tax.test.ts
import { reglaIva, resolveTax, EU_B2C_RATES } from "./tax.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const r = (country_code: string | null, o: Partial<{ cp: string; nif: string; vies: boolean; tipo: string }> = {}) =>
  reglaIva({ country_code, postal_code: o.cp ?? null, customer_type: o.tipo ?? null, tax_id: o.nif ?? null, vies_valid: o.vies ?? null });
const t = (x: ReturnType<typeof r>) => x.ok ? `${x.treatment} ${x.rate}` : `PROBLEMA ${x.problema}`;

Deno.test("Chipre 19 %", () => { assertEquals(t(r("CY")), "cyprus_domestic 0.19"); assertEquals(t(r("CY", { nif: "CY1", vies: true })), "cyprus_domestic 0.19"); });
Deno.test("UE con VAT válido → 0 % inversión, sea empresa o autónomo", () => {
  assertEquals(t(r("ES", { cp: "28001", nif: "B1", vies: true, tipo: "empresa" })), "reverse_charge 0");
  assertEquals(t(r("ES", { cp: "28001", nif: "1A", vies: true, tipo: "particular" })), "reverse_charge 0");
  assertEquals(t(r("DE", { nif: "DE1", vies: true })), "reverse_charge 0");
  assertEquals(t(r("EL", { nif: "EL1", vies: true })), "reverse_charge 0");
});
Deno.test("UE sin VAT válido → tipo del país (OSS)", () => {
  assertEquals(t(r("ES", { cp: "28001", nif: "B1", vies: false, tipo: "empresa" })), "es_vat_21 0.21");
  assertEquals(t(r("ES", { cp: "28001" })), "es_vat_21 0.21");
  assertEquals(t(r("FR", { nif: "FR1", vies: false, tipo: "empresa" })), "eu_b2c_vat 0.2");
  assertEquals(t(r("FR")), "eu_b2c_vat 0.2");
  assertEquals(t(r("EE")), "eu_b2c_vat 0.24");
  assertEquals(t(r("RO")), "eu_b2c_vat 0.21");
  assertEquals(t(r("GR")), "eu_b2c_vat 0.24");
  assertEquals(t(r("EL")), "eu_b2c_vat 0.24");
});
Deno.test("Canarias, Ceuta y Melilla → 0 %", () => {
  for (const cp of ["35001", "38400", "51001", "52001"]) assertEquals(t(r("ES", { cp })), "es_out_of_scope 0");
});
Deno.test("Fuera de la UE → 0 %", () => { assertEquals(t(r("US")), "export_no_eu 0"); assertEquals(t(r("GB", { nif: "GB1", vies: true })), "export_no_eu 0"); });
Deno.test("Sin país → problema (no se decide)", () => { assertEquals(t(r(null)), "PROBLEMA falta el país del cliente"); assertEquals(t(r(" ")), "PROBLEMA falta el país del cliente"); });
Deno.test("España sin código postal → 21 % con aviso", () => {
  const x = r("ES"); assertEquals(t(x), "es_vat_21 0.21"); assertEquals(x.ok && !!x.aviso, true);
});
Deno.test("resolveTax (antes de cobrar) nunca bloquea: sin país, 21 % con aviso", () => {
  const d = resolveTax({ country_code: null, postal_code: null, customer_type: null, tax_id: null, vies_valid: null });
  assertEquals(`${d.treatment} ${d.rate}`, "es_vat_21 0.21"); assertEquals(!!d.aviso, true);
});
Deno.test("tipos generales = tabla oficial de la Comisión (13/07/2026)", () => {
  const oficial: Record<string, number> = { AT:20, BE:21, BG:20, CZ:21, DE:19, DK:25, EE:24, GR:24, FI:25.5, FR:20, HR:25, HU:27, IE:23, IT:22, LT:21, LU:17, LV:21, MT:18, NL:21, PL:23, PT:23, RO:21, SE:25, SI:22, SK:23 };
  for (const [p, v] of Object.entries(oficial)) assertEquals(Math.round(EU_B2C_RATES[p] * 1000) / 10, v, p);
  assertEquals(Object.keys(EU_B2C_RATES).sort(), Object.keys(oficial).sort());
});
