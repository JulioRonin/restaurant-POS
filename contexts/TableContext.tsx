import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './UserContext';
import { Table, TableStatus } from '../types';
import { getAll, put, deleteRecord } from '../services/db';
import { trackChange, onSyncComplete } from '../services/SyncService';

interface TableContextType {
  tables: Table[];
  addTable: (table: Omit<Table, 'id'>) => Promise<void>;
  updateTable: (id: string, updates: Partial<Table>) => Promise<void>;
  updateTableStatus: (id: string, status: TableStatus) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  loading: boolean;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const useTables = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTables must be used within a TableProvider');
  }
  return context;
};

export const TableProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authProfile } = useUser();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTables = async () => {
    if (!authProfile?.businessId) {
      setTables([]);
      setLoading(false);
      return;
    }

    try {
      const idbTables = await getAll('tables' as any);
      const filtered = (idbTables as any[]).filter(t => (t.businessId || t.business_id) === authProfile.businessId);
      
      if (filtered.length > 0) {
        setTables(filtered as Table[]);
      } else {
        setTables([]);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load tables:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
    const unsubscribe = onSyncComplete(loadTables);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [authProfile?.businessId]);

  const addTable = async (table: Omit<Table, 'id'>) => {
    if (!authProfile?.businessId) return;
    
    const id = crypto.randomUUID();
    const newTable = { 
      ...table, 
      id, 
      businessId: authProfile.businessId, 
      locationId: authProfile.locationId,
      synced: false, 
      updated_at: new Date().toISOString() 
    };
    
    await put('tables' as any, newTable as any);
    await trackChange('tables', 'INSERT', id, newTable);
    setTables(prev => [...prev, newTable as Table]);
  };

  const updateTable = async (id: string, updates: Partial<Table>) => {
    const current = tables.find(t => t.id === id);
    if (!current) return;
    
    const updated = { ...current, ...updates, synced: false, updated_at: new Date().toISOString() };
    await put('tables' as any, updated as any);
    await trackChange('tables', 'UPDATE', id, updated);
    setTables(prev => prev.map(t => t.id === id ? updated : t));
  };

  const updateTableStatus = async (id: string, status: TableStatus) => {
    await updateTable(id, { status });
  };

  const deleteTable = async (id: string) => {
    await deleteRecord('tables' as any, id);
    await trackChange('tables', 'DELETE', id, {});
    setTables(prev => prev.filter(t => t.id !== id));
  };

  return (
    <TableContext.Provider value={{ tables, addTable, updateTable, updateTableStatus, deleteTable, loading }}>
      {children}
    </TableContext.Provider>
  );
};
