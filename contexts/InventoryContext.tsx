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
      const [invData, orderData] = await Promise.all([
        getAll('inventory'),
        getAll('supplier_orders')
      ]);

      const filteredInv = (invData as any[]).filter(i => (i.businessId || i.business_id) === authProfile.businessId);
      const filteredOrders = (orderData as any[]).filter(o => (o.businessId || o.business_id) === authProfile.businessId);

      setInventory(filteredInv as InventoryItem[]);
      setOrders(filteredOrders as SupplierOrder[]);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load inventory:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = onSyncComplete(loadData);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [authProfile?.businessId]);

  const addInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    if (!authProfile?.businessId) return;
    const id = crypto.randomUUID();
    const newItem = { ...item, id, businessId: authProfile.businessId, synced: false, updated_at: new Date().toISOString() };
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
