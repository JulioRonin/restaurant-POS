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

## Caso estrella: medir la RECEPCIÓN / hostess (clientes que se van) 🚪

**El problema:** llegan clientes a la entrada, no encuentran a nadie que los
reciba y se van. Es dinero que se pierde sin dejar rastro. ¿Se puede medir
con visión computacional? **Sí, y es uno de los mejores usos de esta tech.**

### Cómo lo mide el módulo

Con detección de personas defines **dos zonas** en la cámara de la entrada:

1. **Puesto anfitrión** (`host_post`) → el lugar donde DEBE estar tu host.
2. **Llegada de clientes** (`guest_arrival`) → el umbral de la puerta / foyer.

El sistema correlaciona ambas y calcula, en vivo:

| KPI | Qué te dice |
|---|---|
| **Llegadas** | Personas que entraron y se quedaron > N seg (filtra a los que solo pasan) |
| **Atendidos** | Llegadas donde un host apareció en el puesto |
| **Se fueron sin atender** | Llegadas que se retiraron sin que nadie los recibiera → **cliente perdido** |
| **% de atención** | Atendidos ÷ llegadas |
| **Tiempo de recepción prom.** | Segundos desde que llega el cliente hasta que lo reciben |
| **% cobertura del puesto** | Qué tanto del turno hubo alguien en el puesto de host |

Y lo más accionable: una **alerta EN VIVO** (sonido + WhatsApp) cuando hay
alguien esperando en la entrada más de X segundos sin que nadie lo atienda —
para que corran a recibirlo *antes* de perderlo, no después.

### Cómo funciona el seguimiento (tracking con identidad)

La zona de entrada **no es una jaula** — es una **línea de cruce (tripwire)**:

1. Una persona **recién aparecida en escena** que pisa la zona de entrada
   queda etiquetada **CLIENTE** (morado) — y a partir de ahí **se le sigue
   por TODO el encuadre** con su cronómetro de espera visible.
2. Quien pisa el **puesto anfitrión** queda etiquetado **PERSONAL** (azul)
   de por vida de su track — por eso la hostess que camina a la puerta a
   saludar NO se confunde con un cliente (su track ya era "viejo" en escena).
3. La **atención se evalúa donde sea**: personal cerca del cliente en
   cualquier punto del encuadre (o puesto cubierto) durante 2s+ = atendido.
4. Cuando el cliente desaparece de escena varios segundos, su episodio se
   cierra: atendido = flujo normal; no atendido = **cliente perdido**.

### Cómo configurarlo (2 minutos)

1. Crea una cámara llamada "Recepción" apuntando a la entrada.
2. Inicia la cámara y dibuja **dos zonas** (tocando las 4 esquinas de cada
   una, en perspectiva sobre el piso):
   - Piso alrededor del atril/puesto del host → regla **Puesto anfitrión**.
   - **Franja del piso cruzando la puerta** (el umbral) → regla **Llegada
     de clientes**.
3. Listo: aparece el tablero **"Recepción"** con los KPIs en vivo. En ⚙️
   ajustas "segundos para contar una llegada" (default 3s, filtra a los que
   pasan de largo) y "segundos de espera → alerta" (default 12s).

### Dónde dibujar cada zona (guía de colocación) 📐

Las zonas se marcan tocando sus **4 esquinas en perspectiva** — píntalas
"acostadas" sobre el piso (o sobre la barra), no como rectángulo flotante:

| Zona | Dónde dibujarla | Error común |
|---|---|---|
| **Llegada de clientes** | Franja de piso de ~1–1.5 m de profundidad cruzando el umbral de la puerta, de pared a pared | Dibujar todo el lobby → etiqueta de cliente a cualquiera; debe ser solo el cruce |
| **Puesto anfitrión** | El piso alrededor del atril (donde pisa el host al estar en su puesto) | Incluir el pasillo → nunca se marca "vacío" |
| **Zona atendida** (barra, caja) | El piso del área de trabajo donde pisa el empleado | Marcar la barra física en vez del piso donde se para la persona |
| **Zona restringida** | El piso del área prohibida completa | — |
| **Pase de comida** | La SUPERFICIE de la barra donde se apoyan los platillos (única que no va en el piso) | Marcar el piso — los platillos están sobre la barra |

**Regla de oro:** el sistema ubica a las personas por sus **pies** (punto
inferior del cuerpo) — por eso toda zona de personas se dibuja en el PISO,
siguiendo la perspectiva del piso real. Cámara ideal: 2.5–3 m de altura,
ángulo picado, la entrada y el puesto del host visibles en el mismo encuadre.

