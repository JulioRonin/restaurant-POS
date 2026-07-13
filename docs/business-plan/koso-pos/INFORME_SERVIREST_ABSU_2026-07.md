# Informe de Producto ServiRest — para ABSU (Marketing y Ventas)

**Versión:** 1.0 · Julio 2026
**Preparado por:** análisis de producto (código auditado línea por línea) + entrevista directa con el fundador.
**Objetivo:** dar a la agencia ABSU un mapa exacto y honesto de cada función de ServiRest, para construir landing, ads y guiones de demo **sin prometer nada que hoy no exista**.
**Sustituye a:** `PRODUCT_INVENTORY_MARKETING.md` (v1.0), que quedaba desactualizado — no incluía el Canal Digital, Lealtad/Referidos, Repartidor ni Visión IA, y arrastraba 4 promesas de un modelo comercial de 4 planes que nunca se llegaron a construir. Ese archivo se conserva como referencia histórica de redacción, pero **este documento es la fuente única de verdad a partir de hoy.**

---

## Cómo leer este documento

Cada función tiene exactamente 7 datos, siempre en el mismo orden: qué hace, quién la usa y en qué dispositivo, cómo se hacía antes sin ServiRest, el valor que aporta, en qué plan vive, su estado real, y si hay captura de pantalla disponible.

### Leyenda de ESTADO (léela antes de todo lo demás — es la columna más importante del documento)

| Símbolo | Significado | Se puede vender en la landing como... |
|---|---|---|
| ✅ **LIVE** | En producción, se vende y se usa hoy en Esencial/Completo, sin condiciones. | Función ya disponible, sin matices. |
| 🧪 **PILOTO** | Construida y funcionando de verdad, validándose con **1 cliente real**, pero **todavía no se vende al público en general**. | "Muy pronto" / "en validación con restaurantes reales" — nunca como "disponible hoy para cualquiera". |
| 🔧 **EN DESARROLLO** | Se está construyendo activamente ahora mismo. No es usable de forma confiable todavía. | Solo como "estamos construyendo esto" (roadmap), nunca como función vendible. |
| 💡 **IDEA / FUTURO** | No existe una sola línea de código. Es una intención o un texto de venta que quedó huérfano de un modelo comercial anterior. | Nunca en la landing de venta. A lo mucho, en un roadmap público tipo "lo que viene". |

---

## Modelo comercial vigente

| Plan | Precio | Para quién |
|---|---|---|
| **Esencial** | $550 MXN/mes | Fondas, cafés, taquerías, foodtrucks — 1 local pequeño |
| **Completo** | $850 MXN/mes | Restaurantes con cocina, barra, delivery y equipo de piso |
| **Enterprise** | Cotización a medida | Cadenas y franquicias multi-sucursal |

No hay comisión por transacción en ningún plan. El Canal Digital (pedidos en línea) tampoco cobra comisión por pedido — el propio restaurante cubre el costo de envío (vía propina al repartidor) y puede restringir el radio de entrega. Esto es un diferenciador frente a Rappi/Uber Eats/DiDi, que cobran entre 25% y 30% de comisión por pedido.

---

# A) Por MÓDULO del sistema

## A.1 · Módulos operativos (el día a día en piso)

