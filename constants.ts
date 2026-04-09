import { MenuItem, Table, TableStatus, KPI, Employee, InventoryItem } from './types';

export const MENU_ITEMS: MenuItem[] = [];

export const TABLES: Table[] = [];

export const DASHBOARD_KPIS: KPI[] = [
  { label: 'Ventas Totales', value: '$0.00', trend: 0, trendUp: true, icon: 'monetization_on' },
  { label: 'Platillos Servidos', value: '0', trend: 0, trendUp: false, icon: 'restaurant_menu' },
  { label: 'Clientes', value: '0', trend: 0, trendUp: true, icon: 'groups' },
  { label: 'Ticket Promedio', value: '$0.00', trend: 0, trendUp: true, icon: 'receipt' }
];

export const CATEGORIES = ['All', 'Entradas', 'Plato Fuerte', 'Bebidas', 'Postres', 'Extras', 'Tacos', 'Tortas'];

export const MOCK_STAFF: Employee[] = [];

export const MOCK_INVENTORY: InventoryItem[] = [];

export const INVENTORY_CATEGORIES = ['All'];