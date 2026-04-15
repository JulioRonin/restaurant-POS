import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SubscriptionStatus, PaymentRecord } from '../types';
import { getSupabase } from '../services/auth';
import { useUser } from './UserContext';

export interface PosStatus {
  plan: 'CONTADO' | '3_MESES' | '6_MESES' | '8_MESES' | null;
  totalAmount: number;
  amountPaid: number;
  isFullyPaid: boolean;
}

interface SubscriptionContextType {
  expiryDate: Date | null;
  daysRemaining: number;
  status: SubscriptionStatus;
  paymentHistory: PaymentRecord[];
  posStatus: PosStatus;
  enabledFeatures: string[];
  isFeatureEnabled: (key: string) => boolean;
  paySubscription: () => Promise<boolean>;
  payEquipment: (amount: number, planName: string) => Promise<boolean>;
  isExpired: boolean;
  isDebtBlocked: boolean; // New: Block for hardware debt
  saasStatus: 'ACTIVE' | 'WARNING' | 'SUSPENDED' | 'DEBT_BLOCKED';
  refreshFeatures: () => Promise<void>;
  extendSubscription: (days: number) => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authProfile, isSuperAdmin } = useUser();
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [posStatus, setPosStatus] = useState<PosStatus>({
    plan: null,
    totalAmount: 5000,
    amountPaid: 0,
    isFullyPaid: false
  });

  const fetchSubscriptionData = async () => {
    if (!authProfile?.businessId) return;
    
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // 1. Fetch Features
      const { data: featureData, error: fError } = await supabase
        .from('business_features')
        .select('enabled, features(key)')
        .eq('business_id', authProfile.businessId);

      if (!fError) {
        const activeKeys = featureData
          .filter((bf: any) => bf.enabled)
          .map((bf: any) => bf.features?.key)
          .filter(Boolean);
        console.log('[SubscriptionContext] Active Features:', activeKeys);
        setEnabledFeatures(activeKeys);
      }

      // 2. Fetch Subscription & Debt Status
      const { data: bizData, error: bError } = await supabase
        .from('businesses')
        .select('subscription_expiry, equipment_total_debt, equipment_balance, plan')
        .eq('id', authProfile.businessId)
        .single();

      if (bError) throw bError;

      // 3. Fetch Payment History
      const { data: historyData, error: hError } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('business_id', authProfile.businessId)
        .order('created_at', { ascending: false })
        .limit(10);

      const history: PaymentRecord[] = (historyData || []).map(p => ({
        id: p.id,
        date: p.created_at,
        amount: p.amount,
        method: p.method === 'stripe' ? 'Stripe Checkout' : p.method,
        transactionId: p.stripe_link || p.id.split('-')[0].toUpperCase()
      }));

      setPaymentHistory(history);

      if (bizData) {
        const expiry = bizData.subscription_expiry ? new Date(bizData.subscription_expiry) : null;
        setExpiryDate(expiry);
        
        const newPosStatus: PosStatus = {
          plan: bizData.plan as any,
          totalAmount: bizData.equipment_total_debt || 0,
          amountPaid: bizData.equipment_balance || 0,
          isFullyPaid: (bizData.equipment_balance || 0) >= (bizData.equipment_total_debt || 0) && (bizData.equipment_total_debt || 0) > 0
        };
        setPosStatus(newPosStatus);

        // Cache for offline
        saveData(expiry || new Date(), history, newPosStatus);
      }
    } catch (err) {
      console.error('[SubscriptionContext] Sync Error:', err);
      // Fallback to local on error
      loadFromLocal();
    }
  };

  const loadFromLocal = () => {
    if (!authProfile?.businessId) return;
    const key = `culinex_subscription_${authProfile.businessId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const { expiry, history, posStatus: savedPos } = JSON.parse(saved);
      setExpiryDate(new Date(expiry));
      setPaymentHistory(history || []);
      if (savedPos) setPosStatus(savedPos);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchSubscriptionData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authProfile?.businessId]);

  // Load basic subscription info from LocalStorage
  useEffect(() => {
    if (!authProfile?.businessId) return;
    
    const key = `culinex_subscription_${authProfile.businessId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const { expiry, history, posStatus: savedPos } = JSON.parse(saved);
        setExpiryDate(new Date(expiry));
        setPaymentHistory(history || []);
        if (savedPos) setPosStatus(savedPos);
      } catch (e) {
        console.error('Error parsing subscription data:', e);
        initializeDefault();
      }
    } else {
      initializeDefault();
    }
  }, [authProfile?.businessId]);

  const initializeDefault = () => {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    setExpiryDate(nextMonth);
    const initialPos = { plan: null, totalAmount: 5000, amountPaid: 0, isFullyPaid: false };
    setPosStatus(initialPos);
    
    if (authProfile?.businessId) {
        const key = `culinex_subscription_${authProfile.businessId}`;
        localStorage.setItem(key, JSON.stringify({
            expiry: nextMonth.toISOString(),
            history: [],
            posStatus: initialPos
        }));
    }
  };

  const saveData = (expiry: Date, history: PaymentRecord[], pos: PosStatus) => {
    if (!authProfile?.businessId) return;
    const key = `culinex_subscription_${authProfile.businessId}`;
    localStorage.setItem(key, JSON.stringify({
      expiry: expiry.toISOString(),
      history,
      posStatus: pos
    }));
  };

  const isFeatureEnabled = (key: string) => {
    if (isSuperAdmin) return true; // Super Admins see everything
    return enabledFeatures.includes(key);
  };

  const paySubscription = async () => {
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
        
        const newRecord: PaymentRecord = {
          id: `PAY-${Date.now()}`,
          date: new Date().toISOString(),
          amount: 850,
          method: 'Tarjeta de Crédito',
          transactionId: `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        };

        const updatedHistory = [newRecord, ...paymentHistory];
        setExpiryDate(newExpiry);
        setPaymentHistory(updatedHistory);
        saveData(newExpiry, updatedHistory, posStatus);
        resolve(true);
      }, 2000);
    });
  };

  const payEquipment = async (amount: number, planName: string) => {
    if (!authProfile?.businessId) return false;
    
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      // 1. Record payment in DB
      const { error: paymentError } = await supabase
        .from('subscription_payments')
        .insert({
          business_id: authProfile.businessId,
          amount: amount,
          method: 'stripe',
          status: 'PAID',
          payment_type: 'EQUIPMENT',
          period_start: new Date().toISOString(),
          period_end: new Date().toISOString()
        });

      if (paymentError) throw paymentError;

      // 2. Update business equipment balance
      const newAmountPaid = posStatus.amountPaid + amount;
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ 
          equipment_balance: newAmountPaid 
        })
        .eq('id', authProfile.businessId);

      if (updateError) throw updateError;

      // 3. Update local state
      const newRecord: PaymentRecord = {
        id: `EQU-${Date.now()}`,
        date: new Date().toISOString(),
        amount: amount,
        method: 'Stripe Checkout',
        transactionId: `EQU-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        type: 'EQUIPMENT'
      };

      const updatedHistory = [newRecord, ...paymentHistory];
      const newPosStatus: PosStatus = {
        plan: (posStatus.plan || planName) as any,
        totalAmount: posStatus.totalAmount,
        amountPaid: newAmountPaid,
        isFullyPaid: newAmountPaid >= posStatus.totalAmount
      };

      setPosStatus(newPosStatus);
      setPaymentHistory(updatedHistory);
      saveData(expiryDate || new Date(), updatedHistory, newPosStatus);
      
      await fetchSubscriptionData();
      return true;
    } catch (err) {
      console.error('[SubscriptionContext] Error paying equipment:', err);
      return false;
    }
  };

  const now = new Date();
  const diffTime = expiryDate ? expiryDate.getTime() - now.getTime() : 0;
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  const isExpired = daysRemaining <= 0;
  
  // New SaaS Hardening Logic: Block if debt exceeds 2500 (threshold) or plan is active but unpaid
  const isDebtBlocked = posStatus.plan !== null && 
                       !posStatus.isFullyPaid && 
                       (posStatus.totalAmount - posStatus.amountPaid > 2500); 

  const saasStatus = isExpired 
    ? 'SUSPENDED' 
    : isDebtBlocked
      ? 'DEBT_BLOCKED'
      : daysRemaining <= 3 
        ? 'WARNING' 
        : 'ACTIVE';

  const status = isExpired 
    ? SubscriptionStatus.EXPIRED 
    : isDebtBlocked
      ? SubscriptionStatus.DEBT_BLOCKED
      : daysRemaining <= 3 
        ? SubscriptionStatus.WARNING 
        : SubscriptionStatus.ACTIVE;

  const extendSubscription = async (days: number) => {
    console.log('[SubscriptionContext] Starting manual extension for Business:', authProfile?.businessId);
    
    if (!authProfile?.businessId) {
      const errorMsg = 'No se encontró un ID de Negocio vinculado a tu sesión.';
      console.error('[SubscriptionContext]', errorMsg);
      throw new Error(errorMsg);
    }
    
    const supabase = getSupabase();
    if (!supabase) throw new Error('Conexión con Supabase no disponible.');

    try {
      // 1. Calculate new expiry
      const baseDate = isExpired ? new Date() : (expiryDate || new Date());
      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + days);

      console.log('[SubscriptionContext] Registering payment in DB...');
      
      // 2. Insert payment record (Audit Trail)
      const { error: paymentError } = await supabase
        .from('subscription_payments')
        .insert({
          business_id: authProfile.businessId,
          amount: 850,
          method: 'stripe',
          status: 'PAID',
          payment_type: 'SUBSCRIPTION',
          period_start: baseDate.toISOString(),
          period_end: newExpiry.toISOString()
        });

      if (paymentError) {
        console.error('[SubscriptionContext] Error recording payment:', paymentError);
        // Alert the user but continue trying to extendaccess
      }
      
      console.log('[SubscriptionContext] Updating business expiry to:', newExpiry.toISOString());

      // 3. Update business expiry
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ 
          subscription_expiry: newExpiry.toISOString(),
          saas_status: 'ACTIVE'
        })
        .eq('id', authProfile.businessId);

      if (updateError) {
        console.error('[SubscriptionContext] Stripe Update Error:', updateError);
        throw new Error(`Supabase Error: ${updateError.message} (${updateError.code})`);
      }
      
      console.log('[SubscriptionContext] Extension successful. Refreshing metadata...');
      
      // 4. Force state refresh
      await fetchSubscriptionData();
      return true;
    } catch (err: any) {
      console.error('[SubscriptionContext] Fatal Error in extendSubscription:', err);
      throw err;
    }
  };

  return (
    <SubscriptionContext.Provider value={{ 
      expiryDate, 
      daysRemaining, 
      status, 
      paymentHistory,
      posStatus,
      enabledFeatures,
      isFeatureEnabled,
      paySubscription,
      payEquipment,
      isExpired,
      isDebtBlocked,
      saasStatus,
      refreshFeatures: fetchSubscriptionData,
      extendSubscription
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
