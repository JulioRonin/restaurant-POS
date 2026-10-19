import { 
  getAll, put, deleteRecord, enqueueSyncOp, 
  getPendingSyncOps, updateSyncOp, clearSyncedOps, 
  getSyncQueueCount, SyncOperation, updateRecordSyncStatus, getById,
  requeueStalledSyncOps
} from './db';

// ─── Configuration ────────────────────────────────────────────
import { getSupabase } from './auth';

export function configureSyncService(url: string, anonKey: string) {
  // We no longer create a separate client here.
  // SyncService will always use the authenticated client from auth.ts
  // to ensure its requests respect RLS and the current user's session.
  console.log('[SyncService] Supabase client linked to auth service');
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}

const supabaseClient = {
  get from() {
    const client = getSupabase();
    if (!client) throw new Error("Supabase client not initialized in SyncService");
    return client.from.bind(client);
  }
};


// ─── Table Mapping ────────────────────────────────────────────
// Maps local IndexedDB store names to Supabase table names
const TABLE_MAP: Record<string, string> = {
  products: 'menu_items',
  orders: 'orders',
  employees: 'employees',
  inventory: 'inventory_items',
  expenses: 'expenses',
  supplier_orders: 'supplier_orders',
  settings: 'business_settings',
  tables: 'tables',
  order_items: 'order_items',
};

// ─── Sync Callbacks ───────────────────────────────────────────
type SyncCallback = (status: SyncStatus) => void;
type SyncCompleteCallback = () => void;
let syncCallback: SyncCallback | null = null;
let syncCompleteListeners: SyncCompleteCallback[] = [];

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncError: string | null;
}

let currentStatus: SyncStatus = {
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  syncError: null,
};

export function onSyncStatusChange(callback: SyncCallback) {
  syncCallback = callback;
}

export function onSyncComplete(callback: SyncCompleteCallback) {
  syncCompleteListeners.push(callback);
  return () => {
    syncCompleteListeners = syncCompleteListeners.filter(l => l !== callback);
  };
}

function emitStatus(updates: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...updates };
  syncCallback?.(currentStatus);
}

// ─── Network Monitoring ──────────────────────────────────────
let syncIntervalId: number | null = null;

export function startNetworkMonitoring() {
  // Online/Offline events
  window.addEventListener('online', () => {
    emitStatus({ isOnline: true });
    triggerSync();
  });

  window.addEventListener('offline', () => {
    emitStatus({ isOnline: false });
  });

  // Periodic sync (every 60 seconds when online) to ensure kitchen/pos stay in sync.
  // Solo cuando la pestaña está VISIBLE: una terminal olvidada abierta toda
  // la noche sincronizaba 1,440 veces sin que nadie estuviera viendo la
  // pantalla — puro egress tirado a la basura.
  syncIntervalId = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (navigator.onLine && !currentStatus.isSyncing) {
      triggerSync(undefined, true); // true = is background sync
    }
  }, 60_000);

  // Al volver a la pestaña, sincroniza de inmediato para no esperar el
  // siguiente tick (así la pausa no se siente en la operación real).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && !currentStatus.isSyncing) {
      triggerSync(undefined, true);
    }
  });

  // Initial status
  emitStatus({ isOnline: navigator.onLine });
  updatePendingCount();
}

export function stopNetworkMonitoring() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

export { getSyncQueueCount } from './db';

async function updatePendingCount() {
  const count = await import('./db').then(db => db.getSyncQueueCount());
  emitStatus({ pendingCount: count });
}

// ─── Core Sync Logic ─────────────────────────────────────────

let sessionBusinessId: string | null = null;

