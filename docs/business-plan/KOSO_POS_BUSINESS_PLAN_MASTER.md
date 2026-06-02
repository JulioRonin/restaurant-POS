# KŌSO POS — BUSINESS PLAN & MASTER PLAN EJECUTIVO
### Plan integral de monetización, comercialización y forecast 2026

| Documento | Versión | Fecha | Autor | Estado |
|---|---|---|---|---|
| Business Plan & Master Plan Master | v1.0 | 2026-06-02 | PMO / Equipo Fundador | Aprobado para ejecución |
| Horizonte | 12 meses (Jun–Dic 2026) | Próxima revisión | 2026-09-01 | — |

> **Objetivo central:** Pasar de producto pre-comercial a **operación SaaS generando ingresos recurrentes (MRR)** en **90 días** (1 sep 2026), con un pipeline que sustente **MXN $1.85 M** de ingresos totales y **MRR ≥ MXN $185 K** al cierre de 2026.

---

## 0. ÍNDICE EJECUTIVO

1. Resumen Ejecutivo
2. Análisis del Producto (auditoría técnica + comercial)
3. Análisis de Mercado y Competencia
4. Modelo de Negocio y Pricing
5. Estrategia Go-To-Market (GTM)
6. Master Plan de 90 días (WBS por sprints semanales)
7. Plan de Recursos y Organización
8. Modelo Financiero & Forecast Jun–Dic 2026
9. Análisis de Riesgos (PMI Risk Register)
10. KPIs & Cadena de Valor
11. Plan de Contingencia y Escenarios
12. Anexos (cálculo unitario, supuestos, plantillas)

---

## 1. RESUMEN EJECUTIVO

**KŌSO POS** (codename interno *Solaris*) es una plataforma SaaS multi-tenant de gestión de restaurantes orientada a **pymes gastronómicas hispanohablantes**, con foco inicial en México. El producto cubre el ciclo operativo completo: Punto de Venta, KDS (Kitchen Display), Hostess, Caja, Inventario, Nómina, Reportería y Super Admin. Está construido sobre **React 19 + Supabase (Postgres) + Vite + Electron**, con integración **Stripe** funcional, modo demo de 15 días, RLS multi-tenant y empaquetado para Windows.

**Diagnóstico:** producto ~85 % completo en features, infraestructura SaaS lista (Stripe, RLS, demo, planes), pero con brechas tácticas en facturación CFDI, automatización de webhooks, landing comercial, soporte y operación post-venta.

**Tesis comercial:**

- Mercado objetivo (TAM) en México: ~**650 mil restaurantes y establecimientos de A&B** (INEGI/Canirac); SAM realista de ~120 mil pymes con disposición digital; SOM inicial 90 días: 50–80 restaurantes; SOM 12 meses: 350–500.
- ARPU mensual mezcla: **MXN $780** (mezcla 50/50 Básico–Pro + upsells de hardware financiado).
- LTV estimado (24 m promedio, churn 4 %): **MXN $13,600** por cliente.
- CAC objetivo: **≤ MXN $1,500** → LTV/CAC ≈ **9.0x** (sano).

**Compromiso operativo a 90 días:**

| Hito | Fecha | Meta cuantitativa |
|---|---|---|
| Cierre Sprint Producto Comercial | 30-jun-2026 | CFDI 4.0 + Webhook automatizado + Landing live |
| Lanzamiento Beta de Pago | 15-jul-2026 | 10 clientes pagando (Beta paga – descuento 30 %) |
| Go-Live Comercial Pleno | 01-ago-2026 | Pricing público, embudo Meta Ads en marcha |
| **Cierre 90 días** | **01-sep-2026** | **30 clientes activos, MRR ≥ MXN $23,400** |

---

## 2. ANÁLISIS DEL PRODUCTO (Auditoría)

### 2.1 Inventario de funcionalidades (estado actual)

