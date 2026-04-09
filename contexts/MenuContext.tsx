import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './UserContext';
import { MenuItem } from '../types';
import { MENU_ITEMS as MOCK_MENU } from '../constants';
import { getAll, put, deleteRecord } from '../services/db';
import { trackChange, onSyncComplete } from '../services/SyncService';

interface MenuContextType {
    menuItems: MenuItem[];
    addItem: (item: Omit<MenuItem, 'id'>) => void;
    updateItem: (id: string, updates: Partial<MenuItem>) => void;
    deleteItem: (id: string) => void;
    toggleStatus: (id: string) => void;
    importCSV: (csvText: string) => { success: boolean; count: number; errors: string[] };
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export const MenuProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { authProfile } = useUser();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    // Load from IndexedDB on mount
    useEffect(() => {
        if (!authProfile?.businessId) return;

        const loadFromInventory = async () => {
            try {
                const idbInventory = await getAll('inventory' as any);
                const filtered = (idbInventory as any[])
                    .map(p => ({
                        ...p,
                        businessId: p.businessId || p.business_id 
                    }))
                    .filter(p => p.businessId === authProfile.businessId && p.publicInMenu === true);

                setMenuItems(filtered as MenuItem[]);
            } catch (err) {
                console.error('[MenuContext] Failed to load from inventory:', err);
            }
        };

        loadFromInventory();
        
        // Listen for sync completions (which might update inventory)
        const unsubscribe = onSyncComplete(loadFromInventory);
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [authProfile?.businessId]);

    // Persist changes back to Inventory table
    const syncToInventory = async (id: string, updates: any) => {
        const idbInventory = await getAll('inventory' as any);
        const item = idbInventory.find((i: any) => i.id === id);
        if (item) {
            const updated = { ...item, ...updates, synced: false, updated_at: new Date().toISOString() };
            await put('inventory' as any, updated);
            await trackChange('inventory', 'UPDATE', id, updated);
        }
    };

    const addItem = async (item: Omit<MenuItem, 'id' | 'businessId'>) => {
        if (!authProfile?.businessId) return;
        const id = crypto.randomUUID();
        const newItem: any = {
            ...item,
            id,
            businessId: authProfile.businessId,
            publicInMenu: true,
            quantity: 0,
            unit: 'Pza',
            costPerUnit: item.price / 1.3, // Estimated cost
            maxStock: 100,
            minStock: 10,
            supplier: 'Manual',
            lastRestock: new Date().toISOString()
        };
        
        await put('inventory' as any, { ...newItem, synced: false, updated_at: new Date().toISOString() });
        await trackChange('inventory', 'INSERT', id, newItem);
        setMenuItems(prev => [...prev, newItem as MenuItem]);
    };

    const updateItem = async (id: string, updates: Partial<MenuItem>) => {
        setMenuItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
        await syncToInventory(id, updates);
    };

    const deleteItem = async (id: string) => {
        setMenuItems(prev => prev.filter(item => item.id !== id));
        // Soft delete from menu: just set publicInMenu to false
        await syncToInventory(id, { publicInMenu: false });
    };

    const toggleStatus = async (id: string) => {
        const item = menuItems.find(i => i.id === id);
        if (item) {
            const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            setMenuItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
            await syncToInventory(id, { status: newStatus });
        }
    };

    const importCSV = (csvText: string) => {
        // ... Existing CSV logic unchanged for now, but should also target inventory ...
        return { success: false, count: 0, errors: ['CSV import currently being updated for inventory unification'] };
    };

    return (
        <MenuContext.Provider value={{ menuItems, addItem, updateItem, deleteItem, toggleStatus, importCSV }}>
            {children}
        </MenuContext.Provider>
    );
};

export const useMenu = () => {
    const context = useContext(MenuContext);
    if (!context) throw new Error('useMenu must be used within a MenuProvider');
    return context;
};
