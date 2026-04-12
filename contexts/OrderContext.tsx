import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './UserContext';
import { Order, OrderStatus, OrderSource } from '../types';
import { getAll, put, deleteRecord } from '../services/db';
import { trackChange, triggerSync, onSyncComplete } from '../services/SyncService';

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus, updatedOrder?: Order) => void;
  removeOrder: (orderId: string) => Promise<void>;
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
        setOrders(parsed.map((o: any) => ({ ...o, items: o.items || [], timestamp: new Date(o.timestamp || o.created_at || o.createdAt || Date.now()) })));
      } catch (e) {
        console.error('Error loading orders:', e);
      }
    }

    // Durable load from IndexedDB
    try {
      const idbOrders = await getAll('orders');
      const idbOrderItems = await getAll('order_items');
      const idbProducts = await getAll('products');
      
      const allItems = idbOrderItems as any[];
      const allProducts = idbProducts as any[];
      
      if (idbOrders.length > 0) {
        // CRITICAL SECURITY: Filter by businessId to prevent cross-tenant leakage
        const myOrders = (idbOrders as any[]).filter(o => 
          (o.business_id === authProfile.businessId || o.businessId === authProfile.businessId)
        );

        setOrders(myOrders.map((o: any) => {
          let assembledItems = o.items;
          
          // Re-assemble items from relational database if they were wiped by SyncService
          if (!assembledItems || !Array.isArray(assembledItems) || assembledItems.length === 0) {
              assembledItems = allItems
                .filter(item => item.orderId === o.id || item.order_id === o.id)
                .map(item => {
                    const productId = item.menuItemId || item.menu_item_id;
                    const originalProduct = allProducts.find(p => p.id === productId);
                    return {
                        ...item,
                        id: productId, // Match expected frontend format
                        name: originalProduct ? originalProduct.name : 'Platillo (Sincronizado)',
                        price: item.priceAtTime || item.price_at_time || 0,
                        quantity: item.quantity || 1,
                        category: originalProduct ? originalProduct.category : 'Uncategorized'
                    };
                });
          }

          return {
            ...o,
            items: assembledItems || [], // PREVENT CRASH from undefined items after Supabase Pull
            timestamp: new Date(o.timestamp || o.created_at || o.createdAt || Date.now()),
          };
        }));
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

  const updateOrderStatus = async (orderId: string, status: OrderStatus, updatedOrder?: Order) => {
    const existingOrder = orders.find(o => o.id === orderId);
    if (!existingOrder && !updatedOrder) return;

    const finalOrder = {
      ...(updatedOrder || existingOrder!),
      status,
      synced: false,
      updated_at: new Date().toISOString()
    };

    setOrders((prev) => prev.map(o => o.id === orderId ? finalOrder : o));
    
    // Save locally immediately to avoid race conditions with sync
    await put('orders', finalOrder as any);

    // Track for sync
    await trackChange('orders', 'UPDATE', orderId, finalOrder);

    // Trigger immediate sync to inform other terminals
    triggerSync().catch(console.error);
  };

  const removeOrder = async (orderId: string) => {
    try {
      await deleteRecord('orders', orderId);
      // Also delete items (clean up orphans)
      const allItems = await getAll('order_items');
      const orphans = (allItems as any[]).filter(i => (i.order_Id === orderId || i.order_id === orderId));
      for (const item of orphans) {
        await deleteRecord('order_items', item.id);
        await trackChange('order_items', 'DELETE', item.id, {});
      }
      
      await trackChange('orders', 'DELETE', orderId, {});
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      console.error('[OrderContext] Error removing order:', err);
    }
  };

  return (
    <OrderContext.Provider value={{ orders, addOrder, updateOrderStatus, removeOrder }}>
      {children}
    </OrderContext.Provider>
  );
};