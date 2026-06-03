# ServiRest — Control de terminales concurrentes
### Diseño técnico · 2026-06-03

| Campo | Valor |
|---|---|
| Tipo | Diseño backend + migración Supabase + handshake del cliente |
| Triggered by | El tier limita `maxConcurrentTerminals` (Esencial 1 · Profesional 5 · Prestige 12 · Enterprise ∞), pero hoy nada lo enforza |
| Estado | Diseño aprobado · falta tabla `active_sessions` + endpoint check-in/check-out + guard en LockScreen |

> **Problema:** un cliente Esencial paga por 1 terminal pero podría tener 4 tablets abiertas porque ningún chequeo del servidor lo bloquea. Esto degrada el upsell hacia Profesional (5 terminales). Necesitamos un mecanismo de **conteo de sesiones activas** que sea robusto a tablets que pierden conexión sin "cerrar" la sesión limpiamente.

---

## 1. Modelo de datos

### 1.1 Tabla nueva `active_sessions`

```sql
CREATE TABLE IF NOT EXISTS active_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  employee_id   uuid REFERENCES employees(id),
  device_id     text NOT NULL,                        -- generado en el cliente, persistido en localStorage
  device_name   text,                                  -- "Tablet barra 1", "iPad mostrador", etc.
  user_agent    text,
  ip_address    inet,
  opened_at     timestamptz DEFAULT now(),
  last_heartbeat_at timestamptz DEFAULT now(),
  closed_at     timestamptz,
  closed_reason text                                   -- 'manual' | 'timeout' | 'forced_by_admin' | 'tier_exceeded'
);

CREATE INDEX active_sessions_business_open_idx
  ON active_sessions (business_id)
  WHERE closed_at IS NULL;

CREATE INDEX active_sessions_device_idx
  ON active_sessions (device_id);

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own_business"
  ON active_sessions FOR SELECT TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "sessions_write_own_business"
  ON active_sessions FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );
```

### 1.2 Función RPC para contar activas (heartbeat-aware)

Una sesión se considera **viva** si su `last_heartbeat_at` está dentro de los últimos 90 segundos. Esto auto-limpia sesiones colgadas (tablet sin batería, sin internet, etc.).

```sql
CREATE OR REPLACE FUNCTION count_active_sessions(biz uuid)
RETURNS integer AS $$
  SELECT COUNT(*)::int
  FROM active_sessions
  WHERE business_id = biz
    AND closed_at IS NULL
    AND last_heartbeat_at > (now() - interval '90 seconds');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Auto-close stale sessions older than 5 minutes (idempotent, called from cron)
CREATE OR REPLACE FUNCTION expire_stale_sessions()
RETURNS integer AS $$
  WITH closed AS (
    UPDATE active_sessions
    SET closed_at = now(),
        closed_reason = 'timeout'
    WHERE closed_at IS NULL
      AND last_heartbeat_at < (now() - interval '5 minutes')
    RETURNING 1
  )
  SELECT COUNT(*)::int FROM closed;
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

-- Run every minute via pg_cron (Supabase Pro)
SELECT cron.schedule('expire-stale-sessions', '* * * * *', 'SELECT expire_stale_sessions()');
```

---

## 2. Flujo end-to-end

### 2.1 Cliente arranca la app (LockScreen)

```
1. Generar/leer device_id en localStorage (UUID).
   Si no existe, crear uno nuevo. Persiste por tablet/computadora.

2. Empleado escoge perfil y mete PIN.

3. ANTES de redirect a la home del rol:
   POST /api/sessions/check-in
   body: { business_id, employee_id, device_id, device_name? }
   → server:
       - count = SELECT count_active_sessions(business_id)
       - max   = tier_limit_for(business_id, 'maxConcurrentTerminals')
       - if count >= max AND device_id NOT IN sesiones activas
           return 403 { error: 'TIER_LIMIT_REACHED', current: count, max }
       - else
           INSERT INTO active_sessions (...)
           return 200 { session_id }

4. Cliente guarda session_id en localStorage.

5. Cliente arranca un heartbeat ping cada 30s:
   POST /api/sessions/heartbeat
   body: { session_id }
   → server UPDATE active_sessions SET last_heartbeat_at = now() WHERE id = session_id

6. Cliente cierra sesión / lockea / cierra pestaña:
   POST /api/sessions/check-out
   body: { session_id }
   → server UPDATE active_sessions SET closed_at = now(), closed_reason='manual'
   Also fires via navigator.sendBeacon on tab close.
```

