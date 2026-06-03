# ServiRest — Modalidades por Plan & Estrategia Visual Tier-Aware
### Documento estratégico CTO + Founder · v1.0 · 2026-06-02

| Campo | Valor |
|---|---|
| Tipo | Estrategia de producto · pricing · diferenciación visual |
| Owner | Julio Ibarra (CEO/Founder) |
| Estado | Borrador para revisión Steering 16-jun |
| Reemplaza | `Billing.tsx` PLAN_TIERS hardcoded · `SubscriptionContext` modelo binario Básico/Pro |

> **Tesis:** un sello editorial gastronómico no se vende con la misma cara a una taquería de barrio que a un restaurante de Polanco. **Mismo producto, distinta máscara de marca**. Esencial y Profesional comparten alma (hermano-del-rubro, denso, operativo, cálido); Prestige eleva el lenguaje visual sin abandonar la paleta — más editorial, más fotografía, más aire — para que el dueño de un fine dining no sienta que está usando "el POS de su fonda".

---

## 1. EL PROBLEMA QUE ESTAMOS RESOLVIENDO

ServiRest hoy ofrece dos planes (`Básico $550`, `Pro $849.99`) que son **funcionalmente** distintos pero **visualmente idénticos**. Eso funciona para el mercado pyme. **No** funciona para el mercado high-end:

- El dueño de un restaurante en Polanco (ticket promedio $850–$1,400, vinos por copa, sommelier, reservaciones críticas) **no compra herramientas que parezcan "para todos"**.
- El restaurante de barrio no necesita features de prestige (reservaciones con confirmación automática, gestor de propinas avanzado, multi-sucursal, carta digital pública) y **se confundiría** con una interfaz más editorial.
- Vender un solo SKU al techo del mercado nos deja **MXN $1,500–$3,000 mensuales por restaurante sobre la mesa** en el segmento que paga más.

**El error de muchos POS LATAM** (Loyverse, Sysme, Maxirest) es asumir que el mercado high-end es pequeño y no vale la pena diferenciar. La realidad: México tiene **~8,000 restaurantes en corredor premium** (Polanco, Roma, Condesa, Coyoacán, San Pedro Garza García, Providencia, Mérida Centro, Cuauhtémoc QRO, Centro Histórico Puebla, Valle de Guadalupe, etc.). A MXN $2,499/mes eso es **MXN $240M ARR de TAM premium**. Capturar 1% es **MXN $2.4M ARR**. Esto justifica el tier.

---

## 2. NUEVA ESTRUCTURA DE PLANES

### 2.1 Tabla maestra

| Plan | Precio mensual | Anual | Target | Equipo típico | Branding |
|---|---|---|---|---|---|
| **Esencial** | **$549 MXN** | $5,490 (2m grat) | Fondas, cafeterías, taquerías formales, food trucks con local, locales 4–8 mesas | 1–4 personas, ticket $80–$220 | Co-branded ServiRest |
| **Profesional** ⭐ | **$899 MXN** | $8,990 (2m grat) | Restaurantes pyme 8–30 mesas en zonas residenciales o comerciales medias | 5–18 personas, ticket $180–$450 | Co-branded ServiRest |
| **Prestige** | **$2,499 MXN** | $24,990 (2m grat) | Restaurantes en corredor premium, conceptos boutique, hoteles 4★–5★, fine dining, omakase, restaurantes con sommelier | 12–40 personas, ticket $600–$1,800 | Cobranded discreto (logo cliente prominente, ServiRest "Powered by") |
| **Enterprise** | Custom | Custom | Cadenas 5+ sucursales, franquicias, grupos restauranteros | 80+, ticket variable | White label total opcional |

### 2.2 Inclusiones por tier (matriz completa)