#### Dashboard — orquestación financiera
- **Qué hace:** panel de cierre en tiempo real. KPI hero de ventas netas con delta % vs promedio, 6 indicadores en línea (ticket promedio, margen con veredicto "Sano/Aceptable/Revisa food cost", platillos vendidos, gastos, cancelaciones, flujo neto), gráfica de tesorería (ingresos vs gastos), top 8 platillos más vendidos + bottom 4 con aviso de "pausar", distribución del valor de inventario por categoría. Filtros por Día/Semana/Mes/Año, por categoría, por fecha específica. Exporta reporte financiero completo.
- **Quién / dispositivo:** Dueño o Administrador, en computadora o tablet.
- **Antes de ServiRest:** sumar tickets a mano o en Excel al cierre del turno; no saber cuánto vale el inventario amarrado; platillos de bajo desempeño ("zombies") ocupando espacio en el menú sin que nadie se dé cuenta.
- **Valor:** ver el estado del negocio en segundos en vez de armar un Excel. Sin métrica cuantitativa propia registrada más allá de la de Caja (ver más abajo); valor cualitativo confirmado por uso diario del fundador.
- **Plan:** Esencial y Completo (ambos lo tienen; los límites de mesas/empleados/platillos varían por plan, no el Dashboard en sí).
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### POS — línea de órdenes
- **Qué hace:** el mesero arma la cuenta y la manda a cocina/bar desde una sola pantalla. Catálogo con búsqueda y categorías, carrito lateral con notas por platillo ("sin cebolla"), variantes con precio delta ("+$25" o "incluido"), selección de mesa, fuente de la orden (en mesa / para llevar / Rappi / Uber Eats), envío a cocina con impresión automática si hay impresora conectada (o fallback a impresión de navegador).
- **Quién / dispositivo:** Mesero, en tablet fija (modo "Tablet POS") o teléfono propio (PWA instalada).
- **Antes de ServiRest:** el mesero cambia entre libreta, memoria y gritos a cocina; "se me olvidó decirle a cocina que sin cebolla" es un dolor recurrente sin nota ligada al ticket físico.
- **Valor:** una sola pantalla del pedido al fuego. Sin métrica cuantitativa propia registrada (percepción: reduce tiempo de armado de cuenta vs cambiar entre libreta/memoria, no medido en minutos exactos).
- **Plan:** Esencial y Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### MyTables — mesas activas del mesero
- **Qué hace:** vista de "solo mis mesas en curso" durante el turno. Ribbon semántico por tarjeta ("Por cobrar" terracota, "Lista para servir" verde, "Tarda N min — verifica" mostaza). Modificar pedido, cancelar, marcar "cobrar cuenta" (avisa a caja). Reducir cantidad de un platillo ya en cocina exige PIN de manager.
- **Quién / dispositivo:** Mesero, en tablet o celular propio.
- **Antes de ServiRest:** el mesero pierde de vista mesas entre tantas pantallas/mesas; un cambio abusivo de pedido (quitar un platillo ya cocinado) no queda registrado ni autorizado.
- **Valor:** el ribbon mostaza avisa que una mesa se está tardando antes de que el cliente se queje; el PIN de manager audita quién autorizó qué cambio.
- **Plan:** Esencial y Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### Kitchen — KDS (pantalla de cocina)
- **Qué hace:** tickets ordenados por antigüedad, legibles a 2 metros. Cronómetro semáforo (verde <15 min "A tiempo", mostaza 15-25 min "Apura", rojo pulsante ≥25 min "Tarde"). Alarma sonora + overlay "Pedido nuevo" al entrar una orden. Auto-impresión de comanda para pedidos de delivery/canal digital. Botón "Pedido listo" por ticket. Filtros Todos/Comedor/Delivery. Burbuja de mensajes de clientes del Canal Digital, con respuesta desde la misma pantalla.
- **Quién / dispositivo:** Chef y cocineros, en pantalla o tablet fija en la línea de cocina.
- **Antes de ServiRest:** comandas de papel que se pierden en el rebote, gritos entre mesero y cocina, ningún aviso de que un pedido lleva demasiado tiempo colgado.
- **Valor:** el cronómetro semáforo da visibilidad instantánea de qué apurar, sin que nadie tenga que pensarlo o preguntarlo.
- **Plan:** Solo Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### Bar — barra de bebidas
- **Qué hace:** pantalla exclusiva del bartender, en paralelo a cocina. Una comanda con bebidas dispara dos tickets automáticamente (cocina y bar) por detección de palabras clave (bebida, vino, trago, cerveza, cocktail…). Cronómetro más agresivo que cocina (bebidas se sirven antes). La mesa cierra cuando ambas estaciones marcan listo.
- **Quién / dispositivo:** Bartender, en pantalla o tablet fija en la barra.
- **Antes de ServiRest:** el "¿ya está el mojito?" gritado a la cocina; bebidas mezcladas con platos fuertes en la misma comanda visual.
- **Valor:** el bartender ve solo lo suyo; la sincronización evita que la mesa se sirva descoordinada.
- **Plan:** Solo Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### Cashier — caja y cobros
- **Qué hace:** cobro de mesas y delivery, split de cuenta (1/2/3/4 partes), propina (0/10/15/20%), cobro en efectivo (con cálculo de cambio y montos rápidos) o tarjeta (simulación de terminal Bluetooth EMV de 6 pasos), impresión de ticket y apertura de cajón, registro de gastos de caja chica por categoría, historial del día exportable a CSV, y **corte de caja imprimible**.
- **Quién / dispositivo:** Cajero, en computadora o tablet fija junto a caja.
- **Antes de ServiRest:** traducir mesas a Excel a mano al final del día; dividir cuenta entre amigos a calculadora; gasto de caja chica ("compré hielo") que se pierde en el bolsillo sin quedar registrado.
- **Valor real medido:** **el corte de caja pasa de ~45 minutos (cierre manual eficiente) a un máximo de 20 minutos con ServiRest** — dato de uso diario del propio fundador, no una proyección de marketing.
- **Plan:** Esencial y Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### Hostess — salón (plano y anfitrionía)
- **Qué hace:** mapa visual de mesas con drag-and-drop y snap-to-grid, lista de espera arrastrable a una mesa disponible (check-in automático), asignación de mesero por foto, reservaciones (apartar mesa, cambiar hora, soltar reserva, sentar cliente), modo Lista alternativo a modo Plano.
- **Quién / dispositivo:** Hostess/anfitrión, en tablet fija en la entrada ("modo Tablet host").
- **Antes de ServiRest:** lista de espera en papel que se pierde o se ensucia; sin plano digital, la rotación de mesas se optimiza a ojo; nadie recuerda a qué mesero le tocó cuál mesa.
- **Valor:** el host coloca cada mesa donde está en el piso real y arrastra al cliente de la lista a su mesa sin escribir nada dos veces.
- **Plan:** Solo Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí
- **Nota sobre una promesa vieja no construida:** el documento de marketing anterior anunciaba "Reservaciones con confirmación automática por WhatsApp + email". Las reservaciones manuales (apartar, cambiar hora, cancelar, sentar) **sí existen y son ✅ LIVE**; el envío automático de confirmación por WhatsApp/email **no existe en el código** → 💡 idea/futuro. No debe aparecer en la landing como función actual.

