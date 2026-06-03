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

/* ─── Business tier (commercial modality, distinct from equipment plan) ──── */
export type BusinessTier = 'esencial' | 'profesional' | 'prestige' | 'enterprise';

export interface PlanLimits {
  maxTables: number;
  maxEmployees: number;
  maxProducts: number;
  maxLocations: number;
  maxConcurrentTerminals: number;
  cfdiStampsPerMonth: number;
  branding: 'shared' | 'cobranded' | 'whitelabel';
  slaUptime: number; // 0.99, 0.993, 0.995, 0.999
}

export const TIER_LIMITS: Record<BusinessTier, PlanLimits> = {
  esencial:    { maxTables: 8,        maxEmployees: 5,   maxProducts: 200,        maxLocations: 1,    maxConcurrentTerminals: 1,    cfdiStampsPerMonth: 50,    branding: 'shared',     slaUptime: 0.990 },
  profesional: { maxTables: 50,       maxEmployees: 20,  maxProducts: 1000,       maxLocations: 1,    maxConcurrentTerminals: 5,    cfdiStampsPerMonth: 200,   branding: 'shared',     slaUptime: 0.993 },
  prestige:    { maxTables: 999,      maxEmployees: 50,  maxProducts: 999999,     maxLocations: 5,    maxConcurrentTerminals: 12,   cfdiStampsPerMonth: 1000,  branding: 'cobranded',  slaUptime: 0.995 },
  enterprise:  { maxTables: 999999,   maxEmployees: 999, maxProducts: 999999,     maxLocations: 999,  maxConcurrentTerminals: 999,  cfdiStampsPerMonth: 999999, branding: 'whitelabel', slaUptime: 0.999 },
};

export const TIER_PRICING: Record<BusinessTier, { monthly: number; yearly: number; label: string }> = {
  esencial:    { monthly: 549,   yearly: 5490,  label: 'Esencial' },
  profesional: { monthly: 899,   yearly: 8990,  label: 'Profesional' },
  prestige:    { monthly: 2499,  yearly: 24990, label: 'Prestige' },
  enterprise:  { monthly: 0,     yearly: 0,     label: 'Enterprise' },
};

interface SubscriptionContextType {
  expiryDate: Date | null;
  daysRemaining: number;
  status: SubscriptionStatus;
  paymentHistory: PaymentRecord[];
  posStatus: PosStatus;
  enabledFeatures: string[];
  isFeatureEnabled: (key: string) => boolean;
  paySubscription: (priceId?: string, planName?: string) => Promise<boolean>;
  payEquipment: (amount: number, planName: string) => Promise<boolean>;
  isExpired: boolean;
  isDebtBlocked: boolean; // New: Block for hardware debt
  /** True when past expiry but within the 5-day grace window. */
  isInGracePeriod: boolean;
  /** How many grace days the operator still has before full lock (0-5). */
  gracePeriodDaysLeft: number;
  /** How many days past the expiry date (0 when not yet expired). */
  daysPastExpiry: number;
  saasStatus: 'ACTIVE' | 'WARNING' | 'SUSPENDED' | 'DEBT_BLOCKED';
  refreshFeatures: () => Promise<void>;
  extendSubscription: (days: number) => Promise<boolean>;
  membershipPrice: number;
  updateMembershipPrice: (price: number) => Promise<void>;
  /** Current business tier (modality). */
  tier: BusinessTier;
  /** Hard limits for the current tier. */
  planLimits: PlanLimits;
  /** Returns true if `currentValue` is within the limit for `key`. */
  isWithinLimit: (key: keyof PlanLimits, currentValue: number) => boolean;
  /** Whether tier feature is allowed at or above `requiredTier`. */
  meetsTier: (requiredTier: BusinessTier) => boolean;
}

