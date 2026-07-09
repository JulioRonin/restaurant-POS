# Guía: Visión computacional para control de zonas y tiempos 🎥

> Módulo **Visión IA** de ServiRest — de la prueba en tu PC a un restaurante
> con cámaras instaladas, en 4 fases.

---

## ¿Qué hace?

Colocas cámaras en puntos estratégicos, **dibujas zonas** sobre el video
(Barra, Caja, Cocina, Almacén…) y el sistema detecta **personas** en vivo
para vigilar dos tipos de regla:

| Regla | Qué vigila | Alerta |
|---|---|---|
| **Zona atendida** | Que siempre haya personal en el área | Si queda vacía más de X minutos |
| **Zona restringida** | Que nadie entre (almacén, caja fuera de horario) | Si alguien entra |

Cada alerta dispara: **sonido + notificación del navegador + WhatsApp
(opcional) + evento en Supabase con captura del momento**. Además mide
tiempos: % del turno con la zona cubierta, duración de cada vacancia,
número de incidentes.

**Privacidad por diseño:** el modelo detecta "persona" (silueta), NO
reconoce rostros ni identifica individuos. El video se procesa localmente
en el equipo — nunca se sube a internet; solo las capturas de eventos.

---

## FASE 0 — Prueba hoy con tu PC y una webcam (15 min)

Lo que ya construimos. Requisitos: tu PC, una webcam (la integrada sirve) y
Chrome/Edge.

### Pasos

1. **Corre la migración** `MIGRATION_VISION.sql` en Supabase → SQL Editor.
   Crea la tabla `vision_events`, el bucket de capturas y registra el
   feature `vision_ai`.
2. **Activa el módulo**: entra como SuperAdmin → selecciona tu negocio →
   enciende el toggle **"Visión IA (experimental)"**. (Es un add-on, igual
   que Canal digital.)
3. En el POS aparece **"Visión IA"** en el menú lateral. Ábrelo.
4. **Inicia cámara** (da permiso). La primera vez descarga el modelo de
   detección (~6 MB, tarda unos segundos; queda en caché).
5. **Dibuja tu primera zona**: arrastra con el mouse sobre el video.
   Ponle nombre ("Barra"), elige la regla:
   - *Atendida* → define minutos máximos sin personal (ej. 3).
   - *Restringida* → alerta al detectar a alguien.
6. **Prueba**: sal del encuadre de la zona y espera los minutos definidos
   → suena la alarma, llega la notificación y el evento queda en el panel
   con su captura.

### WhatsApp (opcional, gratis para pruebas)

Usamos CallMeBot para no requerir cuenta empresarial en la prueba:

1. Agrega **+34 644 71 81 99** a tus contactos.
2. Mándale por WhatsApp: `I allow callmebot to send me messages`
3. Te responde con tu **apikey**.
4. En el módulo → ⚙️ Configuración → activa WhatsApp, pon tu teléfono con
   lada (`+52...`) y la apikey → **Enviar prueba**.

> ⚠️ CallMeBot es para pruebas/uso personal. Para producción ver Fase 3
> (WhatsApp Business Cloud API).

### Consejos para el piloto

- Usa una PC dedicada con la pestaña abierta (desactiva la suspensión).
- Cámara a 2.5–3 m de altura, ángulo picado: el punto de detección son
  "los pies" de la persona, así que la zona se dibuja **sobre el piso**
  del área, no sobre las cabezas.
- Si tu PC va lenta: sube el intervalo a 1000–1500 ms.
- Falsos positivos (detecta "personas" en sombras): sube la confianza a 0.6.

---

## FASE 1 — Usar las cámaras que el restaurante ya tiene (RTSP)

Casi cualquier DVR/NVR o cámara IP (Hikvision, Dahua, TP-Link, Reolink…)
expone un stream **RTSP**. El navegador no puede leer RTSP directo, así que
hay dos puentes:

### Opción A: OBS como puente (0 código, ideal para 1 cámara)