#### RemoteOrder — drive-thru, mostrador y para llevar
- **Qué hace:** toma de orden rápida en canal directo, cobra al momento sin pasar por caja. Modos Drive-thru / Mostrador / Para llevar. Cobro en efectivo, tarjeta o transferencia (con CLABE copiable al portapapeles).
- **Quién / dispositivo:** Cajero o mesero de mostrador, en tablet o computadora junto al mostrador/ventanilla.
- **Antes de ServiRest:** cliente de drive-thru esperando una interfaz lenta pensada para mesas; foodtrucks sin mesas obligados a usar un POS de restaurante de mesa.
- **Valor:** cobro directo sin pasos de más para el canal que menos tolera espera.
- **Plan:** Solo Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

---

## A.2 · Módulos de catálogo

#### Menu — catálogo de platillos
- **Qué hace:** alta, edición, pausa y organización de platillos y variantes (hasta 10 por platillo con precio delta). Importación de CSV en bloque. Foto por upload (a Supabase Storage) o URL. Toggle activo/pausado con un tap.
- **Quién / dispositivo:** Dueño o Administrador, en computadora o tablet.
- **Antes de ServiRest:** subir un cambio de precio un domingo en la noche significa reimprimir el menú o avisar mesa por mesa; migrar 200 platillos desde Excel a mano.
- **Valor:** pausar un platillo agotado sin perder su histórico ni su foto; importar el menú completo de un tiro.
- **Plan:** Esencial y Completo (el tope de platillos varía por plan).
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### Inventory — inventario
- **Qué hace:** capa básica (alta de productos, alerta de mínimo crítico) en Esencial; capa avanzada (costo por unidad, valor total amarrado, proveedor por producto, pedidos de compra agrupados por proveedor, recepción con incremento automático de stock, food cost alimentando el Dashboard) en Completo.
- **Quién / dispositivo:** Dueño, Administrador o encargado de compras, en computadora o tablet.
- **Antes de ServiRest:** no saber cuánto dinero está amarrado en almacén; quedarse sin un insumo crítico un viernes en la noche sin previo aviso; un pedido a proveedor por WhatsApp/llamada por cada insumo suelto en vez de uno agrupado.
- **Valor:** la alerta de mínimo evita el quiebre de stock; el pedido agrupado por proveedor reduce el número de llamadas/mensajes necesarios.
- **Plan:** Esencial (básico) y Completo (avanzado con food cost).
- **Estado:** ✅ LIVE
- **Captura:** Sí

---

## A.3 · Módulos administrativos

#### Staff — personal y horarios
- **Qué hace:** alta de colaborador con PIN inicial, perfil, rating, calendario semanal de turnos, export a PDF listo para imprimir.
- **Quién / dispositivo:** Dueño o Administrador, en computadora.
- **Antes de ServiRest:** horario anotado en una cartulina en la cocina; sin forma sistemática de calificar desempeño.
- **Valor:** horario exportable y compartible sin reescribirlo cada semana.
- **Plan:** Esencial y Completo (el tope de empleados varía por plan).
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### Invoice — facturación CFDI 4.0
- **Qué hace:** timbrado fiscal vía Facturama desde la misma orden ya cobrada. Envío automático de PDF+XML por email. Contador de timbres consumidos con alerta al 70%/90% del límite mensual.
- **Quién / dispositivo:** Cajero o Administrador, en computadora o tablet.
- **Antes de ServiRest:** cliente empresa pide factura al pagar y el negocio tiene que abrir otro sistema aparte, o mandarla "después por WhatsApp".
- **Valor:** factura en el mismo momento del cobro, sin salir del sistema.
- **Plan:** Solo Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### Billing — plan y facturación de la suscripción
- **Qué hace:** elegir/subir de plan, ver días restantes con gracia de 5 días post-vencimiento, financiamiento del equipo POS (contado o hasta 8 meses), historial de pagos, botón "Ya pagué, verifica de nuevo".
- **Quién / dispositivo:** Dueño, en computadora.
- **Antes de ServiRest:** no aplica (es un módulo propio de la operación comercial de ServiRest, no reemplaza nada del restaurante).
- **Valor:** transparencia de cuándo vence el servicio, sin corte sorpresa por retraso de sincronización de pago.
- **Plan:** Todos los planes (es la pantalla donde se gestiona el plan mismo).
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### Settings — ajustes del negocio
- **Qué hace:** 6 pestañas — datos fiscales, apariencia (logo, tema, modo de dispositivo: Estándar/Tablet POS/Tablet host/Móvil mesero), hardware (impresora, terminal, diagnóstico, ancho de papel), personal (alta con permisos por módulo, override por persona), avisos (toggles de notificación), y diagnóstico técnico (incluye "Storage Inspector" con PIN 666 para comparar datos locales vs nube).
- **Quién / dispositivo:** Dueño o Administrador, en computadora.
- **Antes de ServiRest:** configurar hardware de un POS legacy normalmente implica un técnico o un instalador.
- **Valor:** el "modo tablet POS" configurado una vez hace que cada tablet en piso abra directo en su pantalla, sin margen de error del operador.
- **Plan:** Esencial y Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

