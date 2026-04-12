import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from './UserContext';
import { Expense, ExpenseCategory } from '../types';
import { getAll, put, deleteRecord } from '../services/db';
import { trackChange } from '../services/SyncService';

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

        // Also load from IndexedDB, strictly filtered by businessId
        getAll('expenses').then(idbExpenses => {
            const filtered = (idbExpenses as any[]).filter(e =>
                !e.businessId || e.businessId === authProfile.businessId ||
                e.business_id === authProfile.businessId
            );
            if (filtered.length > 0) {
                setExpenses(filtered as Expense[]);
            }
        }).catch(console.error);
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
            date: date ? new Date(date).toISOString() : new Date().toISOString(),
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