| Módulo / Feature | Esencial | Profesional | Prestige | Enterprise |
|---|:---:|:---:|:---:|:---:|
| **Operación diaria** | | | | |
| POS Línea de Órdenes | ✅ | ✅ | ✅ | ✅ |
| Caja, cuadre de día, cierres | ✅ | ✅ | ✅ | ✅ |
| Tickets impresos (térmica) | ✅ | ✅ | ✅ | ✅ |
| Mesas (gestión visual) | ✅ hasta 8 | ✅ hasta 50 | ✅ ilimitadas | ✅ ilimitadas |
| Hostess + waitlist | — | ✅ | ✅ | ✅ |
| KDS (Kitchen Display) | — | ✅ | ✅ | ✅ |
| Bar separado de cocina | — | ✅ | ✅ | ✅ |
| Mesero móvil (PWA) | ✅ | ✅ | ✅ | ✅ |
| **Catálogo y producto** | | | | |
| Menú con variantes | ✅ 200 prod | ✅ 1000 prod | ✅ ilimitado | ✅ ilimitado |
| Categorías y modificadores | ✅ | ✅ | ✅ | ✅ |
| Wine list module (maridajes) | — | — | ✅ | ✅ |
| Coctelería con receta y costeo | — | — | ✅ | ✅ |
| Carta digital pública (URL propia + QR) | — | — | ✅ | ✅ |
| **Inventario y proveedores** | | | | |
| Inventario básico | ✅ | ✅ | ✅ | ✅ |
| Inventario avanzado + proveedores | — | ✅ | ✅ | ✅ |
| Food cost por platillo | — | ✅ | ✅ | ✅ |
| Margin engineering (análisis menú) | — | — | ✅ | ✅ |
| **Personas** | | | | |
| Empleados | 5 | 20 | 50 | Ilimitados |
| PIN tablet por empleado | ✅ | ✅ | ✅ | ✅ |
| Roles personalizados | — | ✅ (3 roles) | ✅ (8 roles) | ✅ ilimitados |
| Gestor avanzado de propinas y splits | — | — | ✅ | ✅ |
| **Comercial** | | | | |
| Reservaciones (visual) | — | — | ✅ | ✅ |
| Confirmación WhatsApp + email automatizada | — | — | ✅ | ✅ |
| Programa de comensales (CRM ligero) | — | — | ✅ | ✅ |
| Orden remota (Rappi, Uber Eats, DiDi) | — | ✅ | ✅ | ✅ |
| **Reportes y finanzas** | | | | |
| Dashboard básico | ✅ | ✅ | ✅ | ✅ |
| Reportes financieros (PDF, periodos) | — | ✅ | ✅ | ✅ |
| Reportes con KPIs hospitality (RevPASH, etc.) | — | — | ✅ | ✅ |
| CFDI 4.0 (timbres incluidos) | 50/mes | 200/mes | 1,000/mes | Volumétrico |
| **Multi-tenancy** | | | | |
| Sucursales | 1 | 1 | 5 | Ilimitadas |
| Terminales (POS concurrentes) | 1 | 5 | 12 | Ilimitadas |
| **Soporte** | | | | |
| Email | ✅ | ✅ | ✅ | ✅ |
| WhatsApp (lun-sáb 9–18) | ✅ | — | — | — |
| WhatsApp prioritario (lun-dom 8–22) | — | ✅ | ✅ | ✅ |
| Account manager dedicado | — | — | ✅ | ✅ |
| Onboarding asistido on-site | — | — | ✅ | ✅ |
| SLA (uptime mensual) | 99.0% | 99.3% | 99.5% | 99.9% |
| **Integraciones** | | | | |
| Stripe (cobro recurrente del cliente final, opcional) | — | ✅ | ✅ | ✅ |
| API pública (webhooks, REST) | — | — | ✅ | ✅ |
| Integración PMS hotel (Opera, Cloudbeds, Mews) | — | — | ✅ | ✅ |
| Integración ERP (SAP, Microsip, Contpaqi) | — | — | — | ✅ |
| **Marca** | | | | |
| Branding co-cliente (logo cliente + "Powered by ServiRest") | — | — | ✅ | ✅ |
| White label completo | — | — | — | ✅ |
| Carta digital con marca del cliente | — | — | ✅ | ✅ |

### 2.3 Lógica de upgrade

| De → A | Razón típica | Ofrecemos |
|---|---|---|
| Esencial → Profesional | Más de 8 mesas · necesidad de KDS · contrataron 6º empleado · agregan delivery | Modal contextual ("Tu 9ª mesa requiere Profesional"); upgrade en 1 click; pro-rate del mes en curso |
| Profesional → Prestige | Reservaciones críticas · sommelier · 2ª sucursal · quieren carta digital con su URL · ticket promedio > $600 | Nudge en QBR mensual: "Tu ticket promedio ($720) y el % de reservas no-show (12%) sugieren Prestige"; demo personalizada |
| Cualquiera → Enterprise | 5ª sucursal o franquicia | Contacto sales; pricing por volumen |

