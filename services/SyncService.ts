import { 
  getAll, put, deleteRecord, enqueueSyncOp, 
  getPendingSyncOps, updateSyncOp, clearSyncedOps, 
  getSyncQueueCount, SyncOperation 
} from './db';

// ─── Configuration ────────────────────────────────────────────
// These will be configured when Supabase credentials are available
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
let supabaseClient: any = null;

export function configureSyncService(url: string, anonKey: string) {
  SUPABASE_URL = url;
  SUPABASE_ANON_KEY = anonKey;
  // Dynamic import to avoid loading supabase when not configured
  import('@supabase/supabase-js').then(({ createClient }) => {
    supabaseClient = createClient(url, anonKey);
    console.log('[SyncService] Supabase client configured');
  });
}

export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null;
}

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

  emitStatus({ isSyncing: true, syncError: null });

  try {
    // Phase 1: PUSH local changes to server
    await pushLocalChanges();

    // Phase 2: PULL latest from server (Filtered by business if provided)
    await pullServerChanges(businessId);

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
  const pending = await getPendingSyncOps();
  
  for (const op of pending) {
    try {
      await updateSyncOp(op.id!, { status: 'syncing' });

      const supabaseTable = TABLE_MAP[op.table] || op.table;

      switch (op.operation) {
        case 'INSERT': {
          // Check for duplicates first
          const { data: existing } = await supabaseClient
            .from(supabaseTable)
            .select('id')
            .eq('id', op.record_id)
            .single();

          if (existing) {
            // Record already exists on server — update instead
            await supabaseClient
              .from(supabaseTable)
              .update(transformForSupabase(op.payload))
              .eq('id', op.record_id);
          } else {
            await supabaseClient
              .from(supabaseTable)
              .insert(transformForSupabase(op.payload));
          }
          break;
        }
        case 'UPDATE': {
          await supabaseClient
            .from(supabaseTable)
            .update(transformForSupabase(op.payload))
            .eq('id', op.record_id);
          break;
        }
        case 'DELETE': {
          await supabaseClient
            .from(supabaseTable)
            .delete()
            .eq('id', op.record_id);
          break;
        }
      }

      await updateSyncOp(op.id!, { status: 'synced' });
    } catch (error: any) {
      console.error(`[SyncService] Failed to push op ${op.id}:`, error);
      await updateSyncOp(op.id!, { 
        status: op.retries >= 3 ? 'failed' : 'pending',
        retries: op.retries + 1,
        error: error.message,
      });
    }
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

      const { data, error } = await query.order('updated_at', { ascending: false });

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
          await put(storeName, { 
            ...transformFromSupabase(serverRecord, localStore), 
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
    if (key === 'synced' || key === 'updated_at') continue; // Skip local-only fields
    
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    transformed[snakeKey] = value;
  }
  transformed.updated_at = new Date().toISOString();
  return transformed;
}

function transformFromSupabase(record: any, storeName: string): any {
  // Convert snake_case to camelCase for local usage
  const transformed: any = {};
  for (const [key, value] of Object.entries(record)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    transformed[camelKey] = value;
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