export async function triggerSync(businessId?: string, isBackground: boolean = false): Promise<void> {
  if (!navigator.onLine) {
    emitStatus({ syncError: 'Sin conexión a internet' });
    return;
  }

  if (currentStatus.isSyncing) {
    return; // Already syncing
  }

  if (!isSupabaseConfigured()) {
    // Supabase not configured, just update counts
    await updatePendingCount();
    return;
  }

  // Update cached businessId if provided
  if (businessId) {
    sessionBusinessId = businessId;
  }

  const supabase = getSupabase();
  const currentBizId = businessId || sessionBusinessId || (supabase as any)?.auth?.session?.user?.user_metadata?.business_id;

  if (!currentBizId && !isBackground) {
     console.warn('[SyncService] Triggered without businessId and no cached session found.');
  }

  console.log('[SyncService] Sync Triggered. Background:', isBackground, 'Business:', currentBizId);
  emitStatus({ isSyncing: true, syncError: null });

  try {
    console.log('[SyncService] Starting PUSH phase...');
    await pushLocalChanges();

    console.log('[SyncService] Starting PULL phase for:', currentBizId);
    const modifiedCount = await pullServerChanges(currentBizId) as any as number;

    // Phase 3: Cleanup synced operations
    await clearSyncedOps();
    await updatePendingCount();

    const isFirstSync = currentStatus.lastSyncTime === null;

    emitStatus({ 
      isSyncing: false, 
      lastSyncTime: new Date(),
      syncError: null 
    });

    // Notify listeners if:
    // 1. It was a manual action (not background)
    // 2. Data actually changed
    // 3. It's the first sync of the session (to ensure initial data load)
    if (!isBackground || modifiedCount > 0 || isFirstSync) {
        console.log(`[SyncService] Notifying UI. Change: ${modifiedCount > 0}, Background: ${isBackground}, Initial: ${isFirstSync}`);
        syncCompleteListeners.forEach(listener => listener());
    } else {
        console.log('[SyncService] Background sync yielded no changes. Suppressing UI update signal to prevent flicker.');
    }
  } catch (error: any) {
    console.error('[SyncService] Sync failed:', error);
    emitStatus({ 
      isSyncing: false, 
      syncError: error.message || 'Error de sincronización' 
    });
  }
}

// ─── PUSH: Send pending operations to Supabase ───────────────

