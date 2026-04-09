import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ─── Sync Operation Type ──────────────────────────────────────
export interface SyncOperation {
  id?: number;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  payload: any;
  timestamp: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retries: number;
  error?: string;
}

// ─── Database Schema ──────────────────────────────────────────
export interface CulinexDB extends DBSchema {
  products: {
    key: string;
    value: {
      id: string;
      name: string;
      price: number;
      category: string;
      image: string;
      inventoryLevel: number;
      description?: string;
      status: 'ACTIVE' | 'INACTIVE';
      gramaje?: string;
      synced: boolean;
      updated_at: string;
    };
    indexes: {
      'by-category': string;
      'by-sync': string;
    };
  };
  orders: {
    key: string;
    value: {
      id: string;
      tableId: string;
      items: any[];
      status: string;
      timestamp: string;
      total: number;
      waiterName?: string;
      paymentStatus?: string;
      paymentMethod?: string;
      source?: string;
      tip?: number;
      splitType?: string;
      invoiceDetails?: any;
      receivedAmount?: number;
      changeAmount?: number;
      paidSplits?: number;
      synced: boolean;
      updated_at: string;
      business_id?: string;
    };
    indexes: {
      'by-status': string;
      'by-date': string;
      'by-sync': string;
    };
  };
  employees: {
    key: string;
    value: {
      id: string;
      name: string;
      role: string;
      area: string;
      status: string;
      image: string;
      rating: number;
      hoursWorked: number;
      schedule: any[];
      pin: string;
      phone?: string;
      synced: boolean;
      updated_at: string;
    };
    indexes: {
      'by-role': string;
      'by-sync': string;
    };
  };
  inventory: {
    key: string;
    value: {
      id: string;
      name: string;
      category: string;
      quantity: number;
      unit: string;
      costPerUnit: number;
      maxStock: number;
      minStock: number;
      supplier: string;
      lastRestock: string;
      synced: boolean;
      updated_at: string;
    };
    indexes: {
      'by-category': string;
      'by-sync': string;
    };
  };
  expenses: {
    key: string;
    value: {
      id: string;
      description: string;
      amount: number;
      category: string;
      date: string;
      user: string;
      synced: boolean;
      updated_at: string;
    };
    indexes: {
      'by-date': string;
      'by-sync': string;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      data: any;
      updated_at: string;
    };
  };
  sync_queue: {
    key: number;
    value: SyncOperation;
    indexes: {
      'by-status': string;
    };
  };
  supplier_orders: {
    key: string;
    value: {
      id: string;
      supplier: string;
      date: string;
      status: string;
      items: any[];
      totalCost: number;
      businessId: string;
      synced: boolean;
      updated_at: string;
    };
    indexes: {
      'by-status': string;
      'by-sync': string;
    };
  };
  tables: {
    key: string;
    value: {
      id: string;
      name: string;
      seats: number;
      status: string;
      x: number;
      y: number;
      businessId: string;
      locationId?: string;
      synced: boolean;
      updated_at: string;
    };
    indexes: {
        'by-sync': string;
        'by-business': string;
    };
  };
}

// ─── Database Instance ────────────────────────────────────────
const DB_NAME = 'culinex-pos';
const DB_VERSION = 2; // Increased from 1 to 2

let dbInstance: IDBPDatabase<CulinexDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<CulinexDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<CulinexDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('by-category', 'category');
        productStore.createIndex('by-sync', 'synced');
      }

      // Orders store
      if (!db.objectStoreNames.contains('orders')) {
        const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
        orderStore.createIndex('by-status', 'status');
        orderStore.createIndex('by-date', 'updated_at');
        orderStore.createIndex('by-sync', 'synced');
      }

      // Employees store
      if (!db.objectStoreNames.contains('employees')) {
        const empStore = db.createObjectStore('employees', { keyPath: 'id' });
        empStore.createIndex('by-role', 'role');
        empStore.createIndex('by-sync', 'synced');
      }

      // Inventory store
      if (!db.objectStoreNames.contains('inventory')) {
        const invStore = db.createObjectStore('inventory', { keyPath: 'id' });
        invStore.createIndex('by-category', 'category');
        invStore.createIndex('by-sync', 'synced');
      }

      // Expenses store
      if (!db.objectStoreNames.contains('expenses')) {
        const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
        expStore.createIndex('by-date', 'date');
        expStore.createIndex('by-sync', 'synced');
      }

      // Settings store (key-value)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Supplier Orders store
      if (!db.objectStoreNames.contains('supplier_orders')) {
        const supStore = db.createObjectStore('supplier_orders', { keyPath: 'id' });
        supStore.createIndex('by-status', 'status');
        supStore.createIndex('by-sync', 'synced');
      }

      // Tables store
      if (!db.objectStoreNames.contains('tables')) {
        const tableStore = db.createObjectStore('tables', { keyPath: 'id' });
        tableStore.createIndex('by-sync', 'synced');
        tableStore.createIndex('by-business', 'businessId');
      }

      // Sync queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('by-status', 'status');
      }
    },
  });

  return dbInstance;
}

