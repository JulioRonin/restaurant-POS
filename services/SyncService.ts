import { 
  getAll, put, deleteRecord, enqueueSyncOp, 
  getPendingSyncOps, updateSyncOp, clearSyncedOps, 
  getSyncQueueCount, SyncOperation, updateRecordSyncStatus, getById
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

  // Periodic sync (every 60 seconds when online)
  syncIntervalId = window.setInterval(() => {
    if (navigator.onLine && !currentStatus.isSyncing) {
      triggerSync();
    }
  }, 60_000);

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

export async function triggerSync(businessId?: string): Promise<void> {
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

  console.log('[SyncService] Sync Triggered for Business:', businessId);
  emitStatus({ isSyncing: true, syncError: null });

  try {
    const supabase = getSupabase();
    const currentBizId = businessId || (supabase as any)?.auth?.session?.user?.user_metadata?.business_id;

    console.log('[SyncService] Starting PUSH phase...');
    await pushLocalChanges();

    console.log('[SyncService] Starting PULL phase for:', currentBizId);
    await pullServerChanges(currentBizId);

    // Phase 3: Cleanup synced operations
    await clearSyncedOps();
    await updatePendingCount();

    emitStatus({ 
      isSyncing: false, 
      lastSyncTime: new Date(),
      syncError: null 
    });

    // Notify listeners that data has been updated
    syncCompleteListeners.forEach(listener => listener());
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
            delete payload.items;
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
             
             // The column is called 'key' in SQL, we must ensure it's not blacklisted or renamed
             finalPayload = {
                key: 'config',
                value: payload,
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
                  
                  // Use Upsert with onConflict for settings to resolve the 'key' column cache issues
                  result = await supabaseClient
                    .from('business_settings')
                    .upsert(
                      { ...finalPayload, business_id: bizId },
                      { onConflict: 'business_id,key' }
                    );
                    
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
        if (!['expenses', 'business_settings', 'supplier_orders'].includes(op.table)) {
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

async function pullServerChanges(businessId?: string): Promise<void> {
  for (const [localStore, supabaseTable] of Object.entries(TABLE_MAP)) {
    try {
      let query = supabaseClient
        .from(supabaseTable)
        .select('*');
      
      // CRITICAL: Filter by businessId if provided to ensure cross-tenant isolation
      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        console.warn(`[SyncService] No businessId provided for PULL on ${supabaseTable}. This might leak data if RLS is not tight.`);
      }

      const orderBy = (supabaseTable === 'expenses' || supabaseTable === 'supplier_orders') 
        ? 'created_at' 
        : 'updated_at';

      const { data, error } = await query.order(orderBy, { ascending: false });

      if (error) {
        console.error(`[SyncService] Pull error for ${supabaseTable}:`, error);
        continue;
      }

      if (!data || data.length === 0) continue;

      const storeName = localStore as any;

      for (const serverRecord of data) {
        const localRecord = await import('./db').then(db => db.getById(storeName, serverRecord.id));
        const serverTimestamp = serverRecord.updated_at || serverRecord.created_at;
        
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
            continue;
          }
          
          // For orders: client wins (skip server update if local is newer)
          if (localStore === 'orders' && localTimestamp > serverTimestamp) {
            continue;
          }
          
          // Default: use server version if newer
          if (serverTimestamp > localTimestamp) {
            await put(storeName, { 
              ...transformFromSupabase(serverRecord, localStore), 
              synced: true,
              updated_at: serverTimestamp,
            });
          }
        } else {
          // New record from server, insert locally
          let finalRecord = transformFromSupabase(serverRecord, localStore);

          // CRITICAL PROTECTION: Do not let cloud settings wipe out local hardware preferences
          if (localStore === 'settings' || localStore === 'business_settings') {
             const bizId = serverRecord.business_id || (finalRecord as any).business_id || (finalRecord as any).businessId;
             const idbKey = `settings_${bizId}`;
             const existingLocal = await import('./db').then(db => db.getSetting(idbKey));
             
             if (existingLocal) {
                const hardwareKeys = ['connectedDeviceName', 'connectedTerminalName', 'isDirectPrintingEnabled'];
                hardwareKeys.forEach(k => {
                   if (existingLocal[k] !== undefined) {
                      finalRecord[k] = existingLocal[k];
                   }
                });
             }
          }

          await put(storeName, { 
            ...finalRecord, 
            synced: true,
            updated_at: serverTimestamp,
          });
        }
      }
    } catch (error) {
      console.error(`[SyncService] Pull failed for ${localStore}:`, error);
    }
  }
}

// ─── Transform Helpers ────────────────────────────────────────

function transformForSupabase(payload: any): any {
  // Convert camelCase to snake_case for Supabase
  const transformed: any = {};
  for (const [key, value] of Object.entries(payload)) {
    const blacklistedKeys = [
      'synced', 'updated_at', 'timestamp', 'items', 'table', 
      'waiter', 'changeAmount', 'receivedAmount', 'paidSplits', 
      'splitType', 'inventoryLevel', 'publicInMenu', 'isFromMenu'
      // Note: 'id' is intentionally NOT blacklisted here anymore to preserve PK/FK integrity
    ];
    
    if (blacklistedKeys.includes(key)) continue; 
    
    // Check if the key is 'key' and we are doing settings
    if (key === 'key') {
       transformed.key = value;
       continue;
    }    
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    
    // CRITICAL: Supabase table_id is UUID. 'COUNTER' is invalid. Convert to null.
    if (snakeKey === 'table_id' && value === 'COUNTER') {
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
        const value = { ...record.value };
        // Transfer key metadata from row to the object
        if (record.business_id) value.businessId = record.business_id;
        if (record.updated_at) value.updated_at = record.updated_at;
        return value;
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