### 2.2 Cuando un empleado intenta abrir terminal #N+1 en Esencial

```
Backend response: 403 { error: 'TIER_LIMIT_REACHED', current: 1, max: 1, sessions: [...] }

Cliente muestra modal:
   - 'Llegaste al máximo de terminales del plan Esencial'
   - Lista las sesiones activas con device_name + employee_name + opened_at
   - Opciones:
       (a) 'Cerrar otra terminal y abrir aquí' (admin pin required)
       (b) 'Subir a Profesional' (link a /billing)
       (c) 'Cancelar'
```

---

## 3. Endpoints nuevos

### 3.1 `/api/sessions/check-in.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const TIER_TERMINALS: Record<string, number> = {
  esencial: 1, profesional: 5, prestige: 12, enterprise: 999999,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { business_id, employee_id, device_id, device_name } = req.body;
  if (!business_id || !device_id) return res.status(400).json({ error: 'Missing fields' });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. ¿Esta tablet ya tiene sesión abierta? Si sí, reusar (idempotente).
  const { data: existing } = await supabase
    .from('active_sessions')
    .select('id, opened_at')
    .eq('business_id', business_id)
    .eq('device_id', device_id)
    .is('closed_at', null)
    .gt('last_heartbeat_at', new Date(Date.now() - 90_000).toISOString())
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ session_id: existing.id, reused: true });
  }

  // 2. Contar activas vs límite del tier
  const { data: countResult } = await supabase.rpc('count_active_sessions', { biz: business_id });
  const current = countResult || 0;

  const { data: biz } = await supabase
    .from('businesses')
    .select('business_tier')
    .eq('id', business_id)
    .single();
  const max = TIER_TERMINALS[biz?.business_tier || 'esencial'];

  if (current >= max) {
    // Devolver la lista de sesiones activas para que el cliente pueda
    // ofrecer "cerrar otra".
    const { data: sessions } = await supabase
      .from('active_sessions')
      .select('id, device_name, opened_at, employees(name)')
      .eq('business_id', business_id)
      .is('closed_at', null)
      .gt('last_heartbeat_at', new Date(Date.now() - 90_000).toISOString());

    return res.status(403).json({
      error: 'TIER_LIMIT_REACHED',
      current, max,
      sessions: sessions || [],
    });
  }

  // 3. Crear sesión nueva
  const { data: created, error } = await supabase
    .from('active_sessions')
    .insert({
      business_id, employee_id, device_id, device_name,
      user_agent: req.headers['user-agent'],
      ip_address: req.headers['x-forwarded-for'] as string || null,
    })
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ session_id: created.id, reused: false });
}
```

### 3.2 `/api/sessions/heartbeat.ts`

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase
    .from('active_sessions')
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq('id', session_id)
    .is('closed_at', null);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
```

### 3.3 `/api/sessions/check-out.ts`

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { session_id, reason } = req.body;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await supabase
    .from('active_sessions')
    .update({ closed_at: new Date().toISOString(), closed_reason: reason || 'manual' })
    .eq('id', session_id);
  return res.status(200).json({ ok: true });
}
```

### 3.4 `/api/sessions/force-close.ts` (admin PIN required)

Permite a un manager cerrar OTRA sesión activa para liberar el cupo.
Sólo callable si quien lo invoca tiene rol 'admin' o 'manager'.

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { session_id_to_close, admin_pin, calling_employee_id } = req.body;
  // 1. Verifica que calling_employee_id sea admin/manager Y pin sea correcto
  // 2. UPDATE active_sessions SET closed_at = now(), closed_reason = 'forced_by_admin'
  //    WHERE id = session_id_to_close
}
```

---

## 4. Cliente — cambios en LockScreen