### Qué SÍ y qué NO puede hacer (honestidad técnica)

✅ **Sí puede:**
- Contar llegadas y, sobre todo, **cuántas se fueron sin atención** (el número
  que tu cliente quiere) como un *proxy muy fuerte*.
- Medir el tiempo de respuesta de tu host y su % de cobertura del puesto.
- Avisar en tiempo real para rescatar al cliente que espera.

⚠️ **Limitaciones (y cómo se mitigan):**
- *No sabe la intención:* alguien que solo asoma la cabeza podría contar como
  llegada → se mitiga con el filtro de permanencia (N segundos) y dibujando la
  zona de entrada ajustada al umbral real.
- *No distingue empleado de cliente por su cara* (y a propósito no usamos
  reconocimiento facial) → por eso el modelo es por ZONAS: "hay alguien en el
  puesto del host" vs "hay alguien esperando en la puerta".
- *Depende del ángulo y la luz:* cámara picada a 2.5–3 m, entrada bien
  iluminada, zona sobre el piso.
- Para afinar los casos dudosos entra el **agente IA (Fase 3)**: revisa la
  captura del evento y confirma si de verdad fue un cliente perdido antes de
  contarlo, subiendo la precisión del número.

> Recomendación de negocio: preséntalo como *"tablero de servicio de
> recepción"* (mejorar la atención) más que vigilancia — mide zonas, no
> personas, y ese encuadre te da mejor clima laboral y mejor defensa legal.

---

## Reconocer al personal por NOMBRE (reconocimiento facial, beta) 👤

Además del etiquetado por comportamiento (Cliente al cruzar la entrada,
Personal al pisar el puesto), puedes registrar a tus empleados por rostro
para que el sistema los nombre: **"Ana · Hostess"** — y nunca los confunda
con clientes.

### Cómo activarlo

1. Botón **🙂 (ScanFace)** en el header del módulo → modal "Personal".
2. Marca el checkbox de **consentimiento por escrito** (obligatorio).
3. Nombre + puesto → **"Capturar rostro"** con el empleado de frente y cerca
   de la cámara (2–3 capturas con ángulos ligeramente distintos).
4. Activa el toggle **"Reconocer personal por rostro"**.

Desde entonces, cada ~2.5s el sistema busca rostros conocidos y renombra el
track: la etiqueta azul pasa de "Personal" a **"Ana · Hostess"**. Si el
tripwire había confundido a un empleado con cliente, se corrige solo (y se
descuenta del conteo de llegadas).

### Límites honestos

- Funciona cuando el rostro es **visible, de frente y razonablemente cerca**
  (la cámara de recepción es ideal; una cámara lejana de techo con ángulo
  muy picado no resuelve rostros — ahí el etiquetado por zonas sigue siendo
  el mecanismo principal).
- Los **clientes jamás se registran** ni se comparan contra ninguna base —
  solo se busca a los empleados dados de alta.

### ⚖️ Biometría = datos personales SENSIBLES (LFPDPPP)

- Consentimiento **expreso y por escrito** de cada empleado ANTES de
  registrarlo (guárdalo firmado en su expediente).
- Los descriptores faciales se guardan **solo en el equipo local**
  (localStorage) — nunca se suben a la nube ni salen del restaurante.
- Actualiza el aviso de privacidad interno mencionando el tratamiento
  biométrico, su finalidad y cómo revocarlo.
- Alternativa sin biometría: identificar por **uniforme** (la hostess de
  color distintivo) — menos precisa pero sin datos sensibles; pídela si tu
  cliente no quiere firmar consentimientos.

---

## Pase de comida: platillos olvidados 🍽️

**El problema:** los platillos salen de cocina al pase/barra y esperan a que
un mesero los recoja. Si nadie pasa por ellos, llegan fríos a la mesa (o se
desperdician).

### Cómo funciona

Dibuja una zona con la regla **"Pase de comida"** sobre la barra donde se
dejan los platillos. El sistema detecta objetos de comida (platos hondos,
tazas, vasos, etc.) dentro de la zona y les da **seguimiento individual por
posición** (los platillos no se mueven, así que cada uno conserva su
cronómetro real):

- Cada platillo muestra su **cronómetro en vivo** sobre el video (`🍽 2m 15s`).
- Si supera el límite configurado (default 3 min) → **alerta**: *"Platillo
  lleva 4m en el pase sin que lo recojan — se está enfriando"* (sonido +
  WhatsApp + captura).
