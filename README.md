# nexifair-fiscal

Regla única de IVA para los servicios de Nexifair (ReforLeads y Market). Un solo fichero, `tax.ts`, sin dependencias.

**Importar siempre por etiqueta de versión, nunca por rama:**

```ts
import { resolveTax } from "https://cdn.jsdelivr.net/gh/cesarboost/nexifair-fiscal@v1.0.1/tax.ts";
```

Las etiquetas son inmutables. Un cambio de regla = nueva etiqueta (`v1.0.2`, …) y actualización explícita del import en cada consumidor.

`resolveTax({ country_code, postal_code, customer_type: 'empresa'|'particular', tax_id, vies_valid })` devuelve `{ treatment, rate, note }`:

| Caso | treatment | rate |
|---|---|---|
| Chipre | `cyprus_domestic` | 19 % |
| España, CP 35/38/51/52 (Canarias, Ceuta, Melilla) | `es_out_of_scope` | 0 % |
| España o resto UE, empresa con VIES válido | `reverse_charge` | 0 % |
| España sin VIES válido | `es_vat_21` | 21 % |
| Resto UE sin VIES válido | `eu_b2c_vat` | tipo del país (OSS) |
| Fuera de la UE | `export_no_eu` | 0 % |
| Datos insuficientes | `es_vat_21` (fallback seguro, nunca 0 %) | 21 % |
