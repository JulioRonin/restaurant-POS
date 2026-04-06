import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SubscriptionStatus, PaymentRecord } from '../types';

interface SubscriptionContextType {
  expiryDate: Date | null;
  daysRemaining: number;
  status: SubscriptionStatus;
  paymentHistory: PaymentRecord[];
  paySubscription: () => Promise<boolean>;
  isExpired: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('culinex_subscription');
    if (saved) {
      try {
        const { expiry, history } = JSON.parse(saved);
        setExpiryDate(new Date(expiry));
        setPaymentHistory(history || []);
      } catch (e) {
        console.error('Error parsing subscription data:', e);
        initializeDefault();
      }
    } else {
      initializeDefault();
    }
  }, []);

  const initializeDefault = () => {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    setExpiryDate(nextMonth);
    saveData(nextMonth, []);
  };

  const saveData = (expiry: Date, history: PaymentRecord[]) => {
    localStorage.setItem('culinex_subscription', JSON.stringify({
      expiry: expiry.toISOString(),
      history
    }));
  };

  const paySubscription = async () => {
    // Simulation of a payment handshake
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
        
        const newRecord: PaymentRecord = {
          id: `PAY-${Date.now()}`,
          date: new Date().toISOString(),
          amount: 965,
          method: 'Tarjeta de Crédito',
          transactionId: `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        };

        const updatedHistory = [newRecord, ...paymentHistory];
        setExpiryDate(newExpiry);
        setPaymentHistory(updatedHistory);
        saveData(newExpiry, updatedHistory);
        resolve(true);
      }, 2000);
    });
  };

  // Calculations
  const now = new Date();
  const diffTime = expiryDate ? expiryDate.getTime() - now.getTime() : 0;
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  const isExpired = daysRemaining <= 0;
  const status = isExpired 
    ? SubscriptionStatus.EXPIRED 
    : daysRemaining <= 3 
      ? SubscriptionStatus.WARNING 
      : SubscriptionStatus.ACTIVE;

  return (
    <SubscriptionContext.Provider value={{ 
      expiryDate, 
      daysRemaining, 
      status, 
      paymentHistory, 
      paySubscription,
      isExpired 
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
