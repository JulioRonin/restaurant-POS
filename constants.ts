import { MenuItem, Table, TableStatus, KPI, Employee, InventoryItem } from './types';

export const MENU_ITEMS: MenuItem[] = [
  // Aguachiles
  { id: '1', name: 'Aguachiles Mixto Grande', price: 220.00, category: 'Aguachiles', image: '/images/aguachile.png', inventoryLevel: 4 },
  { id: '2', name: 'Aguachiles Camarón Grande', price: 230.00, category: 'Aguachiles', image: '/images/aguachile.png', inventoryLevel: 3 },
  { id: '3', name: 'Aguachiles Mixto Chico', price: 160.00, category: 'Aguachiles', image: '/images/aguachile.png', inventoryLevel: 4 },
  { id: '4', name: 'Aguachiles Camarón Chico', price: 170.00, category: 'Aguachiles', image: '/images/aguachile.png', inventoryLevel: 4 },

  // Ceviches
  { id: '5', name: 'Ceviche Mixto Grande', price: 220.00, category: 'Ceviches', image: '/images/ceviche.png', inventoryLevel: 4 },
  { id: '6', name: 'Ceviche Mixto Chico', price: 160.00, category: 'Ceviches', image: '/images/ceviche.png', inventoryLevel: 4 },

  // Snacks (Tostis & More)
  { id: '7', name: 'Tosti Ceviche Verde', price: 160.00, category: 'Snacks', image: '/images/ceviche.png', inventoryLevel: 4 },
  { id: '8', name: 'Tosti Ceviche Morado', price: 160.00, category: 'Snacks', image: '/images/ceviche.png', inventoryLevel: 4 },
  { id: '9', name: 'Tosti Aguachiles Verde', price: 160.00, category: 'Snacks', image: '/images/aguachile.png', inventoryLevel: 4 },
  { id: '10', name: 'Tosti Aguachiles Morado', price: 160.00, category: 'Snacks', image: '/images/aguachile.png', inventoryLevel: 4 },
  { id: '24', name: 'Maruchan preparada', price: 120.00, category: 'Snacks', image: 'https://picsum.photos/id/24/200', inventoryLevel: 4 },
  { id: '25', name: 'Tostitos Solos', price: 30.00, category: 'Snacks', image: 'https://picsum.photos/id/25/200', inventoryLevel: 4 },

  // Cocteles
  { id: '11', name: 'Coctel de Camarón Grande', price: 220.00, category: 'Cocteles', image: 'https://picsum.photos/id/11/200', inventoryLevel: 4 },
  { id: '12', name: 'Coctel de Camarón Chico', price: 160.00, category: 'Cocteles', image: 'https://picsum.photos/id/12/200', inventoryLevel: 3 },

  // Tostadas
  { id: '13', name: 'Tostada Ceviche Camarón', price: 70.00, category: 'Tostadas', image: '/images/tostada.png', inventoryLevel: 4 },
  { id: '14', name: 'Tostada Ceviche Pescado', price: 60.00, category: 'Tostadas', image: '/images/tostada.png', inventoryLevel: 2 },
  { id: '15', name: 'Tostada Mixta', price: 70.00, category: 'Tostadas', image: '/images/tostada.png', inventoryLevel: 4 },
  { id: '16', name: 'Tostada Alucin', price: 130.00, category: 'Tostadas', image: '/images/tostada.png', inventoryLevel: 4 },

  // Caldos
  { id: '17', name: 'Levantamuertos Especial Grande', price: 150.00, category: 'Caldos', image: 'https://picsum.photos/id/17/200', inventoryLevel: 4 },

  // Bebidas
  { id: '18', name: 'Balazo Camaron', price: 30.00, category: 'Bebidas', image: 'https://picsum.photos/id/18/200', inventoryLevel: 4 },
  { id: '19', name: 'Balazo Ostion', price: 30.00, category: 'Bebidas', image: 'https://picsum.photos/id/19/200', inventoryLevel: 2 },
  { id: '20', name: 'Clamato Especial Grande', price: 130.00, category: 'Bebidas', image: 'https://picsum.photos/id/20/200', inventoryLevel: 4 },
  { id: '21', name: 'Clamato Normal Chico', price: 50.00, category: 'Bebidas', image: 'https://picsum.photos/id/21/200', inventoryLevel: 4 },
  { id: '22', name: 'Clamato Normal Grande', price: 80.00, category: 'Bebidas', image: 'https://picsum.photos/id/22/200', inventoryLevel: 4 },
  { id: '23', name: 'Copa Alucin', price: 220.00, category: 'Bebidas', image: 'https://picsum.photos/id/23/200', inventoryLevel: 4 },
];