async function pushLocalChanges(): Promise<void> {
  // Rescata operaciones atoradas en 'syncing' (la app se cerró a media subida)
  // y reintenta las 'failed'. Sin esto, un order_item que falla por llave
  // foránea nunca se vuelve a intentar y la orden queda con total pero sin
  // platillos.
  try {
    const requeued = await requeueStalledSyncOps();
    if (requeued > 0) console.log(`[SyncService] Reencoladas ${requeued} operaciones atoradas`);
  } catch (e) {
    console.warn('[SyncService] No se pudieron reencolar operaciones atoradas:', e);
  }

  const allPending = await getPendingSyncOps();
  // CRITICAL: Sort by ID (auto-increment) to preserve creation order
  // This ensures 'orders' are INSERTed before 'order_items'
  const pending = allPending.sort((a, b) => (a.id || 0) - (b.id || 0));
  
  console.log(`[SyncService] PENDING OPERATIONS: ${pending.length}`);
  
  // Track IDs of orders being synced in this batch
  const ordersPendingInThisBatch = new Set(
    pending.filter(op => op.table === 'orders' && op.operation === 'INSERT').map(op => op.record_id)
  );

  for (const op of pending) {
    try {
      // FK PROTECTION: If this is an order item, ensure its order is already synced on the server
      if (op.table === 'order_items' && op.operation === 'INSERT') {
          const parentOrderId = (op.payload as any).orderId || (op.payload as any).order_id;
          
          // Check local 'orders' table to see if it's already synced
          // This ensures we never send an item before stay-behind orders finish syncing
          const localOrder = await getById('orders', parentOrderId);
          
          if (!localOrder || !localOrder.synced) {
              console.log(`[SyncService] Skipping order_item ${op.record_id} - Parent order ${parentOrderId} not yet synced on server.`);
              continue; // Skip for now, will try next sync cycle after order is confirmed
          }

          // order_items.menu_item_id también es llave foránea (-> menu_items).
          // Si el platillo aún no llegó a la nube, el INSERT truena con 23503 y
          // el renglón se perdía. Aquí lo dejamos PENDIENTE (no 'failed') para
          // que suba en cuanto el platillo exista. Por eso se veían órdenes con
          // unos renglones sí y otros no: los de platillos ya sincronizados
          // pasaban, los de platillos nuevos se caían.
          const menuItemId = (op.payload as any).menuItemId || (op.payload as any).menu_item_id;
          if (menuItemId) {
              const localProduct = await getById('products', menuItemId);
              if (localProduct && !(localProduct as any).synced) {
                  console.log(`[SyncService] Skipping order_item ${op.record_id} - Platillo ${menuItemId} aún no sincronizado.`);
                  continue;
              }
          }
      }

      await updateSyncOp(op.id!, { status: 'syncing' });

      const supabaseTable = TABLE_MAP[op.table] || op.table;
      let result;

      switch (op.operation) {
        case 'INSERT':
        case 'UPDATE': {
          let payload = { ...op.payload };
          
          // Cleanup incompatible fields for multi-tenant tables
          if (op.table === 'orders') {
            // La hora REAL de la orden viaja como created_at.
            // Antes se perdía: `timestamp` está en la lista negra de
            // transformForSupabase, así que el INSERT llegaba sin fecha y
            // Postgres aplicaba `created_at default now()` — es decir, la
            // hora en que se VACIÓ LA COLA DE SYNC, no la hora de la venta.
            // Si la cola traía atraso (sin internet, pestaña cerrada, backlog),
            // órdenes de días anteriores entraban a Supabase fechadas HOY, y
            // al volver a bajarlas se sumaban todas a las ventas de hoy.
            const rawTs = payload.timestamp || payload.created_at;
            if (rawTs) {
              const t = new Date(rawTs);
              if (!isNaN(t.getTime())) payload.created_at = t.toISOString();
            }
            // El nombre de quien pidió viaja DENTRO de customer_metadata (que
            // ya existe para el canal digital), no como columna propia: así no
            // hace falta migrar `orders` ni arriesgar un 42703 que tumbe el
            // INSERT completo de la orden.
            if (payload.customerName) {
              payload.customerMetadata = {
                ...(payload.customerMetadata || {}),
                customerName: payload.customerName,
              };
            }
            delete payload.customerName;

            // Mismo caso para el desglose de un cobro con varios métodos
            // (tarjeta + efectivo en una sola cuenta): va dentro del jsonb.
            if (payload.payments) {
              payload.customerMetadata = {
                ...(payload.customerMetadata || {}),
                payments: payload.payments,
              };
            }
            delete payload.payments;

            // Cobro en divisa (USD): la venta ya está en pesos en `total`,
            // esto solo deja el rastro de cómo pagó el cliente.
            if (payload.paidCurrency && payload.paidCurrency !== 'MXN') {
              payload.customerMetadata = {
                ...(payload.customerMetadata || {}),
                paidCurrency: payload.paidCurrency,
                fxRate: payload.fxRate,
                receivedForeign: payload.receivedForeign,
              };
            }
            delete payload.paidCurrency;
            delete payload.fxRate;
            delete payload.receivedForeign;

            delete payload.items;
            delete payload.paidAt; // Solo local: la columna no existe en Supabase
            delete payload.table; // Object reference cleanup
            delete payload.waiter; // Object reference cleanup
            delete payload.changeAmount;
            delete payload.receivedAmount;
            delete payload.paidSplits;
            delete payload.splitType;
            delete payload.invoiceDetails; // If causing issues, can be kept as JSONB but usually empty
          }
          
          if (op.table === 'order_items') {
            // Remove fields from MenuItem that don't belong in OrderItem table
            delete payload.category;
            delete payload.image;
            delete payload.inventoryLevel;
            delete payload.publicInMenu;
            delete payload.status;
            delete payload.gramaje;
            delete payload.description;
            delete payload.name; // Not in Supabase schema

            // Handle legacy price mapping if record was created before the schema alignment fix
            if (payload.price !== undefined && payload.priceAtTime === undefined) {
              payload.priceAtTime = payload.price;
            }
            delete payload.price;
          }

          let finalPayload: any;
          if (op.table === 'settings' || op.table === 'business_settings') {
             // For settings, ensure we have business_id
             const bizId = payload.businessId || payload.business_id;
             
             // The column 'value' is JSONB in Supabase.
             finalPayload = {
                key: 'config',
                value: payload, // The object itself
                business_id: bizId,
                updated_at: new Date().toISOString()
             };
          } else {
             finalPayload = transformForSupabase(payload);
             // CRITICAL: Ensure the ID is included in the payload for proper FK relationships
             if (op.record_id) {
               finalPayload.id = op.record_id;
             }
          }

          if (op.operation === 'INSERT') {
            // Check for duplicates first
            const { data: existing } = await supabaseClient
              .from(supabaseTable)
              .select('id')
              .eq('id', op.record_id)
              .single();

            if (existing) {
              result = await supabaseClient
                .from(supabaseTable)
                .update(finalPayload)
                .eq('id', op.record_id);
            } else {
              result = await supabaseClient
                .from(supabaseTable)
                .insert(finalPayload);
            }
          } else {
              // Special case for settings: find by logical key and update by ID
               if (op.table === 'settings') {
                  const bizId = payload.businessId || payload.business_id;
                  
                  // Strategy 1: Attempt Upsert (Fastest if constraint exists)
                  const { data: upsertData, error: upsertError } = await supabaseClient
                    .from('business_settings')
                    .upsert(
                      { ...finalPayload, business_id: bizId, key: 'config' },
                      { onConflict: 'business_id,key' }
                    );

                  if (upsertError && (upsertError.message.includes('constraint') || upsertError.code === '42710')) {
                      console.warn('[SyncService] Standard upsert failed due to constraint issue, trying manual merge');
                      
                      // Strategy 2: Manual Check & Update (Fallback)
                      const { data: existing } = await supabaseClient
                        .from('business_settings')
                        .select('id')
                        .eq('business_id', bizId)
                        .eq('key', 'config')
                        .single();
                        
                      if (existing) {
                          result = await supabaseClient
                            .from('business_settings')
                            .update({ ...finalPayload, business_id: bizId })
                            .eq('id', existing.id);
                      } else {
                          result = await supabaseClient
                            .from('business_settings')
                            .insert({ ...finalPayload, business_id: bizId, key: 'config' });
                      }
                  } else {
                      result = { data: upsertData, error: upsertError };
                  }
                    
                  op.status = 'synced'; 
               } else {
                 result = await supabaseClient
                   .from(supabaseTable)
                   .update(finalPayload)
                   .eq('id', op.record_id);
              }
              break; // Ensure we break the switch safely if this block is reached
          }
          break; // This break is for the operation switch case update
        }
        case 'DELETE': {
          result = await supabaseClient
            .from(supabaseTable)
            .delete()
            .eq('id', op.record_id);
          break;
        }
      }

      if (result?.error) {
        console.error(`[SyncService] PUSH ERROR for ${op.table}:`, result.error);
        // "Schema cache" / "column does not exist" = falta correr una migración
        // Supabase pendiente. Guarda local pero no muestra alert (el equipo
        // ServiRest te avisa por consola qué SQL correr).
        const errMsg = String(result.error.message || '');
        const isSchemaMissing =
          errMsg.includes('schema cache') ||
          errMsg.includes('column') && errMsg.includes('does not exist') ||
          (result.error as any).code === '42703';

        if (isSchemaMissing) {
          console.warn(
            `[SyncService] Schema pendiente en ${op.table}. Los datos están guardados localmente. ` +
            `Corre docs/business-plan/koso-pos/MIGRATION_DIGITAL_CHANNEL.sql en Supabase.`
          );
        } else if (!['expenses', 'business_settings', 'supplier_orders', 'order_items'].includes(op.table)) {
          // order_items queda fuera a propósito: ahora se reintenta solo, y no
          // tiene caso interrumpir al cajero a media comanda con un alert.
          alert(`Error guardando ${op.table}: ${result.error.message}`);
        }
        throw result.error;
      } else {
        console.log(`[SyncService] PUSH SUCCESS for ${op.table} (${op.record_id})`);
      }

       // Update local record immediately so subsequent items in the batch can see it
      await updateRecordSyncStatus(op.table, op.record_id, true);
      await updateSyncOp(op.id!, { status: 'synced' });
    } catch (err: any) {
      console.error(`[SyncService] Failed to push ${op.table}/${op.operation}:`, err);
      
      // Handle specific Supabase/PostgreSQL errors
      const errorMsg = err.message || JSON.stringify(err);
      
      // Error 23503 is Foreign Key violation (e.g. order_item missing menu_item)
      if (errorMsg.includes('23503') || errorMsg.includes('foreign key constraint')) {
        console.warn(`[SyncService] Skipping ${op.table} due to missing parent record. Will retry later.`);
        await updateSyncOp(op.id!, { 
          status: 'failed', 
          error: 'Missing parent record (Foreign Key). Verify that the menu item or order exists in the cloud.' 
        });
        continue; // Move to next operation in queue
      }

      await updateSyncOp(op.id!, { status: 'failed', error: errorMsg });
      
      // Don't alert for every single failure in a loop, it's annoying
      // alert(`Error guardando ${op.table}: ${errorMsg}`);
      
      // Optional: continue the loop instead of throwing, to let other tables sync
      continue; 
    }
  }
}