---

## A.4 · Módulos de acceso y arranque

#### Onboarding — asistente de 7 pasos
- **Qué hace:** guía Plan → Info del negocio → Menú → Mesas → Personal → Hardware → Completado. Detección real de hardware (Bluetooth/USB) con prueba de impresión y cajón funcionando dentro del mismo flujo.
- **Quién / dispositivo:** Dueño, en computadora, al darse de alta.
- **Antes de ServiRest:** instalar un POS legacy puede tomar semanas con visita técnica.
- **Valor:** de la cuenta creada al POS listo para vender en una sola sesión guiada.
- **Plan:** Todos los planes.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### AuthScreen — inicio de sesión / registro
- **Qué hace:** login por email/password, toggle a registro de negocio nuevo.
- **Quién / dispositivo:** Cualquier usuario, cualquier dispositivo.
- **Antes de ServiRest:** n/a.
- **Valor:** acceso simple, sin instalador.
- **Plan:** Todos los planes.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### LockScreen — cambio de operador
- **Qué hace:** la terminal queda siempre abierta al negocio; cada persona entra con PIN de 4 dígitos en unos segundos. Cada cobro y cada corte de caja quedan firmados con el nombre real de quien lo hizo.
- **Quién / dispositivo:** Todo el personal, en la terminal física de piso/caja.
- **Antes de ServiRest:** turnos rotativos que obligan a cerrar y abrir sesión completa, o que comparten una sola cuenta sin saber quién cobró qué.
- **Valor:** auditoría real de quién operó cada turno.
- **Plan:** Esencial y Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

---

## A.5 · Módulos de plataforma y confianza

#### SuperAdmin — centro de control interno
- **Qué hace:** panel interno del EQUIPO de ServiRest (no del cliente): cambiar precio global, ver MRR y cuentas activas, gestionar plan/descuentos/features por cliente uno por uno, activar módulos como add-on manual aunque el tier del cliente no los cubra por default.
- **Quién / dispositivo:** Equipo de ServiRest (no restaurantero), en computadora.
- **Antes de ServiRest:** n/a — no reemplaza nada del restaurante, es la cabina de control del negocio ServiRest mismo.
- **Valor:** vender módulos como add-on a un cliente puntual sin tener que subirlo de plan completo.
- **Plan:** No aplica a clientes — uso interno.
- **Estado:** ✅ LIVE
- **Captura:** Sí
- **Nota:** este módulo **no debe aparecer en la landing pública**. Es material solo para un deck interno o de inversionistas.

#### Sidebar — navegación lateral inteligente
- **Qué hace:** el menú se adapta según 3 filtros combinados: permisos del rol (RBAC), plan comercial contratado, y feature flags activados por SuperAdmin. Nadie ve un botón al que no tiene acceso.
- **Quién / dispositivo:** Todo el personal, siempre visible.
- **Valor:** cero confusión de "¿por qué veo esto si no me toca?".
- **Plan:** Todos los planes.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### SubscriptionGuard — guardián de suscripción
- **Qué hace:** bloquea el sistema si la suscripción está vencida (con 5 días de gracia antes del bloqueo real), muestra el estado exacto (activa/próxima a vencer/vencida/demo) y un botón "Ya pagué, verifica de nuevo".
- **Valor:** evita cortes hostiles y llamadas de soporte por retrasos de sincronización de Stripe.
- **Plan:** Todos los planes.
- **Estado:** ✅ LIVE
- **Captura:** Sí

#### FinancialReportModal — reporte exportable
- **Qué hace:** PDF con estado de utilidades, desglose financiero, gastos por categoría, cashflow por canal (efectivo/tarjeta/transferencia/Uber/DiDi/Rappi) con **día real de payout de cada canal**, y top 5 meseros por ventas.
- **Quién / dispositivo:** Dueño, exportado desde Dashboard.
- **Valor:** un PDF profesional listo para la contadora, con cashflow por canal (no solo la suma de ventas).
- **Plan:** Esencial y Completo.
- **Estado:** ✅ LIVE
- **Captura:** Sí

---

## A.6 · Canal Digital (🧪 en validación con 1 cliente real)

> Todo este bloque comparte el mismo estado y el mismo plan, así que se explica una vez aquí: **Estado 🧪 PILOTO** (construido, funcionando, un solo cliente real validándolo, **todavía no a la venta pública**), **Plan: incluido dentro de Completo** cuando salga al mercado, sin costo aparte, sin comisión por pedido. **Sin métricas de uso todavía** (no hay dato real de pedidos/día ni de canjes) — no inventar cifras en la landing. **Sin capturas de pantalla disponibles todavía.**

