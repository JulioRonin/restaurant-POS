import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './UserContext';
import { Order, OrderStatus, OrderSource } from '../types';
import { getAll, put, deleteRecord } from '../services/db';
import { trackChange, triggerSync, onSyncComplete } from '../services/SyncService';

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus, updatedOrder?: Order) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authProfile } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);

  // Memoized load method for initial load and background syncs
  const loadOrders = React.useCallback(async () => {
    if (!authProfile?.businessId) {
      setOrders([]);
      return;
    }

    // Fast initial load from localStorage
    const key = `culinex_orders_${authProfile.businessId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setOrders(parsed.map((o: any) => ({ ...o, items: o.items || [], timestamp: new Date(o.timestamp) })));
      } catch (e) {
        console.error('Error loading orders:', e);
      }
    }

    // Durable load from IndexedDB
    try {
      const idbOrders = await getAll('orders');
      if (idbOrders.length > 0) {
        // CRITICAL SECURITY: Filter by businessId to prevent cross-tenant leakage
        const myOrders = (idbOrders as any[]).filter(o => 
          (o.business_id === authProfile.businessId || o.businessId === authProfile.businessId)
        );

        setOrders(myOrders.map((o: any) => ({
          ...o,
          items: o.items || [], // PREVENT CRASH from undefined items after Supabase Pull
          timestamp: new Date(o.timestamp),
        })));
      }
    } catch (err) {
      console.error('[OrderContext] Error loading orders from IDB:', err);
    }
  }, [authProfile?.businessId]);

  // Initial data loading and sync listeners
  useEffect(() => {
    loadOrders();

    // Auto-refresh when sync finishes
    const unsubscribe = onSyncComplete(() => {
      console.log('[OrderContext] Sync complete - Refreshing orders');
      loadOrders();
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadOrders]);

  // Persist to localStorage (fast)
  useEffect(() => {
    if (!authProfile?.businessId) return;
    
    const key = `culinex_orders_${authProfile.businessId}`;
    localStorage.setItem(key, JSON.stringify(orders));
  }, [orders, authProfile?.businessId]);

  const addOrder = async (order: Order) => {
    // Ensure order has a unique ID if not provided
    const orderId = order.id || crypto.randomUUID();
    const finalOrder = {
      ...order,
      id: orderId,
      synced: false,
      updated_at: new Date().toISOString()
    };
    
    setOrders((prev) => [...prev, finalOrder]);
    
    // 1. Save and Track Main Order
    await put('orders', finalOrder as any);
    await trackChange('orders', 'INSERT', orderId, finalOrder);

    // 2. Save and Track Individual Order Items
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        const orderItemId = item.id || crypto.randomUUID();
        const orderItemRecord = {
          id: orderItemId,
          orderId: orderId,
          menuItemId: (item as any).menuItemId || item.id,
          quantity: item.quantity,
          priceAtTime: item.price,
          notes: item.notes || '',
          businessId: authProfile?.businessId || '',
          locationId: authProfile?.locationId || '',
          synced: false,
          updated_at: new Date().toISOString()
        };

        await put('order_items', orderItemRecord as any);
        await trackChange('order_items', 'INSERT', orderItemId, orderItemRecord);
      }
    }

    // Trigger immediate sync
    triggerSync().catch(console.error);
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, updatedOrder?: Order) => {
    setOrders((prev) => prev.map(o => o.id === orderId ? (updatedOrder ? { ...updatedOrder, status } : { ...o, status }) : o));
    
    // Track for sync
    trackChange('orders', 'UPDATE', orderId, updatedOrder || { status }).catch(console.error);
  };

  return (
    <OrderContext.Provider value={{ orders, addOrder, updateOrderStatus }}>
      {children}
    </OrderContext.Provider>
  );
};