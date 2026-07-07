# Configurar Stripe para pedidos del Canal Digital

**Contexto**: cuando un cliente paga desde el kiosko (o del storefront público en Fase 2B), el sistema genera un link de Stripe Checkout con el **monto real del pedido**, no con el precio de la suscripción SaaS.

Este documento explica cómo dejar tu cuenta de Stripe lista.

---

## 1. Qué ya está resuelto

El endpoint `/api/create-checkout-session` ya distingue 3 tipos de pago:

| `type` que envía el cliente | Qué usa Stripe |
|---|---|
| `SUBSCRIPTION` | `price_id` guardado en `app_config` (renovación mensual de ServiRest) |
| `EQUIPMENT` | Monto del kit físico (kit POS $5,000) |
| **`DIGITAL_ORDER`** (nuevo) | **El `amount` que envía el kiosko en pesos MXN** — subtotal + envío + IVA |

Antes el bug era que **todos** los pagos usaban el precio de la suscripción. Ya está corregido en el commit de esta iteración.

---

## 2. Requisitos en tu cuenta de Stripe

### 2.1 Modo Live vs Test

- **Test mode**: para probar sin cobrar de verdad. Usa las llaves `sk_test_…` y tarjetas `4242 4242 4242 4242`.
- **Live mode**: cobros reales. Usa `sk_live_…` y necesita KYC completo.

Puedes tener las dos y alternar. Recomendado empezar en **Test** hasta que el flujo esté validado.

### 2.2 Verifica tu llave secreta en Vercel

En tu proyecto de Vercel → **Settings → Environment Variables**:

| Variable | Valor esperado |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (Test) o `sk_live_…` (Live) |
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo backend) |

Después de cambiar env vars, **redeploy** obligatorio (Vercel → Deployments → tres puntos → Redeploy).

### 2.3 Nombre público del negocio

En Stripe Dashboard → **Settings → Business settings → Public details**:

- **Business name**: cambia de "Ronin Studio" a **"ServiRest"** (o el nombre comercial que quieras).
- **Support email / phone**: los que se muestran en el recibo.
- **Icon**: sube el logo cuadrado 128×128 (aparece a la izquierda en el checkout).

Esto quita el "Ronin Studio" que se ve en el screenshot que compartiste.

### 2.4 Métodos de pago habilitados

En **Settings → Payments → Payment methods**:

- **Cards** (Visa, MC, Amex, Link) → ✅ obligatorio.
- **OXXO Pay** → activa si quieres cobrar por referencia OXXO. Requiere activarlo para el país MX.
- **SPEI** → transferencia interbancaria mexicana (opcional).
- **Apple Pay / Google Pay** → se activan solos si tu dominio está en Stripe.

Cada método que actives aparece automáticamente en el Checkout.

### 2.5 Dominio para Apple Pay

Para que Apple Pay funcione en tu storefront:

1. Stripe Dashboard → **Settings → Payment methods → Apple Pay**.
2. **Add new domain** → escribe `servirest-XXX.vercel.app` (tu dominio de Vercel).
3. Stripe te pide subir un archivo de verificación en `/.well-known/apple-developer-merchantid-domain-association`. Ya está incluido si usas la infra de Stripe.

---

## 3. Cómo se genera el link de pago en el kiosko (flujo interno)

Solo para referencia técnica:

```
Cliente → click "Pagar con Stripe"
   ↓
Kiosk POST /api/create-checkout-session {
  businessId,
  amount: 40.00,        ← total real del pedido
  type: 'DIGITAL_ORDER', ← rama nueva (no toca suscripción)
  planName: 'Pedido #123 — Caliche',
  successUrl: '.../#/kiosk?paid=<orderId>',
  cancelUrl:  '.../#/kiosk?cancel=<orderId>',
  orderId: <uuid>       ← se guarda en Stripe metadata
}
   ↓
API valida amount > 0 → crea Session con price_data inline en MXN
   ↓
Redirige al Checkout de Stripe
   ↓
Cliente paga
   ↓
Stripe redirige a successUrl con ?paid=<orderId>
   ↓
Kiosk detecta el param → muestra pantalla de estatus del pedido
```

---

## 4. Webhook (marcar la orden como pagada en el backend)

Para el MVP el kiosko marca la orden como `paymentStatus = PAID` **antes** del redirect a Stripe (optimista). Si el cliente cancela o abandona, la orden queda en `PENDING`.

Para producción robusta debes:

1. Ir a Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL: `https://tu-dominio.vercel.app/api/webhook`.
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
4. Copiar el **Signing secret** (`whsec_…`) y agregarlo como env var `STRIPE_WEBHOOK_SECRET` en Vercel.

El endpoint `/api/webhook.ts` ya existe y maneja los eventos de suscripción. Para pedidos digitales necesita una extensión — está documentada como **Fase 2C** en el roadmap.

---

## 5. Pasos concretos para probarlo hoy

1. **Habilita el flujo de pedidos digitales**:
   - Corre `docs/business-plan/koso-pos/MIGRATION_DIGITAL_CHANNEL.sql` en Supabase SQL Editor.
   - En Canal Digital marca algunos platillos como "En línea".
   - En Canal Digital → tab Kiosko, activa "QR de Stripe" en métodos de pago.

2. **Prepara Stripe en modo Test**:
   - Login en `dashboard.stripe.com` → toggle **"View test data"** arriba a la derecha.
   - Confirma que `STRIPE_SECRET_KEY` en Vercel es `sk_test_…` (o cámbialo temporalmente).

3. **Prueba el flujo**:
   - En Vercel abre `/#/kiosk`.
   - Agrega platillos → carrito → checkout → "Pagar con Stripe".
   - Deberías ver un checkout con el monto **real** del pedido (no $899).
   - Usa `4242 4242 4242 4242` con cualquier CVC / fecha futura.

4. **Verifica en Stripe Dashboard** → Payments → verás el pago con `metadata.orderId`.

5. **Verifica en tu app**:
   - `/kitchen` → la orden aparece como pagada.
   - `/cashier → tab Delivery` → **NO** aparece (ya está cobrada online, va directo a historial).
   - `/dashboard` → suma en ventas del día.

---

## 6. Cambio a Live cuando estés listo

1. Completa KYC en Stripe (docs de identidad + info fiscal).
2. Cambia `STRIPE_SECRET_KEY` en Vercel a `sk_live_…`.
3. Actualiza el webhook signing secret si tienes uno configurado.
4. Redeploy.
5. Corre un pedido de prueba de $1.00 MXN con tu tarjeta real para confirmar.
