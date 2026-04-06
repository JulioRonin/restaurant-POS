import React, { createContext, useContext, useState, useEffect } from 'react';
import { Expense, ExpenseCategory } from '../types';

interface ExpenseContextType {
    expenses: Expense[];
    addExpense: (description: string, amount: number, category: ExpenseCategory, user: string) => void;
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
    const [expenses, setExpenses] = useState<Expense[]>(() => {
        const saved = localStorage.getItem('expenses');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('expenses', JSON.stringify(expenses));
    }, [expenses]);

    const addExpense = (description: string, amount: number, category: ExpenseCategory, user: string) => {
        const newExpense: Expense = {
            id: Date.now().toString(),
            description,
            amount,
            category,
            date: new Date().toISOString(),
            user
        };
        setExpenses(prev => [newExpense, ...prev]);
    };

    const deleteExpense = (id: string) => {
        setExpenses(prev => prev.filter(e => e.id !== id));
    };

    return (
        <ExpenseContext.Provider value={{ expenses, addExpense, deleteExpense }}>
            {children}
        </ExpenseContext.Provider>
    );
};
