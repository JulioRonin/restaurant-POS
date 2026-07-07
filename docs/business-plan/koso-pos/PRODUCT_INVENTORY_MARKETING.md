# ServiRest — Reporte de Producto para Landing Page y Marketing

**Versión**: 1.0 · Julio 2026
**Audiencia**: equipo de marketing, agencia de landing page, ventas y contenido.
**Objetivo**: dar a cualquier persona no-técnica un mapa exhaustivo de cada módulo, cada función y cada botón del sistema, con el ángulo de dolor que resuelve y el copy sugerido, para construir la landing, los ads y los guiones de demo con la máxima densidad de valor.

---

## Índice

1. [Resumen ejecutivo del producto](#1-resumen-ejecutivo-del-producto)
2. [Modelo comercial · Los 4 planes](#2-modelo-comercial--los-4-planes)
3. [Cliente ideal (ICP) y buyer personas](#3-cliente-ideal-icp-y-buyer-personas)
4. [Capacidades transversales](#4-capacidades-transversales-lo-que-cruza-toda-la-app)
5. [Módulos operativos (día a día)](#5-módulos-operativos-el-día-a-día-en-piso)
6. [Módulos de catálogo](#6-módulos-de-catálogo)
7. [Módulos administrativos](#7-módulos-administrativos)
8. [Módulos de acceso y arranque](#8-módulos-de-acceso-y-arranque)
9. [Módulos de plataforma y confianza](#9-módulos-de-plataforma-y-confianza)
10. [Blueprint sugerido para la landing page](#10-blueprint-sugerido-para-la-landing-page)
11. [Ángulos de campaña por persona](#11-ángulos-de-campaña-por-persona)
12. [Preguntas frecuentes listas para copy](#12-preguntas-frecuentes-listas-para-copy)
13. [Inventario de assets visuales sugeridos](#13-inventario-de-assets-visuales-sugeridos)

---

## 1. Resumen ejecutivo del producto

**ServiRest** es un Punto de Venta editorial en la nube para restaurantes, cafés, bares, foodtrucks y cadenas boutique en México. Un solo sistema cubre la mesa, la cocina, la barra, la caja, la anfitrionía, el delivery, el inventario, el personal y el CFDI.

**Promesa central (headline listo para landing)**
> "El único POS que te alcanza para vender más… y también para no quedarte con el inventario colgado un viernes por la noche."

**Sub-promesa (deck)**
> Diseño editorial premium, hardware plug-and-play, facturación CFDI 4.0 integrada, precio en pesos mexicanos y soporte por WhatsApp. Sin contratos anuales, sin cables ni servidores.

**Diferenciadores clave**
- **Diseño Sobremesa Lúcida**: primer POS con estética de revista de gastronomía (tipografía Fraunces italic, paleta Midnight/Terracota/Mostaza/Hueso). No parece POS legacy; ayuda a que el mesero se sienta parte del salón.
- **Modo tablet POS / tablet host / móvil mesero**: la misma cuenta se comporta distinto según el dispositivo que usa cada persona en piso.
- **Cocina y Barra separadas** con cronómetros semánticos (verde/mostaza/rojo pulsante) legibles a 2 metros y beep configurable.
- **Cashflow por canal** con días reales de payout (Uber Eats semanal, DiDi los martes, Rappi según acuerdo). El dueño ve cuándo cae el dinero, no solo cuánto se vendió.
- **Facturación CFDI 4.0** integrada al cobro con Facturama (200 timbres/mes en Profesional, 1 000 en Prestige).
- **Financiamiento del equipo POS** hasta a 8 meses ($625/mes) para bajar la barrera de entrada.
- **Gracia de 5 días** después del vencimiento y "Ya pagué, verifica de nuevo" — sin cortes hostiles.
- **Multi-terminal real** con LockScreen editorial: la terminal queda abierta al negocio y cada operador entra con PIN. Turnos rotativos sin cerrar sesión.

**Stack técnico visible al cliente (usar como *trust signals*)**
- React + PWA instalable (funciona sin internet en piso, sincroniza cuando vuelve).
- Supabase (PostgreSQL + Auth + RLS) — datos aislados por negocio con Row-Level Security.
- Stripe Subscriptions + Checkout — pago en línea, tarjeta o transferencia.
- Web Bluetooth + WebUSB — impresora térmica y terminal sin drivers ni cables extra.
- ESC/POS estándar — compatible con las 6 marcas de impresora más comunes en México.

---

## 2. Modelo comercial · Los 4 planes

Cada tier está diseñado para un tamaño de operación específico y cada límite es un *driver de upsell* natural cuando el cliente crece.

| Concepto | **Esencial** | **Profesional** ⭐ | **Prestige** | **Enterprise** |
|---|---|---|---|---|
| **Precio** | $549 MXN / mes | $899 MXN / mes | $2,499 MXN / mes | A medida |
| **Precio anual** | $5,490 (2 meses gratis) | $8,990 (2 meses gratis) | $24,990 (2 meses gratis) | Contrato anual |
| **Perfil ideal** | Fondas, cafés, taquerías, foodtrucks | Restaurantes pyme con cocina y meseros | Boutique, hoteles, corredor premium | Cadenas y franquicias |
| **Mesas** | 8 | 50 | 999 | Ilimitado |
| **Empleados** | 5 | 20 | 50 | 999+ |
| **Platillos** | 200 | 1 000 | 999 999 | Ilimitado |
| **Sucursales** | 1 | 1 | 5 | 999+ |
| **Terminales en paralelo** | 1 | 5 | 12 | Ilimitado |
| **CFDI 4.0 timbres/mes** | ❌ 0 | 200 | 1 000 | Ilimitado |
| **Costo por timbre extra** | — | $2.50 | $1.50 | $0 |
| **KDS (Cocina en pantalla)** | ❌ | ✅ | ✅ | ✅ |
| **Barra separada** | ❌ | ✅ | ✅ | ✅ |
| **Hostess + Waitlist** | ❌ | ✅ | ✅ | ✅ |
| **Orden remota (Rappi/Uber/DiDi)** | ❌ | ✅ | ✅ | ✅ |
| **Inventario avanzado (food cost + proveedores)** | ❌ | ✅ | ✅ | ✅ |
| **Reservaciones con WhatsApp + email** | ❌ | ❌ | ✅ | ✅ |
| **Carta digital pública + URL + QR** | ❌ | ❌ | ✅ | ✅ |
| **Wine list con maridajes** | ❌ | ❌ | ✅ | ✅ |
| **Branding co-cliente** | ❌ | ❌ | ✅ | ✅ |
| **White label total** | ❌ | ❌ | ❌ | ✅ |
| **API privada + integración ERP** | ❌ | ❌ | ❌ | ✅ |
| **SLA** | 99.0% | 99.3% | 99.5% | 99.9% + soporte 24/7 |
| **Soporte** | Email + WhatsApp (lun-sáb) | WhatsApp prioritario | Cuenta dedicada + onboarding asistido | Ejecutivo dedicado |

**Extensiones comerciales**
- **Demo gratuito 20 días** (activable desde SuperAdmin sin tarjeta).
- **Gracia 5 días** post-vencimiento antes del bloqueo definitivo.
- **Kit de equipo POS** desde $5,000 al contado o desde $625/mes hasta 8 meses (impresora térmica + cajón + terminal opcional).
- **Descuentos por corredor** administrables por SuperAdmin (−10%, −20%, −50%) para estrategia comercial regional.

---

## 3. Cliente ideal (ICP) y buyer personas

### 3.1 Persona A — "María, dueña de fonda o café"
- **Perfil**: 35-55 años, 1 local, 3-8 mesas, ella cobra y arma el menú, tiene 1-3 personas de apoyo.
- **Dolor**: cierra caja a mano cada noche, no sabe exactamente cuánto gastó en insumos, pierde tickets, la contadora le pide facturas manuales.
- **Plan sugerido**: Esencial $549/mes.
- **Enganche**: "El POS que sí te alcanza. En pesos y sin contratos."

### 3.2 Persona B — "Carlos, dueño de restaurante pyme con cocina"
- **Perfil**: 30-50 años, 1 local con 20-50 mesas, cocina con chef, meseros, cajero, Rappi/Uber Eats prendidos.
- **Dolor**: cocina desordenada, comandas gritadas, Rappi/Uber que no cuadran contra sistema, food cost invisible, empleados que no reportan mermas.
- **Plan sugerido**: Profesional $899/mes.
- **Enganche**: "Pon orden a la cocina y ve por fin cuánto te queda después de Rappi."

### 3.3 Persona C — "Ana, hotel boutique / chef restaurantero"
- **Perfil**: hotel con restaurante, restaurante de autor, corredor premium (Polanco, Guadalupe, Playa, Roma Norte).
- **Dolor**: reservaciones en libreta, carta digital feita en PDF de Wix, necesita branding co-cliente y look premium, quiere reportes hospitality.
- **Plan sugerido**: Prestige $2,499/mes.
- **Enganche**: "El único POS que se ve tan bien como tu carta."

### 3.4 Persona D — "Grupo Restaurantero / Franquicia"
- **Perfil**: 6-50 sucursales, área de sistemas, contadora corporativa, ERP conectado.
- **Dolor**: cadenas necesitan consolidador, roles personalizados, API para integrar SAP/Microsip/Contpaqi, white label si es franquicia.
- **Plan sugerido**: Enterprise a medida.
- **Enganche**: "Tu marca, tus reglas, nuestra infraestructura."

---

## 4. Capacidades transversales (lo que cruza toda la app)

Estas son características que aparecen en varios módulos y merecen sección propia en la landing porque son *ganadores de deal* frente a competidores tradicionales.

### 4.1 Modo del dispositivo (Configurable en Ajustes → Apariencia)
El mismo sistema se adapta al lugar físico donde vive cada terminal:
- **Estándar**: escritorio del dueño, todos los módulos visibles.
- **Tablet POS**: iPad fijo en piso de mesero, arranca en POS con sidebar bloqueado.
- **Tablet host**: iPad en anfitrionía, arranca en Hostess con plano de mesas.
- **Móvil mesero (PWA)**: smartphone del mesero, se instala como app.

**Ángulo landing**: *"Una cuenta. Cuatro dispositivos. Cero confusión."*

### 4.2 Hardware plug-and-play (Web Bluetooth + WebUSB)
Sin drivers, sin dongles, sin ADO:
- **Impresora térmica**: compatible con 6+ marcas de impresora BT y USB comunes en México (Epson, Xprinter, Bixolon, y variantes chinas 58mm/80mm). Auto-reconexión, chunking optimizado para impresoras baratas, heartbeat cada 2 segundos.
- **Cajón de dinero**: pulso RJ-11 estándar (`ESC p 0 50 255` + fallback DLE DC4).
- **Terminal Bluetooth de cobro**: proceso EMV animado de 6 pasos (canal seguro → sincronizar monto → lectura contactless → banco emisor → autorización → aprobado).

**Ángulo landing**: *"Enchufas la impresora. Ya está. No hay más."*

### 4.3 Modo offline y sincronización (PWA)
- Se instala como app en el escritorio/tablet/celular.
- Sigue vendiendo aunque se caiga el internet.
- Sincroniza cuando vuelve la conexión (badge visible en sidebar: verde/pendiente/error).
- Storage Inspector con PIN 666 para comparar datos locales vs nube (soporte técnico).

**Ángulo landing**: *"El internet se cayó. Tú sigues cobrando."*

### 4.4 CFDI 4.0 integrado (Facturama)
- Timbrado desde la misma orden de cobro (Profesional+).
- Envío automático de PDF + XML por email al comensal.
- 200 timbres/mes en Profesional ($2.50 el sobreuso), 1 000 en Prestige ($1.50), ilimitado en Enterprise.
- Alerta al 70% y 90% de consumo.

**Ángulo landing**: *"Factura el mismo momento del cobro. Sin abrir otro sistema."*

### 4.5 RBAC + Permisos por persona
- 8 roles predefinidos (Admin, Manager, Cashier, Waiter, Kitchen, Chef, Bar, Hostess) con matriz de acceso lista.
- **Override por persona**: el dueño puede activar/desactivar módulos específicos por colaborador (ej. "el cajero SÍ ve Facturación pero NO ve Personal").
- Cada persona aterriza en su pantalla natural tras ingresar PIN (mesero → POS, cajero → Caja, chef → Cocina).

**Ángulo landing**: *"Nadie ve más de lo que le toca ver."*

### 4.6 Multi-terminal + LockScreen editorial
- La terminal queda siempre abierta al negocio.
- Cambio de operador con PIN de 4 dígitos en 3 segundos.
- Auditoría por operador (quién cobró, quién cerró caja).
- **Diseño editorial premium**: layout de dos columnas con roster de empleados (avatars grises que se iluminan al elegir) + keypad tipográfico.

**Ángulo landing**: *"Turnos rotativos sin cerrar sesión. Cambio de operador en 3 segundos."*

### 4.7 Diseño Sobremesa Lúcida
- Paleta Midnight `#1A1E2E`, Terracota `#C4633F`, Mostaza `#C9A24A`, Hueso `#FAF8F4`, Carbon `#2A2826`.
- Tipografía Fraunces (serif italic para títulos), Inter (UI), JetBrains Mono (números, códigos).
- Animaciones stagger de Framer Motion.
- Modo claro y modo cocina (verde oscuro), modo alto contraste (alerta rubí).

**Ángulo landing**: *"El primer POS con estética de revista de gastronomía."*

---

## 5. Módulos operativos (el día a día en piso)

### 5.1 Dashboard — Orquestación financiera

**Qué es en una oración**
El panel de cierre del día en tiempo real; el dueño ve ventas, gastos, margen y top de platillos sin abrir Excel.

**Secciones**
- **Hero KPI**: ventas netas del rango en número gigante (88px) con delta % vs promedio previo y sparkline diaria.
- **6 InlineKPIs**: ticket promedio, margen del periodo (con veredicto "Sano/Aceptable/Revisa food cost"), platillos vendidos, gastos, cancelaciones, flujo neto.
- **Tesorería · Movimiento del periodo**: gráfica de área ingresos vs gastos con paleta editorial + mix de gastos por categoría (barras horizontales top 5).
- **Producto · Qué se está vendiendo**: top 8 más vendidos con rank editorial + barras + revenue + qty, y bottom 4 con leyenda "cubren menos del 5%, considera pausarlos".
- **Capital amarrado · Tu dinero en inventario**: distribución del valor de inventario por categoría.

**Botones y acciones**
- Rango temporal: Día / Semana / Mes / Año.
- Filtro por categoría.
- Selector de día específico, mes específico o rango de fechas.
- Botón "Exportar reporte" (abre `FinancialReportModal`).

**Dolor que resuelve**
- "¿Cuánto gané hoy?" contestado en 2 segundos sin sumar tickets a mano.
- Detecta *platillos zombies* (bajo desempeño) que ocupan espacio en el menú y foto sin vender.
- Da veredicto sobre food cost sin que el dueño calcule fórmulas.

**Copy sugerido para landing**
> **"Tu cierre del día en la palma de la mano."**
> Ventas, gastos, margen y platillos ganadores. Todo en un solo panel que puedes imprimir y mandar a tu contadora en un tap.

**Ángulos de campaña**
- Video corto: dueña abriendo Dashboard mientras cierra la fonda, viendo "Sano" en verde, sonriendo.
- Ad estático: número gigante "$12,847 hoy" con delta "+18% vs promedio".

---

### 5.2 POS · Línea de órdenes

**Qué es en una oración**
La pantalla principal del mesero para armar una cuenta y mandarla a cocina/bar sin cambiar de vista.

**Secciones**
- Header editorial con nombre del mesero activo.
- **Status rail** con chip de impresora (verde/rojo pulsante) y chip de conexión (En línea / Sin conexión).
- **Franja "Pedidos en cocina"** con hasta 4 tarjetas mostrando mesa + cliente + ProgressRing % listo + cantidad de ítems.
- **Catálogo del menú** con búsqueda, tabs de categorías con conteo y grid de DishCards (foto, precio terracota, nombre serif italic sobre gradiente, botón "+" flotante en hover).
- **Order Rail lateral** (368px, oculto detrás de FAB en móvil): picker de mesa full-width, lista de ítems con cantidad badge, nota inline por platillo ("sin cebolla"), controles ± / trash.
- **Footer del rail**: source pills (En mesa / Para llevar / Rappi / Uber Eats), subtotal, IVA 16%, total gigante, botón "Enviar a cocina".

**Botones y acciones (16 en total)**
- Buscar platillo.
- Cambiar categoría.
- Abrir filtros.
- Tap platillo → agrega al carrito.
- Abrir/cerrar carrito móvil (FAB con contador badge).
- Vaciar carrito (trash rojo).
- Elegir/cambiar mesa (modal de mesas).
- ± cantidad por línea.
- Eliminar línea.
- Escribir nota inline "para cocina".
- Elegir fuente de la orden (DINE_IN, TO_GO, RAPPI, UBER_EATS).
- Enviar a cocina (crea orden, dispara impresión, muestra checkmark 2s).

**Modales**
- Modal de éxito "Orden enviada" con checkmark grande (auto-cierra).
- Modal de **variantes** (checkbox visual con precio delta transparente "+$25" o "Incluido").
- Modal de mesas (grid con TableIcon, capacidad, shadow-glow al seleccionar).

**Automatizaciones**
- Impresión automática a cocina si `isKitchenPrintingEnabled`.
- Fallback a `window.print()` con `<KitchenTicket>` embebido si no hay impresora térmica.
- Auto-poll de estado de impresora cada 2 segundos.

**Dolor que resuelve**
- Mesero tarda 3 minutos por cuenta cambiando entre pantallas → una sola vista.
- "Se me olvidó decirle a cocina que sin cebolla" → nota inline por platillo, ancla la información al ticket físico.
- Cliente pide combinación custom → variantes con precio delta transparente.

**Copy sugerido para landing**
> **"Del pedido al fuego en un tap."**
> Tu mesero arma la cuenta, marca la mesa y dispara la comanda a cocina desde una sola pantalla. Con notas por platillo. Con variantes con precio. Sin cambiar de app.

---

### 5.3 MyTables · Mesas activas del mesero

**Qué es en una oración**
La vista de "solo mis mesas en curso" durante el turno, con cobro, modificación y estado en un vistazo.

**Secciones**
- Header "Tu turno · Mesas activas" con nombre del mesero.
- Mini-rail de stats: Activos, Por cobrar, Acumulado ($).
- Tabs de filtro por estado: Todos / En preparación / Listos / Por cobrar (con conteos).
- Grid 2-3 columnas de OrderCards con **ribbon superior** semántico: "Por cobrar" (terracota), "Lista para servir" (verde), "Tarda N min — verifica" (mostaza).
- Cada tarjeta: nombre de mesa gigante, número de orden, ProgressRing % listo, lista compacta de ítems (qty× + monto), total con delimitador editorial, tres acciones: trash / editar / **"Cobrar cuenta"** primario.

**Botones y acciones**
- Cambiar filtro de estado.
- Cancelar pedido (con confirmación).
- Modificar pedido → abre modal con lista temporal + picker de platillos + resumen live.
- Cobrar cuenta (marca `BILL_REQUESTED`, envía señal a caja).
- Guardar cambios. Si es reducción, exige **PIN 0000 del manager** con keypad 4 dígitos.

**Dolor que resuelve**
- Mesero pierde mesas entre pantallas.
- Autorización de cambios abusivos (cliente pide quitar un platillo ya cocinado) queda auditada por PIN.
- El ribbon mostaza *"tarda N min"* dispara acción antes que la queja del comensal.

**Copy sugerido**
> **"Todas tus mesas. Un solo vistazo."**
> El ribbon te avisa cuál se está tardando antes de que el cliente lo pida. El PIN del manager audita quién quitó qué.

---

### 5.4 Kitchen · KDS (Kitchen Display System) — Profesional+

**Qué es en una oración**
La pantalla de cocina para chef y cocineros: tickets ordenados por antigüedad, escaneables desde 2 metros de distancia.

**Secciones**
- Header "Estación de cocina" con stats: Por preparar (terracota), Listos (verde), Hora actual.
- Tabs: Todos / Comedor / Delivery (con conteos).
- **Ticket row horizontal-scroll** con tarjetas de 340×560px.
- Cada Ticket: source ribbon (comedor midnight/mostaza vs delivery verde), mesa 34px serif italic, **timer visible con estado** ("A tiempo / Apura / Tarde"), lista de ítems con quantity badge 40×40 terracota, notas con borde de alerta danger, botón "Pedido listo" full-width abajo.
- **Overlay full-screen animado "Pedido nuevo"** con campana bouncing cuando llega orden nueva + beep de 880Hz.

**Botones y acciones**
- Cambiar vista Todos/Comedor/Delivery.
- Marcar "Pedido listo" por ticket → actualiza `isKitchenReady`. Si no hay bebidas o el bar ya terminó, pasa a `READY`.

**Semántica del cronómetro** (legible a 2 metros):
- `<15 min` → **verde** "A tiempo".
- `15-25 min` → **mostaza** "Apura".
- `≥25 min` → **rojo pulsante** "Tarde".

**Dolor que resuelve**
- Cocina desorganizada donde las comandas se pierden en el rebote.
- El cronómetro rojo vs mostaza vs verde da a cualquier cocinero visibilidad de qué apurar sin pensar.
- La alerta sonora evita que se olvide una orden colgada.

**Copy sugerido**
> **"La cocina en calma."**
> Comandas en pantalla, cronómetro semáforo, campana cuando llega la nueva. Sin gritos, sin comandas perdidas.

---

### 5.5 Bar · Barra de bebidas — Profesional+

**Qué es en una oración**
La pantalla exclusiva para el bartender: bebidas por servir en paralelo a cocina, no atadas a la línea de comida.

**Secciones**
- Header "Bebidas en preparación" con stats: En preparación (mostaza), Listas (verde), Mesas con bebida (terracota).
- **Ticket row horizontal**, mismo layout que Kitchen pero paleta mostaza.
- **Cronómetro más agresivo** (bebidas se sirven antes que la comida):
  - `<8 min` → ok.
  - `8-15 min` → mostaza.
  - `≥15 min` → danger.
- **Overlay "Bebidas nuevas"** con campana bouncing + beep 660Hz.

**Detección automática**: la orden se separa por keywords (bebida, bar, vino, trago, cerveza, drink, cocktail). Una sola comanda dispara dos tickets: cocina y bar, cada uno en su estación.

**Sincronización inteligente**: la mesa cierra la orden cuando ambas estaciones (cocina y bar) han marcado listo.

**Dolor que resuelve**
- Bares que necesitan que las bebidas salgan antes de la comida (cliente en espera).
- Elimina el "¿ya está el mojito?" gritado a la cocina.
- Bartender ve solo lo suyo, no se distrae con platos fuertes.

**Copy sugerido**
> **"La barra por su cuenta."**
> Una comanda, dos pantallas. Cocina cocina. Barra sirve. El sistema los sincroniza para que la mesa cierre al mismo tiempo.

---

### 5.6 Cashier · Caja y cobros

**Qué es en una oración**
La estación del cajero: cobrar mesas y delivery, registrar gastos de caja chica, ver historial del día y exportarlo.

**Secciones**
- **Banner animado top** "Cuenta solicitada por meseros — Mesas: X, Y" (terracota, click abre esa mesa; botón X para descartar).
- Panel izquierdo (w-80) con **4 tabs**: Mesas / Delivery / Gastos / Historial.
  - **Mesas**: lista con nombre, ID, monto, ribbon "POR COBRAR" en las que ya pidieron cuenta.
  - **Delivery**: órdenes de Rappi/Uber/DiDi/Drive-thru filtradas.
  - **Gastos**: formulario "Registrar gasto" (descripción, monto, categoría, fecha) + lista con delete.
  - **Historial**: date-picker + botones "Reimprimir ticket" y "Exportar CSV".
- **Panel central "Acciones"**: Quantum Split (1/2/3/4 formas de dividir la cuenta), Operator Gratuity (0/10/15/20% propina), Print + Open Drawer, manifiesto de ítems, footer Subtotal / Tax / Per Person.
- **Panel derecho "Aggregate Payload"**: total gigante 8xl, selectores Cash / Card, botón **"Execute →"** enorme.
- **Tab Historial**: 4 GlowCards KPI (Ventas brutas, Efectivo, Tarjeta, Total neto) + tabla completa del día con folio, hora, productos como chips, método, estado, monto.

**Botones y acciones (18+)**
- Cambiar tab.
- Seleccionar mesa/delivery → abre panel de cobro.
- Split 1/2/3/4.
- Propina 0/10/15/20%.
- **Print ticket** (real ESC/POS o fallback `window.print`).
- **Open cash drawer** (pulso RJ-11).
- Elegir método Cash / Card.
- Ejecutar cobro → modal Payment Authorize.
- En modal: input de efectivo recibido gigante, quick amounts ($50/$100/$200/$500 + "Exact Amount"), cálculo automático del cambio, Confirm.
- Add expense (5 campos).
- Delete expense.
- Descartar banner de solicitud.
- **Dispatch a Cash Cut** (imprime corte de caja completo).
- **Export CSV** con headers ID/Manifest/Método/Total/Estado/Hora.

**Modal Payment Authorize** (destacado en demo)
- Full-screen dark 92vh, panel izq con input de efectivo gigante 7xl + quick amounts.
- Panel der: KPIs To Pay / Change / método + botón Confirm.
- Si `isTerminalEnabled`, dispara la simulación Bluetooth Terminal de 6 pasos: Canal seguro → Sincronizar → Lectura EMV → Banco → Autorizar → **Aprobado**.

**Dolor que resuelve**
- Cajero que traduce mesas a Excel al final del día → historial vivo + CSV export.
- **Split de cuenta entre amigos** es el escenario más pedido en México pyme → 1/2/3/4 clicks.
- Gasto de caja chica ("compré hielo") queda auditado por categoría en vez de perdido en el bolsillo.

**Copy sugerido**
> **"Cobrar rápido. Contar bien. Cerrar tranquilo."**
> Split de cuenta, propina, cambio en pantalla, corte de caja imprimible. Y si es Bluetooth, la terminal cobra desde la misma app.

---

### 5.7 Hostess · Salón (plano y anfitrionía) — Profesional+

**Qué es en una oración**
La coordinación del piso: mapa visual de mesas con drag-and-drop, lista de espera, asignación de mesero y reservaciones.

**Secciones**
- Header "Coordinación del piso" con stats: Ocupadas, Libres, En espera.
- Toggle **Plano / Lista** con conteos.
- **Columna izquierda Waitlist** (draggable): cards con nombre, hora, party size, ícono de grip para arrastrar.
- **Área central Plano**: canvas con **snap-to-grid 5%**, mesas absolutas colocables por click, con nombre serif italic, sesión activa/reserva/capacidad, avatar del mesero asignado en la esquina superior. Todas las mesas se pueden **arrastrar para reposicionar**.
- **Ghost preview animado** al colocar/mover una mesa con coordenadas x,y en tipografía mono.
- **Modo Lista**: tabla de mesas con chip de estado + capacidad + cliente + mesero.
- **Panel lateral derecho** (420px):
  - **Walk-in console**: nombre + counter de personas + "Sumar a la espera".
  - Sub-panel según estado de la mesa seleccionada:
    - **Available**: "Sentar ahora" / "Apartar mesa".
    - **Reserved**: reservación con Cambiar hora / Soltar reserva / Sentar cliente.
    - **Occupied**: sesión activa + **Asigna mesero** (grid 3-col con avatars del staff) + Cancelar cuenta / Liberar por limpiar.
    - **Dirty**: botón "Mesa lista".

**Botones y acciones (15+)**
- Toggle Plano/Lista.
- Nueva mesa → entra en **placement mode** → click en canvas para dropear.
- **Drag mesa** para reposicionar (snap 5%).
- Editar mesa (nombre + capacidad).
- Eliminar mesa (confirmación).
- Walk-in: escribir nombre + ± pax + Sumar a la espera.
- **Drag entry de waitlist a mesa disponible** → check-in automático.
- Sentar ahora / Apartar mesa (crea reservación).
- Cambiar hora de reserva.
- Soltar reserva.
- Sentar al cliente (consume la reserva).
- **Asignar mesero** (grid con avatars).
- Cancelar cuenta (marca la orden como CANCELLED).
- Liberar mesa por limpiar.
- Mesa lista.

**Tier gate**: `isWithinLimit('maxTables', activeTables.length + 1)` bloquea al llegar al tope (Esencial 8, Profesional 50, Prestige 999) y abre `SrTierUpgradeModal`.

**Dolor que resuelve**
- El host que anota lista de espera en papel y la pierde.
- Restaurante sin plano digital pierde optimización de rotación.
- Asignación de mesero por foto: nadie olvida a quién le tocó qué.

**Copy sugerido**
> **"Tu salón, sobre la mesa."**
> Coloca cada mesa donde está en el piso. Arrastra al cliente de la lista de espera a su mesa. Asigna mesero con la foto. Todo en una pantalla.

---

### 5.8 RemoteOrder · Drive-thru, mostrador y para llevar — Profesional+

**Qué es en una oración**
Toma de orden rápida en canal directo (drive-thru, mostrador, para llevar); cobra al momento sin pasar por caja.

**Secciones**
- Header "Drive-thru y mostrador · Orden rápida" con stats: Órdenes del turno, Ticket promedio, Pendientes.
- **Tabs de modo**: Drive-thru / Mostrador / Para llevar.
- Search platillo.
- **Selector "Mesa asignada"** solo en modo Mostrador.
- Tabs de categorías.
- Grid de platillos 2/3/4-col con card hover CTA "+" flotante.
- **Panel derecho 420px "Cuenta"** con kicker (modo + mesa), chip conteo, "Vaciar".
- Items del carrito con controles ± / precio unitario / subtotal por línea.
- Footer: Subtotal / Total gigante, botones **Tarjeta / Transfer / Cobrar y enviar** (Cash) primario.

**Botones y acciones**
- Cambiar modo.
- Buscar / cambiar categoría.
- Add platillo (tap).
- ± / vaciar.
- Elegir mesa (Mostrador).
- Cobrar Cash / Card / Transfer.
- **Copiar CLABE al portapapeles** desde el modal Transfer.

**Modales**
- Terminal processing (spinner + step, no cerrable).
- **Modal Transfer**: total gigante + Banco + Beneficiario + CLABE con botón copy.
- Modal Mesas.
- Modal éxito "Cobro listo" con checkmark 104px + modo + monto.

**Dolor que resuelve**
- Cliente en drive-thru no puede esperar UI compleja.
- Foodtrucks y locales sin mesas: mostrador que cobra al toque.
- Cobro por transferencia con CLABE al portapapeles en un click (adiós al "¿me pasas la CLABE?" gritado).

**Copy sugerido**
> **"Drive-thru. Mostrador. Para llevar. Todo cobra igual de rápido."**

---

## 6. Módulos de catálogo

### 6.1 Menu · Catálogo de platillos

**Qué es en una oración**
El CRUD del menú digital: crear, editar, pausar y organizar platillos y sus variantes; importar CSV en bloque.

**Secciones**
- Header "Catálogo de platillos" con stats: Total / Activos / Inactivos.
- Controls bar: search, botones "Borrar todo" / "Importar CSV" / **"Nuevo platillo"**.
- Tabs por categoría con conteo.
- **Grid 1-4 col de MenuItem cards**: imagen 176px con overlay gradient, chip "Activo/Pausado" click-toggle top-right, nombre serif italic 18px, precio terracota mono, categoría + gramaje, descripción 2 líneas, chip "N variantes", botones Editar / trash.

**Botones y acciones**
- Buscar.
- Filtrar por categoría.
- Toggle activo/inactivo por tap del chip.
- Editar (modal con datos precargados).
- Eliminar (confirmación).
- Nuevo platillo.
- **Importar CSV** (modal con textarea + file upload).
- Borrar todo (confirmación destructiva).
- En modal add/edit: upload imagen (dashed drop-zone), toggle status, agregar categoría inline, **hasta 10 variantes** (nombre + precio delta).
- En modal CSV: subir archivo o pegar CSV → Importar (retorna count + errores).

**Tier gate**: `isWithinLimit('maxProducts', ...)` (Esencial 200, Profesional 1 000, Prestige/Enterprise ∞).

**Dolor que resuelve**
- Dueño quiere subir precio de un platillo el domingo en la noche → 3 clicks.
- Menú con 200 platillos que se necesita migrar desde Excel → CSV en un tiro.
- Platillo agotado → se **pausa** sin eliminarlo (no pierde histórico).
- Variantes (tamaño / extra queso) sin duplicar filas por platillo.

**Copy sugerido**
> **"Tu carta, siempre al día."**
> Sube fotos, cambia precios, pausa lo que se acabó. Y si tienes 200 platillos en Excel, los importamos de un tiro con CSV.

---

### 6.2 Inventory · Inventario

**Qué es en una oración**
Control de stock, mermas y pedidos a proveedor con dos capas: básica (Esencial) y avanzada con food cost (Profesional+).

**Secciones**
- Header "Stock, mermas y proveedores" con stats: En stock / Bajo mínimo / **Valor total ($)**.
- **Banner de upsell** en Esencial: "Inventario profesional — sube a Profesional $899/mes".
- Actions bar: tabs Stock / Pedidos (solo Pro), botones Carrito (badge count) / Pedir a proveedor / Agregar producto.
- Tabs de categorías.
- **Lista de items**: nombre serif 20px, chip "En menú" si aplica, **ProgressRing de stock** actual/max, cantidad + unidad, chip semantic (En orden/Bajo stock/Bajo mínimo), Costo/unidad (Pro), Proveedor (Pro), botones Pedir / Editar / Eliminar.
- **Tab Pedidos** (Pro+): cards por SupplierOrder con folio, fecha, proveedor, chip estado (Pendiente/Pedido/Recibido/Cancelado), lista de ítems, total, botones "Marcar pedido" / "Recibir".

**Botones y acciones**
- Tabs Stock / Pedidos.
- Filtro categoría.
- Agregar producto (modal con 8 campos: nombre, categoría, proveedor, unidad, cantidad, costo/unidad, mínimo crítico, capacidad ideal).
- Editar / Eliminar.
- **Pedir reposición por item** → modal con counter ± y sugerencia "hasta max".
- Agregar al carrito.
- Abrir carrito drawer.
- **Crear pedido a proveedor** (agrupa por supplier).
- Marcar como pedido / **Recibir** (auto-incrementa `quantity` + `lastRestock`).

**Diferenciación entre planes** (usar en tabla comparativa):

| Función | Esencial | Profesional+ |
|---|---|---|
| Alta de productos | ✅ | ✅ |
| Alerta de mínimo crítico | ✅ | ✅ |
| Costo por unidad y valor total amarrado | ❌ | ✅ |
| Proveedor por producto | ❌ | ✅ |
| Órdenes de compra agrupadas por proveedor | ❌ | ✅ |
| Recepción con incremento automático de stock | ❌ | ✅ |
| Food cost feeding al dashboard | ❌ | ✅ |

**Dolor que resuelve**
- Restaurantero no sabe cuánto vale el inventario que tiene amarrado.
- Alerta "bajo mínimo" evita quedarse sin cebolla un viernes por la noche.
- Pedidos a proveedor agrupados por supplier → un WhatsApp/llamada por proveedor, no 15.
- Food cost real por platillo alimenta el veredicto del Dashboard.

**Copy sugerido**
> **"Tu inventario, sin sorpresas."**
> Alerta cuando estás por quedarte sin insumos. Órdenes agrupadas por proveedor. Y si eres Profesional, sabes cuánto dinero tienes amarrado en almacén.

---

## 7. Módulos administrativos

### 7.1 Staff · Personal y horarios

**Qué es en una oración**
Gestión del equipo humano: alta, perfil, rating, horario semanal, calendario y export PDF.

**Secciones**
- Header "Equipo y horarios" con stats: Activos (en turno con dot verde animado), Total, Calificación promedio.
- Toggle **Equipo / Horarios**.
- Botones "Exportar PDF" + "Agregar persona" (solo admin).
- Tabs por área: Todos / Meseros / Cocina / Bar / Gerencia con conteos.
- **Modo Grid**: cards con avatar redondo bordeado verde si en turno, nombre serif 18px, chip rol semantic, chip "En turno / Descansa", **ProgressRing de horas/40**, hoursWorked, **rating con estrella mostaza**, botones Perfil + Horario.
- **Modo Schedule**: tabla con columnas Lun-Dom y celdas por turno (start-end).

**Botones y acciones**
- Cambiar modo Equipo/Horarios.
- Filtrar por área.
- **Exportar PDF** (landscape A4, scale 2, filename `Personal_ServiRest_YYYY-MM-DD.pdf`).
- Agregar persona (nombre + puesto + área) con **PIN inicial 1111**.
- Ver Perfil.
- Editar Perfil.
- Eliminar turno.
- Agregar nuevo turno (día + entrada + salida).

**Tier gate**: `isWithinLimit('maxEmployees', ...)` (Esencial 5, Profesional 20, Prestige 50, Enterprise 999).

**Dolor que resuelve**
- Restaurantero anota horario en cartulina → tabla digital exportable a PDF.
- Rating por persona → decisión rápida de quién promover / cortar.
- PIN inicial estándar 1111 (personal lo cambia después).

**Copy sugerido**
> **"Tu equipo, con nombre, foto y horario."**
> Alta con PIN, horario semanal, calificación por persona y export a PDF listo para imprimir en la oficina.

---

### 7.2 Invoice · Facturación CFDI 4.0 — Profesional+

**Qué es en una oración**
Timbrado CFDI 4.0 vía Facturama para clientes que piden factura post-cobro; integrado al mismo sistema.

**Dos estados de pantalla**

**A. Estado GATED (Esencial ve esto)**
- Editorial header "Factura como un grande".
- Lock card 20×20.
- **Comparison cards**:
  - Profesional $899 → 200 timbres, sobreuso $2.50, PDF+XML por email.
  - Prestige $2,499 → 1 000 timbres, sobreuso $1.50, cuenta dedicada.
- CTA "Subir mi plan".
- SrAlert info explicando "¿Por qué Esencial no incluye CFDI?".

**B. Estado ALLOWED (Profesional+ ve esto)**
- Header "Tus facturas".
- **KPI cards**: Timbres usados (con barra semantic 70%/90%) + Costo extra por timbre.
- Warning alert si `stampsPct ≥ 90%`.
- Tabs "Por facturar" (count) / "Historial".
- Search por folio o mesa.
- **Lista pending**: cards con folio, mesa + n platillos, timestamp, total, botón **"Facturar"**.

**Modal de timbrado**
- 5 campos: RFC (uppercase, maxLen 13), Razón social, Código postal, Uso CFDI (select G03/G01/P01), Email receptor.
- Botón "Timbrar CFDI".

**Modal éxito**
- **UUID fiscal** + Descargar PDF + Descargar XML.

**Automatizaciones**
- Envío automático de PDF+XML por email post-timbrado.
- Consumo de timbres tracked por mes.
- Costo por timbre transparente según tier (Prestige $1.50, Profesional $2.50, Enterprise $0).

**Dolor que resuelve**
- Cliente empresa pide factura al pagar → el dueño abre otro sistema para timbrar.
- CFDI 4.0 integrado al cobro elimina el "mándamela después por WhatsApp".
- Costo por timbre transparente evita sorpresa en factura mensual del PAC.

**Copy sugerido**
> **"Factura mientras cobras."**
> RFC, uso de CFDI, correo. Timbrado en segundos. PDF y XML al correo del cliente automáticamente. Sin salir de ServiRest.

---

### 7.3 Billing · Plan y facturación de tu suscripción

**Qué es en una oración**
Elegir/subir/renovar plan ServiRest y gestionar el pago del equipo POS por Stripe.

**Secciones**
- Header "Plan & facturación · Tu plan de ServiRest".
- Botón "Equipo POS" (o "Equipo pagado" si isFullyPaid).
- **Current status card**: ícono según tier (Crown/Zap/Building2), plan actual con SrTierBadge, chip de estado (Activa/Próxima a vencer/Vencida/Demo/etc.), **días restantes 44px** + ID SRV-XXX.
- Alerts warning/danger según status.
- **Billing cycle toggle** (Mensual / **Anual con "−2 meses"**).
- **3-up TierCards** en grid: Esencial $549 / Profesional $899 (con chip "Recomendado para tu zona" si viene de Esencial) / Prestige $2,499, con bullets, límites resumidos y CTA contextual.
- **Enterprise rail**: descripción + "Solicitar propuesta".
- **Payment history**: tabla con Transacción / Fecha / Método / Monto / Estado.

**Botones y acciones**
- Toggle Mensual/Anual.
- Escoger plan → dispara Stripe Checkout con el `price_id` correcto (cargado dinámicamente desde `app_config` — el equipo comercial puede cambiar precios sin deploy).
- "Hablar con ventas" para Enterprise.
- Abrir modal equipo (si sin plan) o modal progreso (si ya tiene).
- **En modal equipo**: 4 opciones de financiamiento:
  - Contado $5,000
  - 3 Meses $1,666.66/mes
  - 6 Meses $833.33/mes
  - 8 Meses $625/mes
- Verificar pago (`refreshFeatures`).

**Automatizaciones**
- Stripe Checkout con `price_id` dinámico.
- Grace de 5 días post-vencimiento antes de bloqueo.
- Downgrade requiere contactar soporte (botón ghost "Cambiar a plan menor — escríbenos").

**Dolor que resuelve**
- Restaurantero puede subir/bajar de plan sin llamar a soporte.
- **Financiamiento del equipo hasta 8 meses** ($625/mes) baja barrera de entrada.
- Transparencia de "días restantes" evita corte sorpresa.

**Copy sugerido**
> **"Paga tu POS como pagarías tu renta."**
> Desde $549/mes. Equipo desde $625/mes hasta 8 meses. Sin contratos anuales. Puedes subir de plan cuando crezcas.

---

### 7.4 Settings · Ajustes del negocio

**Qué es en una oración**
Configuración del negocio: identidad fiscal, apariencia, modo terminal, hardware, permisos por usuario, avisos y diagnóstico.

**Secciones (6 tabs)**

**Tab General**
- **PlanLimitsCard**: tier badge + descripción + grid 6 filas con caps del plan (Mesas, Empleados, Platillos, Sucursales, Terminales, Timbres CFDI/mes) + CTA "Ver planes".
- Card "Datos del negocio": Nombre comercial, Razón social, RFC, Dirección.
- Card "Cuenta de depósito": CLABE (tracking 0.2em), Beneficiario.

**Tab Apariencia**
- Card Logo (thumbnail + URL input + tip).
- Card **Tema** con 3 opciones: Sobremesa lúcida (default), Verde cocina (dark), Alerta rubí (alto contraste).
- Card **"Modo del dispositivo"** con 4 opciones (Estándar / Tablet POS / Tablet host / Móvil mesero) con warning al elegir modo bloqueado.

**Tab Hardware**
- Card **impresora**: chip estado + nombre actual + botones "Conectar USB" / "Conectar Bluetooth (BLE)".
- Card **terminal de pago**: chip estado + nombre + Vincular terminal.
- Card **Diagnóstico**: botones "Imprimir prueba" / "Probar cajón" (disabled si sin impresora).
- Card **Tickets**: ancho papel 58mm/80mm + Toggle "Imprimir tickets de cocina automáticamente" + Toggle "Abrir cajón al cobrar".

**Tab Personal**
- Grid 2-col de cards por colaborador (avatar 56, nombre, rol, PIN visible, hover para Editar / Delete).
- Botón "Nuevo colaborador".
- **Modal Add/Edit User**: nombre + rol select (mesero/cajero/cocina/chef/bar/hostess/gerente/admin) + PIN 6 dígitos + **checkboxes de permisos por módulo (12 módulos)** — override por-persona.

**Tab Avisos**
- 3 toggles: Avisar orden >25 min / Imprimir comanda cocina / Avisar apertura cajón.
- Alert info "¿Aún no llegan los avisos?" (con instrucciones de permisos del navegador).

**Tab Diagnóstico**
- Grid 4 tests con botón "Ejecutar prueba": Impresora / Cajón / Conexión latencia / **Datos con PIN 666**.
- **Storage Inspector (PIN 666)**: comparación local vs cloud de 5 tablas (products/orders/employees/inventory/expenses) con chips Sincronizado/Pendiente/Error. Herramienta de soporte visible al operador.

**Floating save bar** sticky abajo con chip de status (verde éxito / rojo error / verde "Cambios guardados") + botón Guardar.

**Dolor que resuelve**
- "Modo tablet POS": el dueño configura una vez y las tablets en piso abren directo, sin menú → barrera de error operador.
- Diagnóstico integrado en producto → menos calls a soporte.
- Storage Inspector para soporte técnico (comparación local vs cloud).
- Permisos por módulo por persona (control sobre qué ve el cajero vs qué ve el chef).

**Copy sugerido**
> **"Toda tu operación, un lugar donde configurarla."**
> Datos fiscales, logo, tema, hardware, permisos por persona y diagnóstico. Sin abrir 6 pantallas.

---

## 8. Módulos de acceso y arranque

### 8.1 Onboarding · Wizard de 7 pasos

**Qué es en una oración**
Guiar al dueño en 15 minutos desde el registro hasta el POS listo para vender: Plan → Info → Menú → Mesas → Personal → Hardware → Complete.

**Sticky UI**
- Header con logo ChefHat + kicker "Bienvenido a ServiRest", **step dots (7 pasos)**, ProgressRing, botón "Configurar después".
- Grid principal 280px sidebar (checklist) + step body.
- Footer con "Atrás" + "Continuar" / "Abrir mi POS".

**Paso PLAN**
- 2 tarjetas de plan con radios visuales.
- Sub-card Hardware: 3 opciones radio (Renta / Compra / Ya tengo mi equipo).
- Alert "Activamos tu cuenta al cerrar" + Stripe.

**Paso INFO**
- Logo uploader (dashed 96×96).
- Campos: Nombre comercial, Razón social, RFC, Teléfono, Dirección completa, Mensaje al pie del ticket.

**Paso MENU**
- Card "Importar CSV" (upsell).
- Card lista de platillos con "Agregar platillo" o EmptyState "Tu carta empieza aquí". Cada línea inline: ícono + input nombre + $ + eliminar.

**Paso TABLES**
- Card visual con **counter grande ±** → suma/resta mesas.
- Previsualización grid 3-6 col con id / nombre / "4 sillas".

**Paso STAFF**
- Owner card destacada terracota (PIN 0000, tú).
- Cards colaboradores editables inline (nombre + rol + PIN + eliminar).

**Paso HARDWARE**
- Card con estado scanning / idle: botones **Bluetooth** y **USB**.
- Card "Encontrados" con lista de impresoras/scanners/drawer + chip En línea/Listo/Vinculado.
- Card Diagnóstico: "Imprimir prueba" y "Probar cajón" (**funcionan de verdad**).

**Paso COMPLETE**
- Card centrada con checkmark 96px + "¡Listo, {nombre}!" en serif italic 56px.
- Stats mini-cards: Plan, Mesas, Equipo, Hardware "Vinculado".

**Dolor que resuelve**
- "Instalarme el POS me toma 2 semanas" → 15 minutos con wizard guiado.
- No usuario técnico: cada paso tiene copy amigable ("toca aquí", "si no lo tienes ahora, luego").
- **Hardware real detectado en el mismo flow** (no una lista genérica en PDF).

**Copy sugerido**
> **"En 15 minutos ya vendiste tu primer platillo."**
> Sin instalador. Sin visita técnica. Sin drivers. Enchúfate y vende.

---

### 8.2 AuthScreen · Login / Signup

**Qué es en una oración**
El portal de acceso (email/password) con toggle entre iniciar sesión y registrar negocio nuevo.

**Elementos**
- Background midnight con blobs terracota + mostaza (blurred).
- Logo ServiRest 96px.
- Card GlowCard cream centrada.
- Toggle "Iniciar Sesión / Registrar Negocio".
- Campos: email, password (y en signup: businessName + fullName).
- Botón terracota gigante "Entrar" / "Crear mi restaurante".
- Footer editorial "ServiRest — Aliados del rubro".

**Copy sugerido**
> **"Crea tu restaurante en 60 segundos."** (para signup)

---

### 8.3 LockScreen · Cambio de operador

**Qué es en una oración**
"¿Quién abre turno?" — cambio de operador por PIN dentro de la misma terminal sin cerrar sesión del negocio.

**Layout premium**
- Dos columnas: izquierda midnight con **roster de empleados** (grid 2-4 col con avatars 88-104px, borde terracota al seleccionar + candado inferior), derecha crema con **keypad tipográfico**.
- Header "Sobremesa lúcida · Terminal abierto" + "¿Quién abre turno?" serif italic 44-64px.
- Cada empleado: avatar (grayscale si no seleccionado), nombre primer nombre serif italic, rol uppercase tracking wide.
- Footer izq: "Terminal: {business name}" + "Cerrar sesión del local".
- Panel derecho keypad: kicker "Ingresa tu PIN", saludo dinámico "Hola, {firstname}", **4 dots animados** que crecen al llenarse.
- Keypad 3x3 con teclas serif italic 28-32px.

**Dolor que resuelve**
- Turnos rotativos: la terminal queda siempre abierta al negocio.
- Auditoría clara de quién cobró qué (each cash cut queda con nombre real del operador).
- Diseño editorial que no parece POS legacy sombrío.

**Copy sugerido**
> **"Cambio de turno en 3 segundos."**
> Turnos rotativos sin cerrar sesión. Cada corte de caja con nombre y firma digital del operador.

---

## 9. Módulos de plataforma y confianza

### 9.1 SuperAdmin · Centro de control (interno ServiRest)

**Nota**: este módulo NO se muestra al cliente final. Es la cabina de control del equipo comercial de ServiRest. **No aparece en la landing pública**, pero se puede usar como *behind-the-scenes* en material de inversores para mostrar cómo se escala.

**Capacidades destacables**
- Cambiar precio global de membresía.
- 5 KPI cards (Cuentas activas / En demo / Inactivas / MRR proyectado / Cobrado en mes).
- Gestión por cliente: cambiar plan, aplicar descuentos (−10/−20/−50%), registrar pago manual, habilitar/deshabilitar 16 features individuales, bloquear o eliminar cuenta.
- **Feature flag por cliente**: roll out gradual de wine_list (por ejemplo) a clientes boutique antes de todos.

**Ángulo para deck de inversores**: control operativo unitario por cliente para poder hacer ventas de nicho sin re-deploy.

---

### 9.2 Sidebar · Navegación lateral inteligente

**Qué hace único al sidebar**
- **96px collapsed / 256px expanded** (hover).
- Widgets top: **PrinterStatus** (verde/rojo pulsante, click para reconectar) + **SyncBadge** (Cloud verde / CloudCog terracota / RefreshCw spinning).
- **Navegación agrupada** en 3 grupos: Operación diaria / Profesional+ / Administración.
- **Cada nav item pasa por 3 gates combinados**:
  1. `canAccess(activeEmployee, path)` — RBAC.
  2. `meetsTier(minTier)` — plan comercial.
  3. `isFeatureEnabled(feature)` — flag por super_admin.
- **Status card "Estado del Nodo"** (link a /billing) con "XXD" en 24px + estado semantic.
- Footer: cuenta del operador activo con avatar, botón candado para lock rápido, botón Salir sólo para admins.

**Ángulo landing**: *"El menú aprende a tu plan y a tu rol. Nadie ve un botón que no debería tocar."*

---

### 9.3 SubscriptionGuard · Guardián de suscripción

**Qué hace**
- Interceptor global.
- Si `ACTIVE / DEMO`: renderiza la app + GraceBanner sticky si `isInGracePeriod`.
- Si `EXPIRED / DEMO_EXPIRED / DEBT_BLOCKED`: overlay full-screen midnight con card cream centrada (Lock/ShieldCheck/CreditCard según estado) + botones "Renovar suscripción" (Stripe) + "Ya pagué, verifica de nuevo".

**Gracia comercial**
- **5 días de gracia** post-vencimiento (evita cortes hostiles).
- Alerta warning **5 días ANTES** de vencer.
- Botón "Ya pagué, verifica de nuevo" corta calls a soporte por retrasos de sync Stripe → Supabase.
- Deuda de equipo separada de suscripción (bloqueo distinto).

**Ángulo landing (trust signal)**: *"Si se te olvida pagar, tienes 5 días de gracia. No cortamos servicio al instante."*

---

### 9.4 FinancialReportModal · Reporte exportable

**Qué contiene**
- Title bar con nombre del restaurante en serif 48px + periodo + fecha generada.
- **Estado de utilidades midnight card** con ingreso bruto + flujo neto mostaza.
- **Tabla desglose financiero** (Concepto / Bruto / Delivery / Neto): Ventas totales, Gastos operativos, Balance final resaltado terracota.
- **Tabla detalle de gastos** con categoría chip.
- **Card Cashflow con BarChart** por canal (Efectivo verde / Gastos rojo / Tarjeta terracota / Transferencia / Uber mostaza / DiDi / Rappi) + **legend con día real de payout** ("Al instante" / "Día siguiente" / "Lunes" / "Martes" / "Al sumar monto").
- **Grid Performance**: Top 5 meseros por ventas + KPIs (Ticket promedio, Pedidos, Mix Mesa vs Delivery).
- Footer editorial "ServiRest — Reporte verificado".

**Descargable como PDF** (usa `window.print()` con estilos print-mode).

**Ángulo landing**: *"Manda a tu contadora un PDF profesional. Con cashflow por canal, no solo la suma."*

---

## 10. Blueprint sugerido para la landing page

Estructura secuencial recomendada (mobile-first, cada sección un ancla scroll):

### Sección 1 · Hero
- Headline: **"El POS con estética de revista y precio de tortería."**
- Sub: "Vende, cobra, cocina, factura y controla tu cocina desde una sola pantalla. En pesos mexicanos, sin contratos."
- CTA primario: "Prueba 20 días gratis"
- CTA secundario: "Ver demo en 3 minutos"
- Hero visual: screenshot del **POS con Order Rail lateral**, con paleta editorial.

### Sección 2 · Barra de trust logos
- Logos de clientes reales cuando existan. Mientras tanto: iconos de Stripe, Supabase, Facturama, Web Bluetooth, PWA installable.

### Sección 3 · 3 dolores universales (bloque emocional)
- "No sabes cuánto ganaste hoy" → screenshot Dashboard.
- "La cocina no se pone de acuerdo" → screenshot Kitchen.
- "Cada cliente pide factura por WhatsApp" → screenshot Invoice.

### Sección 4 · Grid de módulos (13 tarjetas)
Cada tarjeta: ícono + nombre + one-liner. Al hacer hover, expande a un párrafo. Este bloque es el que reutiliza este documento.

### Sección 5 · Comparativa de planes
Tabla de la Sección 2 de este documento con toggle Mensual / Anual y highlight terracota en Profesional.

### Sección 6 · Video demo o loop editorial
Loop de 60 segundos mostrando LockScreen → POS → Kitchen (con timer semantic) → Cashier → Dashboard con export PDF.

### Sección 7 · "Cómo se ve en tu tablet"
Sección con 4 mockups (Standard / Tablet POS / Tablet Host / Móvil mesero) para vender modo terminal.

### Sección 8 · Hardware compatible
Grid de marcas de impresora térmica compatibles + terminal Bluetooth. "Sin drivers. Sin cables raros. Enchufas y funciona."

### Sección 9 · Testimonios (cuando existan)
Formato editorial: quote grande serif italic sobre foto de local, con crédito nombre + tipo de negocio.

### Sección 10 · CFDI 4.0 (bloque de credibilidad)
"Factura desde el mismo cobro. 200 timbres/mes en Profesional, 1 000 en Prestige. Sin salir de ServiRest."

### Sección 11 · Pricing final + CTA
Repetir tabla de planes con "Empieza gratis 20 días". Chip "Sin tarjeta" reforzando fricción cero.

### Sección 12 · FAQ (usar Sección 12 de este documento)

### Sección 13 · Footer
Copyright, links a docs de RLS, seguridad de datos, aviso de privacidad, contacto WhatsApp.

---

## 11. Ángulos de campaña por persona

### 11.1 Campaña "María" (fondas, cafés, Esencial)
- **Canal**: Facebook + Instagram + TikTok orgánico.
- **Hook**: video de dueña cerrando su fonda con el celular en la mano, viendo Dashboard sonriendo. Voz en off: *"Yo antes sumaba tickets a mano hasta las 11 de la noche."*
- **Copy corto**: "Cierra tu caja como cierran los grandes. Desde $549/mes."
- **CTA**: "Empieza gratis. Sin tarjeta."

### 11.2 Campaña "Carlos" (pyme con cocina, Profesional)
- **Canal**: LinkedIn + Google Search + Facebook Ads.
- **Hook**: split screen izq "cocina caótica con gritos", der "cocina con Kitchen Display en pantalla, cronómetro verde".
- **Copy**: "Tu cocina merece el sistema que grandes cadenas usan. Por $899/mes."
- **CTA**: "Ver Kitchen Display en acción" → demo video.

### 11.3 Campaña "Ana" (boutique / hospitality, Prestige)
- **Canal**: Instagram + prensa gastronómica + partnerships con influencers de gastronomía.
- **Hook**: video en formato revista con música ambiental. Mesa puesta, carta digital cargando en teléfono con URL propia + QR.
- **Copy**: "El único POS que se ve tan bien como tu carta."
- **CTA**: "Solicita demo con nuestro equipo de cuenta dedicada."

### 11.4 Campaña "Grupo" (Enterprise)
- **Canal**: LinkedIn Sales Navigator + eventos ANTAD + Canirac.
- **Hook**: whitepaper "Cómo integrar tu POS con SAP/Microsip sin re-migrar".
- **Copy**: "Tu marca, tus reglas, nuestra infraestructura. Consolidador multi-sucursal, API privada, SLA 99.9%."
- **CTA**: "Agenda una llamada con nuestro equipo enterprise."

---

## 12. Preguntas frecuentes listas para copy

**¿Necesito comprar equipo?**
No. Puedes usar cualquier tablet, laptop o computadora que ya tengas. Si quieres nuestro kit (impresora térmica + cajón), lo financiamos desde $625/mes hasta 8 meses.

**¿Funciona sin internet?**
Sí. ServiRest se instala como app en tu dispositivo (PWA). Sigue vendiendo aunque se caiga el internet. Cuando vuelve, sincroniza sola.

**¿Puedo probar sin dar mi tarjeta?**
Sí. Tienes 20 días de demo gratis sin tarjeta. Después decides si contratas o no.

**¿Puedo cambiar de plan cuando quiera?**
Sí. Puedes subir de plan al instante. Bajar de plan requiere que nos escribas para reconfigurar tus datos.

**¿Qué pasa si un mes se me olvida pagar?**
Tienes **5 días de gracia** después del vencimiento. No cortamos tu servicio al instante. Si pagas dentro de esa ventana, todo sigue como si nada.

**¿Tengo que instalar algo en mi tablet?**
No. Abres el navegador, entras a la app y le das "Instalar" (o "Añadir a pantalla de inicio"). Queda como una app nativa.

**¿La factura CFDI 4.0 está incluida?**
En Profesional ($899/mes) tienes 200 timbres mensuales. En Prestige ($2,499/mes) tienes 1 000 timbres. Si consumes más, el sobreuso es de $2.50 o $1.50 por timbre según tu plan. En Esencial no incluye CFDI.

**¿Qué impresoras son compatibles?**
Las 6 marcas más comunes en México: Epson TM-T88, Xprinter, Bixolon, MUNBYN, y las variantes genéricas chinas 58mm y 80mm. Vía Bluetooth o USB. Sin drivers.

**¿Cómo funciona el cambio de turno?**
La terminal queda siempre abierta al negocio. Cada operador entra con su PIN de 4 dígitos. El cambio toma 3 segundos. Cada cobro y cada corte de caja quedan firmados con el nombre del operador.

**¿Puedo tener más de una tablet operando a la vez?**
Sí. En Esencial una terminal, en Profesional 5, en Prestige 12, en Enterprise ilimitadas.

**¿Mis datos están seguros?**
Sí. Usamos Supabase con Row-Level Security (RLS): tus datos están aislados a nivel de base de datos, otro restaurante nunca podría verlos aunque intentara. Auth encriptada con estándares OAuth2.

**¿Puedo integrar con Rappi/Uber Eats/DiDi?**
Sí. En Profesional y superiores, la orden remota captura pedidos de los tres canales y los mete a la cola de cocina como cualquier otra mesa. En el Dashboard ves el cashflow por canal con días reales de payout.

**¿Tienen soporte en español?**
Todo el equipo es mexicano, radicado en México. Soporte por WhatsApp, email y llamada según tu plan.

---

## 13. Inventario de assets visuales sugeridos

Lista priorizada de screenshots y videos que necesitas para poblar la landing y las campañas:

### Screenshots estáticos (mínimo 12)
1. **POS** en modo Tablet POS con Order Rail lleno y platillos coloridos.
2. **Kitchen** con 3 tickets, uno verde, uno mostaza, uno rojo pulsante.
3. **Bar** con 2 tickets de cocteles.
4. **Cashier** con modal "Payment Authorize" abierto mostrando el input gigante.
5. **Cashier** en tab Historial con los 4 KPI cards.
6. **Hostess** con plano de mesas, una mesa siendo arrastrada (con ghost preview).
7. **Menu** con grid de 8 platillos.
8. **Inventory** en modo Profesional con progress rings y valor total.
9. **Dashboard** con todos los widgets (día completo con datos ricos).
10. **FinancialReportModal** con BarChart de cashflow por canal.
11. **LockScreen** con roster de 6 empleados y keypad.
12. **Onboarding** paso 6 (Hardware) con impresora detectada.

### Videos cortos (5, cada uno 15-30s)
1. **Vender un platillo en 4 taps** (POS → carrito → cocina).
2. **Cambio de turno en 3 segundos** (LockScreen → PIN → POS del nuevo mesero).
3. **Cocina en calma** (Kitchen con orden entrando, cronómetro semaforo, botón "Pedido listo").
4. **Cobrar con split** (Cashier con 4 formas de dividir).
5. **Facturar CFDI** (Invoice → modal → UUID exitoso).

### Video ancla (1, de 90-120 segundos)
Recorrido editorial narrado desde el login hasta el cierre del día, con música ambiental. Termina en el Dashboard con "Ventas hoy: $12,847" y el logo ServiRest.

### Mockups de dispositivo (4)
Cada uno mostrando el modo terminal correcto:
1. Laptop en modo Estándar (Dashboard).
2. iPad horizontal en modo Tablet POS (POS).
3. iPad vertical en modo Tablet Host (Hostess).
4. Celular en modo Móvil Mesero (MyTables).

---

## Cierre editorial

Este documento es el **inventario completo del producto ServiRest a julio de 2026**. Cada módulo, cada botón, cada estado tiene aquí un ángulo de venta correspondiente. La invitación al equipo de marketing es tratar este archivo como *fuente única de verdad* para landing, ads y guiones de demo; y al equipo de producto, actualizarlo cada vez que se libere un módulo nuevo.

Detrás de cada pantalla hay una decisión: no ser el POS más completo del mercado, sino el POS que un dueño de fonda mexicana pueda instalar en 15 minutos y usar sin susto. La estética Sobremesa Lúcida y el precio en pesos son la carta de presentación; la operación en cocina, barra y caja es la razón por la que se quedan.

**ServiRest — Aliados del rubro.**
