import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Order, OrderStatus, OrderSource } from '../types';

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
  // Initial Data with Persistence
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('active_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((o: any) => ({ ...o, timestamp: new Date(o.timestamp) }));
      } catch (e) {
        console.error('Error loading orders:', e);
      }
    }
    // Default Mock Data
    return [
      {
        id: '2034',
        tableId: 'T5',
        items: [
          { id: '1', name: 'Aguachiles Mixto Grande', price: 220, category: 'Aguachiles', image: '', inventoryLevel: 4, quantity: 2 },
          { id: '7', name: 'Tosti Ceviche Verde', price: 160, category: 'Snacks', image: '', inventoryLevel: 3, quantity: 1 }
        ],
        status: OrderStatus.COOKING,
        timestamp: new Date(Date.now() - 1000 * 60 * 12),
        total: 600,
        waiterName: 'Maria G.'
      },
      {
        id: '2035',
        tableId: 'T2',
        items: [
          { id: '11', name: 'Coctel de Camarón Grande', price: 220, category: 'Cocteles', image: '', inventoryLevel: 4, quantity: 1 }
        ],
        status: OrderStatus.PENDING,
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        total: 220,
        waiterName: 'Carlos R.'
      }
      // Reduced mock data for brevity in code but keeping the structure
    ];
  });

  useEffect(() => {
    localStorage.setItem('active_orders', JSON.stringify(orders));
  }, [orders]);

  const addOrder = (order: Order) => {
    setOrders((prev) => [...prev, order]);
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, updatedOrder?: Order) => {
    setOrders((prev) => prev.map(o => o.id === orderId ? (updatedOrder ? { ...updatedOrder, status } : { ...o, status }) : o));
  };

  return (
    <OrderContext.Provider value={{ orders, addOrder, updateOrderStatus }}>
      {children}
    </OrderContext.Provider>
  );
};