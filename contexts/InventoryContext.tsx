import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAll, put, deleteRecord } from '../services/db';
import { trackChange, onSyncComplete } from '../services/SyncService';
import { useUser } from './UserContext';
import { InventoryItem, SupplierOrder, SupplyOrderStatus } from '../types';

interface InventoryContextType {
  inventory: InventoryItem[];
  orders: SupplierOrder[];
  loading: boolean;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  createSupplierOrder: (order: Omit<SupplierOrder, 'id'>) => Promise<void>;
  updateSupplierOrder: (id: string, updates: Partial<SupplierOrder>) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authProfile } = useUser();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!authProfile?.businessId) {
      setInventory([]);
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      if (!authProfile?.businessId) {
        setInventory([]);
        setOrders([]);
        setLoading(false);
        return;
      }

      const [invData, orderData, menuData] = await Promise.all([
        getAll('inventory'),
        getAll('supplier_orders'),
        getAll('products')
      ]);

      const filteredInv = (invData as any[]).filter(i => (i.businessId || i.business_id) === authProfile.businessId);
      const filteredOrders = (orderData as any[]).filter(o => (o.businessId || o.business_id) === authProfile.businessId);
      
      // Combine with Menu Items and DEDUPLICATE by name
      const combinedMap = new Map<string, any>();

      // First, add all Menu Items as base
      (menuData as any[])
        .filter(m => (m.businessId || m.business_id) === authProfile.businessId)
        .forEach(m => {
          combinedMap.set(m.name.toLowerCase(), {
            ...m,
            quantity: m.inventoryLevel || 0,
            unit: 'Pza',
            costPerUnit: (m.price || 0) / 1.3,
            isFromMenu: true
          });
        });

      // Then, merge with Inventory records
      filteredInv.forEach(item => {
        const key = item.name.toLowerCase();
        if (combinedMap.has(key)) {
          const existing = combinedMap.get(key);
          combinedMap.set(key, {
            ...existing,
            quantity: (existing.quantity || 0) + (item.quantity || 0),
            // Prefer the item ID if it was originally an inventory item
            id: existing.isFromMenu ? existing.id : item.id 
          });
        } else {
          combinedMap.set(key, item);
        }
      });

      setInventory(Array.from(combinedMap.values()));
      setOrders(filteredOrders as SupplierOrder[]);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load inventory:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Auto-refresh when sync finishes
    const unsubscribe = onSyncComplete(() => {
      console.log('[InventoryContext] Sync complete - Refreshing inventory');
      loadData();
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [authProfile?.businessId, authProfile?.locationId]);

  const addInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    const bizId = authProfile?.businessId;
    if (!bizId) {
        console.warn('[InventoryContext] Adding item without businessId. It will be synced once profile is ready.');
    }
    
    const id = crypto.randomUUID();
    const newItem = { 
      ...item, 
      id, 
      businessId: bizId || 'pending', 
      locationId: authProfile?.locationId,
      synced: false, 
      updated_at: new Date().toISOString() 
    };
    
    await put('inventory', newItem as any);
    await trackChange('inventory', 'INSERT', id, newItem);
    setInventory(prev => [...prev, newItem as InventoryItem]);
  };

  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    const current = inventory.find(i => i.id === id);
    if (!current) return;
    const updated = { ...current, ...updates, synced: false, updated_at: new Date().toISOString() };
    await put('inventory', updated as any);
    await trackChange('inventory', 'UPDATE', id, updated);
    setInventory(prev => prev.map(i => i.id === id ? updated : i));
  };

  const deleteInventoryItem = async (id: string) => {
    await deleteRecord('inventory', id);
    await trackChange('inventory', 'DELETE', id, {});
    setInventory(prev => prev.filter(i => i.id !== id));
  };

  const createSupplierOrder = async (order: Omit<SupplierOrder, 'id'>) => {
    if (!authProfile?.businessId) return;
    const id = crypto.randomUUID();
    const newOrder = { ...order, id, businessId: authProfile.businessId, synced: false, updated_at: new Date().toISOString() };
    await put('supplier_orders', newOrder as any);
    await trackChange('supplier_orders', 'INSERT', id, newOrder);
    setOrders(prev => [newOrder as SupplierOrder, ...prev]);
  };

  const updateSupplierOrder = async (id: string, updates: Partial<SupplierOrder>) => {
    const current = orders.find(o => o.id === id);
    if (!current) return;
    const updated = { ...current, ...updates, synced: false, updated_at: new Date().toISOString() };
    await put('supplier_orders', updated as any);
    await trackChange('supplier_orders', 'UPDATE', id, updated);
    setOrders(prev => prev.map(o => o.id === id ? updated : o));
  };

  return (
    <InventoryContext.Provider value={{
      inventory,
      orders,
      loading,
      addInventoryItem,
      updateInventoryItem,
      deleteInventoryItem,
      createSupplierOrder,
      updateSupplierOrder
    }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within InventoryProvider');
  return context;
};