- Cuando lo recogen, se registra el evento con cuánto esperó (métrica para
  medir la disciplina de recolección por turno).
- La oclusión momentánea (el brazo de un mesero tapando el plato) no
  reinicia el cronómetro (gracia anti-flicker de ~6s).

**Consejo de encuadre:** cámara mirando el pase desde arriba/en ángulo, con
los platillos bien visibles y separados. El modelo detecta mejor platos
hondos (bowls), tazas y vasos que platos extendidos muy llanos — haz una
prueba con tu vajilla real y ajusta la "confianza mínima" si hace falta.

### Heatmap de actividad 🔥 (toggle)

Botón **"Heatmap"** sobre el video: pinta un mapa de calor de **dónde se
concentra el movimiento de personas** (azul = poco, rojo = mucho, con
decaimiento en el tiempo). Úsalo para ver patrones: dónde se paran los
meseros, qué pasillos se congestionan, si el host abandona su puesto.

### ⚠️ Temperatura real de los platillos: hablemos claro

Una cámara normal (RGB) **no puede medir temperatura** — el "heatmap" de
arriba es de *actividad/movimiento*, no de calor físico. Para detectar que
un platillo caliente se enfrió hay dos rutas:

1. **Proxy por tiempo (lo que ya hace el módulo):** un platillo caliente que
   lleva 4+ minutos en el pase YA se enfrió — la alerta por tiempo es, en la
   práctica, tu "alarma de platillo frío" sin hardware extra. Es lo que
   recomendamos operar.
2. **Cámara térmica (hardware, Fase 2+):** una cámara termográfica real
   (Hikvision serie térmica ~$8–15 mil MXN, o módulos FLIR Lepton ~$4 mil
   MXN con Raspberry Pi) sí mide grados por pixel; se integra por RTSP igual
   que las demás y podríamos alertar "el platillo bajó de 45°C". Tiene
   sentido solo si el cliente lo pide con presupuesto — el proxy por tiempo
   resuelve el 95% del valor con 0 hardware.

---

## Multi-cámara: cada zona en su cámara

El módulo maneja **varias cámaras**, cada una con **sus propias zonas e
inspecciones**. En la barra superior agregas cámaras ("+ Cámara"), le pones
nombre y eliges su dispositivo/fuente; al seleccionarla ves y editas solo sus
zonas. Ejemplos:

- **Recepción** → Puesto anfitrión + Llegada de clientes (modo recepción).
- **Barra** → zona *atendida* (que nunca quede sola > 3 min).
- **Almacén** → zona *restringida* (alerta si alguien entra).
- **Cocina** → zona *atendida* + zona *restringida* (área de cuchillos).

> En la PC analizas **una cámara a la vez** (cambias entre ellas con un clic).
> Para vigilar **todas simultáneamente 24/7** es la Fase 2 (Frigate en un
> mini-PC), donde cada cámara corre en paralelo y el bridge manda los mismos
> eventos a este tablero.

---

## FASE 1 — Usar las cámaras que el restaurante ya tiene (RTSP)

Casi cualquier DVR/NVR o cámara IP (Hikvision, Dahua, TP-Link, Reolink…)
expone un stream **RTSP**. El navegador no puede leer RTSP directo, así que
hay dos puentes:

### Opción A: OBS como puente (0 código, ideal para validar HOY)

**No necesitas ningún proxy ni servidor** si tu PC está en la MISMA red local
que el DVR: OBS *es* el puente (RTSP → cámara virtual → módulo Visión IA).

#### Paso a paso con un DVR/NVR **Hikvision** (el caso de tu cliente)