export const TABLES: Table[] = [
  { id: 'T1', name: 'Mesa 1', seats: 4, status: TableStatus.OCCUPIED, x: 10, y: 10 },
  { id: 'T2', name: 'Mesa 2', seats: 2, status: TableStatus.AVAILABLE, x: 40, y: 10 },
  { id: 'T3', name: 'Mesa 3', seats: 6, status: TableStatus.RESERVED, x: 70, y: 10 },
  { id: 'T4', name: 'Mesa 4', seats: 4, status: TableStatus.AVAILABLE, x: 10, y: 50 },
  { id: 'T5', name: 'Mesa 5', seats: 4, status: TableStatus.OCCUPIED, x: 40, y: 50 },
  { id: 'T6', name: 'VIP 1', seats: 8, status: TableStatus.AVAILABLE, x: 70, y: 50 },
];

export const DASHBOARD_KPIS: KPI[] = [
  { label: 'Ventas Totales', value: '$10,243.00', trend: 32.40, trendUp: true, icon: 'monetization_on' },
  { label: 'Platillos Servidos', value: '23,456', trend: 12.40, trendUp: false, icon: 'restaurant_menu' },
  { label: 'Clientes', value: '1,234', trend: 2.40, trendUp: true, icon: 'groups' },
  { label: 'Ticket Promedio', value: '$225.50', trend: 5.10, trendUp: true, icon: 'receipt' }
];

export const CATEGORIES = ['All', 'Aguachiles', 'Ceviches', 'Cocteles', 'Tostadas', 'Bebidas', 'Snacks', 'Caldos'];