| Módulo | Implementado | Calidad | Comercializable |
|---|---|---|---|
| Punto de Venta (POS) | ✅ | Alta | Sí |
| KDS (cocina) | ✅ | Alta | Sí (Plan Pro) |
| Hostess & Floor Plan | ✅ | Media-alta | Sí |
| Caja, splits, recibos | ✅ | Alta | Sí |
| Inventario + proveedores | ✅ | Media | Sí (Plan Pro) |
| Menú & variantes | ✅ | Alta | Sí |
| Dashboard analítico | ✅ | Media | Sí |
| Bar / Remoto / Drive-thru | ✅ | Media | Sí |
| Multi-tenant + RLS | ✅ | Alta | Sí |
| Stripe Checkout (suscripción) | ✅ | Alta | Sí |
| Modo Demo 15 días | ✅ | Alta | Sí |
| Bloqueo por mora/expiración | ✅ | Alta | Sí |
| **Facturación CFDI 4.0** | ❌ | — | **Blocker MX** |
| Webhook Stripe → activación auto | Parcial | Baja | **Blocker** |
| Onboarding self-service | Parcial | Media | Requiere pulido |
| App Android tablet (PWA) | ✅ vía PWA | Media | Aceptable v1 |
| Soporte WhatsApp / Helpdesk | ❌ | — | Pendiente |
| Tests automatizados | ❌ | — | Riesgo técnico |
| Multi-idioma | ❌ (solo ES) | — | OK para MX/LATAM |

### 2.2 Stack y arquitectura

- **Frontend:** React 19, TypeScript 5.8, Vite 6, Tailwind 4, Framer Motion, Recharts, Lucide.
- **Empaquetado:** Electron 31 (Windows portable) + PWA (Android/iOS web).
- **Backend / Datos:** Supabase (Postgres + Auth + RLS), funciones serverless en `/api` (Vercel).
- **Pagos:** Stripe (subscription + payment mode).
- **Offline:** IndexedDB (idb) con sync.
- **Hardware:** Bluetooth ESC/POS (impresora térmica) ya integrado.

### 2.3 Brechas críticas (deben cerrarse antes del Go-Live)

| # | Brecha | Impacto | Severidad | Owner | Deadline |
|---|---|---|---|---|---|
| 1 | CFDI 4.0 (Facturama o SW-Sapien) | Sin facturación los restaurantes formales no compran | Crítico | Backend Lead | 28-jun |
| 2 | Webhook Stripe → activar/renovar/cancelar | Riesgo de fraude o doble cobro manual | Crítico | Backend Lead | 18-jun |
| 3 | Landing + checkout público | No hay funnel de adquisición | Crítico | Marketing | 25-jun |
| 4 | Onboarding wizard 5 pasos (<10 min) | Bloquea PLG | Alto | Producto | 30-jun |
| 5 | Política privacidad + ToS (LFPDPPP) | Compliance | Alto | Legal | 30-jun |
| 6 | Soporte WhatsApp Business API | Promesa en Plan Pro | Alto | CX | 10-jul |
| 7 | Smoke tests E2E (Playwright) críticos | Estabilidad release | Medio | QA | 10-jul |
| 8 | Logs estructurados + Sentry | Observabilidad SaaS | Medio | Backend | 15-jul |

---

## 3. ANÁLISIS DE MERCADO Y COMPETENCIA

### 3.1 Tamaño de mercado (México, foco primario)

- **TAM (Total Addressable Market):** ~650,000 establecimientos A&B en México (fuente Canirac/INEGI). Suponiendo ARPU MXN $780/mes → **TAM ≈ MXN $6,084 M/año**.
- **SAM (Serviceable Available Market):** ~120,000 pymes con disposición digital (tarjeta, WhatsApp, smartphone) → **SAM ≈ MXN $1,123 M/año**.
- **SOM (Serviceable Obtainable Market) 12 m:** captura realista del 0.3 % del SAM ≈ **360 clientes**.

### 3.2 Competencia

| Competidor | Pricing MX (mes) | Fortaleza | Debilidad explotable |
|---|---|---|---|
| Loyverse | Gratis / $20 USD addons | Marca, gratis | Sin CFDI nativo, soporte EN |
| Square (no oficial MX) | n/a | UX premium | No facturación MX |
| Parrot Software | $799–$1,499 | Marca local, hardware | Caro, soporte saturado |
| Soft Restaurant | $1,200+ | Cumple SAT | UI legada, instalación pesada |
| Sysme/Maxirest | $600–$900 | Funcionalidad | UX antigua, sin web/PWA |
| **KŌSO POS** | **$550–$849** | UX moderna, multi-canal, KDS, offline, hardware financiado | Marca nueva |