/**
 * REPAIR TOOL: Recovers menu items that were previously stored in the inventory table
 * and clones them to the new professional products table.
 */
export async function repairAndRecoverMenuData(targetBusinessId: string): Promise<number> {
  const { getAll, put } = await import('./db');
  console.log(`[SyncService] Running Menu Recovery Tool for business: ${targetBusinessId}`);
  
  if (!targetBusinessId) {
    console.error('[SyncService] Recovery aborted: No business ID provided.');
    return 0;
  }

  try {
    const invData = await getAll('inventory');
    const existingProducts = await getAll('products');
    const existingIds = new Set(existingProducts.map(p => p.id));
    
    let recoveredCount = 0;
    
    // Filter inventory items to ONLY those belonging to this business to prevent leaks
    const myInvData = (invData as any[]).filter(item => 
      (item.business_id === targetBusinessId || item.businessId === targetBusinessId)
    );
    
    for (const item of myInvData) {
      if (existingIds.has(item.id)) continue;

      // Heuristic: if it has a category like 'Bebidas', 'Platillos', etc., it's likely a menu item
      // OR if it has a description/image (common for menu, rare for raw inventory)
      const isLikelyMenu = item.price !== undefined || 
                           ['bebidas', 'platillos', 'entradas', 'postres'].includes(item.category?.toLowerCase()) ||
                           item.image;

      if (isLikelyMenu) {
        console.log(`[SyncService] Recovering menu item from inventory: ${item.name}`);
        const newProduct = {
          id: item.id,
          name: item.name,
          price: item.price || (item.costPerUnit ? item.costPerUnit * 1.3 : 0),
          category: item.category || 'Varios',
          image: item.image || '',
          inventoryLevel: item.quantity || 0,
          description: item.description || '',
          status: 'ACTIVE' as const,
          business_id: item.business_id || item.businessId,
          synced: false,
          updated_at: new Date().toISOString()
        };
        
        await put('products', newProduct);
        await trackChange('products', 'INSERT', newProduct.id, newProduct);
        recoveredCount++;
      }
    }
    
    console.log(`[SyncService] Recovery complete. Recovered ${recoveredCount} items.`);
    return recoveredCount;
  } catch (err) {
    console.error('[SyncService] Menu recovery failed:', err);
    return 0;
  }
}

