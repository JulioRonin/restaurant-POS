import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './UserContext';
import { MenuItem } from '../types';
import { getAll, put, deleteRecord } from '../services/db';
import { trackChange, triggerSync } from '../services/SyncService';

interface MenuContextType {
    menuItems: MenuItem[];
    addItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
    updateItem: (id: string, updates: Partial<MenuItem>) => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
    toggleStatus: (id: string) => Promise<void>;
    importCSV: (csvText: string) => Promise<{ success: boolean; count: number; errors: string[] }>;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export const MenuProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { authProfile } = useUser();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    // Load data from IndexedDB
    useEffect(() => {
        if (!authProfile?.businessId) return;

        const loadMenu = async () => {
            try {
                // --- EMERGENCY RECOVERY ---
                // If menu is empty, try to recover from inventory (legacy system)
                const { repairAndRecoverMenuData } = await import('../services/SyncService');
                const recoveredCount = await repairAndRecoverMenuData();
                if (recoveredCount > 0) {
                    console.log(`[MenuContext] Recovered ${recoveredCount} items from legacy storage.`);
                }
                // --- END RECOVERY ---

                const data = await getAll('products');
                // Filter by businessId locally if needed, though IndexedDB is cleared on business switch
                setMenuItems(data as MenuItem[]);
            } catch (err) {
                console.error('[MenuContext] Error loading menu:', err);
            }
        };

        loadMenu();
    }, [authProfile?.businessId]);

    const addItem = async (item: Omit<MenuItem, 'id' | 'businessId'>) => {
        const id = crypto.randomUUID();
        const newItem: MenuItem = {
            ...item,
            id,
            businessId: authProfile?.businessId || '',
            synced: false,
            updated_at: new Date().toISOString()
        } as MenuItem;

        await put('products', newItem as any);
        setMenuItems(prev => [...prev, newItem]);
        
        await trackChange('products', 'INSERT', id, newItem);
    };

    const updateItem = async (id: string, updates: Partial<MenuItem>) => {
        const existing = menuItems.find(i => i.id === id);
        if (!existing) return;

        const updated = { 
            ...existing, 
            ...updates, 
            synced: false, 
            updated_at: new Date().toISOString() 
        };

        await put('products', updated as any);
        setMenuItems(prev => prev.map(i => i.id === id ? updated : i));
        
        await trackChange('products', 'UPDATE', id, updated);
    };

    const deleteItem = async (id: string) => {
        await deleteRecord('products', id);
        setMenuItems(prev => prev.filter(i => i.id !== id));
        
        await trackChange('products', 'DELETE', id);
    };

    const toggleStatus = async (id: string) => {
        const item = menuItems.find(i => i.id === id);
        if (item) {
            const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            await updateItem(id, { status: newStatus });
        }
    };

    const importCSV = async (csvText: string) => {
        const lines = csvText.split('\n');
        let count = 0;
        const errors: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',').map(p => p.trim());
            
            if (parts.length < 3) {
                errors.push(`Línea ${i + 1}: Formato inválido (mínimo Nombre, Categoría, Precio)`);
                continue;
            }

            try {
                const [name, category, priceStr, description, gramaje, statusStr] = parts;
                const price = parseFloat(priceStr);

                if (isNaN(price)) {
                    errors.push(`Línea ${i + 1}: Precio inválido: ${priceStr}`);
                    continue;
                }

                await addItem({
                    name,
                    category,
                    price,
                    description: description || '',
                    gramaje: gramaje || '',
                    status: (statusStr?.toUpperCase() === 'INACTIVO') ? 'INACTIVE' : 'ACTIVE',
                    image: `https://picsum.photos/seed/${encodeURIComponent(name)}/200`,
                    inventoryLevel: 10
                });
                count++;
            } catch (err: any) {
                errors.push(`Línea ${i + 1}: ${err.message || 'Error desconocido'}`);
            }
        }

        // Trigger sync
        triggerSync().catch(console.error);

        return { success: errors.length === 0, count, errors };
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
