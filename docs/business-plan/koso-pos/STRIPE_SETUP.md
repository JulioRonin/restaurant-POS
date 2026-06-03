# ServiRest — Configuración Stripe (productos, precios, webhook)
### Guía de implementación · 2026-06-03

| Campo | Valor |
|---|---|
| Estado | Borrador para Julio · ejecutar en el dashboard Stripe |
| Webhook URL | `https://project-er5ks.vercel.app/api/webhook` |
| Webhook estado actual | Activo · 51 eventos suscritos · 0 entregas (sin clientes pagando aún) |
| Productos actuales en Stripe | Plan PRO $849.99 · Plan Básico $550 |
| Productos objetivo (per docs) | Esencial $549 · Profesional $899 · Prestige $2,499 · Enterprise custom · Equipo $5,000 |

> Este documento sincroniza el plan de tiering (`TIER_STRATEGY_AND_VISUAL_DIFFERENTIATION.md`) y el recalibrado de precios con lo que está vivo en Stripe. Detalla qué crear, qué archivar y qué eventos de webhook deben dispararse para que la mecánica de cobro funcione automáticamente.

---

## 1. Mecánica de cobro decidida

| Aspecto | Decisión |
|---|---|
| Modalidad por defecto | **Auto-renew mensual** vía Stripe Subscription |
| Modalidad opcional | **Anual** con 2 meses gratis (ahorro 16 %) |
| Demo gratuito | **20 días** (no 15) — sin cobro hasta el día 21 |
| Período de gracia tras vencimiento | **5 días** — el operador sigue operando, ve banner mostaza recordando renovar, recibe correo de Stripe |
| Después del día 5 de gracia | Lock screen total, solo permite pagar o verificar pago |
| Cobro de equipo | One-time payment vía Stripe (no recurrente). Plan 3/6/8 meses se maneja como pagos manuales mensuales aplicados desde el panel |
| Reintentos automáticos Stripe | Hasta 4 intentos en 3 semanas (default Stripe). Cada fallo dispara `invoice.payment_failed` y nuestro webhook marca `saas_status='GRACE_PERIOD'` |

---

## 2. Productos a crear en Stripe Dashboard

### 2.1 Suscripciones SaaS — recurrentes

Crea cada producto en **Stripe Dashboard → Catálogo de productos → Crea un producto**:

| Producto (display) | Precio mensual | Precio anual | Recurrencia | Categoría | Notas |
|---|---|---|---|---|---|
| **ServiRest Esencial** | $549 MXN | $5,490 MXN (–2 meses) | mensual + anual | SaaS | Default para fondas / cafeterías / locales chicos |
| **ServiRest Profesional** | $899 MXN | $8,990 MXN | mensual + anual | SaaS | Default recomendado · pyme con cocina y meseros |
| **ServiRest Prestige** | $2,499 MXN | $24,990 MXN | mensual + anual | SaaS | Restaurantes corredor premium · branding co-cliente |

**Producto Enterprise**: NO lo crees en el catálogo público — es pricing por contrato. Lo gestionas con `custom_price` en la tabla `businesses` cuando cierras la venta.

### 2.2 Producto Equipo POS — one-off

| Producto | Precio | Recurrencia | Notas |
|---|---|---|---|
| **Equipo POS ServiRest — Kit Listo** | $4,990 MXN | Pago único | Una sola compra, no recurrente. También aceptamos en 3/6/8 mensualidades como cobros manuales |

### 2.3 Cómo crearlos paso a paso

Para cada uno de los 4 productos recurrentes (Esencial, Profesional, Prestige × mensual+anual):

```
Stripe Dashboard
  → Productos → + Crea un producto
    Nombre del producto: "ServiRest Esencial"  (sin "KŌSO POS")
    Descripción: "Punto de venta, menú, caja y reportes para tu restaurante."
    Tipo: Recurrente
    Precio: 549 MXN
    Período: cada 1 mes
    [Crear]
  → Una vez creado, copia el price_id (price_xxx) que aparece en la pestaña "Precios"
  → Agrega un segundo precio anual al MISMO producto:
    Precio: 5,490 MXN
    Período: cada 1 año
    Nombre interno: "Esencial Anual"
    [Agregar precio]
```