// ─── PULL: Fetch latest data from Supabase ───────────────────

/**
 * WATERMARK POR TABLA — control de egress.
 *
 * Antes este pull hacía `select('*')` de las 9 tablas COMPLETAS cada 60s,
 * sin filtro de fecha: cada minuto se re-descargaba todo el historial del
 * negocio (todas las órdenes desde siempre + el menú con sus fotos). Con
 * varias terminales abiertas todo el día eso son cientos de GB de egress
 * al mes en Supabase.
 *
 * Ahora guardamos, por negocio y tabla, el `updated_at` más reciente que ya
 * bajamos, y solo pedimos lo que cambió después de esa marca. El primer
 * pull de un dispositivo sí trae datos (acotados por ventana, ver
 * FULL_PULL_WINDOW_DAYS), los siguientes bajan casi cero.
 */
const watermarkKey = (bizId: string, table: string) => `sync_wm_${bizId}_${table}`;

const getWatermark = (bizId: string, table: string): string | null => {
  try { return localStorage.getItem(watermarkKey(bizId, table)); } catch { return null; }
};

const setWatermark = (bizId: string, table: string, iso: string) => {
  try { localStorage.setItem(watermarkKey(bizId, table), iso); } catch { /* storage lleno */ }
};

/** Borra las marcas: fuerza un pull completo (útil tras limpiar IndexedDB). */
export function resetSyncWatermarks(businessId?: string) {
  try {
    const prefix = businessId ? `sync_wm_${businessId}_` : 'sync_wm_';
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
    console.log('[SyncService] Watermarks reiniciados — el próximo sync será completo.');
  } catch { /* no-op */ }
}