**1. Consigue los datos del DVR (5 min):**
   - **IP del DVR**: en el monitor del DVR → Menú → Configuración → Red
     (ej. `192.168.1.64`), o con la herramienta gratuita
     [SADP](https://www.hikvision.com/es-la/support/tools/hitools/) que
     encuentra todos los equipos Hikvision de la red.
   - **Usuario y contraseña** del DVR (el `admin` que usa tu cliente para
     entrar; muchas veces está en una etiqueta o lo tiene el instalador).
   - **RTSP habilitado**: casi siempre viene activo (puerto **554**). Se
     verifica en Menú → Red → Más ajustes → puerto RTSP.

**2. Arma la URL RTSP de Hikvision.** El formato moderno es:

   ```
   rtsp://USUARIO:CONTRASEÑA@IP:554/Streaming/Channels/CCss
   ```

   donde `CC` = número de cámara y `ss` = stream (`01` principal HD,
   `02` substream ligero — **usa el 02 para análisis**, carga mucho menos):

   | Cámara del DVR | URL |
   |---|---|
   | Cámara 1 (substream) | `rtsp://admin:MiPass123@192.168.1.64:554/Streaming/Channels/102` |
   | Cámara 2 (substream) | `rtsp://admin:MiPass123@192.168.1.64:554/Streaming/Channels/202` |
   | Cámara 5 (principal) | `rtsp://admin:MiPass123@192.168.1.64:554/Streaming/Channels/501` |

   > Equipos Hikvision viejos usan `rtsp://user:pass@ip:554/h264/ch1/main/av_stream`.
   > Si la contraseña tiene `@` o `#`, codifícala (`@` → `%40`).

**3. Valida la URL con VLC antes que nada** (te ahorra pelearte con OBS):
   VLC → Medio → *Abrir ubicación de red* → pega la URL → si ves el video,
   la URL es correcta. Si no: revisa IP/credenciales/puerto 554.

**4. Métela a OBS:**
   - Instala [OBS Studio](https://obsproject.com) (gratis).
   - Fuentes → **+** → **Origen multimedia** → desmarca "Archivo local" →
     en *Entrada* pega la URL RTSP. En *Opciones de entrada* agrega
     `rtsp_transport=tcp` si se ve entrecortado.
   - Clic en **Iniciar cámara virtual** (panel de controles, derecha).

**5. Conéctala al módulo:** Visión IA → **+ Cámara** → nombre "Recepción
   (DVR ch.1)" → dispositivo **"OBS Virtual Camera"** → Iniciar → dibuja
   tus zonas. Ya estás analizando la cámara del techo del cliente. 🎉

#### Varias cámaras del DVR con un solo OBS

Crea en OBS **una escena por cámara** (Escena "Recepción" con el canal 102,
Escena "Barra" con el 202…). La cámara virtual emite la escena activa: al
cambiar de escena en OBS cambias qué cámara analiza el módulo — igual que
cambiar de cámara en la barra del módulo. (Todas a la vez y 24/7 = Fase 2.)

#### ¿Y si NO estoy en el local del cliente? (acceso remoto)

Aquí sí necesitas un túnel — **nunca expongas el puerto 554 a internet**:

- **Recomendado: [Tailscale](https://tailscale.com)** (gratis, 5 min): se
  instala en una PC del local y en la tuya → crea una VPN privada y usas la
  URL RTSP con la IP de Tailscale (`rtsp://admin:pass@100.x.y.z:554/...`)
  como si estuvieras en el local.
- Alternativa: port-forwarding en el router del cliente — **no lo hagas**,
  los DVR expuestos son el blanco #1 de botnets.
- Para la validación de esta semana lo más práctico: ve al local con tu
  laptop, conéctate al WiFi del negocio y sigue los pasos 1–5.

### ¿Puedo validar con mi cámara Blink de casa? (respuesta honesta: no directo)

Las cámaras **Blink (Amazon) NO exponen RTSP ni stream local** — van
directo a la nube de Amazon y solo se ven desde su app. Además los modelos
de batería no transmiten continuo (graban clips al detectar movimiento y el
"Live View" se corta a los pocos minutos). **No es buena fuente para esta
validación.** Tienes 2 caminos:

- **Mejor opción — tu teléfono como cámara IP (5 min):** instala en un
  celular viejo la app **IP Webcam** (Android, gratis) → *Iniciar servidor*
  → te da una URL `http://192.168.x.x:8080/video`. Pégala en OBS (Origen
  multimedia) → cámara virtual → módulo. Con **DroidCam** (Android/iPhone)
  es aún más directo: su cliente de PC crea su propia cámara virtual que el
  módulo ve sin OBS. Montas el teléfono apuntando a tu puerta y validas el
  modo Recepción hoy mismo en tu casa.
- **Hack con la Blink (funciona, no elegante):** espeja la app del teléfono
  a tu PC (Android: [scrcpy](https://github.com/Genymobile/scrcpy) o Phone
  Link de Windows; iPhone: espejo en Mac) con el Live View de Blink abierto
  → en OBS usa **Captura de ventana** sobre el espejo → cámara virtual.
  Sirve para un demo corto; para pruebas largas usa el teléfono como IP cam.

> Moraleja para tu cliente: cámaras con **RTSP** (Hikvision, Dahua, TP-Link
> Tapo, Reolink…) = integrables. Cámaras cloud cerradas (Blink, Ring) = no.

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