Repite para Profesional y Prestige.

Para Equipo POS:

```
  → Productos → + Crea un producto
    Nombre: "ServiRest Equipo POS · Kit Listo"
    Descripción: "Impresora térmica + tablet 10\" + soporte + cajón monedero."
    Tipo: Producto único
    Precio: 4,990 MXN
    [Crear]
```

### 2.4 Archivar los productos viejos

Después de crear los nuevos, **archiva** (no borres — Stripe pide conservar historial):

- "Plan PRO Software POS" ($849.99)
- "Plan Básico (Software Only)" ($550)

Stripe Dashboard → Productos → click en el producto → menú `…` arriba derecha → **Archivar**. Esto los oculta del checkout pero conserva los pagos históricos.

---

## 3. Tabla `app_config` en Supabase — price IDs

Después de crear los productos, captura los `price_id` en Supabase para que la app los use al crear sesiones de checkout. Ejecuta este SQL:

```sql
INSERT INTO app_config (key, value) VALUES
  ('stripe_price_esencial_monthly',     'price_xxxxxxxxxxxx'),  -- pega el price_id del Esencial mensual
  ('stripe_price_esencial_yearly',      'price_xxxxxxxxxxxx'),  -- anual
  ('stripe_price_profesional_monthly',  'price_xxxxxxxxxxxx'),
  ('stripe_price_profesional_yearly',   'price_xxxxxxxxxxxx'),
  ('stripe_price_prestige_monthly',     'price_xxxxxxxxxxxx'),
  ('stripe_price_prestige_yearly',      'price_xxxxxxxxxxxx'),
  ('stripe_price_equipment_kit',        'price_xxxxxxxxxxxx'),
  ('membership_monthly_price',          '899')                 -- default global
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

`screens/Billing.tsx` lee esos IDs en runtime y los pasa a `paySubscription(priceId, planName)`. Mientras no estén en Supabase, la app cae al `price_data` inline (precio en MXN sin descuento anual).

---

## 4. Eventos del webhook — qué tiene que escuchar

Tu webhook en `https://project-er5ks.vercel.app/api/webhook` ya está activo y suscrito a 51 eventos. De esos, **estos 5 son los que el código procesa hoy**:

| Evento Stripe | Qué hace nuestro `api/webhook.ts` | Tabla Supabase afectada |
|---|---|---|
| `checkout.session.completed` | Aplica pago de primera compra · extiende `subscription_expiry` 30 días desde hoy o desde el expiry actual (lo que sea mayor) · marca `saas_status='ACTIVE'` · inserta row en `subscription_payments` con `status=PAID` | `businesses` + `subscription_payments` |
| `invoice.paid` | **Renovación recurrente exitosa** · misma lógica que checkout — extiende 30 días y registra pago | `businesses` + `subscription_payments` |
| `invoice.payment_failed` | Tarjeta rechazada en la renovación · marca `saas_status='GRACE_PERIOD'` · setea `last_payment_failed_at` y `payment_failed_attempts` · NO toca `subscription_expiry` (el cliente sigue operando con grace) | `businesses` + `subscription_payments` (con status=FAILED) |
| `customer.subscription.deleted` | Cliente canceló o Stripe canceló por intentos agotados · marca `saas_status='SUSPENDED'`, `is_active=false` | `businesses` |
| `customer.subscription.trial_will_end` | Demo de 20 días termina en 3 días (Stripe lo dispara automáticamente) · marca `saas_status='WARNING'` para que la UI muestre recordatorio | `businesses` |

### 4.1 Verifica en Stripe Dashboard que estos 5 estén marcados

Stripe → **Desarrolladores → Webhooks → suscription-payment → Editar el destino → Eventos**

