# ServiRest — Facturación electrónica (CFDI 4.0) · Decisión y costos
### Documento estratégico · 2026-06-03

| Campo | Valor |
|---|---|
| Tipo | Decisión técnica + impacto en plan de negocio |
| Owner | Julio Ibarra (Project Leader KŌSO POS / ServiRest) |
| Decisión | **Facturama** como proveedor PAC (Proveedor Autorizado de Certificación) |
| Plan gateado | **CFDI solo disponible desde Profesional** (Esencial NO factura) |
| Impacto en margen | +$0.50–0.70 MXN por timbre · ya considerado en COGS del modelo financiero |

> **Lo que esto resuelve:** la facturación CFDI 4.0 es un requisito fiscal en México (SAT obliga a todos los contribuyentes con actividad empresarial). No tenerla bloquea a clientes formales. Pero implementarla **mal** quema margen: cada factura cuesta dinero al PAC. Este doc decide a quién facturar, con qué proveedor, y cómo monetizarlo sin perder margen.

---

## 1. El problema de decisión

México tiene ~15 PACs autorizados por el SAT. Las opciones realistas para un POS SaaS son 5:

| PAC | Precio por timbre (volumen pyme) | API REST | Sandbox | CFDI 4.0 | Veredicto |
|---|---|---|---|---|---|
| **Facturama** | **$0.50 MXN** (paquetes 100/500/1000) | ✅ moderna | ✅ libre | ✅ | **Ganador** |
| SW Sapien | $0.30–0.70 MXN (escala) | ✅ | ✅ | ✅ | Más barato a escala (>5k/mes), pero onboarding lento y soporte intermitente |
| FactureHoy | $0.45 MXN | ✅ | ✅ | ✅ | Buena alternativa, marca menos conocida |
| FacturaCom | $0.60 MXN | ✅ | ❌ requiere setup manual | ✅ | Más caro y fricción técnica |
| Edicom / Solución Factible | $0.80–1.20 MXN | ✅ pero SOAP/REST mixto | ✅ | ✅ | Enterprise — overkill para pyme |

### 1.1 Por qué Facturama

1. **Precio competitivo y simple**: $0.50/timbre en paquetes pyme. Sin minimum mensual.
2. **Sandbox real**: tienen un endpoint `https://apisandbox.facturama.com.mx` que emite CFDIs de prueba con tu RFC genérico de pruebas (`EKU9003173C9`).
3. **API REST moderna**: endpoints documentados en `https://api.facturama.com.mx`. Auth con basic auth (usuario + password) — no OAuth complicado.
4. **CFDI 4.0 nativo**: soporta el nuevo schema desde abril 2023.
5. **Onboarding rápido**: registras la cuenta en Facturama → te dan credenciales sandbox al día siguiente → en 1 semana migras a producción con tu CSD real.

### 1.2 Por qué NO SW Sapien aunque sea más barato

A volumen bajo (<2,000 timbres/mes), el ahorro de $0.20/timbre = $400/mes. Pero el costo de oportunidad de un onboarding más lento + soporte menos responsivo se come la diferencia. Cuando ServiRest llegue a >5,000 timbres/mes, **reevaluar**: en ese punto $1,000+/mes de ahorro justifica el switch.

---

## 2. Pricing y gating por tier

### 2.1 Tabla definitiva

| Plan | CFDI incluido | Timbres incluidos / mes | Timbre extra (sobreuso) | Costo a ServiRest por timbre | Margen ServiRest |
|---|---|---|---|---|---|
| **Esencial** ($549/mes) | ❌ **No factura** | 0 | n/a | n/a | n/a |
| **Profesional** ($899/mes) | ✅ | **200 timbres** | $2.50 MXN c/u | $0.50 | $2.00 (4×) |
| **Prestige** ($2,499/mes) | ✅ | **1,000 timbres** | $1.50 MXN c/u | $0.50 | $1.00 (3×) |
| **Enterprise** (custom) | ✅ | Ilimitado | Pricing por volumen | $0.30–0.50 | Negociado |

### 2.2 Por qué Esencial NO factura