#### Storefront — tienda en línea del cliente
- **Qué hace:** el cliente ordena desde su navegador en `tunegocio.com/#/o/{negocio}`, sin instalar nada. Elige domicilio o recoger, arma su pedido con variantes, valida su ubicación por GPS contra el radio de entrega configurado por el restaurante (con candado de seguridad para invitados), paga con tarjeta (Stripe), efectivo o terminal, y sigue el estatus de su pedido en vivo (burbuja flotante + pantalla de progreso) con mensajería directa a la tienda/repartidor.
- **Quién / dispositivo:** Cliente final, en su propio celular (navegador, sin instalar app).
- **Antes de ServiRest:** el restaurante depende 100% de apps de delivery de terceros (con 25-30% de comisión) o de tomar pedidos por WhatsApp a mano.
- **Valor:** canal propio sin comisión por pedido; el restaurante controla su radio real de entrega.
- **Plan / Estado / Captura:** ver nota superior.

#### Kiosko — auto-servicio en tablet dentro del local
- **Qué hace:** una tablet física en el mostrador donde el cliente ordena y paga él mismo (tarjeta, terminal o efectivo en caja), sin esperar a un mesero.
- **Quién / dispositivo:** Cliente final, en tablet fija del restaurante ("modo Kiosko").
- **Antes de ServiRest:** fila en mostrador esperando que alguien tome el pedido en horas pico.
- **Valor:** reduce la dependencia de personal disponible en horas pico.
- **Plan / Estado / Captura:** ver nota superior.
- **Nota sobre una promesa vieja no construida:** el código de esta pantalla tiene un botón que literalmente dice **"Descargar QR (próximamente)"** — el QR imprimible para mesa/volante **no está construido**, solo la URL pública funciona. → 💡 idea/futuro, no mencionar como disponible.

#### Panel de administración del Canal Digital
- **Qué hace:** el dueño define el catálogo público, horarios de servicio por día, precios específicos para venta en línea, zona/radio de entrega (con GPS del negocio), y obtiene la URL pública para compartir.
- **Quién / dispositivo:** Dueño o Administrador, en computadora.
- **Plan / Estado / Captura:** ver nota superior.

---

## A.7 · Cuenta de cliente, Lealtad y Referidos (🧪 en validación con 1 cliente real)

> Mismo estado que el bloque anterior: **🧪 PILOTO**, incluido dentro de Completo sin costo aparte, **sin métricas de uso real todavía** (ningún cliente final ha canjeado una recompensa de verdad todavía), **sin capturas disponibles**.

#### Mi cuenta / Mis pedidos
- **Qué hace:** el cliente ve su perfil, su historial de consumo (pedidos, gasto total, puntos), y sus favoritos (lo que más pide) como una gráfica de preferencias. Puede reabrir el estatus en vivo de cualquier pedido activo o ver el resumen (productos, total, dirección) de cualquier pedido anterior.
- **Quién / dispositivo:** Cliente final, en su celular, dentro del Storefront.
- **Antes de ServiRest:** cero relación con el cliente entre pedido y pedido; ningún dato de qué le gusta pedir.
- **Valor:** perfila al cliente recurrente sin encuesta manual.

#### Programa de referidos
- **Qué hace:** cada cliente tiene un código propio para compartir; cuando un referido hace su primer pedido, el que invitó recibe crédito. Recompensa automática: rebanada gratis a las 5 compras o a los 3 referidos, con código de canje que el cliente presenta al cajero.
- **Quién / dispositivo:** Cliente final (comparte y canjea), Cajero (valida el canje).
- **Antes de ServiRest:** boca a boca sin trazabilidad ni incentivo formal.
- **Valor:** mecanismo de adquisición de clientes con costo de recompensa conocido de antemano (una rebanada), no una comisión variable.

#### Mensajería cliente ↔ tienda/repartidor
- **Qué hace:** el cliente manda mensajes ligados a su pedido; cocina y repartidor los ven como burbujas con notificación y responden desde su propia pantalla.
- **Quién / dispositivo:** Cliente (Storefront), Cocina (Kitchen), Repartidor (Driver).
- **Valor:** evita la llamada telefónica para "¿ya viene mi pedido?" o "cambié de dirección".

---

## A.8 · Repartidor (🧪 piloto — panel de seguimiento, no un rol de campo todavía)

#### Panel de seguimiento de entregas
- **Qué hace:** lista de entregas a domicilio activas con dirección, teléfono (llamar directo), ruta en Maps con el GPS validado del cliente, productos del pedido y estatus de pago. Marca "salir a entregar" y "entregada" (cobra automáticamente si era efectivo/terminal pendiente). Mensajería directa con el cliente.
- **Quién / dispositivo:** hoy lo usa el **Administrador o Gerente**, en computadora o tablet, para dar seguimiento a las entregas — **no existe todavía un login propio de repartidor de campo con su propio PIN**. El fundador confirma que ese rol de campo **debe construirse** (queda anotado como pendiente de roadmap).
- **Antes de ServiRest:** el dueño se entera de que un pedido no llegó solo cuando el cliente se queja.
- **Valor:** visibilidad centralizada de cada entrega en curso, sin depender de que el repartidor reporte por WhatsApp.
- **Plan:** incluido en Completo, sin costo aparte.
- **Estado:** 🧪 PILOTO (el panel), 💡 IDEA (el rol de campo con login propio — no existe)
- **Captura:** No

---

## A.9 · Visión IA (🔧 en desarrollo activo — experimental)

