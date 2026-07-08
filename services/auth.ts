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

/**
 * Sube una imagen (File o data-URL base64) al bucket `menu-photos` de
 * Supabase Storage y devuelve la URL pública. Reemplaza el guardado de
 * base64 en la BD, que se truncaba al sincronizar.
 *
 * Devuelve null si Supabase no está configurado o si la subida falla — en
 * ese caso el caller puede caer al base64 como fallback.
 */
export async function uploadMenuPhoto(
  businessId: string,
  itemId: string,
  input: File | string
): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    // Normaliza a Blob. Si es data-URL base64, la convertimos.
    let blob: Blob;
    let ext = 'png';
    if (typeof input === 'string') {
      if (!input.startsWith('data:')) return input; // ya es una URL http, no hay nada que subir
      const res = await fetch(input);
      blob = await res.blob();
      ext = (blob.type.split('/')[1] || 'png').replace('svg+xml', 'svg');
    } else {
      blob = input;
      ext = (input.type.split('/')[1] || 'png').replace('svg+xml', 'svg');
    }

    // Ruta: {businessId}/{itemId}.{ext} — sobrescribe la foto anterior.
    const path = `${businessId}/${itemId}.${ext}`;
    const { error } = await client.storage
      .from('menu-photos')
      .upload(path, blob, { upsert: true, contentType: blob.type || 'image/png' });
    if (error) {
      console.warn('[uploadMenuPhoto] upload error:', error.message);
      return null;
    }

    const { data } = client.storage.from('menu-photos').getPublicUrl(path);
    // Cache-buster para que el navegador no muestre la foto vieja tras reemplazar.
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (err) {
    console.warn('[uploadMenuPhoto] failed:', err);
    return null;
  }
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