- **Mercado real**: fondas, taquerías, cafés, food trucks. La gran mayoría son personas físicas con actividad empresarial bajo RIF/RESICO que **no facturan al cliente final**. Cobran ticket simple, no CFDI.
- **Costo unitario**: si Esencial incluyera CFDI a $549/mes, los 50 timbres × $0.50 = $25 MXN/mes. Aceptable, pero…
- **Costo real verdadero**: cada timbre requiere un cliente con RFC válido, datos fiscales, y nuestro tiempo de soporte explicándoles "qué es CFDI 4.0". Para una fonda, eso es **soporte caro**.
- **Apalancamiento de upgrade**: cuando una fonda crece y un cliente le pide factura, el dueño ya tiene la urgencia de subir a Profesional ($899). El gateo de CFDI es nuestro mejor anchor de upsell Esencial → Profesional.

### 2.3 Costo CFDI dentro de cada plan

| Plan | Ingreso bruto/mes | COGS CFDI (timbres incluidos) | COGS otros (Stripe, Supabase, etc.) | Margen neto |
|---|---|---|---|---|
| Esencial | $549 | $0 | ~$257 | 53.2% |
| Profesional | $899 | $0.50 × 200 = $100 | ~$257 | **60.3%** |
| Prestige | $2,499 | $0.50 × 1,000 = $500 | ~$257 (+ account manager $200) | **62.1%** |

Resultado: **el costo de CFDI no degrada el margen** porque está cobrado en el precio del plan. Los timbres extra que un Pro consume arriba de 200 son **margen puro adicional** ($2.50 cobrado − $0.50 costo = $2.00).

### 2.4 Sobreuso (importante)

Si un Profesional consume 250 timbres en un mes:
- 200 incluidos → cubiertos por el plan
- 50 extra → ServiRest le factura $2.50 × 50 = **$125 MXN adicionales** al cargo mensual
- ServiRest paga al PAC $0.50 × 50 = $25
- Margen sobreuso: $100 (80%)

Esto se anuncia en la app: "Llevas 187 de 200 timbres este mes. Cada timbre extra cuesta $2.50".

---

## 3. Implementación técnica

### 3.1 Variables de entorno (Vercel)

```
FACTURAMA_USER          tu_usuario_facturama
FACTURAMA_PASS          tu_password_facturama
FACTURAMA_ENV           sandbox | production
FACTURAMA_API_BASE_URL  https://apisandbox.facturama.com.mx (sandbox)
                        https://api.facturama.com.mx (production)
```

### 3.2 Endpoint nuevo `/api/cfdi/issue`

```typescript
// api/cfdi/issue.ts (a crear)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const FACTURAMA = process.env.FACTURAMA_API_BASE_URL!;
const AUTH = 'Basic ' + Buffer.from(
  `${process.env.FACTURAMA_USER}:${process.env.FACTURAMA_PASS}`
).toString('base64');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { businessId, orderId, receiverRfc, receiverName, receiverPostalCode,
          receiverEmail, cfdiUse, items, paymentMethod } = req.body;

  // 1. Verificar plan del business (gate Esencial)
  const supabase = createClient(...);
  const { data: biz } = await supabase
    .from('businesses')
    .select('business_tier, cfdi_stamps_used_this_month')
    .eq('id', businessId).single();
  if (biz.business_tier === 'esencial') {
    return res.status(403).json({ error: 'CFDI no disponible en plan Esencial' });
  }

  // 2. Construir CFDI payload (Facturama spec)
  const cfdi = {
    Issuer: { /* business's CSD data */ },
    Receiver: { Rfc: receiverRfc, Name: receiverName,
                CfdiUse: cfdiUse, FiscalRegime: '...', TaxZipCode: receiverPostalCode },
    Items: items.map(i => ({
      ProductCode: '01010101', Quantity: i.qty,
      Description: i.name, UnitPrice: i.price,
      Total: i.qty * i.price, TaxObject: '02',
      Taxes: [{ Total: i.tax, Name: 'IVA', Rate: 0.16 }],
    })),
    PaymentForm: paymentMethod, // '01' efectivo, '04' tarjeta, etc
    PaymentMethod: 'PUE', // pago en una exhibición
    Currency: 'MXN',
    CfdiType: 'I', // Ingreso
  };

  // 3. Llamar Facturama
  const r = await fetch(`${FACTURAMA}/3/cfdis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: AUTH },
    body: JSON.stringify(cfdi),
  });
  const result = await r.json();

  // 4. Guardar referencia en Supabase + incrementar contador
  await supabase.from('cfdi_issued').insert({
    business_id: businessId, order_id: orderId,
    cfdi_uuid: result.Id, xml_url: result.LinksXml,
    pdf_url: result.LinksPdf, status: 'STAMPED',
    issued_at: new Date().toISOString(),
  });
  await supabase.rpc('increment_cfdi_counter', { biz: businessId });

  return res.status(200).json({
    uuid: result.Id, pdf: result.LinksPdf, xml: result.LinksXml,
  });
}
```

### 3.3 Tablas Supabase nuevas

```sql
-- Tabla de CFDIs emitidos
CREATE TABLE cfdi_issued (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  order_id uuid REFERENCES orders(id),
  cfdi_uuid text UNIQUE NOT NULL,          -- folio fiscal del SAT
  xml_url text NOT NULL,
  pdf_url text NOT NULL,
  receiver_rfc text,
  receiver_name text,
  amount numeric(10,2),
  status text DEFAULT 'STAMPED'
    CHECK (status IN ('STAMPED', 'CANCELED', 'PENDING')),
  issued_at timestamptz DEFAULT now(),
  canceled_at timestamptz
);
CREATE INDEX cfdi_business_idx ON cfdi_issued (business_id);
CREATE INDEX cfdi_order_idx ON cfdi_issued (order_id);

