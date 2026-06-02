# KŌSO POS / ServiRest — RECALIBRACIÓN v2 (BOOTSTRAP-LEAN)
### Plan de costos y capital revisado contra plan de marketing ServiRest ABSU

| Campo | Valor |
|---|---|
| Documento | Recalibración v2 — Modelo BOOTSTRAP-LEAN |
| Versión | v2.0 (anula v1 `MARKETING_CAPITAL_RECALIBRATION.md` y §8 del Dossier original) |
| Fecha | 2026-06-02 |
| Project Leader | Julio Ibarra |
| Triggered by | (1) Plan de marketing ServiRest ABSU del 2026-06-01 con cifras LEAN auditables; (2) Decisión del founder de NO contratar equipo en Q3 |
| Decisión consagrada | Operación 100 % founder-led los primeros 4 meses + 1 empleado a $7,000 MXN/mes desde el mes 5 |

> **Conclusión que cambia la tesis:** Con esta estructura de costos, **KŌSO POS / ServiRest deja de necesitar capital externo en 2026**. El proyecto es **bootstrappable** con un burn pico de ~$10,000 MXN en mes 1, EBITDA positivo desde el mes 2, y EBITDA acumulado 7 m de **+$112,600 MXN**. El cambio de fondo es: la nómina pesada y el outbound formal estaban quemando un capital que la unidad económica del producto no necesitaba.

---

## 1. CAMBIOS APLICADOS

| Concepto | Plan v1 (recalibrado) | **Plan v2 (BOOTSTRAP-LEAN)** | Decisión del founder |
|---|---|---|---|
| Equipo / Nómina | $112K – $177K MXN/mes | **$0 hasta sep · $7,000 MXN/mes desde oct** | Julio cubre todos los roles los primeros 4 meses; 1 empleado part-time desde M5 |
| Outbound (SDR + comisiones) | $0 → $35K/mes | **$0 (eliminado)** | El outbound lo hace Julio personalmente |
| Partnerships + setup | $1K – $3K/mes | **$0 (eliminado)** | Se activan orgánicamente sin presupuesto formal |
| Legal + Contabilidad | $4K – $6K/mes | **$0 (eliminado)** | Asesoría legal/fiscal one-time absorbida en marca/setup inicial |
| Ads (Meta + Google) | $3K – $80K/mes | **$800 – $7,500 MXN/mes** (plan ServiRest LEAN) | Ad spend alineado al plan ABSU |
| Marketing infra (Apify, Content Factory, WhatsApp API, ABSU OS) | No estaba separado | **$4,200 – $7,150 MXN/mes** (plan ServiRest LEAN) | Infra pass-through del motor de adquisición |
| Herramientas SaaS KOSO (producto) | $8K – $13K/mes | **$2K – $3K/mes** | Solo Stripe + Sentry + Resend + Crisp + CRM básico |
| Hosting | $1.5K → $4K/mes | **$1,800 → $2,400 MXN/mes** | Fijado a banda controlada |

**Eliminaciones netas:** $109K – $221K MXN/mes liberados. **Adiciones:** ~$4K – $7K MXN/mes de marketing infra. **Resultado:** burn mensual cae de ~$133K – $352K (plan v1) a ~$10K – $66K MXN/mes (plan v2).

---

## 2. NUEVO P&L 7 MESES (Jun–Dic 2026) — escenario LEAN

> Adopta la curva de adquisición **LEAN** del plan ServiRest ABSU (5 → 86 clientes activos M6, extrapolado a ~110 en Dic). ARPU $775 MXN. Hardware margen 30 % adopción × $998 × clientes nuevos. Setup margen 15 % × $1,200 × clientes nuevos.