// En el PRIMER pull de un dispositivo (sin watermark) no bajamos el
// historial completo desde el inicio de los tiempos: las tablas
// transaccionales se acotan a esta ventana. El histórico viejo sigue en
// Supabase y se consulta bajo demanda desde los reportes.
const FULL_PULL_WINDOW_DAYS = 7;
const WINDOWED_TABLES = new Set(['orders', 'order_items', 'expenses', 'supplier_orders']);

async function pullServerChanges(businessId?: string): Promise<number> {
  let globalModifiedCount = 0;
  for (const [localStore, supabaseTable] of Object.entries(TABLE_MAP)) {
    try {
      const orderBy = (supabaseTable === 'expenses' || supabaseTable === 'supplier_orders')
        ? 'created_at'
        : 'updated_at';

      let query = supabaseClient
        .from(supabaseTable)
        .select('*');

      // CRITICAL: Filter by businessId if provided to ensure cross-tenant isolation
      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        console.warn(`[SyncService] No businessId provided for PULL on ${supabaseTable}. This might leak data if RLS is not tight.`);
      }

      // ── Filtro incremental (el que evita el egress masivo) ──────────
      let wm = businessId ? getWatermark(businessId, supabaseTable) : null;

      // RED DE SEGURIDAD: si hay marca pero el store local está VACÍO
      // (el operador limpió el navegador, o cambió de equipo), la marca
      // mentiría y el dispositivo se quedaría sin datos. En ese caso la
      // descartamos y hacemos pull completo una vez.
      if (wm && localStore !== 'settings' && localStore !== 'business_settings') {
        try {
          const local = await import('./db').then((db) => db.getAll(localStore as any));
          if (!local || local.length === 0) {
            console.warn(`[SyncService] ${localStore} vacío localmente — ignorando watermark y re-sincronizando.`);
            wm = null;
          }
        } catch { /* si falla la lectura local, seguimos con la marca */ }
      }

      if (wm) {
        query = query.gt(orderBy, wm);
      } else if (WINDOWED_TABLES.has(supabaseTable)) {
        const since = new Date(Date.now() - FULL_PULL_WINDOW_DAYS * 86400000).toISOString();
        query = query.gte(orderBy, since);
      }

      const { data, error } = await query.order(orderBy, { ascending: false });

      if (error) {
        console.error(`[SyncService] Pull error for ${supabaseTable}:`, error);
        continue;
      }

      if (!data || data.length === 0) continue;

      // Avanza la marca al timestamp más reciente que realmente bajamos
      // (usamos el reloj DEL SERVIDOR, no el del cliente, para no perder
      // registros por desfase de horas entre dispositivos).
      if (businessId) {
        let maxTs = wm || '';
        for (const r of data) {
          const ts = (r as any)[orderBy] || (r as any).updated_at || (r as any).created_at;
          if (ts && ts > maxTs) maxTs = ts;
        }
        if (maxTs) setWatermark(businessId, supabaseTable, maxTs);
      }

      for (const serverRecord of data) {
        let localRecord: any;
        const serverTimestamp = serverRecord.updated_at || serverRecord.created_at;
        const storeName = localStore as any;

        // SPECIAL CASE: Settings store uses logical keys, not UUIDs from Supabase
        if (localStore === 'settings' || localStore === 'business_settings') {
           const bizId = serverRecord.business_id;
           const idbKey = `settings_${bizId}`;
           // We use a separate helper or raw access for settings 
           localRecord = await import('./db').then(db => db.getDB().then(inst => inst.get('settings', idbKey)));
           
           let finalRecord = transformFromSupabase(serverRecord, localStore);

           // CRITICAL PROTECTION: el server NO debe borrar config local que el
           // operador acaba de guardar. Hacemos MERGE: la base es lo del
           // server, pero cualquier campo que exista local GANA. Esto cubre
           // hardware, canal digital, kiosko, banco, apariencia, etc. sin
           // tener que enumerar cada key nueva a mano.
           if (localRecord && localRecord.data) {
              finalRecord.data = { ...(finalRecord.data || {}), ...localRecord.data };
           }

           // Solo escribe si el server es estrictamente más nuevo, y aún así
           // ya mergeamos local encima para no perder ediciones recientes.
           const localTimestamp = localRecord?.updated_at;
           if (!localRecord || serverTimestamp > localTimestamp) {
              await import('./db').then(db => db.getDB().then(inst => inst.put('settings', finalRecord)));
              globalModifiedCount++;
           }
           continue;
        }

        // NORMAL CASE: Relational entries use UUIDs
        localRecord = await import('./db').then(db => db.getById(storeName, serverRecord.id));
        
        // Conflict resolution
        if (localRecord) {
          const localTimestamp = (localRecord as any).updated_at;
          
          // For inventory: server always wins
          if (localStore === 'inventory') {
            await put(storeName, { 
              ...transformFromSupabase(serverRecord, localStore), 
              synced: true,
              updated_at: serverTimestamp,
            });
            globalModifiedCount++;
            continue;
          }
          
          // For orders: client wins (skip server update if local is newer)
          if (localStore === 'orders' && localTimestamp >= serverTimestamp) {
            continue;
          }
          
          // Default: use server version if newer
          if (serverTimestamp > localTimestamp) {
            await put(storeName, { 
              ...transformFromSupabase(serverRecord, localStore), 
              synced: true,
              updated_at: serverTimestamp,
            });
            globalModifiedCount++;
          }
        } else {
          // New record from server, insert locally
          let finalRecord = transformFromSupabase(serverRecord, localStore);

          await put(storeName, { 
            ...finalRecord, 
            synced: true,
            updated_at: serverTimestamp,
          });
          globalModifiedCount++;
        }
      }
    } catch (error) {
      console.error(`[SyncService] Pull failed for ${localStore}:`, error);
    }
  }
  return globalModifiedCount;
}

