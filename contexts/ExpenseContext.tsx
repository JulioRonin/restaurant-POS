import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from './UserContext';
import { Expense, ExpenseCategory } from '../types';
import { getAll, put, deleteRecord } from '../services/db';
import { trackChange, onSyncComplete } from '../services/SyncService';
import { getSupabase } from '../services/auth';

/**
 * Sube DIRECTO a Supabase los gastos que este equipo tiene y la nube no.
 *
 * Hasta este fix, ningún gasto llegaba a la nube (la app mandaba la columna
 * `user`, que no existe; la tabla usa `executor`). Las operaciones de la
 * cola ya agotaron sus reintentos y no se vuelven a intentar, así que los
 * gastos capturados quedaron atrapados en el navegador donde se registraron.
 * Esto los rescata: upsert idempotente por id, una vez por sesión.
 */
async function backfillExpensesToCloud(bizId: string, list: Expense[]) {
    const sb = getSupabase();
    if (!sb || list.length === 0) return;
    const flag = `sr_expenses_backfill_${bizId}`;
    try { if (sessionStorage.getItem(flag)) return; } catch {}
    const rows = list
        .filter((e: any) => !e.businessId || e.businessId === bizId || e.business_id === bizId)
        .map((e: any) => ({
            id: String(e.id),
            business_id: bizId,
            description: e.description || '',
            amount: Number(e.amount || 0),
            category: e.category || 'Otros',
            date: e.date || new Date().toISOString(),
            executor: e.user || e.executor || null,
        }));
    for (let i = 0; i < rows.length; i += 200) {
        const { error } = await sb.from('expenses').upsert(rows.slice(i, i + 200), { onConflict: 'id' });
        if (error) {
            console.warn('[ExpenseContext] No se pudieron subir gastos a la nube:', error.message);
            return; // se reintenta en la siguiente sesión
        }
    }
    try { sessionStorage.setItem(flag, '1'); } catch {}
    console.log(`[ExpenseContext] ${rows.length} gastos asegurados en la nube.`);
}

interface ExpenseContextType {
    expenses: Expense[];
    addExpense: (description: string, amount: number, category: ExpenseCategory, user: string, date?: string) => void;
    deleteExpense: (id: string) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const useExpenses = () => {
    const context = useContext(ExpenseContext);
    if (!context) {
        throw new Error('useExpenses must be used within an ExpenseProvider');
    }
    return context;
};

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { authProfile } = useUser();
    const [expenses, setExpenses] = useState<Expense[]>([]);

    // Load from IndexedDB on mount
    useEffect(() => {
        if (!authProfile?.businessId) {
            setExpenses([]);
            return;
        }

        const key = `culinex_expenses_${authProfile.businessId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Filter by businessId in case of cross-tenant contamination
                const filtered = parsed.filter((e: any) =>
                    !e.businessId || e.businessId === authProfile.businessId
                );
                setExpenses(filtered);
            } catch {
                setExpenses([]);
            }
        } else {
            setExpenses([]);
        }

        const bizId = authProfile.businessId;
        const loadFromIdb = () => getAll('expenses').then(idbExpenses => {
            const filtered = (idbExpenses as any[])
                .filter(e => !e.businessId || e.businessId === bizId || e.business_id === bizId)
                // En la nube quien registró el gasto está en `executor`.
                .map(e => (e.user === undefined && e.executor !== undefined ? { ...e, user: e.executor } : e));
            if (filtered.length > 0) setExpenses(filtered as Expense[]);
            return filtered as Expense[];
        });

        loadFromIdb()
            .then(list => {
                // Une lo de localStorage y de IndexedDB antes de subir, para no
                // dejar fuera nada de lo que el equipo tiene guardado.
                const fromLs = saved ? (() => { try { return JSON.parse(saved); } catch { return []; } })() : [];
                const byId = new Map<string, Expense>();
                [...fromLs, ...list].forEach((e: any) => byId.set(String(e.id), e));
                return backfillExpensesToCloud(bizId, Array.from(byId.values()));
            })
            .catch(console.error);

        // Gastos capturados en OTRO equipo llegan por el sync; antes este
        // contexto solo leía IndexedDB al montar y no se enteraba.
        const unsubscribe = onSyncComplete(() => { loadFromIdb().catch(console.error); });
        return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
    }, [authProfile?.businessId]);

    // Persist to both localStorage and IndexedDB
    useEffect(() => {
        if (!authProfile?.businessId) return;

        const key = `culinex_expenses_${authProfile.businessId}`;
        localStorage.setItem(key, JSON.stringify(expenses));
        
        const now = new Date().toISOString();
        for (const exp of expenses) {
            put('expenses', {
                ...exp,
                synced: false,
                updated_at: now,
            } as any).catch(console.error);
        }
    }, [expenses, authProfile?.businessId]);

    const addExpense = (description: string, amount: number, category: ExpenseCategory, user: string, date?: string) => {
        const newExpense: Expense = {
            id: Date.now().toString(),
            description,
            amount,
            category,
            date: date ? new Date(date + 'T00:00:00').toISOString() : new Date().toISOString(),
            user,
            // Tag with businessId for multi-tenant isolation
            ...(authProfile?.businessId ? { businessId: authProfile.businessId } : {})
        } as any;
        setExpenses(prev => [newExpense, ...prev]);
        trackChange('expenses', 'INSERT', newExpense.id, newExpense).catch(console.error);
    };

    const deleteExpense = (id: string) => {
        setExpenses(prev => prev.filter(e => e.id !== id));
        deleteRecord('expenses', id).catch(console.error);
        trackChange('expenses', 'DELETE', id, {}).catch(console.error);
    };

    return (
        <ExpenseContext.Provider value={{ expenses, addExpense, deleteExpense }}>
            {children}
        </ExpenseContext.Provider>
    );
};