const TIER_RANK: Record<BusinessTier, number> = {
  esencial: 0, profesional: 1, prestige: 2, enterprise: 3,
};

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
  const [membershipPrice, setMembershipPrice] = useState(899);
  const [demoUntil, setDemoUntil] = useState<Date | null>(null);
  const [tier, setTier] = useState<BusinessTier>('esencial');

  // Fetch Global Config (Price)
  const fetchGlobalConfig = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'membership_monthly_price').single();
      if (data) setMembershipPrice(Number(data.value));
    } catch (e) {
      console.log('Using default price (app_config table may not exist yet)');
    }
  };

  useEffect(() => {
    fetchGlobalConfig();
  }, []);

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
        .select('subscription_expiry, equipment_total_debt, equipment_balance, plan, custom_price, demo_until, business_tier')
        .eq('id', authProfile.businessId)
        .single();

      if (bError) throw bError;

      // Derive commercial tier (modality). Column may not exist in older DBs.
      const rawTier = (bizData as any)?.business_tier as string | null | undefined;
      const validTier: BusinessTier =
        rawTier === 'profesional' || rawTier === 'prestige' || rawTier === 'enterprise'
          ? rawTier
          : 'esencial';
      setTier(validTier);

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
        // Actualizar precio basado en si es personalizado o global
        if (bizData.custom_price) {
            setMembershipPrice(bizData.custom_price);
        } else {
            await fetchGlobalConfig();
        }

        const expiry = bizData.subscription_expiry ? new Date(bizData.subscription_expiry) : null;
        setExpiryDate(expiry);
        
        // Demo Logic
        const dUntil = bizData.demo_until ? new Date(bizData.demo_until) : null;
        setDemoUntil(dUntil);

        const newPosStatus: PosStatus = {
          plan: bizData.plan as any,
          totalAmount: bizData.equipment_total_debt || 0,
          amountPaid: bizData.equipment_balance || 0,
          isFullyPaid: (bizData.equipment_balance || 0) >= (bizData.equipment_total_debt || 0) && (bizData.equipment_total_debt || 0) > 0
        };
        setPosStatus(newPosStatus);

        // Cache for offline
        saveData(expiry || new Date(), history, newPosStatus, demoUntil);
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
      const { expiry, history, posStatus: savedPos, demoUntil: savedDemo } = JSON.parse(saved);
      setExpiryDate(new Date(expiry));
      setPaymentHistory(history || []);
      if (savedPos) setPosStatus(savedPos);
      if (savedDemo) setDemoUntil(new Date(savedDemo));
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
        const { expiry, history, posStatus: savedPos, demoUntil: savedDemo } = JSON.parse(saved);
        setExpiryDate(new Date(expiry));
        setPaymentHistory(history || []);
        if (savedPos) setPosStatus(savedPos);
        if (savedDemo) setDemoUntil(new Date(savedDemo));
      } catch (e) {
        console.error('Error parsing subscription data:', e);
        initializeDefault();
      }
    } else {
      initializeDefault();
    }
  }, [authProfile?.businessId]);

  const initializeDefault = () => {
    // Default to expired/today to force sync with Supabase before granting access
    const today = new Date();
    setExpiryDate(today);
    const initialPos = { plan: null, totalAmount: 5000, amountPaid: 0, isFullyPaid: false };
    setPosStatus(initialPos);
    
    if (authProfile?.businessId) {
        const key = `culinex_subscription_${authProfile.businessId}`;
        localStorage.setItem(key, JSON.stringify({
            expiry: today.toISOString(),
            history: [],
            posStatus: initialPos
        }));
    }
  };

  const saveData = (expiry: Date, history: PaymentRecord[], pos: PosStatus, demoUntil?: Date | null) => {
    if (!authProfile?.businessId) return;
    const key = `culinex_subscription_${authProfile.businessId}`;
    localStorage.setItem(key, JSON.stringify({
      expiry: expiry.toISOString(),
      history,
      posStatus: pos,
      demoUntil: demoUntil?.toISOString()
    }));
  };

  const isFeatureEnabled = (key: string) => {
    if (isSuperAdmin) return true; // Super Admins see everything
    return enabledFeatures.includes(key);
  };

  const paySubscription = async (priceId?: string, planName: string = 'ServiRest — Renovación mensual') => {
    if (!authProfile?.businessId) return false;
    
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: authProfile.businessId,
          businessName: authProfile.full_name,
          amount: membershipPrice,
          priceId: priceId,
          mode: priceId ? 'subscription' : 'payment',
          type: 'SUBSCRIPTION',
          planName: planName
        }),
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);
      
      // Redirect to Stripe
      window.location.href = url;
      return true;
    } catch (err) {
      console.error('Stripe Error:', err);
      alert('Error al conectar con la pasarela de pagos.');
      return false;
    }
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

  // ─── EXPIRY LOGIC ────────────────────────────────────────────────────
  // We give the operator a 5-day grace period after subscription_expiry to
  // settle late payments without losing access. The screen shows reminders
  // every day during grace. Only after day 6 the app is fully locked.
  const GRACE_DAYS = 5;
  const WARNING_DAYS = 5; // start warning 5 days BEFORE expiry too

  // diffTime can be negative (already past expiry); we use raw diff to detect
  // how many days into grace we are.
  const rawDiffTime = expiryDate ? expiryDate.getTime() - now.getTime() : 0;
  const rawDaysRemaining = Math.ceil(rawDiffTime / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, rawDaysRemaining); // for backwards compat

  // Past expiry, but within grace window → operator can still operate, with
  // banner reminder each render of how many grace days are left.
  const daysPastExpiry = rawDaysRemaining < 0 ? Math.abs(rawDaysRemaining) : 0;
  const isInGracePeriod = rawDaysRemaining < 0
    && daysPastExpiry <= GRACE_DAYS
    && posStatus.plan !== 'demo';
  const gracePeriodDaysLeft = Math.max(0, GRACE_DAYS - daysPastExpiry);

  // Fully expired = past expiry AND past the grace window.
  const isExpired = rawDaysRemaining < 0
    && daysPastExpiry > GRACE_DAYS
    && posStatus.plan !== 'demo';

  // New SaaS Hardening Logic: Block if debt exceeds 2500 (threshold) or plan is active but unpaid
  const isDebtBlocked = posStatus.plan !== null &&
                       posStatus.plan !== 'demo' &&
                       !posStatus.isFullyPaid &&
                       (posStatus.totalAmount - posStatus.amountPaid > 2500);

  // Demo Status Logic
  const isDemoActive = posStatus.plan === 'demo';
  const isDemoExpired = isDemoActive && demoUntil && now > demoUntil;

  const saasStatus = isDemoExpired
    ? 'SUSPENDED'
    : isDemoActive
      ? 'ACTIVE'
      : isExpired
        ? 'SUSPENDED'
        : isDebtBlocked
          ? 'DEBT_BLOCKED'
          : isInGracePeriod
            ? 'WARNING'
            : daysRemaining <= WARNING_DAYS
              ? 'WARNING'
              : 'ACTIVE';

  const status = isDemoExpired
    ? SubscriptionStatus.DEMO_EXPIRED
    : isDemoActive
      ? SubscriptionStatus.DEMO
      : isExpired
        ? SubscriptionStatus.EXPIRED
        : isDebtBlocked
          ? SubscriptionStatus.DEBT_BLOCKED
          : isInGracePeriod
            ? SubscriptionStatus.WARNING
            : daysRemaining <= WARNING_DAYS
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
      isInGracePeriod,
      gracePeriodDaysLeft,
      daysPastExpiry,
      saasStatus,
      refreshFeatures: fetchSubscriptionData,
      extendSubscription,
      membershipPrice,
      updateMembershipPrice: async (price: number) => {
        const supabase = getSupabase();
        if (!supabase) return;
        await supabase.from('app_config').upsert({ key: 'membership_monthly_price', value: price.toString() }, { onConflict: 'key' });
        setMembershipPrice(price);
      },
      tier,
      planLimits: TIER_LIMITS[tier],
      isWithinLimit: (key, currentValue) => currentValue <= TIER_LIMITS[tier][key as keyof PlanLimits] as unknown as number,
      meetsTier: (requiredTier) => TIER_RANK[tier] >= TIER_RANK[requiredTier],
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
