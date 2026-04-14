export enum OrderStatus {
  PENDING = 'PENDING',
  COOKING = 'COOKING',
  READY = 'READY',
  SERVED = 'SERVED',
  BILL_REQUESTED = 'BILL_REQUESTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
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
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  gramaje?: string;
  businessId: string;
}

export interface OrderItem extends MenuItem {
  quantity: number;
  notes?: string;
}

export enum OrderSource {
  DINE_IN = 'DINE_IN',
  UBER_EATS = 'UBER_EATS',
  RAPPI = 'RAPPI',
  DIDI = 'DIDI',
  TO_GO = 'TO_GO',
  PICKUP = 'PICKUP',
  DRIVE_THRU = 'DRIVE_THRU'
}

export interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  status: OrderStatus;
  timestamp: Date;
  total: number;
  waiterName?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  source?: OrderSource; // New field
  tip?: number;
  splitType?: 'EQUAL' | 'CUSTOM' | 'NONE';
  invoiceDetails?: InvoiceDetails;
  receivedAmount?: number;
  changeAmount?: number;
  paidSplits?: number;
  isKitchenReady?: boolean;
  isBarReady?: boolean;
  businessId?: string;
  locationId?: string;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PARTIAL = 'PARTIAL'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  MIXED = 'MIXED'
}

export interface InvoiceDetails {
  rfc: string;
  legalName: string;
  email: string;
  useCFDI: string;
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
  pin: string | null; // 4-digit PIN for login (null = First Time Setup)
  phone?: string;
  businessId: string;
  locationId?: string;
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
  publicInMenu?: boolean;
  price?: number; // Retail price when showing in menu
  linkedProductId?: string;
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

export type ExpenseCategory = 'Insumos' | 'Mantenimiento' | 'Nomina' | 'Servicios' | 'Otros';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  user: string;
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  WARNING = 'WARNING',
  EXPIRED = 'EXPIRED',
  DEBT_BLOCKED = 'DEBT_BLOCKED'
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  transactionId: string;
  type?: 'SUBSCRIPTION' | 'EQUIPMENT';
}

export interface WaitlistEntry {
  id: string;
  customerName: string;
  partySize: number;
  timestamp: string;
  status: 'WAITING' | 'ASSIGNED' | 'CANCELLED';
}