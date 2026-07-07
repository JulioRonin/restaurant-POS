# Canal Digital · Pedidos online + Kiosko + Storefront público

**Versión**: 1.0 · Julio 2026
**Autor**: Equipo producto ServiRest
**Estado**: Fase 1 implementada (módulo admin). Fase 2 pendiente.

---

## 1. Visión general

El canal digital es la vía por la que el restaurante vende sin que el cliente entre al local (o entrando, pero sin depender de un mesero). Es la extensión natural del POS: reusa el mismo catálogo, el mismo cobro y las mismas comandas a cocina. Solo cambia la **superficie** por donde entra la orden.

### Tres superficies del canal digital

| Superficie | Quién la usa | Dónde vive | Fase |
|---|---|---|---|
| **Módulo admin "Canal digital"** | Dueño / gerente | Dentro de ServiRest, ruta `/digital-channel` | ✅ **Fase 1** |
| **Modo Kiosko** | Cliente en el local | Tablet o pantalla física, ruta `/kiosk` | ⏳ Fase 2 |
| **Storefront público** | Cliente remoto | Web pública `servirest.mx/o/{slug}` | ⏳ Fase 2 |

Las tres comparten:
- Un solo catálogo (`MenuItem.publishOnline` decide qué se muestra).
- Una sola configuración (`BusinessSettings` extendida con campos `digital*` y `kiosk*`).
- Una sola cola de órdenes (llegan a Kitchen/Bar como cualquier otra `Order`, con `source` distinguible).

---

## 2. Gate de tier

**Tier por defecto**: **Prestige+**.

Se agregaron 4 feature flags nuevos en `SuperAdmin.DEFAULT_FEATURES`:

| Feature key | Descripción |
|---|---|
| `online_ordering` | Habilita el módulo admin, kiosko y storefront (bandera maestra) |
| `online_reservations` | Reservas online desde el storefront |
| `kiosk_mode` | Activa `terminalMode = 'kiosk'` como opción en Ajustes |
| `online_payments` | Cobro digital (Stripe QR / OXXO además de terminal BT + efectivo) |

**Override manual desde SuperAdmin**: cualquier cliente en Esencial o Profesional puede recibir el módulo si el equipo comercial activa `online_ordering` desde el toggle por cliente. Esto es una palanca de venta importante: se puede ofrecer el canal digital como *add-on* separado del salto de tier.

---

## 3. Modelo de datos

### 3.1 Extensiones a `MenuItem`
```ts
publishOnline?: boolean;    // Si aparece en el kiosko o storefront
onlinePrice?: number;       // Precio online opcional (por default usa price)
onlineAvailable?: boolean;  // Disponibilidad instantánea (true = compra ahora)
```

### 3.2 Extensiones a `BusinessSettings`
```ts
publicSlug?: string;             // servirest.mx/o/{slug}
digitalMode?: 'delivery' | 'pickup' | 'dine-in' | 'reservation';
digitalHoursOpen?: string;       // "10:00"
digitalHoursClose?: string;      // "22:00"
digitalWelcome?: string;         // Mensaje editorial en portada (max 140)
digitalMinOrder?: number;        // Monto mínimo de orden
digitalDeliveryFee?: number;     // Costo fijo de envío
digitalDeliveryZones?: string;   // Colonias / zonas (texto libre)
kioskPin?: string;               // PIN para salir del kiosko (4 dígitos)
kioskPayMethods?: {
  bluetooth?: boolean;
  stripe_qr?: boolean;
  cash?: boolean;
  oxxo?: boolean;
};
```

### 3.3 Extensión de `terminalMode`
Se añadió `'kiosk'` a la unión de modos: `'standard' | 'tablet-pos' | 'tablet-host' | 'mobile-pwa' | 'kiosk'`.

---

## 4. Fase 1 — Módulo admin (implementado)

