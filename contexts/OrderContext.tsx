import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Order, OrderStatus } from '../types';

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
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
  // Initial Mock Data to populate Kitchen on load
  const [orders, setOrders] = useState<Order[]>([
     {
        id: '2034',
        tableId: 'Mesa 5',
        items: [
            { id: '1', name: 'Aguachiles Mixto Grande', price: 220, category: 'Aguachiles', image: '', inventoryLevel: 4, quantity: 2 },
            { id: '7', name: 'Tosti Ceviche Verde', price: 160, category: 'Snacks', image: '', inventoryLevel: 3, quantity: 1 }
        ],
        status: OrderStatus.COOKING,
        timestamp: new Date(Date.now() - 1000 * 60 * 12), // 12 mins ago
        total: 600
     },
     {
        id: '2035',
        tableId: 'Mesa 2',
        items: [
             { id: '11', name: 'Coctel de Camarón Grande', price: 220, category: 'Cocteles', image: '', inventoryLevel: 4, quantity: 1 }
        ],
        status: OrderStatus.PENDING,
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
        total: 220
     }
  ]);

  const addOrder = (order: Order) => {
    setOrders((prev) => [...prev, order]);
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  return (
    <OrderContext.Provider value={{ orders, addOrder, updateOrderStatus }}>
      {children}
    </OrderContext.Provider>
  );
};