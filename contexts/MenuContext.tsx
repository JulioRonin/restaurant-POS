import React, { createContext, useContext, ReactNode } from 'react';
import { useInventory } from './InventoryContext';
import { MenuItem } from '../types';

interface MenuContextType {
    menuItems: MenuItem[];
    addItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
    updateItem: (id: string, updates: Partial<MenuItem>) => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
    toggleStatus: (id: string) => Promise<void>;
    importCSV: (csvText: string) => { success: boolean; count: number; errors: string[] };
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
            quantity: 0,
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

    const importCSV = (csvText: string) => {
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