**Posicionamiento:** *"El POS moderno para el restaurante mexicano: bonito como Square, completo como Parrot, accesible como Loyverse, con CFDI y soporte humano por WhatsApp."*

### 3.3 Buyer persona

- **Dueña/o operador** de restaurante 8–40 mesas, 2–15 empleados, ticket promedio $180–$450.
- 25–55 años, opera con caja de papel o Excel + impresora térmica antigua.
- Compra por WhatsApp/Facebook, decide en 3–10 días, paga con TDC/SPEI o tarjeta de débito.
- Dolores: cuadre de caja, robo hormiga, propinas, inventario, CFDI manual.

---

## 4. MODELO DE NEGOCIO Y PRICING

### 4.1 Tres líneas de ingreso

1. **Suscripción SaaS recurrente** (núcleo del MRR).
2. **Hardware bajo financiamiento** (impresora térmica, tablet, cajón, lector) → ingreso one-time o financiado a 3/6/8 meses, márgen 18–25 %.
3. **Servicios profesionales** (setup, migración de menú, capacitación on-site) → one-time MXN $1,500–$4,500.

### 4.2 Pricing público (mensual, IVA incluido)

| Plan | Precio MX | Incluye | Target |
|---|---|---|---|
| **Básico** | **$549** | POS, Menú, Recibos, 1 terminal, Soporte email | Cafés, fondas, food trucks |
| **Pro** ⭐ | **$849** | Todo Básico + KDS, Inventario avanzado, Multi-terminal, Soporte WhatsApp prioritario | Restaurantes 10–40 mesas |
| **Enterprise** | **$1,499+** | Pro + Multi-sucursal, API, Reportería avanzada, SLA, gerente de cuenta | Cadenas y grupos |
| **Setup Express** (one-time) | $1,500 | Captura de menú, configuración, capacitación 2 h | Add-on opcional |
| **Hardware Kit "Listo"** | $4,990 contado / $899 × 6 m | Impresora térmica + tablet 10" + soporte + cajón monedero | Cliente sin equipo |

> **Plan Anual:** descuento 2 meses (16 %) → Básico $5,490/año, Pro $8,490/año.
> **Beta paga (Jul):** 30 % descuento de por vida (locked-in) para los primeros 30 clientes.

### 4.3 Unit Economics

```
Plan mezclado promedio (50% Básico + 50% Pro):
  ARPU bruto              = (549 + 849) / 2 = $699
  + Upsell setup amortizado (15% adopción / 12 m) = $19
  + Upsell hardware margen amortizado            = $62
  ARPU neto efectivo        ≈ $780 MXN / mes

Costos variables por cliente / mes:
  Supabase compute + storage          $40
  Stripe (3.6% + IVA + $3)            $35
  Soporte WhatsApp + CX (prorrateo)   $90
  Infra Vercel + dominios             $8
  CFDI por timbre (~120 timbres/mes × $0.70) $84
  Total CoGS                          $257
Gross Margin                          = ($780 - $257) / $780 = 67%

CAC objetivo                          $1,500
Payback                               = $1,500 / ($780 × 0.67) ≈ 2.9 meses
Churn mensual proyectado              4%  (vida promedio 25 meses)
LTV                                   = ARPU × Margen × Vida = $780 × 0.67 × 25 ≈ $13,065
LTV/CAC                               ≈ 8.7x  ✅ (objetivo > 3x)
```

---

## 5. ESTRATEGIA GO-TO-MARKET (GTM)

### 5.1 Canales de adquisición (mix presupuesto 90 días)