-- Counter por mes para sobreuso
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS
  cfdi_stamps_used_this_month integer DEFAULT 0,
  cfdi_stamps_reset_at timestamptz DEFAULT now();

-- RPC que incrementa y resetea cada mes
CREATE OR REPLACE FUNCTION increment_cfdi_counter(biz uuid) RETURNS void AS $$
BEGIN
  -- Reset si pasó un mes
  UPDATE businesses
  SET cfdi_stamps_used_this_month = 0, cfdi_stamps_reset_at = now()
  WHERE id = biz AND cfdi_stamps_reset_at < (now() - interval '30 days');
  -- Increment
  UPDATE businesses
  SET cfdi_stamps_used_this_month = cfdi_stamps_used_this_month + 1
  WHERE id = biz;
END; $$ LANGUAGE plpgsql;

-- Datos fiscales del negocio (para el emisor)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS
  fiscal_csd_cer_url text,
  fiscal_csd_key_url text,
  fiscal_csd_password text,        -- ENCRYPT at rest!
  fiscal_regime text,              -- 612, 621, 626, etc.
  fiscal_postal_code text;
```

### 3.4 Nuevo screen `/screens/Invoice.tsx`

Pantalla para emitir CFDI a una orden. Solo accesible si `meetsTier('profesional')` y `isFeatureEnabled('cfdi')`. Layout:

- Lista de órdenes COMPLETED del día con botón "Facturar" en cada una
- Modal con formulario (RFC, razón social, CP, uso CFDI, email)
- Stripe-like "stamps usados este mes": progress bar mostrando 187 / 200
- Historial: tabla con últimos 50 CFDIs emitidos (con links a PDF y XML)
- Si el counter llega a 200, muestra alert mostaza: "Llegaste al tope. Cada timbre extra cuesta $2.50."

---

## 4. Impacto en el plan de negocio

### 4.1 Cambios en `TIER_LIMITS` (SubscriptionContext.tsx)

```typescript
export const TIER_LIMITS: Record<BusinessTier, PlanLimits> = {
  esencial:    { ..., cfdiStampsPerMonth: 0     },  // antes 50, ahora 0
  profesional: { ..., cfdiStampsPerMonth: 200   },
  prestige:    { ..., cfdiStampsPerMonth: 1000  },
  enterprise:  { ..., cfdiStampsPerMonth: 999999 },
};
```

### 4.2 Cambios en `TIER_PRICING` (no cambia)

Los precios públicos se quedan igual ($549/$899/$2,499). El cambio en CFDI no requiere subir precios — el COGS es absorbido en el margen actual.

### 4.3 Forecast actualizado para 2026 (escenario base, 110 clientes Dic)

Sumando ingresos por sobreuso CFDI:

| Mix proyectado Dic | Clientes | Timbres prom usados/mes | Margen sobreuso |
|---|---|---|---|
| Esencial (44 cli) | 44 | n/a | $0 |
| Profesional (50 cli) | 50 | ~150 (bajo el cap) | $0 (sobreuso bajo) |
| Prestige (12 cli) | 12 | ~600 (bajo el cap) | $0 |
| Enterprise (4 cli) | 4 | ~3,000 | ~$2,000/mes promedio |
| **Total sobreuso adicional** | | | **~$8,000 MXN/mes** |

Esto **no es** un revenue stream a perseguir agresivamente — es un colchón. Más importante es el **upsell anchor de Esencial→Profesional** que CFDI desbloquea.

### 4.4 Costos operativos nuevos (a sumar al P&L)

| Concepto | Mensual |
|---|---|
| Facturama: licencia base | $0 (paga por uso) |
| Timbres consumidos (110 clientes × promedio 100/mes × $0.50) | $5,500 |
| Soporte CFDI primer trimestre (1 persona × 25%) | $7,500 |
| **Total nuevo costo CFDI** | **$13,000 MXN/mes** |

Esto **ya está cubierto en el COGS proyectado** ($257/cli × 50 Profesional + Prestige clientes = $12,850).

---

## 5. Checklist de implementación

### Sprint 1 — Setup (esta semana)
- [ ] Registrar cuenta Facturama en `https://facturama.com.mx`
- [ ] Pedir credenciales sandbox (24-48 hrs)
- [ ] Crear las 3 tablas Supabase (`cfdi_issued`, columnas en `businesses`, RPC `increment_cfdi_counter`)
- [ ] Añadir env vars en Vercel: `FACTURAMA_USER`, `FACTURAMA_PASS`, `FACTURAMA_ENV`, `FACTURAMA_API_BASE_URL`

