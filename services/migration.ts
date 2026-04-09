import { getDB, putSetting } from './db';

const MIGRATION_FLAG = 'culinex_idb_migrated';

/**
 * One-time migration from localStorage to IndexedDB.
 * Reads all known localStorage keys used by the app contexts
 * and writes them into the corresponding IndexedDB object stores.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  // Check if already migrated
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
    return;
  }

  console.log('[Migration] Starting localStorage → IndexedDB migration...');
  const db = await getDB();
  const now = new Date().toISOString();

  // ─── Migrate Menu Items (products) ──────────────────────────
  try {
    const menuRaw = localStorage.getItem('culinex_menu');
    if (menuRaw) {
      const items = JSON.parse(menuRaw);
      const tx = db.transaction('products', 'readwrite');
      for (const item of items) {
        await tx.store.put({
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category,
          image: item.image || '',
          inventoryLevel: item.inventoryLevel ?? 4,
          description: item.description || '',
          status: item.status || 'ACTIVE',
          gramaje: item.gramaje || '',
          synced: false,
          updated_at: now,
        });
      }
      await tx.done;
      console.log(`[Migration] Migrated ${items.length} menu items`);
    }
  } catch (e) {
    console.error('[Migration] Error migrating menu items:', e);
  }

  // ─── Migrate Orders ─────────────────────────────────────────
  try {
    const ordersRaw = localStorage.getItem('active_orders');
    if (ordersRaw) {
      const orders = JSON.parse(ordersRaw);
      const tx = db.transaction('orders', 'readwrite');
      for (const order of orders) {
        await tx.store.put({
          id: order.id,
          tableId: order.tableId,
          items: order.items,
          status: order.status,
          timestamp: order.timestamp,
          total: order.total,
          waiterName: order.waiterName,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          source: order.source,
          tip: order.tip,
          splitType: order.splitType,
          invoiceDetails: order.invoiceDetails,
          receivedAmount: order.receivedAmount,
          changeAmount: order.changeAmount,
          paidSplits: order.paidSplits,
          synced: false,
          updated_at: now,
        });
      }
      await tx.done;
      console.log(`[Migration] Migrated ${orders.length} orders`);
    }
  } catch (e) {
    console.error('[Migration] Error migrating orders:', e);
  }

  // ─── Migrate Users/Employees ────────────────────────────────
  try {
    const usersRaw = localStorage.getItem('culinex_users');
    if (usersRaw) {
      const users = JSON.parse(usersRaw);
      const tx = db.transaction('employees', 'readwrite');
      for (const user of users) {
        await tx.store.put({
          id: user.id,
          name: user.name,
          role: user.role,
          area: user.area || 'Service',
          status: user.status || 'ON_SHIFT',
          image: user.image || '',
          rating: user.rating ?? 5,
          hoursWorked: user.hoursWorked ?? 0,
          schedule: user.schedule || [],
          pin: user.pin || '1111',
          phone: user.phone,
          synced: false,
          updated_at: now,
        });
      }
      await tx.done;
      console.log(`[Migration] Migrated ${users.length} employees`);
    }
  } catch (e) {
    console.error('[Migration] Error migrating employees:', e);
  }

  // ─── Migrate Expenses ───────────────────────────────────────
  try {
    const expRaw = localStorage.getItem('culinex_expenses');
    if (expRaw) {
      const expenses = JSON.parse(expRaw);
      const tx = db.transaction('expenses', 'readwrite');
      for (const exp of expenses) {
        await tx.store.put({
          id: exp.id,
          description: exp.description,
          amount: exp.amount,
          category: exp.category,
          date: exp.date,
          user: exp.user,
          synced: false,
          updated_at: now,
        });
      }
      await tx.done;
      console.log(`[Migration] Migrated ${expenses.length} expenses`);
    }
  } catch (e) {
    console.error('[Migration] Error migrating expenses:', e);
  }

  // ─── Migrate Settings ──────────────────────────────────────
  try {
    const settingsRaw = localStorage.getItem('culinex_settings');
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      await putSetting('business_settings', settings);
      console.log('[Migration] Migrated business settings');
    }
  } catch (e) {
    console.error('[Migration] Error migrating settings:', e);
  }

  // ─── Migrate Subscription ──────────────────────────────────
  try {
    const subRaw = localStorage.getItem('culinex_subscription');
    if (subRaw) {
      const sub = JSON.parse(subRaw);
      await putSetting('subscription', sub);
      console.log('[Migration] Migrated subscription data');
    }
  } catch (e) {
    console.error('[Migration] Error migrating subscription:', e);
  }

  // Mark migration as complete
  localStorage.setItem(MIGRATION_FLAG, 'true');
  console.log('[Migration] ✅ Migration complete!');
}