---

## 3. DIFERENCIACIÓN VISUAL POR TIER

### 3.1 Principio rector

**Mismo design system. Distinto "modo".** No vamos a mantener tres React trees ni tres bibliotecas de componentes. Aplicamos un atributo `data-tier="esencial" | "pro" | "prestige" | "enterprise"` en `<body>` y dejamos que CSS variables y unas pocas overrides hagan el resto.

### 3.2 ESENCIAL + PROFESIONAL (mismo modo: "Sobremesa Operativa")

- Paleta Sobremesa Lúcida estándar (terracota CTA, hueso canvas, midnight sidebar).
- Tipografía:
  - Display: Fraunces 500 italic, 32–38px en headers.
  - Brutal headers: Inter 900 italic uppercase −0.03em tracking.
  - Cuerpo: Inter 400 regular.
- Densidad operativa: cards 24px radius, padding 20px, spacing entre módulos 16–22px.
- Animaciones: 0.18–0.30s, ease-out — rápidas, funcionales.
- Photography: opcional, tarjetas de platillo 150×150 (suficiente para identificación rápida en POS).
- Copy: "hermano del rubro", tuteo, datos al frente ("Reduce food cost 6–12%"), ningún cliché de fine dining.

> Cuando un dueño de fonda en Iztapalapa abre el POS, lo siente **suyo**: directo, denso, cálido. Cuando un dueño de restaurante medio en Coyoacán abre el mismo POS, lo siente **profesional**: mismo lenguaje, más módulos. **No hay fricción de marca entre estos dos tiers**, lo que hace el upgrade Esencial → Profesional trivial.

### 3.3 PRESTIGE (modo "Sobremesa Editorial")

Sobre la misma paleta, aplicamos un set de overrides que **eleva** sin cambiar de identidad:

| Dimensión | Sobremesa Operativa | **Sobremesa Editorial (Prestige)** |
|---|---|---|
| Type scale display | 32–38px | **64–80px** Fraunces italic con opsz 144 max |
| Body para cartas / menús | Inter 400 16px | **Fraunces 400 18px line-height 1.7** |
| Eyebrow / kicker | Inter 900 italic uppercase 10px tracking .4em | **Fraunces 500 italic 11px** (más editorial, menos brutal) |
| Card radius | 24px | **32px** (más generoso) |
| Card padding | 20–22px | **32–40px** |
| Spacing scale | múltiplos de 4 | **múltiplos de 8** (1.5x más aire) |
| Animaciones | 0.18–0.30s ease-out | **0.45–0.60s ease-solaris** (más cinemáticas) |
| Photography | 150×150 tarjetas POS | **280×210 con grano sutil + warm grade** |
| Acentos | Terracota CTA · mostaza badge | **+ capa de gold pegado a mostaza para insignias premium** (`#D4A857` sobre mostaza `#C9A24A`) |
| Modo oscuro opcional | No | **Sí: "Carta de Noche" — midnight canvas + hueso text + terracota accent** (para uso en restaurantes con iluminación tenue, evita deslumbre al cliente cuando ven la carta digital) |
| Sidebar | 96→256 hover | **Permanente 256 + estilo "wax seal" del Plato Asimétrico en oro** |
| Header de pantalla | Brutal Fraunces 32px | **Editorial Fraunces 64px + eyebrow tipo revista ("Sobremesa · Cocina") + filete dorado bajo título** |
| Tarjetas de menú (público) | Grid 190px | **Layout tipo carta impresa: 2 columnas, secciones con preludio en Fraunces italic ("De la huerta · cinco platos para empezar"), foto rectangular 4:5** |
| Modales | 480–760 max-width | **640–880 max-width**, animación slide-up 600ms |
| Sonido | Sin sonido | **Sonido opcional sutil al confirmar orden (campanita de cobre, una sola nota)** |
| Branding | "ServiRest" en header | **Logo del cliente prominente · "Powered by ServiRest" en footer con tipografía elegante** |

### 3.4 Implementación técnica (un solo codebase)