| Concepto (MXN) | Jun | Jul | Ago | Sep | Oct | Nov | Dic | **Total** |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| Clientes nuevos en el mes | 5 | 9 | 14 | 18 | 22 | 24 | 26 | 118 |
| Clientes activos (acum, churn 4 %) | 5 | 14 | 28 | 45 | 64 | 86 | 110 | — |
| Ingresos suscripción | 3,875 | 10,850 | 21,700 | 34,875 | 49,600 | 66,650 | 85,250 | **272,800** |
| Ingresos hardware (margen) | 1,500 | 2,700 | 4,200 | 5,400 | 6,600 | 7,200 | 7,800 | **35,400** |
| Ingresos setup (margen) | 900 | 1,620 | 2,520 | 3,240 | 3,960 | 4,320 | 4,680 | **21,240** |
| **Ingresos totales** | **6,275** | **15,170** | **28,420** | **43,515** | **60,160** | **78,170** | **97,730** | **329,440** |
| COGS suscripción ($257 × clientes activos) | 1,285 | 3,598 | 7,196 | 11,565 | 16,448 | 22,102 | 28,270 | **90,464** |
| Equipo / Nómina | 0 | 0 | 0 | 0 | 7,000 | 7,000 | 7,000 | **21,000** |
| Ads (Meta + Google, plan ServiRest LEAN) | 800 | 2,900 | 4,200 | 5,000 | 5,800 | 6,600 | 7,500 | **32,800** |
| Marketing infra (Apify + CF + WA API + ABSU OS + Canva/CapCut/HeyGen/Sched.) | 4,200 | 4,450 | 5,500 | 5,850 | 6,450 | 6,750 | 7,150 | **40,350** |
| Herramientas SaaS KOSO (Stripe + Sentry + Resend + Crisp + CRM) | 2,000 | 2,000 | 2,500 | 2,500 | 3,000 | 3,000 | 3,000 | **18,000** |
| Hosting (Supabase + Vercel) | 1,800 | 1,800 | 1,900 | 2,000 | 2,100 | 2,200 | 2,400 | **14,200** |
| **Gastos totales** | **10,085** | **14,748** | **21,296** | **26,915** | **40,798** | **47,652** | **55,320** | **216,814** |
| **EBITDA mensual** | **(3,810)** | **422** | **7,124** | **16,600** | **19,362** | **30,518** | **42,410** | **112,626** |
| EBITDA acumulado | (3,810) | (3,388) | 3,736 | 20,336 | 39,698 | 70,216 | **112,626** | — |

### Lectura honesta del nuevo P&L

- **Burn pico:** solo $3,810 MXN en junio (vs. $147K originales).
- **Break-even mensual:** **julio (mes 2)**.
- **Break-even acumulado:** **agosto (mes 3)**.
- **EBITDA acumulado 7 m:** **+$112,626 MXN (~USD $6,600)**.
- **Run-rate anualizado dic 2026:** **$509,040 MXN (~USD $29,940)** en EBITDA.
- **MRR exit dic 2026:** $85,250 MXN (~USD $5,015).
- **Run-rate ARR dic:** $1,023,000 MXN (~USD $60,200).

---

## 3. NECESIDAD DE CAPITAL — REVISIÓN COMPLETA

| Concepto | Plan v1 | **Plan v2 (BOOTSTRAP-LEAN)** | Δ |
|---|---|---|---|
| Cash burn 7 m | $1,118,818 MXN | **$3,810 MXN** | **−$1,115,008 MXN** |
| Reserva colchón 3 meses | $440,000 | **~$30,000** (buffer prudencial) | −$410,000 |
| Inversión hardware inventario | $120,000 | **$30,000** (5 kits iniciales) | −$90,000 |
| Buffer legal one-time | $100,000 | **$15,000** (constitución + trademark) | −$85,000 |
| **Total capital necesario** | **$1,778,818 MXN (~USD $105K)** | **~$78,810 MXN (~USD $4,640)** | **−$1.7 M MXN** |

### Conclusión

> **El proyecto NO necesita capital externo en 2026.** Con $78,810 MXN (~USD $4,640) de aporte inicial del founder (constitución legal + 5 kits de hardware + reserva), el proyecto se autofinancia a partir de julio. **El levantamiento de $105K USD que se planteaba se elimina del plan Q3–Q4 2026.**

### ¿Cuándo sí tendría sentido levantar capital?

Solo si se cumplen las 3 condiciones:

1. **Gate ServiRest aprobado al M2** (1-ago): trial→pago ≥ 18 %, CAC ≤ $40 USD blended, ≥ 12 clientes activos.
2. **EBITDA positivo sostenido** en jul–sep (3 meses consecutivos).
3. **Demanda comprobada** por aceleración (lista de espera, partnerships orgánicos en marcha).

Si las 3 se cumplen, el levantamiento se justifica **NO para sobrevivir**, sino para **comprar velocidad** y saltar al escenario ACELERADO del plan ServiRest (+$107,720 MXN inyección M3–M6 → 239 clientes M6 vs 86 LEAN). Eso sí requeriría USD $6–10K, no $105K. **El levantamiento masivo del plan original asumía una estructura de costos que ya no existe.**

---

## 4. ESCENARIO ACELERADO (post-gate, opcional)

Si en el gate ServiRest del 1-ago todo valida, **el founder puede optar** por inyectar capital propio o levantar un ticket pequeño (≤ USD $10K) para mover a ACELERADO. P&L referencial:

| Concepto (MXN) | Jun | Jul | Ago | Sep | Oct | Nov | Dic | **Total** |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| Clientes activos (acum) ACEL | 5 | 14 | 44 | 93 | 160 | 239 | 290 | — |
| Ingresos totales | 6,275 | 15,170 | 49,610 | 95,545 | 156,800 | 222,750 | 268,750 | **814,900** |
| Gastos totales (incl. infra escalada) | 10,085 | 14,748 | 36,500 | 49,000 | 60,500 | 67,000 | 75,000 | **312,833** |
| **EBITDA mensual** | **(3,810)** | **422** | **13,110** | **46,545** | **96,300** | **155,750** | **193,750** | **502,067** |

> **Lectura:** El escenario ACELERADO eleva el EBITDA acumulado 7 m de **$112,626 → $502,067 MXN** (~USD $29,500). La inyección necesaria es de $107,720 MXN concentrada en M3–M6 — perfectamente cubierta con el cash flow positivo de jul–ago + un ticket pequeño de socio si quiere acelerar más.

---

## 5. LO QUE QUEDA POR ENTENDER (transparencia operativa)

Los recortes son honestos, pero hay **trade-offs reales** que el founder debe asumir conscientemente:

| Trade-off aceptado | Implicación | Mitigación |
|---|---|---|
| Julio hace TODO los primeros 4 meses | CEO + Sales + Outbound + Support + Producto + Marketing operativo. ~70–80 h/sem | Disciplina de calendario: bloques fijos por función. Outsourcing puntual de tareas no críticas |
| No hay Tech Lead in-house | Si hay incidente P0 en producción, la respuesta depende solo de Julio | (a) Soporte premium Supabase ($600 MXN/mes opcional) (b) Documentación de runbooks (c) On-call propio en horario clave |
| No hay equipo de soporte | El SLA de respuesta WhatsApp depende de la disponibilidad de Julio | Crisp + plantillas + horario publicado (lun-sáb 9–18); 1 empleado CSM/Soporte se contrata en oct (mes 5) |
| Outbound 100 % founder-led | Limita a ~10–15 cierres/mes máximo realista | La curva LEAN del plan ServiRest (5 → 86 en 6 meses) ya asume este límite |
| Sin presupuesto de partnerships formal | Los partnerships se firman, no se compran | Se priorizan referidos boca-a-boca y co-marketing sin costos |
| Sin presupuesto legal mensual | Riesgo de no cumplir CFDI/LFPDPPP si surge problema imprevisto | Asesoría one-time inicial ($15K MXN) cubre constitución + ToS + trademark; consultoría puntual a la carta |

---

## 6. CONDICIONES DE ÉXITO RECALIBRADAS (QBR 1-sep-2026)