#### Control de zonas y tiempos por cámara
- **Qué hace:** con una webcam o cámara IP (vía OBS como puente RTSP para DVRs Hikvision existentes), detecta personas en tiempo real y permite dibujar zonas por cámara con distintas reglas: zona atendida (alerta si queda sin personal X minutos), zona restringida (alerta si alguien entra), puesto de anfitrión + línea de entrada (mide clientes que llegan y si son atendidos o se van sin atención — con seguimiento individual por cliente, no solo por zona), pase de comida (alerta si un platillo lleva demasiado tiempo esperando a que un mesero lo recoja), reconocimiento facial opcional del personal (con consentimiento explícito, solo local, nunca en la nube), y mapa de calor de actividad.
- **Quién / dispositivo:** Dueño o Administrador, en una computadora con cámara — pensado para escalar a un mini-PC con cámaras IP existentes del restaurante.
- **Antes de ServiRest:** sospecha sin datos de que se pierden clientes en la recepción por falta de atención; ningún restaurante pyme en México tiene esto hoy.
- **Valor potencial:** medir con datos reales un problema que hoy solo se sospecha (clientes que llegan y se van sin ser atendidos). Sin validar todavía en producción.
- **Plan:** aún sin definir comercialmente — está en fase de prueba técnica, no de venta.
- **Estado:** 🔧 EN DESARROLLO. **No debe aparecer en ningún material de venta activo.** A lo mucho, como "estamos construyendo esto" en un roadmap.
- **Captura:** No

---

# B) Por ROL / VISTA del equipo

Cada rol aterriza automáticamente en su pantalla natural al ingresar su PIN — nadie navega un menú completo para llegar a lo suyo.

#### Mesero
- **Qué ve/hace:** POS (armar y mandar pedidos), MyTables (sus mesas activas, cobrar cuenta), Bar/Kitchen si también cubre esas funciones.
- **Dispositivo:** tablet fija en modo "Tablet POS" o su propio celular (PWA instalada, modo "Móvil mesero").
- **Antes:** libreta y memoria; comunicación con cocina por voz.
- **Valor:** una sola pantalla del pedido al cobro, con notas y variantes ancladas al ticket.
- **Plan:** Esencial y Completo.
- **Estado:** ✅ LIVE

#### Cocina (Chef / Cocinero)
- **Qué ve/hace:** Kitchen (tickets con cronómetro semáforo, marcar listo), mensajes de clientes del Canal Digital (🧪).
- **Dispositivo:** pantalla o tablet fija en la línea de cocina.
- **Antes:** comandas de papel perdidas en el rebote, gritos.
- **Valor:** visibilidad de qué apurar sin preguntar a nadie.
- **Plan:** Solo Completo.
- **Estado:** ✅ LIVE (Kitchen) — mensajería del Canal Digital 🧪.

#### Bar (Bartender)
- **Qué ve/hace:** Bar (tickets de bebidas en paralelo a cocina).
- **Dispositivo:** pantalla o tablet fija en la barra.
- **Antes:** bebidas mezcladas con platos fuertes, "¿ya está el mojito?" gritado.
- **Valor:** cronómetro específico para bebidas, más agresivo que el de cocina.
- **Plan:** Solo Completo.
- **Estado:** ✅ LIVE

#### Cajero
- **Qué ve/hace:** Cashier (cobrar, split, propina, gastos de caja chica, historial, corte de caja), Invoice (facturar CFDI si el cliente lo pide).
- **Dispositivo:** computadora o tablet fija junto a caja.
- **Antes:** traducir mesas a Excel a mano; dividir cuenta a calculadora.
- **Valor real medido:** corte de caja de ~45 min a un máximo de 20 min.
- **Plan:** Esencial y Completo (Cashier); Invoice solo Completo.
- **Estado:** ✅ LIVE

#### Hostess / Anfitrión
- **Qué ve/hace:** Hostess (plano de mesas, lista de espera, reservaciones, asignación de mesero).
- **Dispositivo:** tablet fija en la entrada, modo "Tablet host".
- **Antes:** lista de espera en papel, rotación de mesas a ojo.
- **Valor:** plano digital + lista de espera arrastrable a la mesa.
- **Plan:** Solo Completo.
- **Estado:** ✅ LIVE

#### Administrador / Dueño
> Son la misma vista — el dueño simplemente usa el rol Administrador; no existe una pantalla ejecutiva separada.
- **Qué ve/hace:** todo lo anterior más Dashboard, Menu, Inventory, Staff, Billing, Settings, y el Canal Digital/Lealtad/Repartidor cuando aplique.
- **Dispositivo:** computadora principalmente, también tablet.
- **Antes:** múltiples sistemas o cuadernos sueltos para cada función administrativa.
- **Valor:** un solo lugar para ver el negocio completo y configurarlo.
- **Plan:** Esencial y Completo (con más módulos desbloqueados en Completo).
- **Estado:** ✅ LIVE

