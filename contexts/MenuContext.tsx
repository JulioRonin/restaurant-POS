import React, { createContext, useContext, ReactNode } from 'react';
import { useInventory } from './InventoryContext';
import { MenuItem } from '../types';

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
    const { inventory, addInventoryItem, updateInventoryItem } = useInventory();

    // The Menu is simply the inventory filtered for public items
    const menuItems = React.useMemo(() => {
        return inventory.filter(p => p.publicInMenu === true);
    }, [inventory]);

    const addItem = async (item: Omit<MenuItem, 'id' | 'businessId'>) => {
        const fullItem: any = {
            ...item,
            publicInMenu: true,
            quantity: 10,
            unit: 'Pza',
            costPerUnit: (item as any).price / 1.3,
            maxStock: 100,
            minStock: 10,
            supplier: 'Manual',
            lastRestock: new Date().toISOString()
        };
        await addInventoryItem(fullItem);
    };

    const updateItem = async (id: string, updates: Partial<MenuItem>) => {
        await updateInventoryItem(id, updates);
    };

    const deleteItem = async (id: string) => {
        // Soft delete from menu
        await updateInventoryItem(id, { publicInMenu: false });
    };

    const toggleStatus = async (id: string) => {
        const item = menuItems.find(i => i.id === id);
        if (item) {
            const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            await updateInventoryItem(id, { status: newStatus });
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
            
            // Expected Format: Nombre, Categoría, Precio, Descripción, Gramaje, Estatus
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

        // Force a sync after bulk import
        const { triggerSync } = require('../services/SyncService');
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