// ─── Transform Helpers ────────────────────────────────────────

function transformForSupabase(payload: any): any {
  // Convert camelCase to snake_case for Supabase
  const transformed: any = {};
  for (const [key, value] of Object.entries(payload)) {
    const blacklistedKeys = [
      'synced', 'updated_at', 'timestamp', 'items', 'table', 
      'waiter', 'changeAmount', 'receivedAmount', 'paidSplits', 
      'splitType', 'inventoryLevel', 'publicInMenu', 'isFromMenu',
      'connectedDeviceName', 'connectedTerminalName', 'isDirectPrintingEnabled',
      'isKitchenPrintingEnabled', 'isCashDrawerEnabled', 'isTerminalEnabled'
      // Note: 'id' is intentionally NOT blacklisted here anymore to preserve PK/FK integrity
    ];
    
    if (blacklistedKeys.includes(key) && key !== 'value') continue; 
    
    // Check if the key is 'key' and we are doing settings
    if (key === 'key') {
       transformed.key = value;
       continue;
    }    
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

    // CRITICAL: Supabase table_id es UUID. Cualquier sentinel no-UUID
    // ('COUNTER', 'KIOSK', 'STOREFRONT', etc.) rompe el INSERT. Los
    // convertimos a null — la orden vive igual, solo sin mesa asignada.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (snakeKey === 'table_id' && typeof value === 'string' && !UUID_RE.test(value)) {
      transformed[snakeKey] = null;
    } else {
      transformed[snakeKey] = value;
    }
  }
  transformed.updated_at = new Date().toISOString();
  return transformed;
}