#### Cliente (Canal Digital)
> No es un empleado — es la vista pública que ve quien pide desde su casa o desde la tablet del kiosko. Es una extensión de los módulos de Canal Digital (Storefront + Kiosko), no una pantalla aparte.
- **Qué ve/hace:** arma su pedido, paga, valida su ubicación por GPS, sigue el estatus en vivo, manda mensajes a la tienda, ve su cuenta con historial/lealtad/referidos.
- **Dispositivo:** su propio celular (Storefront) o la tablet física del restaurante (Kiosko).
- **Antes:** dependía de apps de delivery de terceros o de WhatsApp manual.
- **Valor:** pedir directo al restaurante, sin comisión, con seguimiento en vivo.
- **Plan:** el restaurante debe tener Completo para ofrecerlo.
- **Estado:** 🧪 PILOTO

#### Repartidor
> Hoy **no existe como rol con login propio** — es un pendiente confirmado de roadmap. Lo que existe hoy es el panel de seguimiento que usa el Administrador/Gerente (ver módulo A.8).
- **Qué vería/haría (a futuro):** su lista de entregas asignadas, ruta, mensajería con el cliente, marcar entregada.
- **Dispositivo (a futuro):** su propio celular.
- **Estado:** 💡 IDEA / FUTURO (el rol) — el panel de seguimiento del admin ya es 🧪 PILOTO.

---

# C) Flujo completo de punta a punta

## C.1 · Flujo núcleo — comensal que llega al restaurante (✅ validado, en uso diario)

1. **Apertura de turno** — cada persona entra a la terminal con su PIN en `LockScreen`. Queda registrado quién es el operador activo.
2. **Llegada del cliente** — la Hostess lo sienta desde el plano de `Hostess` (o lo suma a la lista de espera y lo arrastra a la mesa cuando se libera), y le asigna un mesero.
3. **Toma de orden** — el mesero arma la cuenta en `POS`: platillos, variantes, notas, mesa, y la envía. Se imprime comanda automáticamente (o cae a impresión de navegador si no hay impresora térmica).
4. **Preparación** — la orden aparece en `Kitchen` (y en `Bar` si trae bebidas) con cronómetro semáforo. Cada estación marca "listo" cuando corresponde; la mesa se marca lista para servir cuando ambas estaciones terminan.
5. **Seguimiento en piso** — el mesero ve el estatus de todas sus mesas en `MyTables`, con el ribbon avisando cuál se está tardando.
6. **Cobro** — el cliente pide la cuenta; el mesero marca "cobrar" desde `MyTables`, lo que dispara un aviso en `Cashier`. El cajero divide la cuenta si aplica, cobra en efectivo/tarjeta, imprime el ticket y abre el cajón.
7. **Factura (opcional)** — si el cliente la pide, se timbra CFDI 4.0 desde `Invoice` con los datos fiscales, y se manda PDF+XML por correo automáticamente.
8. **Cierre del día** — el corte de caja se genera desde `Cashier` (~20 min o menos); el dueño revisa `Dashboard` para ver ventas, margen y platillos ganadores del día, y puede exportar el reporte financiero completo desde `FinancialReportModal`.

## C.2 · Flujo Canal Digital — cliente que pide desde su casa (🧪 piloto, validado con 1 cliente)

1. El cliente entra al link del Storefront del restaurante (o a la tablet del Kiosko en el local).
2. Arma su pedido, elige domicilio o recoger. Si es domicilio, valida su ubicación por GPS contra el radio configurado por el restaurante (candado de seguridad — sin ubicación validada, no hay envío).
3. Paga (tarjeta vía Stripe, efectivo o terminal) o confirma su pedido para cobrar al recoger/entregar.
4. La orden entra directo a `Kitchen`, igual que una orden de mesa — la cocina no distingue de dónde vino.
5. El cliente sigue el estatus en vivo (burbuja flotante en su pantalla + notificaciones), y puede mandar un mensaje a la tienda si necesita avisar algo.
6. Si es domicilio, el Administrador/Gerente da seguimiento desde `Driver`, marca "salió a entregar" y "entregada" (cobra automáticamente si quedaba pendiente).
7. Al completarse el pedido, se acredita el consumo del cliente: suma puntos, cuenta hacia su próxima recompensa de lealtad, y si fue referido por alguien, se acredita el referido a quien lo invitó.

---

# D) Diferenciadores reales vs Toast y vs Soft Restaurante

## vs Toast

| | Toast | ServiRest |
|---|---|---|
| **Disponibilidad en México** | **No opera oficialmente en México ni Latinoamérica** — sus mercados confirmados son EE.UU., Canadá, Irlanda y Reino Unido. | Construido desde cero para el mercado mexicano. |
| **Moneda** | Precios en USD. | Precios en pesos mexicanos, desde el día uno. |
| **CFDI 4.0** | Sin evidencia de soporte nativo — es una función fiscal específica de México que una plataforma centrada en EE.UU./Canadá/UK no tiene razón estructural para incluir. | Integrado al mismo cobro (Completo). |
| **Contrato** | Contratos típicos de 2 años, con penalización alta por cancelación anticipada. | Sin contratos anuales — mensual o anual con descuento, cancelas cuando quieras. |
| **Costo real** | El plan base anunciado ($69/mes) no refleja el costo real: con comisión de procesamiento (2.49-2.99% + $0.15 USD), hardware y add-ons, el costo real termina siendo 2-3 veces el precio anunciado. | $550 o $850 MXN/mes, todo incluido según el plan, sin comisión por transacción. |

## vs Soft Restaurante (el competidor real y establecido en México)

