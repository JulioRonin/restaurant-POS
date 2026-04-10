import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './UserContext';
import { Order, OrderStatus, OrderSource } from '../types';
import { getAll, put, deleteRecord } from '../services/db';
import { trackChange } from '../services/SyncService';

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

  // Initial data from localStorage for instant load, then replace with IndexedDB
  useEffect(() => {
    if (!authProfile?.businessId) return;

    const key = `culinex_orders_${authProfile.businessId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setOrders(parsed.map((o: any) => ({ ...o, timestamp: new Date(o.timestamp) })));
      } catch (e) {
        console.error('Error loading orders:', e);
      }
    } else {
      setOrders([]);
    }

    getAll('orders').then(idbOrders => {
      // Filter orders by business if IndexedDB contains multiple (though it shouldn't if we use business-aware sync)
      // For now, let's just use what's there but the localStorage fix is primary
      if (idbOrders.length > 0) {
        setOrders(idbOrders.map((o: any) => ({
          ...o,
          timestamp: new Date(o.timestamp),
        })));
      }
    }).catch(console.error);
  }, [authProfile?.businessId]);

  // Persist to both localStorage (fast) and IndexedDB (durable)
  useEffect(() => {
    if (!authProfile?.businessId) return;
    
    const key = `culinex_orders_${authProfile.businessId}`;
    localStorage.setItem(key, JSON.stringify(orders));
    
    // Async write to IndexedDB
    const now = new Date().toISOString();
    for (const order of orders) {
      put('orders', {
        ...order,
        timestamp: order.timestamp instanceof Date ? order.timestamp.toISOString() : order.timestamp,
        synced: false,
        updated_at: now,
      } as any).catch(console.error);
    }
  }, [orders, authProfile?.businessId]);

  const addOrder = (order: Order) => {
    // Ensure order has a unique ID if not provided
    const finalOrder = {
      ...order,
      id: order.id || crypto.randomUUID()
    };
    
    setOrders((prev) => [...prev, finalOrder]);
    
    // Track for sync
    trackChange('orders', 'INSERT', finalOrder.id, finalOrder).catch(console.error);
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