```css
/* index.css — añadir bajo los tokens existentes */

/* PRESTIGE TIER OVERRIDES */
[data-tier="prestige"] {
  --sr-r-xl: 32px;
  --sr-r-2xl: 40px;
  --sr-dur-fast: 0.30s;
  --sr-dur: 0.45s;
  --sr-dur-slow: 0.60s;
  --sr-mostaza-gold: #D4A857;
}

[data-tier="prestige"] .sr-h1 {
  font-size: clamp(48px, 5vw, 64px);
  line-height: 1.05;
  font-variation-settings: "opsz" 144, "SOFT" 60;
}

[data-tier="prestige"] .sr-card,
[data-tier="prestige"] .sr-card-solaris {
  border-radius: 32px;
}

[data-tier="prestige"] .sr-section-padding {
  padding: 56px 48px;
}

/* PRESTIGE NIGHT MODE (opcional, persistido por usuario) */
[data-tier="prestige"][data-prestige-night="true"] {
  --sr-bg: var(--sr-midnight);
  --sr-bg-sunken: var(--sr-midnight-soft);
  --sr-surface: var(--sr-midnight-card);
  --sr-fg: var(--sr-hueso);
  --sr-fg-mute: rgba(250, 248, 244, 0.65);
}
```

```tsx
// App.tsx — aplicar tier al body
useEffect(() => {
  const tier = authProfile?.businessTier || 'esencial';
  document.body.dataset.tier = tier;
}, [authProfile?.businessTier]);
```

```ts
// SubscriptionContext — añadir tier y planLimits
export type BusinessTier = 'esencial' | 'profesional' | 'prestige' | 'enterprise';
export interface PlanLimits {
  maxTables: number;
  maxEmployees: number;
  maxProducts: number;
  maxLocations: number;
  maxConcurrentTerminals: number;
  cfdiStampsPerMonth: number;
  branding: 'shared' | 'cobranded' | 'whitelabel';
  slaUptime: number; // 0.99, 0.993, 0.995, 0.999
}

const TIER_LIMITS: Record<BusinessTier, PlanLimits> = {
  esencial:    { maxTables: 8,        maxEmployees: 5,  maxProducts: 200,       maxLocations: 1, maxConcurrentTerminals: 1,  cfdiStampsPerMonth: 50,    branding: 'shared',     slaUptime: 0.990 },
  profesional: { maxTables: 50,       maxEmployees: 20, maxProducts: 1000,      maxLocations: 1, maxConcurrentTerminals: 5,  cfdiStampsPerMonth: 200,   branding: 'shared',     slaUptime: 0.993 },
  prestige:    { maxTables: 999,      maxEmployees: 50, maxProducts: 999999,    maxLocations: 5, maxConcurrentTerminals: 12, cfdiStampsPerMonth: 1000,  branding: 'cobranded',  slaUptime: 0.995 },
  enterprise:  { maxTables: 999999,   maxEmployees: 999, maxProducts: 999999,   maxLocations: 999, maxConcurrentTerminals: 999, cfdiStampsPerMonth: 999999, branding: 'whitelabel', slaUptime: 0.999 },
};
```

### 3.5 Lo que NO cambia entre tiers

- **El motor de POS Línea de Órdenes** es el mismo (todos lo usan idéntico).
- **El flujo de pago al cliente final** es el mismo (Stripe Checkout).
- **La base de datos Supabase** es la misma (multi-tenant RLS).
- **El ciclo waiter → kitchen → cashier** es idéntico.
- **El idioma y la voz** ("hermano del rubro") se mantienen — Prestige no se vuelve frío ni corporate; sigue siendo cálido, solo que con más espacio y mejor tipografía.

---

## 4. ROADMAP DE IMPLEMENTACIÓN (este trimestre)

### Sprint 1 (esta semana)
- Rebuild `Billing.tsx` con los 3 tiers (Esencial, Profesional, Prestige) + comparativa funcional + CTA contextual por tier actual del usuario.
- Añadir `BusinessTier` y `TIER_LIMITS` a `SubscriptionContext`.
- Aplicar `data-tier` al body desde `App.tsx`.
- Añadir overrides Prestige al `index.css`.

### Sprint 2
- `TierUpgradePrompt` component que se inserta contextualmente (al alcanzar límites, al intentar abrir feature gated).
- Refactor visual de `Onboarding.tsx` (split into PLAN → BUSINESS INFO → KITCHEN SETUP — solo 3 pasos visibles, los otros se completan ya operando).
- Refactor de `LockScreen.tsx` con avatares más editoriales.
- Visual upgrade de `AuthScreen.tsx` (split layout, hero brand statement).

