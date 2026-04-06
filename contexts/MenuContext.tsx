import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MenuItem } from '../types';
import { MENU_ITEMS as MOCK_MENU } from '../constants';

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
    const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
        const saved = localStorage.getItem('culinex_menu');
        if (saved) return JSON.parse(saved);
        // Initialize with MOCK_MENU and default status
        return MOCK_MENU.map(item => ({ ...item, status: 'ACTIVE' }));
    });

    useEffect(() => {
        localStorage.setItem('culinex_menu', JSON.stringify(menuItems));
    }, [menuItems]);

    const addItem = (item: Omit<MenuItem, 'id'>) => {
        const newItem: MenuItem = {
            ...item,
            id: Date.now().toString()
        };
        setMenuItems(prev => [...prev, newItem]);
    };

    const updateItem = (id: string, updates: Partial<MenuItem>) => {
        setMenuItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const deleteItem = (id: string) => {
        setMenuItems(prev => prev.filter(item => item.id !== id));
    };

    const toggleStatus = (id: string) => {
        setMenuItems(prev => prev.map(item => 
            item.id === id ? { ...item, status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : item
        ));
    };

    const importCSV = (csvText: string) => {
        const lines = csvText.split('\n');
        const count = 0;
        const errors: string[] = [];
        const newItems: MenuItem[] = [];

        // Skip header if exists
        const startLine = lines[0].toLowerCase().includes('nombre') ? 1 : 0;

        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',').map(s => s.trim());
            const [nombre, categoria, precio, descripcion, gramaje, estatus] = parts;
            
            if (!nombre || !precio) {
                errors.push(`Línea ${i + 1}: Nombre y Precio son obligatorios.`);
                continue;
            }

            const cleanPrice = parseFloat(precio.replace(/[^0-9.]/g, '')) || 0;

            newItems.push({
                id: `CSV-${Date.now()}-${i}`,
                name: nombre,
                category: categoria || 'General',
                price: cleanPrice,
                description: descripcion || '',
                gramaje: gramaje || '',
                status: (estatus?.toLowerCase().includes('inactivo')) ? 'INACTIVE' : 'ACTIVE',
                image: `https://picsum.photos/seed/${nombre}/200`,
                inventoryLevel: 4
            });
        }

        if (newItems.length > 0) {
            setMenuItems(prev => [...prev, ...newItems]);
            return { success: true, count: newItems.length, errors };
        }

        return { success: false, count: 0, errors: errors.length > 0 ? errors : ['No se encontraron datos válidos.'] };
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