```typescript
// components/LockScreen.tsx
import { v4 as uuid } from 'uuid';

const DEVICE_ID_KEY = 'servirest_device_id';
const SESSION_ID_KEY = 'servirest_session_id';

const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

const handleUnlock = async () => {
  if (!selectedUser || pin.length !== 4) return;

  // 1. Validar PIN localmente (como hoy)
  const valid = await switchEmployee(selectedUser, pin);
  if (!valid) { setError(true); return; }

  // 2. Check-in al server
  const r = await fetch('/api/sessions/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_id: authProfile.businessId,
      employee_id: selectedUser,
      device_id: getDeviceId(),
      device_name: settings.deviceName || navigator.userAgent.substring(0, 50),
    }),
  });

  const data = await r.json();

  if (r.status === 403 && data.error === 'TIER_LIMIT_REACHED') {
    setLimitModal({ current: data.current, max: data.max, sessions: data.sessions });
    return; // NO unlock — block
  }

  if (data.session_id) {
    localStorage.setItem(SESSION_ID_KEY, data.session_id);
    startHeartbeat(data.session_id);
    // ... redirect to home as usual
  }
};

// Heartbeat ping every 30s
const startHeartbeat = (sessionId: string) => {
  setInterval(() => {
    fetch('/api/sessions/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
  }, 30_000);
};

// Check-out on tab close (best effort)
window.addEventListener('beforeunload', () => {
  const sid = localStorage.getItem(SESSION_ID_KEY);
  if (sid) {
    navigator.sendBeacon(
      '/api/sessions/check-out',
      JSON.stringify({ session_id: sid, reason: 'manual' }),
    );
  }
});
```

---

## 5. SuperAdmin — vista de sesiones activas

Nueva tab "Terminales activas" en SuperAdmin con tabla:

| Negocio | Empleado | Dispositivo | Abierta hace | Última actividad | Acciones |
|---|---|---|---|---|---|
| Mariscos Alucines | Aura | iPad mostrador | 2h 14m | hace 12s | [Forzar cierre] |
| Mariscos Alucines | Sofia M. | Tablet barra | 45m | hace 8s | [Forzar cierre] |

Esto le da al admin visibilidad de quién está conectado y permite resolver el caso "alguien dejó la sesión abierta en una tablet con poca batería y no podemos abrir otra".

---

## 6. Riesgos y consideraciones

| Riesgo | Mitigación |
|---|---|
| Heartbeat agrega ~120 requests/min × terminales activas | Stripe-friendly (~$0 cost en Supabase Pro). Si volumen sube, mover heartbeat a websocket/Supabase Realtime |
| Tablets sin internet quedan "abiertas" en el servidor | `expire_stale_sessions` cierra después de 5 min sin heartbeat |
| Operador puede crear nuevo `device_id` borrando localStorage | Aceptable — es ataque interno; el upsell sigue siendo claro y el admin ve la actividad sospechosa en SuperAdmin |
| Tier downgrade Profesional → Esencial con 3 sesiones abiertas | En el momento del downgrade, mantener las 3 abiertas hasta que cierren; bloquear nuevas hasta volver a 1 |
| Múltiples ventanas del mismo browser cuentan como 1 device | Sí, porque comparten `device_id` (mismo localStorage). Eso favorece al cliente — no es bug |

---

## 7. Checklist de implementación

### Sprint 1 — DB + endpoints (~3 días)
- [ ] Migración SQL §1 (tabla + RLS + 2 RPCs + pg_cron)
- [ ] Endpoint `/api/sessions/check-in.ts`
- [ ] Endpoint `/api/sessions/heartbeat.ts`
- [ ] Endpoint `/api/sessions/check-out.ts`
- [ ] Endpoint `/api/sessions/force-close.ts`

### Sprint 2 — Cliente (~2 días)
- [ ] Helper `getDeviceId()` con persistencia en localStorage
- [ ] Modificar `handleUnlock()` en LockScreen con check-in
- [ ] Iniciar heartbeat al unlock
- [ ] `beforeunload` con `sendBeacon` para check-out
- [ ] Modal "Límite de terminales alcanzado" con lista de sesiones + acciones

### Sprint 3 — Admin (~1 día)
- [ ] Tab "Terminales activas" en SuperAdmin
- [ ] Botón "Forzar cierre" por sesión
- [ ] Refresh automático cada 30s

### Sprint 4 — Polish
- [ ] Settings: campo "Nombre de este dispositivo" (`device_name`) para que el operador identifique cada terminal
- [ ] Email/notif al admin si una sesión se cierra forzada
- [ ] Métrica en Dashboard: "Promedio de terminales activas hoy"

---

## 8. Pricing implication recordatorio

| Tier | Terminales | Valor diferenciado |
|---|---|---|
| Esencial $549 | 1 | Pequeño local, una caja |
| Profesional $899 | 5 | Cocina + caja + 2 meseros + 1 móvil |
| Prestige $2,499 | 12 | Restaurante grande con múltiples estaciones |
| Enterprise | ∞ | Cadenas |

La limitación de terminales **es** el upsell físico más visible — más físico que CFDI o food cost — porque el dueño que tiene 4 tabletas siente la fricción inmediatamente.

---

*Documento de diseño técnico. Próxima revisión post-implementación de Sprint 1.*