export const MOCK_STAFF: Employee[] = [
  {
    id: '1',
    name: 'Maria Gonzalez',
    role: 'Chef Principal',
    area: 'Kitchen',
    status: 'ON_SHIFT',
    image: 'https://i.pravatar.cc/150?u=1',
    rating: 4.9,
    hoursWorked: 42,
    schedule: [
      { day: 'Mon', start: '08:00', end: '16:00' },
      { day: 'Tue', start: '08:00', end: '16:00' },
      { day: 'Wed', start: '08:00', end: '16:00' },
      { day: 'Thu', start: '08:00', end: '16:00' },
      { day: 'Fri', start: '10:00', end: '20:00' },
    ]
  },
  {
    id: '2',
    name: 'Carlos Ruiz',
    role: 'Ayudante',
    area: 'Kitchen',
    status: 'ON_SHIFT',
    image: 'https://i.pravatar.cc/150?u=2',
    rating: 4.8,
    hoursWorked: 38,
    schedule: [
      { day: 'Mon', start: '09:00', end: '17:00' },
      { day: 'Tue', start: '09:00', end: '17:00' },
      { day: 'Off', start: '-', end: '-' },
      { day: 'Thu', start: '09:00', end: '17:00' },
      { day: 'Fri', start: '12:00', end: '22:00' },
    ]
  },
  {
    id: '3',
    name: 'Ana Lopez',
    role: 'Gerente',
    area: 'Management',
    status: 'OFF_SHIFT',
    image: 'https://i.pravatar.cc/150?u=3',
    rating: 5.0,
    hoursWorked: 45,
    schedule: [
      { day: 'Mon', start: '08:00', end: '18:00' },
      { day: 'Tue', start: '08:00', end: '18:00' },
      { day: 'Wed', start: '08:00', end: '18:00' },
      { day: 'Thu', start: '08:00', end: '18:00' },
      { day: 'Fri', start: '08:00', end: '18:00' },
    ]
  },
  {
    id: '4',
    name: 'Pedro Diaz',
    role: 'Mesero',
    area: 'Service',
    status: 'ON_SHIFT',
    image: 'https://i.pravatar.cc/150?u=4',
    rating: 4.5,
    hoursWorked: 20,
    schedule: [
      { day: 'Mon', start: '16:00', end: '23:00' },
      { day: 'Tue', start: '16:00', end: '23:00' },
      { day: 'Wed', start: '16:00', end: '23:00' },
      { day: 'Thu', start: 'Off', end: '-' },
      { day: 'Fri', start: '16:00', end: '01:00' },
    ]
  },
  {
    id: '5',
    name: 'Luis Torres',
    role: 'Barra',
    area: 'Bar',
    status: 'BREAK',
    image: 'https://i.pravatar.cc/150?u=5',
    rating: 4.7,
    hoursWorked: 30,
    schedule: [
      { day: 'Mon', start: 'Off', end: '-' },
      { day: 'Tue', start: '14:00', end: '22:00' },
      { day: 'Wed', start: '14:00', end: '22:00' },
      { day: 'Thu', start: '14:00', end: '22:00' },
      { day: 'Fri', start: '16:00', end: '02:00' },
    ]
  },
  {
    id: '6',
    name: 'Sofia M.',
    role: 'Mesera',
    area: 'Service',
    status: 'OFF_SHIFT',
    image: 'https://i.pravatar.cc/150?u=6',
    rating: 4.9,
    hoursWorked: 25,
    schedule: [
      { day: 'Mon', start: '10:00', end: '16:00' },
      { day: 'Tue', start: '10:00', end: '16:00' },
      { day: 'Wed', start: 'Off', end: '-' },
      { day: 'Thu', start: '10:00', end: '16:00' },
      { day: 'Fri', start: '10:00', end: '18:00' },
    ]
  },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Camarón Grande', category: 'Mariscos', quantity: 25, unit: 'kg', costPerUnit: 180.00, maxStock: 60, minStock: 10, supplier: 'Pescadería Central', lastRestock: '2023-10-25' },
  { id: '2', name: 'Limón Persa', category: 'Verduras', quantity: 45, unit: 'kg', costPerUnit: 25.50, maxStock: 100, minStock: 20, supplier: 'Abastos', lastRestock: '2023-10-20' },
  { id: '3', name: 'Pulpo', category: 'Mariscos', quantity: 10, unit: 'kg', costPerUnit: 250.00, maxStock: 25, minStock: 5, supplier: 'Pescadería Central', lastRestock: '2023-10-26' },
  { id: '4', name: 'Pepino', category: 'Verduras', quantity: 15, unit: 'kg', costPerUnit: 18.00, maxStock: 30, minStock: 5, supplier: 'Abastos', lastRestock: '2023-10-27' },
  { id: '5', name: 'Tostadas', category: 'Abarrotes', quantity: 100, unit: 'paquetes', costPerUnit: 25.00, maxStock: 150, minStock: 50, supplier: 'La Tostadería', lastRestock: '2023-10-15' },
  { id: '6', name: 'Filete Pescado', category: 'Mariscos', quantity: 12, unit: 'kg', costPerUnit: 120.00, maxStock: 30, minStock: 5, supplier: 'Pescadería Central', lastRestock: '2023-10-27' },
  { id: '7', name: 'Clamato', category: 'Bebidas', quantity: 30, unit: 'litros', costPerUnit: 45.00, maxStock: 60, minStock: 10, supplier: 'Bebidas del Norte', lastRestock: '2023-10-10' },
  { id: '8', name: 'Ostión Fresco', category: 'Mariscos', quantity: 50, unit: 'piezas', costPerUnit: 8.00, maxStock: 100, minStock: 20, supplier: 'Mariscos Express', lastRestock: '2023-10-28' },
];

export const INVENTORY_CATEGORIES = ['All', 'Mariscos', 'Verduras', 'Abarrotes', 'Bebidas', 'Salsas'];