| | Soft Restaurante | ServiRest |
|---|---|---|
| **Arquitectura** | Cliente-servidor: se instala en una PC con Windows que actúa de servidor local; **no es nube por defecto** (existe una versión "Cloud" aparte, distinta a su producto principal). Solo Windows — no Mac, no Linux. | 100% nube/PWA de fábrica. Se instala como app desde el navegador en cualquier dispositivo (Windows, Mac, Android, iOS), sin servidor local que mantener. |
| **Precio** | Desde ~$360 MXN/mes + IVA, pero **los módulos se cobran por separado** (facturación electrónica, delivery, monitor de cocina son add-ons adicionales). | Todo incluido dentro de cada plan — sin ir sumando módulos sueltos a la cotización. |
| **Antigüedad / percepción** | +25 años en el mercado — reconocido, pero con la interfaz y arquitectura de esa época. | Diseño editorial moderno (Sobremesa Lúcida), pensado para 2026, no para 2001. |
| **Modo offline** | No aplica igual — al ser cliente-servidor local, "offline" es su estado natural; el reto de Soft Restaurante es la nube, no lo offline. | PWA que sigue vendiendo sin internet y sincroniza al volver la conexión (ver matiz honesto en la sección de límites). |

*Fuentes consultadas para esta comparación (julio 2026): [Toast Pricing & Plans](https://pos.toasttab.com/pricing), [Toast Pricing — Owner.com](https://www.owner.com/blog/toast-pricing), [Toast Internacionalización — Toast Tech Blog](https://technology.toasttab.com/entry/internationalization-toast/), [Soft Restaurant — Precios](https://softrestaurant.com/soft-restaurant-precio), [Requerimientos del Sistema — Soft Restaurant](https://softrestaurant.com/phocadownload/DES.MNL.IMP.Manual_de_Usuario_de_Requerimientos_de_Sistema.V.1.20241025.pdf).*

---

# E) Métricas reales de uso propio

Esto es lo único que el fundador puede afirmar con certeza porque lo vive todos los días operando su propio restaurante con ServiRest:

- **Corte de caja:** de ~45 minutos (cierre manual eficiente) a un máximo de 20 minutos con ServiRest.
- Todo lo demás en este documento que no trae un número explícito **no tiene todavía una métrica cuantitativa propia registrada** — se describe el valor de forma honesta pero cualitativa, en vez de inventar una cifra para que suene mejor. Conforme se acumule más operación (propia o de clientes), este documento debe actualizarse con más datos duros.

---

# F) Lo que ServiRest NO hace hoy (límites honestos)

Léase esto antes de escribir cualquier copy de venta — es la sección que evita prometer de más.

1. **Reservaciones con confirmación automática por WhatsApp/email** — no existe. Las reservaciones manuales en Hostess sí funcionan.
2. **Código QR descargable/imprimible del Canal Digital** — no existe (la propia interfaz dice "próximamente"). Solo la URL pública funciona hoy.
3. **Wine list con maridajes** — no existe ninguna pantalla; era únicamente texto de un plan comercial anterior.
4. **White label real / API privada para integración con ERP** (SAP, Microsip, Contpaqi) — no existe ningún código que lo implemente; es solo un campo de configuración sin uso real. Si un cliente Enterprise lo pide, hoy sería desarrollo a la medida, no una función ya construida.
5. **Rol de Repartidor con login de campo propio** — no existe todavía. Hoy el seguimiento de entregas lo hace el Administrador/Gerente desde el panel de Repartidor.
6. **Visión IA** — es un experimento en desarrollo activo, sin fecha comercial, sin cliente usándolo en producción. No debe mencionarse en ningún material de venta activo.
7. **Canal Digital, Kiosko, Lealtad/Referidos y el panel de Repartidor** — están construidos y funcionando, pero validándose con un solo cliente real. Todavía no se venden al público en general ni tienen métricas de uso acumuladas.
8. **Sincronización automática en segundo plano:** el modo offline (seguir vendiendo sin internet) sí funciona. La sincronización automática de esos cambios hacia la nube al recuperar la conexión, en cambio, **no siempre se completaba de forma confiable** en algunos tipos de datos durante el desarrollo — se resolvió con escrituras directas específicas en los puntos donde se detectó. Es una candidata a reforzarse antes de escalar a más clientes concurrentes; no es un blocker para la operación de un solo restaurante hoy, pero tampoco conviene usarlo como *highlight* central de la landing hasta terminar de endurecerlo.
9. **Multi-sucursal, multi-moneda o multi-país** — el sistema está pensado para operación en México, en pesos, en un negocio con una o pocas sucursales (Enterprise cubre más sucursales, pero sigue siendo México/pesos).

---

## Cierre

Este documento reemplaza al `PRODUCT_INVENTORY_MARKETING.md` anterior como fuente única de verdad para ABSU. La regla de oro para cualquier pieza de venta que salga de aquí: **todo lo marcado ✅ se puede prometer sin condiciones; todo lo marcado 🧪 se puede insinuar como "muy pronto" o "en validación", nunca como disponible hoy; todo lo marcado 🔧 o 💡 no debe aparecer en ningún material de venta activo.**