| Canal | % Presupuesto | Inversión 90d (MXN) | CAC esperado | Leads/cliente |
|---|---|---|---|---|
| Meta Ads (FB+IG) — leads WhatsApp | 45 % | $54,000 | $1,200 | 25 leads / 1 cliente |
| Google Ads (búsqueda "POS restaurante") | 20 % | $24,000 | $1,800 | 18 leads / 1 cliente |
| TikTok orgánico + ads de UX-POS | 10 % | $12,000 | $900 | viral / variable |
| Outbound directo (referidos, calle, asociaciones) | 15 % | $18,000 | $700 | 4 visitas / 1 cliente |
| Partners (proveedores de carne, refresco, papel) | 10 % | $12,000 | $500 | recomendación |
| **Total** | **100 %** | **$120,000** | **prom $1,300** | — |

### 5.2 Funnel comercial

```
Impresión Ads → Lead WhatsApp → Demo (30 min) → Trial 15 días → Cobro Stripe
   100,000  →     800       →      120      →      60       →     30  (3.75% impr→cliente)
```

### 5.3 Calendario de campañas

- **Sem 2 (jun):** teaser orgánico + lista de espera.
- **Sem 5 (1-jul):** lanzamiento Beta paga (30 % off vitalicio) — escasez: solo 30 cupos.
- **Sem 9 (1-ago):** Go-Live público + promo "Setup gratis si pagas anual".
- **Sem 12 (sep):** caso de éxito 1er beta cliente con testimoniales en video.

### 5.4 Estrategia de retención

