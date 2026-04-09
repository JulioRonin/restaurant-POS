import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabase() {
  if (!supabase) {
    const url = (import.meta as any).env?.VITE_SUPABASE_URL || (window as any).env?.VITE_SUPABASE_URL || '';
    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (window as any).env?.VITE_SUPABASE_ANON_KEY || '';
    
    if (url && anonKey) {
      supabase = createClient(url, anonKey);
    }
  }
  return supabase;
}

export interface AuthProfile {
  id: string;
  businessId: string;
  businessName?: string;
  locationId: string | null;
  role: 'super_admin' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
  fullName: string | null;
  onboardingCompleted: boolean;
}

export const authService = {
  async signUp(email: string, password: string, businessName: string, fullName: string) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');
    return await client.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          business_name: businessName,
          full_name: fullName
        }
      }
    });
  },

  async signIn(email: string, password: string) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');
    return await client.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');
    return await client.auth.signOut();
  },

  async getProfile(userId: string): Promise<AuthProfile | null> {
    const client = getSupabase();
    if (!client) return null;
    
    const { data, error } = await client
      .from('profiles')
      .select('id, business_id, location_id, role, full_name, onboarding_completed, businesses(name)')
      .eq('id', userId)
      .single();
      
    if (error || !data) return null;
    
    return {
      id: data.id,
      businessId: data.business_id,
      businessName: (data.businesses as any)?.name,
      locationId: data.location_id,
      role: data.role,
      fullName: data.full_name,
      onboardingCompleted: !!data.onboarding_completed
    };
  },
  async completeOnboarding(userId: string) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');
    return await client
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', userId);
  },

  async updateBusiness(businessId: string, updates: any) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');
    return await client
      .from('businesses')
      .update(updates)
      .eq('id', businessId);
  },

  async getAllBusinesses() {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client
      .from('businesses')
      .select('id, name')
      .order('name');
    if (error) throw error;
    return data || [];
  }
};