### Sprint 2 — Backend (semana 2)
- [ ] Crear `/api/cfdi/issue.ts` (emisión)
- [ ] Crear `/api/cfdi/cancel.ts` (cancelación con motivo SAT)
- [ ] Crear `/api/cfdi/list.ts` (listado por business_id)
- [ ] Pruebas con RFC sandbox de Facturama (`EKU9003173C9`)

### Sprint 3 — Frontend (semana 3)
- [ ] Nuevo screen `screens/Invoice.tsx` con editorial layout
- [ ] Botón "Facturar" en `screens/Cashier.tsx` después de cobrar (solo si tier >= profesional)
- [ ] Modal con formulario fiscal del receptor
- [ ] Tab "Datos fiscales" en `screens/Settings.tsx` para subir CSD del emisor
- [ ] Progress bar de timbres usados/restantes en Billing

### Sprint 4 — Polish + Live (semana 4)
- [ ] Switch sandbox → production con credenciales Live Facturama
- [ ] Email automático con PDF + XML al cliente final (Resend)
- [ ] Reporte mensual de CFDIs emitidos en Dashboard
- [ ] Aviso de sobreuso en banner cuando llegan al 90% del cap

---

## 6. Notas de cumplimiento SAT

- **CSD obligatorio**: cada negocio debe subir su Certificado de Sello Digital (.cer + .key + password). Se almacena encriptado en Supabase Storage.
- **Régimen fiscal**: cada negocio captura su régimen (RESICO 626, RIF 621, Persona Moral 601, etc.). Se valida con catálogo SAT.
- **Uso CFDI**: el receptor escoge el uso (G03 Gastos en general, P01 Por definir, etc.). El campo va a Facturama tal cual.
- **Cancelación**: SAT requiere motivo de cancelación desde 2022 (01 errores, 02 sin operación, etc.). El UI debe pedirlo.
- **CFDI 4.0 vs 3.3**: ServiRest emite SOLO 4.0. No mantener compatibilidad con 3.3 (obsoleto desde abril 2023).

---

## 7. Decisión

✅ **Implementar con Facturama**, gateado al tier Profesional+, con 200/1000/∞ timbres incluidos y sobreuso a $2.50/timbre.

Esto se documenta también en:
- `TIER_STRATEGY_AND_VISUAL_DIFFERENTIATION.md` (matriz de features actualizada)
- `STRIPE_SETUP.md` (no cambia — CFDI no toca Stripe)
- `KOSO_PROJECT_DOSSIER.md` (sumar al backlog técnico de Sprint 1 del trimestre)

---

*Documento de decisión técnica. Próxima revisión: post-implementación de Sprint 1.*