Marca exactamente:
- ✅ `checkout.session.completed`
- ✅ `invoice.paid` (alias de `invoice.payment_succeeded` para algunas versiones)
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.deleted`
- ✅ `customer.subscription.trial_will_end`

Los otros 46 que tienes suscritos no hacen daño — solo se ignoran silenciosamente. Puedes des-suscribirlos para reducir ruido en los logs si quieres.

### 4.2 Variables de entorno requeridas en Vercel

`Vercel → Project Settings → Environment Variables`:

```
STRIPE_SECRET_KEY            sk_live_…  (sk_test_… en preview)
STRIPE_WEBHOOK_SECRET        whsec_…   (Stripe → Webhooks → tu webhook → "Click to reveal" en Signing secret)
SUPABASE_URL                 https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY    eyJxxx… (Supabase → Settings → API → service_role secret · BYPASSES RLS)
```

> El `SUPABASE_SERVICE_ROLE_KEY` es crítico: el webhook bypasa RLS para escribir en `businesses` desde el server. **Nunca** lo expongas en el bundle del cliente.

---

## 5. Migración Supabase requerida

Añade las columnas que el webhook ahora escribe:

```sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS saas_status text DEFAULT 'ACTIVE'
    CHECK (saas_status IN ('ACTIVE', 'WARNING', 'GRACE_PERIOD', 'SUSPENDED', 'DEBT_BLOCKED')),
  ADD COLUMN IF NOT EXISTS last_payment_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_failed_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS business_tier text DEFAULT 'esencial'
    CHECK (business_tier IN ('esencial', 'profesional', 'prestige', 'enterprise'));

CREATE INDEX IF NOT EXISTS businesses_stripe_customer_idx ON businesses (stripe_customer_id);
CREATE INDEX IF NOT EXISTS businesses_stripe_subscription_idx ON businesses (stripe_subscription_id);
```

Y el campo nuevo en `subscription_payments` para distinguir pagos fallidos:

```sql
ALTER TABLE subscription_payments
  ALTER COLUMN status SET DEFAULT 'PAID';
-- Si status ya existe con valores existentes, no fuerces CHECK; deja que el código maneje.
```

---

## 6. Flujo end-to-end (qué pasa cuando)

### 6.1 Cliente nuevo se registra y empieza demo

```
1. Cliente completa Onboarding → app llama updateBusiness({ plan: 'demo' })
2. SuperAdmin (opcional) revisa y aprueba demo desde su panel
3. SuperAdmin marca plan='demo' → businesses.demo_until = NOW() + 20 días
4. Cliente opera sin cobro
5. Día 17 → app muestra warning "Te quedan 3 días de prueba"
6. Día 20 → status flip a DEMO_EXPIRED → SubscriptionGuard bloquea
7. Cliente paga vía Stripe Checkout → checkout.session.completed → webhook
   extiende subscription_expiry 30 días, plan='basic'/'premium'
```

### 6.2 Cliente con suscripción mensual activa

```
1. Stripe carga el día N (mes anterior + 1) automáticamente
2. Stripe dispara invoice.paid → webhook extiende subscription_expiry +30
3. Cliente nunca ve interrupción
```

### 6.3 Cobro recurrente falla (tarjeta rechazada, fondos, etc.)

```
1. Día N: Stripe intenta cargar → falla
2. Stripe dispara invoice.payment_failed → webhook marca saas_status=GRACE_PERIOD
3. App muestra GraceBanner (mostaza, sticky top) cada vez que el cliente abre
4. Día N+1, +3, +5: Stripe reintenta (smart retries)
5. Si retry exitoso → invoice.paid → vuelve a ACTIVE, banner desaparece
6. Día N+5: si nada, SubscriptionContext flip a EXPIRED → lock screen total
7. Día N+21: Stripe da por perdida la suscripción → customer.subscription.deleted
   → webhook marca SUSPENDED + is_active=false
