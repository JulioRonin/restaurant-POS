import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Employee } from '../types';
import { getAll, put, deleteRecord } from '../services/db';
import { authService, AuthProfile } from '../services/auth';
import { onSyncComplete, triggerSync, trackChange } from '../services/SyncService';

interface UserContextType {
    // SaaS Auth (Main Login)
    authProfile: AuthProfile | null;
    isSuperAdmin: boolean;
    signIn: (email: string, pass: string) => Promise<void>;
    signUp: (email: string, pass: string, businessName: string, fullName: string) => Promise<void>;
    signOut: () => Promise<void>;
    completeOnboarding: () => Promise<void>;
    updateBusiness: (updates: any) => Promise<void>;

    // Staff Switching (Local PIN)
    activeEmployee: Employee | null;
    switchEmployee: (userId: string, pin: string) => boolean;
    clearActiveEmployee: () => void;
    employees: Employee[];
    addEmployee: (user: Omit<Employee, 'id'>) => void;
    updateEmployee: (id: string, updates: Partial<Employee>) => void;
    deleteEmployee: (id: string) => void;
    setEmployeePin: (id: string, pin: string) => Promise<void>;
    refreshEmployees: () => Promise<void>;
    triggerSync: () => void;
    switchBusiness: (businessId: string, businessName?: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // SaaS Auth State
    const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // 0. Refresh Profile Method
    const refreshProfile = async () => {
        const client = (await import('../services/auth')).getSupabase();
        if (!client) return;
        const { data: { session } } = await client.auth.getSession();
        if (session?.user) {
            const profile = await authService.getProfile(session.user.id);
            setAuthProfile(profile);
            const role = profile?.role?.toLowerCase();
            setIsSuperAdmin(role === 'super_admin');
        }
    };

    // Current Staff Member (PIN based)
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
    const isEnsuringAdmin = useRef(false);

    // 1. Initial Auth Check
    useEffect(() => {
        const checkAuth = async () => {
            setIsAuthenticating(true);
            try {
                const client = (await import('../services/auth')).getSupabase();
                if (!client) {
                    setIsAuthenticating(false);
                    return;
                }

                const { data: { session } } = await client.auth.getSession();
                if (session?.user) {
                    const profile = await authService.getProfile(session.user.id);
                    setAuthProfile(profile);
                    const role = profile?.role?.toLowerCase();
                    setIsSuperAdmin(role === 'super_admin');
                }
            } catch (err) {
                console.error('[UserContext] Auth check failed:', err);
            } finally {
                setIsAuthenticating(false);
            }
        };

        checkAuth();
    }, []);

    // 2. Load Employees Logic (Memoized so it can be exported)
    const loadEmployees = React.useCallback(async () => {
        if (!authProfile?.businessId) {
            setEmployees([]);
            setActiveEmployee(null);
            return;
        }

        try {
            const idbEmployees = await getAll('employees');
            const filtered = idbEmployees.map((e: any) => ({
                ...e,
                businessId: e.businessId || e.business_id,
                locationId: e.locationId || e.location_id,
                hoursWorked: e.hoursWorked || e.hours_worked || 0,
            })).filter((e: any) => 
                e.businessId === authProfile.businessId
                && (!authProfile.locationId || e.locationId === authProfile.locationId)
            );
            
            setEmployees(filtered as Employee[]);
            
            if (filtered.length === 0 && !isAuthenticating && authProfile.businessId) {
                console.log('[UserContext] No employees found, creating initial Admin employee...');
                await ensureAdminEmployee(authProfile);
                loadEmployees(); 
            }
        } catch (err) {
            console.error('[UserContext] Failed to load employees:', err);
        }
    }, [authProfile?.businessId, isAuthenticating]);

    useEffect(() => {
        loadEmployees();

        // Listen for sync completions to refresh data from Supabase
        const unsubscribe = onSyncComplete(() => {
            console.log('[UserContext] Sync complete - Refreshing employees');
            loadEmployees();
        });

        // Trigger an initial sync to pull new onboarding data (like Admin employee)
        if (authProfile?.businessId && navigator.onLine) {
            triggerSync();
        }

        return () => {
            // If onSyncComplete returned an unsubscribe function, call it
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [authProfile, isAuthenticating]);

    // 3. Auth Methods

    // Creates an Admin employee for the owner on first login if none exists yet
    const ensureAdminEmployee = async (profile: { id: string; businessId: string; locationId: string | null; fullName: string | null }) => {
        if (!profile.fullName || !profile.businessId || isEnsuringAdmin.current) return;
        isEnsuringAdmin.current = true;

        try {
            const supabase = (await import('../services/auth')).getSupabase();
            const { put: idbPut } = await import('../services/db');
            const { trackChange: tc } = await import('../services/SyncService');

            // --- DOUBLE CHECK: Check locally FIRST for any admin ---
            const { getAll } = await import('../services/db');
            const idbEmps = await getAll('employees');
            const localHasAdmin = idbEmps.some((e: any) => 
                (e.businessId || e.business_id) === profile.businessId && 
                e.role?.toLowerCase() === 'admin'
            );
            if (localHasAdmin) {
                isEnsuringAdmin.current = false;
                return;
            }

            // Check if any employees already exist for this business
            if (supabase) {
                const { data: existing } = await supabase
                    .from('employees')
                    .select('id, name, role')
                    .eq('business_id', profile.businessId);

                // Check for any admin existence
                if (existing && existing.length > 0) {
                    const hasAnyAdmin = existing.some(e => e.role?.toLowerCase() === 'admin');
                    if (hasAnyAdmin) {
                        isEnsuringAdmin.current = false;
                        return;
                    }
                }
            }

            // Create the Admin employee
            const adminEmployee = {
                id: crypto.randomUUID(),
                name: profile.fullName,
                role: 'admin',
                area: 'Management' as const,
                status: 'OFF_SHIFT' as const,
                image: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.fullName)}&background=5d5fef&color=fff&size=128`,
                rating: 5,
                hoursWorked: 0,
                schedule: [],
                pin: '0000',
                businessId: profile.businessId,
                locationId: profile.locationId || undefined,
            };

            // Save to IndexedDB
            await idbPut('employees', {
                ...adminEmployee,
                business_id: profile.businessId,
                synced: false,
                updated_at: new Date().toISOString(),
            } as any);

            // Queue sync to Supabase
            await tc('employees', 'INSERT', adminEmployee.id, adminEmployee);

            console.log('[UserContext] Admin employee created for:', profile.fullName);
        } catch (err) {
            console.error('[UserContext] Failed to create admin employee:', err);
        } finally {
            isEnsuringAdmin.current = false;
        }
    };

    const signIn = async (email: string, pass: string) => {
        const { data, error } = await authService.signIn(email, pass);
        if (error) throw error;
        if (data.user) {
            const profile = await authService.getProfile(data.user.id);

            // --- Multi-tenant cache isolation ---
            // If businessId changed (different tenant logging in), wipe all local IndexedDB data
            const prevBusinessId = localStorage.getItem('culinex_active_business');
            const incomingBusinessId = profile?.businessId;

            if (prevBusinessId && incomingBusinessId && prevBusinessId !== incomingBusinessId) {
                console.log('[UserContext] Business changed — clearing local cache for clean state.');
                const { clearAllBusinessData } = await import('../services/db');
                await clearAllBusinessData(prevBusinessId);
            }

            if (incomingBusinessId) {
                localStorage.setItem('culinex_active_business', incomingBusinessId);
            }
            // --- End isolation ---

            setAuthProfile(profile);
            const role = profile?.role?.toLowerCase();
            setIsSuperAdmin(role === 'super_admin');
        }
    };

    const signUp = async (email: string, pass: string, businessName: string, fullName: string) => {
        const { data, error } = await authService.signUp(email, pass, businessName, fullName);
        if (error) throw error;
        if (data.user) {
            // Profiling now handled by backend trigger
            return true;
        }
        return false;
    };

    const signOut = async () => {
        // --- SYNC SAFETY ---
        // Ensure data is pushed to Supabase before we wipe the local IndexedDB
        const { getSyncQueueCount, waitForTotalSync } = await import('../services/SyncService');
        const pendingCount = await getSyncQueueCount();
        
        if (pendingCount > 0 && navigator.onLine) {
            console.log(`[UserContext] Logout requested but ${pendingCount} changes pending. Waiting for sync...`);
            // We could show a global loader here if we had one in context
            const synced = await waitForTotalSync(7000); // Wait up to 7 seconds
            if (!synced) {
                const proceed = window.confirm(`Hay ${pendingCount} cambios que aún no se guardan en la nube por falta de conexión o lentitud. Si sales ahora, se PERDERÁN. ¿Cerrar sesión de todos modos?`);
                if (!proceed) return;
            }
        }

        // Clear current business localStorage cache before signing out
        const currentBusinessId = authProfile?.businessId;
        if (currentBusinessId) {
            const { clearAllBusinessData } = await import('../services/db');
            await clearAllBusinessData(currentBusinessId);
            localStorage.removeItem('culinex_active_business');
        }
        await authService.signOut();
        setAuthProfile(null);
        setActiveEmployee(null);
    };

    const completeOnboarding = async () => {
        if (!authProfile) return;
        try {
            await authService.completeOnboarding(authProfile.id);
            await refreshProfile(); // Ensure sync after completion
        } catch (err) {
            console.error('[UserContext] Failed to complete onboarding:', err);
        }
    };

    const updateBusiness = async (updates: any) => {
        if (!authProfile?.businessId) return;
        try {
            await authService.updateBusiness(authProfile.businessId, updates);
            await refreshProfile(); // Sync business info changes
        } catch (err) {
            console.error('[UserContext] Failed to update business:', err);
            throw err;
        }
    };

    const switchBusiness = async (businessId: string, businessName?: string) => {
        if (!isSuperAdmin || !authProfile) return;
        if (authProfile.businessId === businessId) return;

        console.log(`[UserContext] Switching to business: ${businessId}`);
        
        // 1. Safe Sync Wait
        const { getSyncQueueCount, waitForTotalSync } = await import('../services/SyncService');
        const pending = await getSyncQueueCount();
        if (pending > 0 && navigator.onLine) {
            await waitForTotalSync(5000);
        }

        // 2. Clear current cache
        const prevId = authProfile.businessId;
        const { clearAllBusinessData } = await import('../services/db');
        await clearAllBusinessData(prevId);

        // 3. Update state
        localStorage.setItem('culinex_active_business', businessId);
        setAuthProfile({
            ...authProfile,
            businessId,
            businessName: businessName || 'Cargando...',
            onboardingCompleted: true // Assume already onboarded or will be handled
        });

        // 4. Force trigger sync for new context
        setTimeout(() => triggerSync(), 500);
    };

    // 4. Staff Switching (PIN)
    const switchEmployee = (userId: string, pin: string) => {
        const emp = employees.find(e => e.id === userId && e.pin === pin);
        if (emp) {
            setActiveEmployee(emp);
            return true;
        }
        return false;
    };

    const clearActiveEmployee = () => setActiveEmployee(null);

    // 5. Staff Management
    const addEmployee = async (userData: Omit<Employee, 'id'>) => {
        if (!authProfile) return;
        const newEmp: Employee = {
            ...userData,
            id: crypto.randomUUID(),
            businessId: authProfile.businessId,
            locationId: authProfile.locationId,
            status: 'OFF_SHIFT',
            hoursWorked: 0,
            rating: 5,
            schedule: [],
            pin: (userData as any).pin || null
        };

        const idbRecord = {
            ...newEmp,
            synced: false,
            updated_at: new Date().toISOString()
        };

        await put('employees', idbRecord as any);
        await trackChange('employees', 'INSERT', newEmp.id, newEmp);
        setEmployees(prev => [...prev, newEmp]);
    };

    const updateEmployee = async (id: string, updates: Partial<Employee>) => {
        const updatedEmployees = employees.map(e => 
            e.id === id ? { ...e, ...updates } : e
        );
        const target = updatedEmployees.find(e => e.id === id);
        
        if (target) {
            const idbRecord = {
                ...target,
                synced: false,
                updated_at: new Date().toISOString()
            };
            await put('employees', idbRecord as any);
            await trackChange('employees', 'UPDATE', id, target);
            setEmployees(updatedEmployees);
            if (activeEmployee?.id === id) {
                setActiveEmployee(target);
            }
        }
    };

    const deleteEmployee = (id: string) => {
        setEmployees(prev => prev.filter(u => u.id !== id));
        deleteRecord('employees', id).catch(console.error);
        trackChange('employees', 'DELETE', id, {}).catch(console.error);
    };

    const setEmployeePin = async (employeeId: string, pin: string) => {
        const updatedEmployees = employees.map(e => 
            e.id === employeeId ? { ...e, pin } : e
        );
        const target = updatedEmployees.find(e => e.id === employeeId);
        
        if (target) {
            const idbRecord = {
                ...target,
                synced: false,
                updated_at: new Date().toISOString()
            };
            await put('employees', idbRecord as any);
            await trackChange('employees', 'UPDATE', employeeId, target);
            setEmployees(updatedEmployees);
            if (activeEmployee?.id === employeeId) {
                setActiveEmployee(target);
            }
        }
    };

    return (
        <UserContext.Provider value={{ 
            authProfile,
            isAuthenticating,
            isSuperAdmin,
            signIn,
            signUp,
            signOut,
            completeOnboarding,
            updateBusiness,
            refreshProfile,
            activeEmployee, 
            employees, 
            switchEmployee, 
            clearActiveEmployee,
            addEmployee, 
            updateEmployee, 
            deleteEmployee,
            setEmployeePin,
            refreshEmployees: loadEmployees,
            triggerSync,
            switchBusiness
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
