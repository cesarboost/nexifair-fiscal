# nexifair-fiscal

Regla única de IVA para los servicios de Nexifair Limited (ReforLeads y Market). Un solo fichero, `tax.ts`, sin dependencias.

**Importar siempre por etiqueta de versión, nunca por rama:**

```ts
import { reglaIva, resolveTax } from "https://cdn.jsdelivr.net/gh/cesarboost/nexifair-fiscal@v1.1.0/tax.ts";
```

Las etiquetas son inmutables. Un cambio de regla = nueva etiqueta y actualización explícita del import en cada consumidor.

## v1.1.0 (21/10/2026)

`reglaIva({ country_code, postal_code, customer_type, tax_id, vies_valid })` es la regla **al emitir la factura**. Devuelve
`{ ok: true, treatment, rate, note, aviso? }` o `{ ok: false, problema }` (nunca decide por defecto):

| Caso | treatment | rate |
|---|---|---|
| Chipre | `cyprus_domestic` | 19 % |
| UE (España incluida) con VAT válido en VIES, empresa o autónomo | `reverse_charge` | 0 % |
| España sin VAT válido | `es_vat_21` | 21 % (sin código postal: con aviso) |
| España, CP 35/38/51/52 (Canarias, Ceuta, Melilla) | `es_out_of_scope` | 0 % |
| Resto de la UE sin VAT válido (empresa o particular) | `eu_b2c_vat` | tipo general del país (OSS) |
| Fuera de la UE | `export_no_eu` | 0 % |
| Sin país | — | problema: no se emite sola |

`resolveTax` (mismos datos) es para calcular el importe **antes de cobrar** (checkout, presupuesto): nunca bloquea; sin
país usa 21 % con aviso.

Tipos generales revisados contra la tabla oficial de la Comisión Europea (Your Europe, «VAT rules and rates», revisada el
13/07/2026): Estonia 24 % (desde 01/07/2025), Rumanía 21 % (desde 01/08/2025); el resto sin cambios. Grecia acepta «GR» y «EL».

Pruebas: `deno test tax.test.ts`.

## v1.0.1 (24/08/2026)

Primera versión común (ReforLeads y Market). Sin país → 21 %; el 0 % por VIES solo para clientes «empresa».