| Métrica | Mínimo | Base | Excelente |
|---|---|---|---|
| Clientes activos al 1-sep | 18 (M4) | **45 (M4 LEAN)** | 93 (M4 ACELERADO si se inyectó) |
| MRR | $14K MXN | **$34,875 MXN** | $72,000 MXN |
| EBITDA acumulado Q3 | $0 | **+$20K MXN** | +$50K MXN |
| Burn neto Q3 | < $20K | **$0 (autofinanciado)** | Positivo |
| CAC blended | < $1,500 MXN | **< $1,000 MXN** | < $800 MXN |
| Trial→pago | ≥ 15 % | ≥ 20 % | ≥ 25 % |
| Churn mensual | < 8 % | < 5 % | < 3 % |

**Veredicto QBR:**
- **≥ Base** → continuar BOOTSTRAP-LEAN; opcional: inyectar $30K–$50K USD del founder o ticket pequeño para activar ACELERADO en Q4.
- **Entre Mínimo y Base** → seguir LEAN, revisar funnel (no inyectar capital).
- **< Mínimo** → revisión profunda de ICP/pricing/oferta. Costo del error: < $50K MXN total (vs $1.5M MXN que se hubiera gastado en el plan v1).

---

## 7. ACTUALIZACIÓN AL PORTFOLIO MASTER PLAN

Esta recalibración v2 implica los siguientes cambios al `00_PORTFOLIO_MASTER_PLAN.md`:

| Campo del Portafolio | Plan v1 | **Plan v2** |
|---|---|---|
| Capital requerido KŌSO Q3–Q4 | USD $105K | **USD $4.6K (founder)** |
| Capital portafolio total | USD $110K | **USD $5.7K (founder)** |
| Necesidad de inversor externo | **Sí** | **No** (opcional para acelerar post-QBR) |
| Estructura de tramos | 3 tramos gateados ($30K/$40K/$35K) | **Diferido** — solo si se activa ACELERADO |
| Tesis para socio | "Capital para encender ads y escalar nómina" | **"Capital opcional para comprar velocidad post-validación"** |

---

## 8. ACCIONES INMEDIATAS (esta semana)

1. **Julio:** confirmar que asume el rol multi-cap (CEO + Sales + Outbound + Support + Marketing operativo) durante 4 meses.
2. **Julio:** transferir $78,810 MXN al cash flow operativo del proyecto (constitución + 5 kits hardware + reserva).
3. **Julio + Sebastián + PMO:** sesión de Steering 16-jun para ratificar el plan BOOTSTRAP-LEAN y archivar la opción de levantamiento masivo.
4. **PMO:** actualizar `00_PORTFOLIO_MASTER_PLAN.md` §3.4 (necesidad de capital del portafolio) y §3.5 (recalibración KŌSO).
5. **Julio:** publicar weekly review viernes 17:00 con los 7 KPIs revisados (clientes nuevos, activos, MRR, EBITDA del mes, CAC, churn, trial→pago).

---

## 9. CIERRE EJECUTIVO

El plan v1 prometía un negocio que requería USD $105K de capital externo para alcanzar 152 clientes y MRR de $118K MXN al cierre de 2026. El plan v2, aplicando los recortes del founder y la disciplina de costos del plan de marketing ServiRest LEAN, proyecta:

- **110 clientes activos** al cierre de 2026 (vs. 152 plan v1)
- **MRR exit $85,250 MXN** (vs. $118,560 plan v1)
- **EBITDA acumulado 7 m +$112,626 MXN** (vs. **−$1,118,096 plan v1**)
- **Capital externo necesario: $0**

> La diferencia entre el plan v1 y el v2 no es 25 % de clientes menos. Es **$1.7 M MXN que NO se queman** y **un negocio que se paga solo desde el mes 2**. Esa es la decisión correcta cuando el producto ya está construido y la única pregunta real es si el founder puede sostener el ritmo operativo.
>
> El levantamiento de capital queda como **opción**, no obligación. Si en el QBR 1-sep el funnel valida, se evalúa inyectar $5–10K USD para activar el escenario ACELERADO. Si no valida, el costo del error es 50× menor que en el plan v1.

---

*Documento de recalibración v2. Anula `MARKETING_CAPITAL_RECALIBRATION.md` y §8 del Dossier KŌSO. Próxima revisión: QBR 1-sep-2026.*