1. Instala [OBS Studio](https://obsproject.com) (gratis).
2. Fuente → **Origen multimedia** → desmarca "archivo local" y pega tu URL
   RTSP, p. ej.:
   `rtsp://usuario:contraseña@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0`
   (la URL exacta viene en el manual de tu DVR; usa el substream para menos carga).
3. OBS → **Iniciar cámara virtual**.
4. En el módulo Visión IA, en el selector de cámara elige **"OBS Virtual
   Camera"**. Listo: tu cámara del techo ya está siendo analizada.

### Opción B: go2rtc / MediaMTX (varias cámaras, sin OBS)

[go2rtc](https://github.com/AlexxIT/go2rtc) re-transmite RTSP → WebRTC/MSE
que el navegador sí entiende. Un solo binario, config YAML con tus cámaras.
Es la antesala natural de la Fase 2.

---

## FASE 2 — Producción escalable: Frigate NVR (multi-cámara 24/7)

Para un restaurante con 4–16 cámaras corriendo día y noche, el análisis se
saca del navegador y se mueve a un **mini-PC en el local**:

### Arquitectura

```
Cámaras RTSP ──► Frigate NVR (mini-PC + Coral TPU opcional)
                    │  zonas + detección de personas 24/7
                    ├──► MQTT: eventos (zona, entra/sale, tiempos)
                    │       └──► Bridge (Node, ~50 líneas) ──► Supabase vision_events
                    │                                            └──► Módulo Visión IA (dashboard)
                    └──► Grabación 24/7 con retención configurable
```

### Hardware recomendado

| Pieza | Opción | Costo aprox. |
|---|---|---|
| Mini-PC | Beelink Mini S12 / N100 | $2,500–3,500 MXN |
| Acelerador (opcional) | Google Coral USB TPU (detección a 100+ FPS) | $1,500 MXN |
| Cámaras (si faltan) | Cualquier IP con RTSP (TP-Link Tapo, Hikvision) | $600–1,500 c/u |

### Pasos

1. Instala [Frigate](https://frigate.video) (Docker) en el mini-PC.
2. En `config.yml` declara cada cámara RTSP y define las **zonas** (mismas
   ideas que en la Fase 0, pero por cámara y en coordenadas del frame).
3. Frigate publica eventos MQTT (`frigate/events`): persona entró/salió de
   zona, con snapshot y clip.
4. Un **bridge** pequeño (Node.js) se suscribe a MQTT y hace INSERT en
   `vision_events` de Supabase — el módulo Visión IA del POS ya lee esa
   tabla, así que el dashboard funciona igual con 1 webcam o 16 cámaras.
5. Las reglas de tiempo ("vacía > X min") se evalúan en el bridge con la
   misma lógica del módulo.

> Cuando llegues a esta fase, pídeme el bridge MQTT→Supabase y el
> config.yml de ejemplo y los genero sobre tu lista de cámaras.

---

## FASE 3 — Notificaciones serias + Agente IA ("Hermes")

### WhatsApp de producción

CallMeBot se reemplaza por **WhatsApp Business Cloud API** (Meta, gratis
hasta 1,000 conversaciones/mes) o **Twilio**. El bridge de la Fase 2 envía
la plantilla aprobada con la captura adjunta. Ventajas: número propio del
negocio, botones ("Ver cámara", "Ignorar 30 min"), multi-destinatario
(gerente + dueño).

### Agente IA sobre los eventos

Un agente (Claude API) como capa de inteligencia encima del flujo crudo:

- **Filtra falsos positivos**: antes de alertar, el agente mira la captura
  ("¿de verdad no hay nadie en la barra o el mesero está agachado?") con
  un modelo con visión, y decide si molesta al gerente.
- **Resumen del turno**: a las 11 pm manda por WhatsApp: "Barra estuvo
  cubierta 94% del turno; caja tuvo 2 vacancias >5 min (14:20, 18:45);
  1 acceso al almacén fuera de horario (con captura)".
- **Preguntas en lenguaje natural**: "¿quién descuidó más la caja esta
  semana?" contra la tabla `vision_events`.

Costo estimado: con Claude Haiku, filtrar ~200 eventos/día + un resumen
diario cuesta centavos. Cuando quieras esta fase, la montamos como Edge
Function de Supabase (cron cada N min sobre `vision_events`).

---

## Marco legal y buenas prácticas (México) ⚖️

La videovigilancia laboral es legal en México, pero la LFPDPPP exige:

1. **Señalética visible**: "Zona videovigilada" en cada área con cámara.
2. **Aviso de privacidad** a empleados (finalidad: seguridad y operación;
   inclúyelo en el contrato o reglamento interior).
3. **Nunca** en baños, vestidores o áreas de descanso.
4. **Sin audio** (grabar audio sin consentimiento es delito federal).
5. **Retención limitada**: 7–30 días de capturas y luego borrar (configura
   lifecycle en el bucket `vision-snapshots`).
6. **Acceso restringido**: solo admin/gerencia ven eventos (la RLS de
   `vision_events` ya lo aplica).

**Recomendación de uso**: preséntalo al equipo como herramienta de
*cobertura de servicio* ("que la caja nunca quede sola") y no de vigilancia
individual — de hecho el sistema no identifica personas, mide zonas. Eso
es mejor clima laboral y mejor defensa legal.

---

## Resumen del roadmap

| Fase | Alcance | Esfuerzo | Estado |
|---|---|---|---|
| 0 | PC + webcam, zonas, alertas, WhatsApp de prueba | 15 min | ✅ Construido |
| 1 | Cámaras RTSP existentes vía OBS/go2rtc | 1 hora | Guía lista |
| 2 | Frigate NVR multi-cámara 24/7 + bridge Supabase | 1 día + hardware | Pídeme el bridge |
| 3 | WhatsApp Cloud API + agente IA (filtro/resúmenes) | 1–2 días | Pídeme la Edge Function |