// ─── Generic CRUD Helpers ─────────────────────────────────────

type StoreName = 'products' | 'orders' | 'employees' | 'inventory' | 'expenses' | 'supplier_orders' | 'tables';

export async function getAll<T extends StoreName>(store: T): Promise<CulinexDB[T]['value'][]> {
  const db = await getDB();
  return db.getAll(store);
}

export async function getById<T extends StoreName>(store: T, id: string): Promise<CulinexDB[T]['value'] | undefined> {
  const db = await getDB();
  return db.get(store, id);
}

export async function put<T extends StoreName>(store: T, value: CulinexDB[T]['value']): Promise<string> {
  const db = await getDB();
  return db.put(store, value);
}

export async function deleteRecord<T extends StoreName>(store: T, id: string): Promise<void> {
  const db = await getDB();
  return db.delete(store, id);
}

export async function getAllByIndex<T extends StoreName>(
  store: T,
  indexName: string,
  value: any
): Promise<CulinexDB[T]['value'][]> {
  const db = await getDB();
  return db.getAllFromIndex(store, indexName as any, value);
}

// ─── Settings Helpers ─────────────────────────────────────────

export async function getSetting(key: string): Promise<any | undefined> {
  const db = await getDB();
  const record = await db.get('settings', key);
  return record?.data;
}

export async function putSetting(key: string, data: any): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, data, updated_at: new Date().toISOString() });
}

// ─── Sync Queue Helpers ───────────────────────────────────────

export async function enqueueSyncOp(op: Omit<SyncOperation, 'id' | 'status' | 'retries'>): Promise<void> {
  const db = await getDB();
  await db.add('sync_queue', {
    ...op,
    status: 'pending',
    retries: 0,
  } as SyncOperation);
}

export async function getPendingSyncOps(): Promise<SyncOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex('sync_queue', 'by-status', 'pending');
}

export async function updateSyncOp(id: number, updates: Partial<SyncOperation>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('sync_queue', id);
  if (existing) {
    await db.put('sync_queue', { ...existing, ...updates });
  }
}

export async function clearSyncedOps(): Promise<void> {
  const db = await getDB();
  const synced = await db.getAllFromIndex('sync_queue', 'by-status', 'synced');
  const tx = db.transaction('sync_queue', 'readwrite');
  for (const op of synced) {
    if (op.id !== undefined) {
      await tx.store.delete(op.id);
    }
  }
  await tx.done;
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await getDB();
  const pending = await db.getAllFromIndex('sync_queue', 'by-status', 'pending');
  return pending.length;
}

// ─── Multi-Tenant Cache Clear ─────────────────────────────────
// Called when a different business logs in to ensure a clean slate.
export async function clearAllBusinessData(prevBusinessId?: string): Promise<void> {
  const db = await getDB();
  const businessStores: Array<keyof CulinexDB> = [
    'products', 'orders', 'employees', 'inventory',
    'supplier_orders', 'tables', 'menus', 'categories'
  ];

  for (const store of businessStores) {
    try {
      await db.clear(store as any);
      console.log(`[db] Cleared store: ${store}`);
    } catch (err) {
      // Store may not exist depending on schema version — safe to ignore
      console.warn(`[db] Could not clear store ${store}:`, err);
    }
  }

  // Also clear the sync queue so no stale operations are sent
  try {
    await db.clear('sync_queue');
  } catch (_) { /* ignore */ }

  // Clear localStorage keys for the previous business
  if (prevBusinessId) {
    const lsKeyPrefixes = [
      `culinex_menu_${prevBusinessId}`,
      `culinex_expenses_${prevBusinessId}`,
      `culinex_subscription_${prevBusinessId}`,
      `culinex_settings_${prevBusinessId}`,
      `culinex_pos_status_${prevBusinessId}`,
    ];
    lsKeyPrefixes.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[db] Cleared localStorage key: ${key}`);
    });

    // Also scan for any other keys under this businessId
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes(prevBusinessId)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }

  console.log('[db] All business data cleared for new session.');
}
