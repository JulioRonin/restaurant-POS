export enum OrderStatus {
  PENDING = 'PENDING',
  COOKING = 'COOKING',
  READY = 'READY',
  SERVED = 'SERVED',
  COMPLETED = 'COMPLETED'
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  DIRTY = 'DIRTY'
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  inventoryLevel: number; // 0-4 scale as per blueprint
}

export interface OrderItem extends MenuItem {
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  status: OrderStatus;
  timestamp: Date;
  total: number;
  waiterName?: string;
}

export interface Table {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  x: number; // Relative position for floor plan
  y: number;
  assignedWaiterId?: string; // New field for table assignment
}

export interface KPI {
  label: string;
  value: string | number;
  trend: number; // Percentage
  trendUp: boolean;
  icon: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  area: 'Kitchen' | 'Service' | 'Bar' | 'Management'; // New field
  status: 'ON_SHIFT' | 'OFF_SHIFT' | 'BREAK';
  image: string;
  rating: number; // 0-5
  hoursWorked: number;
  schedule: { day: string; start: string; end: string }[]; // New field
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  maxStock: number;
  minStock: number; // New field for reorder point
  supplier: string;
  lastRestock: string;
}

export interface CartItem extends InventoryItem {
  orderQuantity: number;
}

export enum SupplyOrderStatus {
  PENDING = 'PENDING',
  ORDERED = 'ORDERED',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED'
}

export interface SupplierOrder {
  id: string;
  supplier: string;
  date: string;
  status: SupplyOrderStatus;
  items: CartItem[];
  totalCost: number;
}