function transformFromSupabase(record: any, storeName: string): any {
  // If it's the settings table, the data is inside the 'value' column jsonb
  if (storeName === 'settings' || storeName === 'business_settings') {
     if (record.value && typeof record.value === 'object') {
        // IDB 'settings' store expects { key, data, updated_at }
        const dataPayload = { ...record.value };
        if (record.business_id) dataPayload.businessId = record.business_id;
        
        return {
           key: `settings_${record.business_id}`,
           data: dataPayload,
           updated_at: record.updated_at || new Date().toISOString()
        };
     }
  }

  // Convert snake_case to camelCase for local use
  const transformed: any = {};
  for (const [key, value] of Object.entries(record)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    
    // CRITICAL: Bridge Supabase null back to UI 'COUNTER'
    if (camelKey === 'tableId' && value === null) {
      transformed[camelKey] = 'COUNTER';
    } else {
      transformed[camelKey] = value;
    }
  }
  
  // Custom mappings for consistency
  if (record.business_id) transformed.businessId = record.business_id;

  // El nombre de quien pidió se guarda dentro de customer_metadata (tanto el
  // capturado en POS como el del canal digital). Se rehidrata a nivel raíz
  // para que las pantallas lo lean como order.customerName sin escarbar.
  if (storeName === 'orders' && transformed.customerMetadata?.customerName) {
    transformed.customerName = transformed.customerMetadata.customerName;
  }
  if (storeName === 'orders' && Array.isArray(transformed.customerMetadata?.payments)) {
    transformed.payments = transformed.customerMetadata.payments;
  }
  if (storeName === 'orders' && transformed.customerMetadata?.paidCurrency) {
    transformed.paidCurrency = transformed.customerMetadata.paidCurrency;
    transformed.fxRate = transformed.customerMetadata.fxRate;
    transformed.receivedForeign = transformed.customerMetadata.receivedForeign;
  }

  return transformed;
}

// ─── Public Helpers ──────────────────────────────────────────

/**
 * Call this whenever a local write happens.
 * It enqueues the operation for sync and updates the pending count.
 */
export async function trackChange(
  table: string, 
  operation: 'INSERT' | 'UPDATE' | 'DELETE', 
  recordId: string, 
  payload: any
): Promise<void> {
  await enqueueSyncOp({
    table,
    operation,
    record_id: recordId,
    payload,
    timestamp: new Date().toISOString(),
  });
  await updatePendingCount();
  
  // Auto-sync if online
  if (navigator.onLine && isSupabaseConfigured()) {
    // Small delay to batch rapid changes
    setTimeout(() => triggerSync(), 2000);
  }
}

export function getSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

/**
 * Returns a promise that resolves when the sync queue is empty.
 * Useful for ensuring data is saved before logout.
 */
export async function waitForTotalSync(maxWaitMs: number = 10000): Promise<boolean> {
  const start = Date.now();
  
  // Force a sync trigger to start pushing if not already
  if (navigator.onLine) {
    triggerSync().catch(console.error);
  }

  while (Date.now() - start < maxWaitMs) {
    const count = await getSyncQueueCount();
    if (count === 0 && !currentStatus.isSyncing) {
      return true;
    }
    // Wait bit before checking again
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false; // Timed out
}