### Sprint 3
- Refactor visual de `Settings.tsx` con un nuevo panel "Plan & Modalidades" arriba.
- Refactor de `MyTables.tsx` + `Hostess.tsx` con más aire.
- Build del módulo de **Reservaciones** (Prestige only) — primera feature exclusiva de Prestige.

### Sprint 4
- Build de **Carta digital pública** (Prestige) — `/c/[restaurant-slug]` con su propio dominio opcional. Esta es la *killer feature* de Prestige porque convierte el POS en marketing.
- Build de **Wine list module** (Prestige) con maridajes.
- Photography pack — 30 fotos profesionales de platillos mexicanos (warm top-lit) que Prestige incluye gratis.

### Sprint 5
- Pricing público en landing con los 3 tiers + calculadora "¿cuál es para mí?".
- Sales playbook diferenciado por tier: Esencial es self-service, Profesional es self-service + WhatsApp humano, Prestige es **founder-led con demo en vivo y propuesta personalizada**.

---

## 5. IMPACTO ECONÓMICO PROYECTADO

### 5.1 Mix actual vs proyectado (cierre 2026)

| Plan | Mix actual (modelo binario) | Mix proyectado (3 tiers) | ARPU contribución |
|---|---|---|---|
| Esencial | 50% × $549 = $275 | 40% × $549 = $220 | — |
| Profesional | 50% × $850 = $425 | 45% × $899 = $405 | — |
| Prestige | n/a | 12% × $2,499 = $300 | +$300 |
| Enterprise | n/a | 3% × $6,000 prom = $180 | +$180 |
| **ARPU blended** | **$700** | **$1,105** | **+58%** |

> A 153 clientes Dic 2026 (escenario base recalibrado): **MRR Dic 2026 sube de $107K MXN a $169K MXN** (+58%). Esto sin sumar más clientes — solo por mejorar el mix vía Prestige.

### 5.2 Targeting Prestige (M7–M12)

- 18–20 clientes Prestige al cierre 2026 (12% × 153).
- Pipeline target: 5–8 demos Prestige/mes desde sept.
- Channel: founder-led, no Meta Ads. Lista warm de 30 restaurantes en Polanco/Roma/Condesa identificados por Apify.
- Cierre rate esperado: 25–35% (más alto que pyme porque el dolor es más caro: pierden $50K MXN/mes por no-show de reservas mal gestionadas).

### 5.3 Risk

- **Prestige falla en captura** si el visual y el copy se sienten "pyme con maquillaje". Por eso el refactor visual de Billing + Onboarding + Settings es **bloqueante** para abrir el canal Prestige.
- **Esencial/Pro pueden sentirse degradados** si la diferenciación visual de Prestige es muy brutal (FOMO inverso). Mitigación: el modo Sobremesa Operativa sigue siendo cálido y hermoso; Prestige solo agrega aire y tipografía editorial, no resta.

---

## 6. CIERRE EJECUTIVO

> **Lo que estamos comprando con el tercer tier no son features; es identidad.** Un restaurante de Polanco no paga $2,499 por reservaciones (existen apps gratis para eso). Paga porque la herramienta **dignifica** su propuesta. Visualmente debe sentir que es parte del establecimiento, no un parche. Es el mismo software, pero con la respiración pausada que el segmento espera.

Los siguientes commits ejecutan este plan:

1. **Refactor `Billing.tsx`** con 3 tiers, comparativa funcional, copy ServiRest, paleta Sobremesa Lúcida (la pantalla actual está en dark mode + slate + blue — fuera de marca).
2. **Refactor `SubscriptionContext`** con `BusinessTier`, `planLimits`, `TIER_LIMITS`, helpers `isWithinLimit('tables', n)`.
3. **Overrides Prestige en `index.css`** + `data-tier` en `App.tsx`.
4. **Refactor `Onboarding.tsx`** simplificado a 3 pasos visibles + invitación al tier que corresponde.
5. **Refactor `AuthScreen.tsx` + `LockScreen.tsx`** con split layout editorial.
6. **Upgrade visual del Sidebar + Dashboard + MyTables + Hostess + Settings** sobre el patrón establecido en POS Línea de Órdenes.
7. **Nuevo componente `<TierGate>`** para nudges contextuales al alcanzar límites.

---

*Documento estratégico. Próxima revisión: Steering 16-jun-2026.*