- **Onboarding asistido en 48 h** (CSM WhatsApp + Loom personalizado).
- **Health-Score automatizado** (uso semanal, # órdenes/día) → alerta CSM si <5 órdenes/día.
- **Newsletter mensual** con tips y nuevas features.
- **Programa de referidos:** 1 mes gratis por cada cliente referido activado.

---

## 6. MASTER PLAN 90 DÍAS — WBS POR SPRINTS SEMANALES

> Metodología: **Scrum-of-Scrums** con 2 squads (Producto y GTM). Daily 15 min, demo viernes, retro quincenal. Tablero Linear/Jira.

### Sprint 1 — Sem del 2-jun → 8-jun · "Fundación comercial"

| ID | Actividad | Owner | Esfuerzo | Entregable |
|---|---|---|---|---|
| S1-01 | Constituir SAS de C.V. o usar persona física RIF | Legal | 3 d | RFC operativo |
| S1-02 | Apertura cuenta bancaria empresarial + Stripe MX en producción | Finance | 5 d | Stripe vivo |
| S1-03 | Diseño definitivo de pricing (validar contra Parrot/Soft Rest) | PM | 2 d | Pricing v1.0 |
| S1-04 | Definir brand voice + naming definitivo (KŌSO vs alterno) | Marketing | 3 d | Brand brief |
| S1-05 | Auditoría seguridad RLS + Supabase advisors | Backend | 2 d | Reporte y fixes |
| S1-06 | Inventario de bugs P0/P1 (pre-prod) | QA | 2 d | Backlog priorizado |

### Sprint 2 — Sem 9-jun → 15-jun · "Cierre de blockers técnicos"

| ID | Actividad | Owner | Esfuerzo | Entregable |
|---|---|---|---|---|
| S2-01 | Integrar **Facturama API** (CFDI 4.0 ingresos + pago) | Backend | 5 d | Endpoint /api/cfdi |
| S2-02 | Completar **Stripe webhook** (activate/cancel/renew → Supabase) | Backend | 3 d | webhook.ts prod |
| S2-03 | Onboarding wizard 5 pasos (negocio → menú → mesa → caja → suscribir) | Front | 5 d | UX reducida 7→5 |
| S2-04 | Política privacidad LFPDPPP + ToS + aviso de cookies | Legal | 3 d | URLs en footer |
| S2-05 | Plan de migración de menú (CSV/Excel importer) | Backend | 3 d | Importer básico |
| S2-06 | Sentry + Logflare logs estructurados | DevOps | 2 d | Dashboard de errores |

### Sprint 3 — Sem 16-jun → 22-jun · "Landing & funnel"

| ID | Actividad | Owner | Esfuerzo | Entregable |
|---|---|---|---|---|
| S3-01 | Landing pública (Framer/Next) con CTA "Probar 15 días gratis" | Marketing | 5 d | koso-pos.com live |
| S3-02 | Integrar Calendly + WhatsApp Business API | CX | 2 d | Booking demos |
| S3-03 | Crear 3 anuncios para Meta + 2 Google + 2 TikTok orgánicos | Creative | 5 d | Library de creatives |
| S3-04 | Pixel Meta + GA4 + GTM en landing y app | Growth | 1 d | Tracking activo |
| S3-05 | Email transaccional (Resend) + secuencia trial (0,3,7,12,14) | Growth | 3 d | Sequence live |
| S3-06 | Smoke tests E2E (Playwright) – POS, KDS, Caja, Onboarding | QA | 4 d | CI verde |

### Sprint 4 — Sem 23-jun → 29-jun · "Pulido y aterrizaje Beta"

| ID | Actividad | Owner | Esfuerzo | Entregable |
|---|---|---|---|---|
| S4-01 | Caso de éxito piloto con 2 restaurantes amigos (gratis 1 mes) | CX | 5 d | Video testimonial |
| S4-02 | Materiales venta: deck, one-pager, comparativo competencia | Marketing | 3 d | Sales kit v1 |
| S4-03 | Capacitación interna agentes ventas + scripts WhatsApp | Sales Lead | 2 d | Playbook v1 |
| S4-04 | Pruebas de carga (k6) 200 cuentas concurrentes | DevOps | 2 d | Reporte capacity |
| S4-05 | Auditoría UX final por usuario externo (5 sesiones) | UX | 3 d | Backlog hot-fix |
| S4-06 | Plan de soporte 8×6 (lun-sáb 9–18) con WhatsApp + Crisp | CX | 2 d | SOP soporte |

### Sprint 5 — Sem 30-jun → 6-jul · "Apertura Beta Paga (30 cupos)"

- Lanzamiento campaña Meta + Google con presupuesto inicial **MXN $20K**.
- Apertura WhatsApp ventas con SLA respuesta ≤ 5 min en horario.
- Meta semana: **40 demos, 10 cierres, 5 clientes pagando.**

### Sprint 6 — Sem 7-jul → 13-jul · "Iteración"

- Optimizar creatives top performer (escalado 2x presupuesto).
- A/B test landing (hero, precio anclado, prueba social).
- Cerrar bugs reportados por primeros 5 clientes.
- Meta semana: **+8 clientes nuevos (acumulado 13).**

### Sprint 7 — Sem 14-jul → 20-jul · "Soporte y churn cero"

- CSM proactivo: llamada de check-in semana 1 y semana 2.
- Build de Health Score automático.
- Meta semana: **+7 clientes (acumulado 20).**

### Sprint 8 — Sem 21-jul → 27-jul · "Caso de éxito y referidos"

- Publicación caso éxito (video + post LinkedIn/IG).
- Lanzar programa de referidos (1 mes gratis por referido activado).
- Meta semana: **+6 clientes (acumulado 26).**

### Sprint 9 — Sem 28-jul → 3-ago · "Go-Live público"

- Pricing público en landing (sin descuento de 30 %).
- Comunicado prensa local + boletín Canirac.
- Meta semana: **+8 clientes (acumulado 34).**

### Sprint 10–12 — Sem 4-ago → 24-ago · "Aceleración"

- Escalado Meta + Google a **MXN $80K/mes** combinado.
- Activación 5 partners gastronómicos.
- Lanzamiento plan anual con descuento 16 %.
- Apertura segunda ciudad (Guadalajara o Monterrey).
- **Cierre 90 días (1-sep): 50 clientes activos, MRR ≥ MXN $39 K** (escenario base).

---

## 7. ORGANIZACIÓN Y RECURSOS

### 7.1 Estructura mínima (Mes 1–3)

| Rol | FTE | Costo mensual MXN | Modalidad |
|---|---|---|---|
| Founder / CEO (ventas + producto) | 1.0 | $0 (equity) | Full-time |
| Tech Lead (backend + DevOps) | 1.0 | $45,000 | Full-time |
| Frontend Dev | 0.5 | $20,000 | Freelance |
| Diseño UX/UI | 0.3 | $10,000 | Freelance |
| Customer Success (WhatsApp + onboarding) | 1.0 | $15,000 | Full-time |
| Performance Marketing (Meta+Google) | 0.5 | $18,000 | Freelance/agencia |
| Contabilidad/Fiscal | 0.2 | $4,000 | Externo |
| **Total equipo** | **~4.5 FTE** | **$112,000 / mes** | — |

### 7.2 Escala a Q4

- Sumar 1 SDR (Sales Development Rep) en septiembre: +$15K.
- Sumar 1 CSM adicional en octubre: +$15K.
- Sumar 1 Dev fullstack en noviembre: +$35K.

---

## 8. MODELO FINANCIERO & FORECAST JUN–DIC 2026

### 8.1 Supuestos clave

- ARPU mezcla: **MXN $780**.
- Churn mensual: **4 %**.
- CAC objetivo promedio: **MXN $1,300** (mejorando a $1,000 en Q4).
- COGS por cliente/mes: **MXN $257**.
- Gross margin: **67 %**.
- Adición de hardware: 30 % de clientes nuevos compran kit ($4,990, margen 20 % → $998 c/u).
- Setup express: 15 % adopción ($1,500, margen 80 % → $1,200 c/u).

### 8.2 Proyección clientes y MRR (escenario BASE)

| Mes | Nuevos | Churn | Activos fin de mes | MRR (MXN) | ARR equivalente |
|---|---|---|---|---|---|
| Jun-26 | 5 (beta gratis) | 0 | 5 | $0 (gratis piloto) | — |
| Jul-26 | 13 | 0 | 18 | $14,040 | $168,480 |
| Ago-26 | 17 | 1 | 34 | $26,520 | $318,240 |
| **Sep-26** (cierre 90 d) | **20** | **1** | **53** | **$41,340** | **$496,080** |
| Oct-26 | 28 | 2 | 79 | $61,620 | $739,440 |
| Nov-26 | 35 | 3 | 111 | $86,580 | $1,038,960 |
| Dic-26 | 45 | 4 | 152 | $118,560 | $1,422,720 |

**Cierre año 2026 (escenario base):**

| KPI | Valor |
|---|---|
| Clientes activos | **152** |
| MRR | **MXN $118,560** |
| ARR equivalente | **MXN $1,422,720** |

### 8.3 P&L proyectado Jun–Dic 2026 (escenario BASE, MXN)

| Concepto | Jun | Jul | Ago | Sep | Oct | Nov | Dic | **Total** |
|---|---|---|---|---|---|---|---|---|
| Ingresos suscripción | 0 | 14,040 | 26,520 | 41,340 | 61,620 | 86,580 | 118,560 | **348,660** |
| Ingresos hardware (margen) | 0 | 12,974 | 16,966 | 19,960 | 27,944 | 34,930 | 44,910 | **157,684** |
| Ingresos setup (margen) | 0 | 2,340 | 3,060 | 3,600 | 5,040 | 6,300 | 8,100 | **28,440** |
| **Ingresos totales** | **0** | **29,354** | **46,546** | **64,900** | **94,604** | **127,810** | **171,570** | **534,784** |
| COGS suscripción | 0 | 4,626 | 8,738 | 13,622 | 20,303 | 28,529 | 39,062 | **114,880** |
| Equipo (nómina) | 112,000 | 112,000 | 112,000 | 127,000 | 142,000 | 177,000 | 177,000 | **959,000** |
| Marketing & Ads | 20,000 | 40,000 | 60,000 | 70,000 | 80,000 | 90,000 | 100,000 | **460,000** |
| Herramientas (Stripe, Sentry, Resend, Calendly, Crisp, etc) | 8,000 | 8,000 | 9,000 | 10,000 | 11,000 | 12,000 | 13,000 | **71,000** |
| Legal / Contabilidad / SAT | 6,000 | 4,000 | 4,000 | 4,000 | 4,000 | 4,000 | 4,000 | **30,000** |
| Hosting (Supabase Pro + Vercel) | 1,500 | 1,500 | 2,000 | 2,500 | 3,000 | 3,500 | 4,000 | **18,000** |
| **Gastos totales** | **147,500** | **170,126** | **195,738** | **227,122** | **260,303** | **315,029** | **337,062** | **1,652,880** |
| **EBITDA mensual** | **(147,500)** | **(140,772)** | **(149,192)** | **(162,222)** | **(165,699)** | **(187,219)** | **(165,492)** | **(1,118,096)** |
| Cash burn acumulado | (147,500) | (288,272) | (437,464) | (599,686) | (765,385) | (952,604) | (1,118,096) | — |

> **Lectura honesta:** el año 2026 cierra con **pérdida operativa MXN ~$1.12 M** (inversión en crecimiento) pero entrando a 2027 con **ARR MXN $1.42 M** y break-even proyectado entre **abril–mayo 2027** al alcanzar ~280 clientes.

### 8.4 Escenarios (Sensibilidad)

| Escenario | Clientes cierre 2026 | MRR Dic | Ingresos totales 2026 | Burn 2026 |
|---|---|---|---|---|
| Pesimista (CAC sube 60 %, churn 7 %) | 95 | $74,100 | $362,000 | $1.45 M |
| **Base** | **152** | **$118,560** | **$534,784** | **$1.12 M** |
| Optimista (referidos 20 % CAC, churn 3 %) | 220 | $171,600 | $762,000 | $0.78 M |

### 8.5 Necesidad de capital

| Concepto | Monto MXN |
|---|---|
| Cash burn 7 meses (escenario base) | $1,120,000 |
| Reserva colchón (3 meses extra) | $510,000 |
| Inversión hardware inventario inicial (30 kits) | $120,000 |
| Buffer legal/contingencias | $100,000 |
| **Total a levantar (pre-seed/founder)** | **$1,850,000 MXN ≈ USD $105K** |

> Si no se levanta capital externo, las palancas son: (a) cobrar plan anual upfront (descuento 16 %) para anticipar caja, (b) hardware solo contado (no financiar), (c) recortar marketing 50 % y forzar canal outbound + referidos.

---

## 9. RISK REGISTER (PMI)

| ID | Riesgo | Probab. | Impacto | Sev. | Mitigación | Owner |
|---|---|---|---|---|---|---|
| R-01 | Bug crítico en producción afecta operación restaurante | Media | Alto | 🔴 | Smoke tests E2E + rollback rápido + on-call 24/7 primeros 60 d | Tech Lead |
| R-02 | CFDI integración se atrasa | Alta | Alto | 🔴 | Plan B: alianza con contador externo manual 1er mes | Backend |
| R-03 | CAC real > $2,500 (Meta no convierte) | Media | Alto | 🟠 | Pivot a outbound directo + alianzas B2B | CMO |
| R-04 | Churn > 8 % primer trimestre | Media | Alto | 🟠 | CSM proactivo + health score + onboarding asistido | CX Lead |
| R-05 | Competencia baja precios | Baja | Medio | 🟡 | Diferenciación por UX/soporte, no precio | CEO |
| R-06 | Supabase outage > 2 h | Baja | Alto | 🟠 | Modo offline ya implementado + monitor + plan migración self-host | DevOps |
| R-07 | Multa LFPDPPP/INAI por privacidad | Baja | Alto | 🟠 | ToS + aviso + DPO externo | Legal |
| R-08 | Fraude con tarjetas robadas → chargebacks | Media | Medio | 🟡 | Stripe Radar + manual review primeros 90 d | Finance |
| R-09 | Equipo clave renuncia | Baja | Alto | 🟠 | Equity vesting + documentación + redundancia | CEO |
| R-10 | Tipo de cambio USD/MXN sube costos (Supabase, Stripe USD) | Media | Medio | 🟡 | Pricing en MXN + revisar trimestralmente | CFO |

---

## 10. KPIs Y CADENA DE VALOR

### 10.1 KPIs comerciales (semanal)

| KPI | Meta sem 4 | Meta sem 8 | Meta sem 12 |
|---|---|---|---|
| Demos agendadas / sem | 10 | 25 | 40 |
| Tasa demo → cliente | 25 % | 30 % | 35 % |
| Nuevos clientes / sem | 3 | 6 | 10 |
| CAC | $1,800 | $1,400 | $1,200 |
| MRR | $4,200 | $20,000 | $39,000 |
| NPS | n/a | 40 | 55 |
| Churn mensual | n/a | 5 % | 4 % |

### 10.2 KPIs producto (mensual)

- Tiempo onboarding promedio: **≤ 25 min**.
- Errores P0 / mes: **0**.
- Uptime mensual: **≥ 99.5 %**.
- Tickets soporte por cliente activo: **≤ 1.5 / mes**.

---

## 11. PLAN DE CONTINGENCIA Y ESCENARIOS

### 11.1 Si en Sem 8 no llegamos a 13 clientes:

- Pivotear a outbound puro (founder hace 30 visitas/semana).
- Reducir precio Beta a $399 (Básico) por 3 meses para destrabar fricción.
- Considerar canal "operadores de delivery" (Rappi/Uber) como aliado.

### 11.2 Si churn > 7 % en mes 3:

- Pause de crecimiento, foco 100 % en producto + onboarding.
- Entrevistas 1:1 con todos los churned.
- Iniciar programa de reembolso parcial pro-rata para evitar reseñas negativas.

### 11.3 Si CAC > $2,500 sostenido:

- Cortar Google Ads (CPC alto).
- Doblar TikTok orgánico + influencers gastronómicos micro.
- Mover 40 % de marketing a programa de referidos pagados a partners.

---

## 12. ANEXOS

### A1. Cálculo unitario detallado (1 cliente promedio)

```
Mes 1 (mes de adquisición):
  Ingreso suscripción           +780
  COGS suscripción              -257
  CAC                         -1,300
  Margen mes 1                  -777

Mes 2 a 25 (vida promedio 25 meses, churn 4%):
  Ingreso suscripción           +780 × 24 = 18,720
  COGS suscripción              -257 × 24 =  6,168
  Margen acumulado mes 2-25                12,552

LTV total (sin descuento)                   12,552 - 777 = 11,775
+ Margen hardware (30% prob × $998)            +299
+ Margen setup (15% × $1,200)                  +180
LTV ajustado                                ≈ 12,254

NPV LTV (descuento 12% anual)               ≈ 10,800
```

### A2. Roadmap producto Q4 2026 (post-Go-Live)

- App nativa Android (React Native) — Oct.
- Módulo de delivery propio con repartidor — Nov.
- Integración facturación global mensual SAT — Nov.
- API pública para integraciones (Rappi, Uber, contabilidad) — Dic.
- Multi-sucursal con consolidador para grupos — Dic.

### A3. Stack legal/fiscal mínimo MX

- SAS de C.V. o persona física actividad empresarial.
- Inscripción RFC + e.firma + sello digital.
- Aviso de privacidad publicado.
- Convenio con PAC (Facturama o SW-Sapien) para CFDI 4.0.
- Términos de Servicio firmados al alta de cliente.

### A4. Herramientas operativas SaaS (stack interno)

| Función | Herramienta | Costo / mes |
|---|---|---|
| Code & deploy | GitHub + Vercel | $40 |
| DB & Auth | Supabase Pro | $25 |
| Pagos | Stripe (3.6 % + IVA) | variable |
| Soporte | Crisp + WhatsApp Business | $25 |
| Email transaccional | Resend | $20 |
| Calendario demos | Calendly | $12 |
| Errores | Sentry | $26 |
| Analítica | PostHog free + GA4 | $0 |
| CRM ventas | HubSpot Starter | $20 |
| **Total stack interno** | — | **~$168 USD ≈ $3,000 MXN** |

---

## CIERRE EJECUTIVO

KŌSO POS llega al 2-jun-2026 con un producto técnicamente robusto, una arquitectura SaaS multi-tenant funcional y un modelo de pricing validado en el mercado mexicano. Las **3 brechas críticas a cerrar antes del 1-jul** son: **CFDI, Webhook Stripe y Landing**. Con un equipo de 4.5 FTE y una inversión de ~**MXN $1.85 M** durante el segundo semestre, el plan proyecta cerrar 2026 con **152 clientes activos, MRR de MXN $118 K** y un camino claro a break-even en el Q2 2027.

> **El éxito del trimestre se mide por una sola métrica:** **30 clientes pagando al 1-sep-2026.** Toda decisión semanal debe contestar "¿esto nos acerca a esos 30?".

---

*Documento vivo. Próxima revisión: 2026-09-01.*
