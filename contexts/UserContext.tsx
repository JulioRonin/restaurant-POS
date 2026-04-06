import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Employee } from '../types';

interface UserContextType {
    currentUser: Employee | null;
    users: Employee[];
    login: (userId: string, pin: string) => boolean; // Updated for PIN validation
    logout: () => void;
    addUser: (user: Omit<Employee, 'id'>) => void;
    updateUser: (id: string, updates: Partial<Employee>) => void;
    deleteUser: (id: string) => void;
    isAuthenticated: boolean;
}

import { MOCK_STAFF } from '../constants';

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<Employee[]>(() => {
        const saved = localStorage.getItem('culinex_users');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Temporary: Force all users to 1111 for ease of testing as requested
            return parsed.map((u: Employee) => ({ ...u, pin: '1111' }));
        }
        // Initialize with MOCK_STAFF + default PINs
        return MOCK_STAFF.map(u => ({ ...u, pin: '1111' }));
    });
    const [currentUser, setCurrentUser] = useState<Employee | null>(null);

    useEffect(() => {
        localStorage.setItem('culinex_users', JSON.stringify(users));
    }, [users]);

    const login = (userId: string, pin: string) => {
        const user = users.find(u => u.id === userId && u.pin === pin);
        if (user) {
            setCurrentUser(user);
            return true;
        }
        return false;
    };

    const logout = () => {
        setCurrentUser(null);
    };

    const addUser = (userData: Omit<Employee, 'id'>) => {
        const newUser: Employee = {
            ...userData,
            id: `EMP-${Date.now()}`,
            pin: '1111',
            image: 'https://i.pravatar.cc/150?u=' + Math.random()
        };
        setUsers(prev => [...prev, newUser]);
    };

    const updateUser = (id: string, updates: Partial<Employee>) => {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    };

    const deleteUser = (id: string) => {
        setUsers(prev => prev.filter(u => u.id !== id));
    };

    return (
        <UserContext.Provider value={{ 
            currentUser, 
            users, 
            login, 
            logout, 
            addUser, 
            updateUser, 
            deleteUser, 
            isAuthenticated: !!currentUser 
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