```

### 6.4 Cliente cancela voluntariamente desde su Customer Portal

```
1. Cliente abre Stripe Customer Portal (URL de billing portal)
2. Cancela suscripción
3. Stripe dispara customer.subscription.deleted → webhook marca SUSPENDED
4. Su acceso queda válido hasta la fecha pagada (subscription_expiry no se toca)
5. Después de esa fecha → EXPIRED → lock screen
```

### 6.5 Cobro de equipo

```
1. Cliente entra a Billing → "Equipo POS pendiente"
2. Escoge plan (Contado / 3 / 6 / 8 meses)
3. Si CONTADO → Stripe Checkout one-time payment con el priceId del kit
4. Si financiado → la app inserta payment manual en subscription_payments
   (no se cobra automático cada mes; el dueño paga cuando puede,
    estilo CONTADO repetido)
5. Cuando posStatus.amountPaid >= posStatus.totalAmount → isFullyPaid=true,
   se quita el aviso del sidebar
```

---

## 7. Checklist para hoy (Julio)

- [ ] Crear los 3 productos recurrentes (Esencial, Profesional, Prestige) con precio mensual y anual
- [ ] Crear producto Equipo POS one-off
- [ ] Archivar Plan PRO viejo y Plan Básico viejo
- [ ] Copiar los 7 `price_id` resultantes y meterlos a `app_config` en Supabase (SQL en §3)
- [ ] Ejecutar la migración `ALTER TABLE` de §5 en el SQL editor de Supabase
- [ ] En el webhook de Stripe verificar que los 5 eventos críticos estén marcados (§4.1)
- [ ] Verificar que `STRIPE_WEBHOOK_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` estén en Vercel env vars
- [ ] Hacer un pago de prueba con tarjeta test `4242 4242 4242 4242` y verificar que llegue al webhook (Stripe Dashboard → Webhooks → suscription-payment → Entregas de eventos)
- [ ] Una vez probado en test mode, repetir todo el setup en modo Live

---

## 8. Diagnóstico — cómo verificar que el webhook está bien

### 8.1 Mirar entregas de eventos

```
Stripe → Desarrolladores → Webhooks → suscription-payment → Entregas de eventos
```

Si ves rows con status `2xx` (200) significa que el endpoint respondió OK. Si ves `4xx` o `5xx`:
- `400 Webhook signature verification failed` → STRIPE_WEBHOOK_SECRET incorrecto
- `400 Webhook configuration error` → falta STRIPE_WEBHOOK_SECRET en Vercel env
- `500` → error en Supabase. Revisa Vercel function logs

### 8.2 Logs en Vercel

```
Vercel → Project → Logs → Filter: /api/webhook
```

Cada evento exitoso imprime `✅ [checkout] Payment applied · biz=… · until=…` o `✅ [invoice] Payment applied · biz=… · until=…`.

### 8.3 Tabla `subscription_payments` en Supabase

```sql
SELECT business_id, amount, method, status, payment_type, period_end, created_at
FROM subscription_payments
ORDER BY created_at DESC
LIMIT 20;
```

Debes ver rows con `status='PAID'` por cada renovación exitosa, y `status='FAILED'` por cada `invoice.payment_failed`.

---

## 9. Pendientes para próximas iteraciones

- [ ] **Stripe Customer Portal** — endpoint `/api/create-portal-session` para que el cliente actualice su tarjeta sin pasar por nosotros
- [ ] **Auto-renew toggle desde el cliente** — interfaz en Billing para pausar/reanudar la renovación mensual
- [ ] **Yearly upsell** — mostrar el descuento de 2 meses como CTA contextual cerca del vencimiento del 11vo mes
- [ ] **Email transaccional** — usar Resend para mandar correo de renovación exitosa, pago fallido, fin de demo
- [ ] **Stripe Tax** — habilitar para que Stripe calcule el IVA automáticamente en el checkout
- [ ] **CFDI** — alianza con Facturama / SW-Sapien para emitir CFDI 4.0 automático al recibir invoice.paid

---

*Documento de configuración técnica. Junto con el código en `api/webhook.ts` y `api/create-checkout-session.ts` es la fuente de verdad de cómo cobra ServiRest.*