**Ruta**: `/digital-channel`
**Screen**: `screens/DigitalChannel.tsx`
**RBAC**: Admin + Manager (extendido en `services/rbac.ts`).
**Nav en sidebar**: `showModule('/digital-channel', 'online_ordering', 'prestige')`.

### 4.1 Tabs
- **Catálogo público** — curaduriía de items publicables, precio online opcional, disponibilidad.
- **Modo & horarios** — delivery / pickup / dine-in / reservation + hours + mínimo + envío + zonas + mensaje editorial.
- **Kiosko** — PIN + 4 toggles de método (BT, Stripe QR, efectivo, OXXO).
- **URL pública & QR** — slug normalizado, preview del link, copy + open, QR placeholder.

---

## 5. Fase 2 — Roadmap pendiente

### 5.1 Modo Kiosko (`terminalMode = 'kiosk'`)
- Nueva pantalla `screens/Kiosk.tsx` ruta `/kiosk`.
- UI grande touch-friendly: portada con `digitalWelcome`, grid gigante de categorías, carrito lateral, modal de cobro que respeta `kioskPayMethods`.
- Salida con `kioskPin`. Estimación: 1.5 días.

### 5.2 Storefront público (`/o/:slug`)
- Router público sin auth. Fetch de business por slug + MenuItems donde `publishOnline = true`. Checkout con Stripe Session. Webhook agrega la orden con `source = 'ONLINE'` y `paymentStatus = 'PAID'`. Estimación: 3 días.

### 5.3 QR imprimible
- Librería `qrcode` (npm) + composición editorial 90×90mm. Estimación: medio día.

### 5.4 Auto-print de comandas online
- `printKitchenTicket` reconoce `source = 'ONLINE'` y agrega ribbon "PEDIDO ONLINE". Beep distinto en Kitchen. Estimación: 3 horas.

### 5.5 Panel de órdenes online realtime
- Sub-tab en Cashier o en Digital Channel. Notificación WhatsApp cuando pasa a `READY`. Estimación: 1.5 días.

---

## 6. Impacto en el modelo comercial

### 6.1 Landing
> **"Vende también sin que el cliente entre al local."**
> Kiosko en tu tablet, tienda web con URL propia y pagos digitales sin abrir otro sistema. Disponible desde Prestige.

### 6.2 Pricing
- Los precios de los tiers **no cambian**. El canal digital forma parte de Prestige ($2,499/mes).
- Alternativa a explorar: **add-on de $299/mes** para Esencial y Profesional que activa solo `online_ordering`.

### 6.3 Soporte
- Nuevos escenarios: "no me llegan las órdenes online" → verificar `publishOnline`, horario, connectivity impresora.

---

## 7. Notas de implementación

- **Sin migración Supabase requerida en Fase 1**: campos nuevos viven en el JSON de settings y en las filas de menu_items sin schema estricto. En Fase 2 valdrá la pena columnas explícitas para query performance del storefront.
- **Sync**: cambios de `publishOnline` y `onlinePrice` viajan por `updateItem` del `MenuContext`.
- **Feature flag propagation**: `SubscriptionContext` re-fetchea features cada 5 min (o inmediato con `refreshFeatures()`).

---

## 8. Copy para landing (bonus)

### Hero
> **"El POS que también vende afuera del local."**
> Kiosko para auto-servicio, tienda online con tu propia URL, y cobro con terminal, QR o efectivo. Todo desde el mismo sistema.

### Bullets
- **Un solo catálogo.** Elige qué platillos publicas online desde el mismo Menú.
- **Un solo cobro.** Terminal Bluetooth, QR de Stripe, OXXO Pay o efectivo — tú decides.
- **Una sola cocina.** Las órdenes online caen directo a KDS con ribbon "Pedido online".
- **Delivery, pickup o reserva.** Configura el giro según tu tipo de restaurante.
- **URL propia + QR imprimible.** Pega el QR en tus mesas y empieza a recibir pedidos.
