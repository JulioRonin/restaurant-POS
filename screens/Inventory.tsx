import React, { useState, useMemo } from 'react';
import { INVENTORY_CATEGORIES } from '../constants';
import { InventoryItem, CartItem, SupplierOrder, SupplyOrderStatus } from '../types';
import { useInventory } from '../contexts/InventoryContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Truck, ShoppingCart, Plus, Edit3, Trash2, AlertTriangle,
  CheckCircle2, Search, ArrowRight, X, Minus, Boxes,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrInput, SrLabel, SrKicker, SrMono,
  SrModal, SrModalHeader, SrEmptyState, SrTabs, SrProgressRing,
} from '../components/ui/servirest';

type Tab = 'stock' | 'orders';

export const InventoryScreen: React.FC = () => {
  const {
    inventory, orders, addInventoryItem, updateInventoryItem,
    deleteInventoryItem, createSupplierOrder, updateSupplierOrder,
  } = useInventory();

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<Tab>('stock');

  // Cart & Ordering
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Editing
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Restock
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<number>(0);

  const [publishToMenu, setPublishToMenu] = useState(false);
  const [menuPrice, setMenuPrice] = useState<number>(0);

  const filteredInventory = useMemo(() => {
    if (activeCategory === 'All') return inventory;
    return inventory.filter((item) => item.category === activeCategory);
  }, [activeCategory, inventory]);

  const cartTotal = cart.reduce((acc, item) => acc + item.costPerUnit * item.orderQuantity, 0);

  const stats = useMemo(() => {
    const total = inventory.length;
    const belowMin = inventory.filter((i) => i.quantity <= (i.minStock || 0)).length;
    const totalValue = inventory.reduce((s, i) => s + i.quantity * (i.costPerUnit || 0), 0);
    return { total, belowMin, totalValue };
  }, [inventory]);

  const categoryTabs = useMemo(
    () =>
      INVENTORY_CATEGORIES.map((c) => ({
        id: c,
        label: c === 'All' ? 'Todo' : c,
        count: c === 'All' ? inventory.length : inventory.filter((i) => i.category === c).length,
      })) as readonly { id: string; label: string; count: number }[],
    [inventory]
  );

  const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemData = {
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      supplier: formData.get('supplier') as string,
      quantity: Number(formData.get('quantity')),
      unit: formData.get('unit') as string,
      costPerUnit: Number(formData.get('cost')),
      minStock: Number(formData.get('minStock')),
      maxStock: Number(formData.get('maxStock')),
      publicInMenu: publishToMenu,
      price: menuPrice,
      lastRestock: editingItem?.lastRestock || new Date().toISOString(),
    };

    if (editingItem) {
      await updateInventoryItem(editingItem.id, itemData);
    } else {
      await addInventoryItem(itemData as Omit<InventoryItem, 'id'>);
    }
    setIsAddModalOpen(false);
    setEditingItem(null);
  };

  const addToCart = (item: InventoryItem, qty: number) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart((prev) => prev.map((c) => c.id === item.id ? { ...c, orderQuantity: c.orderQuantity + qty } : c));
    } else {
      setCart((prev) => [...prev, { ...item, orderQuantity: qty }]);
    }
    setRestockItem(null);
    setIsCartOpen(true);
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) return;
    const bySupplier: Record<string, CartItem[]> = {};
    for (const item of cart) {
      const key = item.supplier || 'Sin proveedor';
      if (!bySupplier[key]) bySupplier[key] = [];
      bySupplier[key].push(item);
    }
    for (const [supplier, items] of Object.entries(bySupplier)) {
      await createSupplierOrder({
        supplier,
        date: new Date().toISOString(),
        status: SupplyOrderStatus.PENDING,
        items,
        totalCost: items.reduce((s, i) => s + i.costPerUnit * i.orderQuantity, 0),
      });
    }
    setCart([]);
    setIsCartOpen(false);
    setActiveTab('orders');
  };

  const handleUpdateStatus = async (orderId: string, status: SupplyOrderStatus) => {
    if (status === SupplyOrderStatus.RECEIVED) {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        for (const orderItem of order.items) {
          const invItem = inventory.find((i) => i.id === orderItem.id);
          if (invItem) {
            await updateInventoryItem(invItem.id, {
              quantity: invItem.quantity + orderItem.orderQuantity,
              lastRestock: new Date().toISOString(),
            });
          }
        }
      }
    }
    await updateSupplierOrder(orderId, { status });
  };

  const getStockState = (qty: number, max: number, min: number) => {
    const pct = max > 0 ? Math.min(100, Math.round((qty / max) * 100)) : 0;
    if (qty <= min) return { label: 'Bajo mínimo', tone: 'danger' as const, pct };
    if (pct < 40) return { label: 'Bajo stock', tone: 'mostaza' as const, pct };
    return { label: 'En orden', tone: 'success' as const, pct };
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon antialiased">
      <div className="px-[38px] py-10 max-w-[1480px] mx-auto pb-32 lg:pb-12">
        {/* ─── HEADER ────────────────────────────────────────────── */}
        <div className="flex justify-between items-start flex-wrap gap-6 mb-12">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Stock, mermas y proveedores</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              Inventario
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[480px] leading-relaxed">
              Lo que entra, lo que sale y lo que pides. Cuida tu capital amarrado sin pasarte mirando hojas de cálculo.
            </p>
          </motion.div>

          {/* Mini-stats rail */}
          <div className="flex gap-3 flex-wrap">
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">En stock</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-midnight tracking-[-0.03em] leading-none">
                {stats.total}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Bajo mínimo</SrLabel>
              <div className={`font-black italic text-[32px] tracking-[-0.03em] leading-none ${stats.belowMin > 0 ? 'text-servirest-danger' : 'text-servirest-success'}`}>
                {stats.belowMin}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Valor total</SrLabel>
              <SrMono className="text-[20px] text-servirest-midnight font-extrabold tracking-tight">
                ${stats.totalValue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
              </SrMono>
            </SrCard>
          </div>
        </div>

        {/* ─── ACTIONS BAR ───────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between mb-8">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`px-5 py-3 rounded-sr-md text-[10px] font-black uppercase tracking-[0.16em] transition-colors flex items-center gap-2 border ${
                activeTab === 'stock'
                  ? 'bg-servirest-midnight text-servirest-hueso border-servirest-midnight'
                  : 'bg-servirest-surface text-[rgba(42,40,38,0.6)] border-[rgba(42,40,38,0.12)] hover:text-servirest-carbon'
              }`}
            >
              <Package size={14} /> Stock
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-5 py-3 rounded-sr-md text-[10px] font-black uppercase tracking-[0.16em] transition-colors flex items-center gap-2 border ${
                activeTab === 'orders'
                  ? 'bg-servirest-midnight text-servirest-hueso border-servirest-midnight'
                  : 'bg-servirest-surface text-[rgba(42,40,38,0.6)] border-[rgba(42,40,38,0.12)] hover:text-servirest-carbon'
              }`}
            >
              <Truck size={14} /> Pedidos
              {orders.length > 0 && (
                <span className="text-[rgba(255,255,255,0.6)]">· {orders.length}</span>
              )}
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative px-5 py-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.6)] hover:text-servirest-carbon hover:border-servirest-terracota/40 transition-colors flex items-center gap-2"
            >
              <ShoppingCart size={14} />
              <span className="font-black italic uppercase tracking-[0.18em] text-[10px]">Carrito</span>
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-servirest-terracota text-servirest-hueso text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-sr-glow">
                  {cart.length}
                </span>
              )}
            </button>
            <SrButton
              variant="outline"
              size="md"
              icon={<Truck size={14} />}
              onClick={() => setIsCartOpen(true)}
              disabled={cart.length === 0}
            >
              Pedir a proveedor
            </SrButton>
            <SrButton
              variant="primary"
              size="md"
              icon={<Plus size={14} />}
              onClick={() => { setEditingItem(null); setIsAddModalOpen(true); }}
            >
              Agregar producto
            </SrButton>
          </div>
        </div>

        {activeTab === 'stock' && (
          <>
            {/* ─── CATEGORY TABS ───────────────────────────────── */}
            <div className="mb-8">
              <SrTabs<string>
                tabs={categoryTabs as any}
                active={activeCategory}
                onChange={setActiveCategory}
              />
            </div>

            {/* ─── EDITORIAL ITEM LIST ─────────────────────────── */}
            {filteredInventory.length === 0 ? (
              <SrCard variant="solaris" className="p-12">
                <SrEmptyState
                  icon={<Boxes size={28} />}
                  title={inventory.length === 0 ? 'Aún sin productos en inventario' : 'Sin productos en este filtro'}
                  description={
                    inventory.length === 0
                      ? 'Empieza dando de alta tus insumos clave. Sabrás siempre qué pedir y a quién.'
                      : 'Cambia de categoría para ver el resto de tu stock.'
                  }
                  action={
                    inventory.length === 0 ? (
                      <SrButton variant="primary" icon={<Plus size={14} />} onClick={() => { setEditingItem(null); setIsAddModalOpen(true); }}>
                        Agregar primer producto
                      </SrButton>
                    ) : undefined
                  }
                />
              </SrCard>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredInventory.map((item, idx) => {
                    const state = getStockState(item.quantity, item.maxStock, item.minStock || 0);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.3, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <SrCard hover className="p-5">
                          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_auto_1fr_auto] gap-5 items-center">
                            {/* Name + category */}
                            <div className="min-w-0">
                              <h3 className="font-serif italic font-medium text-[20px] text-servirest-midnight tracking-[-0.015em] leading-tight m-0 mb-1 truncate">
                                {item.name}
                              </h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                <SrLabel>{item.category}</SrLabel>
                                {item.publicInMenu && (
                                  <SrChip tone="mostaza" size="xs">En menú</SrChip>
                                )}
                              </div>
                            </div>

                            {/* Stock with ring */}
                            <div className="flex items-center gap-4">
                              <SrProgressRing pct={state.pct} size={52} stroke={4} showLabel />
                              <div>
                                <div className="font-black italic text-[22px] text-servirest-midnight tracking-[-0.02em] leading-none mb-1">
                                  {item.quantity}
                                  <span className="text-[12px] font-medium not-italic text-[rgba(42,40,38,0.5)] ml-1">{item.unit}</span>
                                </div>
                                <SrChip tone={state.tone} size="xs">
                                  {state.tone === 'danger' && <AlertTriangle size={9} className="mr-1" />}
                                  {state.label}
                                </SrChip>
                              </div>
                            </div>

                            {/* Cost */}
                            <div className="text-center min-w-[100px]">
                              <SrLabel className="block mb-1">Costo / {item.unit}</SrLabel>
                              <SrMono className="text-[14px] text-servirest-terracota font-extrabold">
                                ${item.costPerUnit.toFixed(2)}
                              </SrMono>
                            </div>

                            {/* Supplier */}
                            <div className="min-w-0">
                              <SrLabel className="block mb-1.5">Proveedor</SrLabel>
                              <SrChip tone="neutral">
                                <Truck size={9} className="mr-1.5" />
                                {item.supplier || 'Sin asignar'}
                              </SrChip>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 justify-end">
                              <SrButton
                                variant="outline"
                                size="sm"
                                icon={<Plus size={12} />}
                                onClick={() => {
                                  setRestockItem(item);
                                  setRestockQty(Math.max(0, item.maxStock - item.quantity));
                                }}
                              >
                                Pedir
                              </SrButton>
                              <button
                                type="button"
                                onClick={() => { setEditingItem(item); setIsAddModalOpen(true); }}
                                className="w-10 h-10 rounded-sr-md bg-[rgba(42,40,38,0.05)] text-[rgba(42,40,38,0.6)] hover:text-servirest-terracota hover:bg-[rgba(196,99,63,0.08)] flex items-center justify-center transition-colors"
                                aria-label="Editar"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`¿Eliminar "${item.name}" del inventario?`)) {
                                    deleteInventoryItem(item.id);
                                  }
                                }}
                                className="w-10 h-10 rounded-sr-md bg-[rgba(225,85,75,0.06)] text-servirest-danger/60 hover:text-servirest-danger hover:bg-[rgba(225,85,75,0.10)] flex items-center justify-center transition-colors"
                                aria-label="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </SrCard>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {activeTab === 'orders' && (
          <>
            {orders.length === 0 ? (
              <SrCard variant="solaris" className="p-12">
                <SrEmptyState
                  icon={<Truck size={28} />}
                  title="Aún sin pedidos a proveedores"
                  description="Agrega productos al carrito desde la pestaña de stock y haz tu primer pedido."
                  action={
                    <SrButton variant="primary" icon={<Package size={14} />} onClick={() => setActiveTab('stock')}>
                      Ir al stock
                    </SrButton>
                  }
                />
              </SrCard>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {orders.map((order, idx) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.03 }}
                  >
                    <SrCard
                      variant="solaris"
                      className={`p-7 ${order.status === SupplyOrderStatus.PENDING ? 'border-servirest-mostaza/40' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <SrKicker className="block mb-1.5">Pedido</SrKicker>
                          <h3 className="font-serif italic font-medium text-[24px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight mb-1">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </h3>
                          <SrMono className="text-[11px] text-[rgba(42,40,38,0.5)]">
                            {new Date(order.date).toLocaleDateString('es-MX')} · {order.supplier}
                          </SrMono>
                        </div>
                        <SrChip
                          tone={
                            order.status === SupplyOrderStatus.RECEIVED ? 'success'
                              : order.status === SupplyOrderStatus.ORDERED ? 'terracota'
                              : order.status === SupplyOrderStatus.CANCELLED ? 'danger'
                              : 'mostaza'
                          }
                        >
                          {order.status === SupplyOrderStatus.RECEIVED ? 'Recibido'
                            : order.status === SupplyOrderStatus.ORDERED ? 'Pedido'
                            : order.status === SupplyOrderStatus.CANCELLED ? 'Cancelado'
                            : 'Pendiente'}
                        </SrChip>
                      </div>

                      <div className="space-y-2 mb-6">
                        {order.items.map((it, i) => (
                          <div key={i} className="flex justify-between items-center text-[12px] py-1.5 border-b border-[rgba(42,40,38,0.06)] last:border-0">
                            <span className="font-medium text-servirest-carbon">
                              <span className="font-mono font-bold text-servirest-terracota mr-2">{it.orderQuantity}×</span>
                              {it.name}
                            </span>
                            <SrMono className="text-[11px] text-[rgba(42,40,38,0.6)]">
                              ${(it.costPerUnit * it.orderQuantity).toFixed(2)}
                            </SrMono>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-5 border-t border-[rgba(42,40,38,0.08)]">
                        <div>
                          <SrLabel className="block mb-1">Total del pedido</SrLabel>
                          <div className="font-black italic text-[26px] text-servirest-midnight tracking-[-0.02em] leading-none">
                            ${order.totalCost.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {order.status === SupplyOrderStatus.PENDING && (
                            <SrButton
                              variant="primary"
                              size="sm"
                              iconRight={<ArrowRight size={12} />}
                              onClick={() => handleUpdateStatus(order.id, SupplyOrderStatus.ORDERED)}
                            >
                              Marcar pedido
                            </SrButton>
                          )}
                          {order.status === SupplyOrderStatus.ORDERED && (
                            <SrButton
                              variant="primary"
                              size="sm"
                              icon={<CheckCircle2 size={12} />}
                              onClick={() => handleUpdateStatus(order.id, SupplyOrderStatus.RECEIVED)}
                            >
                              Recibir
                            </SrButton>
                          )}
                        </div>
                      </div>
                    </SrCard>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── ADD / EDIT MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <SrModal open onClose={() => setIsAddModalOpen(false)} maxWidth={620}>
            <SrModalHeader
              title={editingItem ? 'Editar producto' : 'Nuevo producto'}
              kicker={editingItem ? `Estás editando · ${editingItem.name}` : 'Registra un insumo en tu inventario'}
              onClose={() => setIsAddModalOpen(false)}
            />

            <form onSubmit={handleSaveItem} className="space-y-5">
              <div>
                <SrLabel className="block mb-2">Nombre del insumo *</SrLabel>
                <SrInput name="name" defaultValue={editingItem?.name} required placeholder="Ej. Aceite de oliva" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SrLabel className="block mb-2">Categoría</SrLabel>
                  <select
                    name="category"
                    defaultValue={editingItem?.category || 'Abarrotes'}
                    className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg py-3 px-4 text-[13px] font-medium text-servirest-carbon outline-none focus:border-servirest-terracota transition-colors cursor-pointer"
                  >
                    {INVENTORY_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <SrLabel className="block mb-2">Proveedor</SrLabel>
                  <SrInput name="supplier" defaultValue={editingItem?.supplier} required placeholder="Nombre del proveedor" />
                </div>
              </div>

              <div>
                <SrLabel className="block mb-2">Unidad de medida</SrLabel>
                <div className="grid grid-cols-3 gap-3">
                  {['PZ', 'gr', 'Bolsa'].map((u) => (
                    <label key={u} className="cursor-pointer">
                      <input
                        type="radio"
                        name="unit"
                        value={u}
                        defaultChecked={editingItem?.unit === u || (!editingItem && u === 'PZ')}
                        className="sr-only peer"
                      />
                      <div className="peer-checked:bg-[rgba(196,99,63,0.10)] peer-checked:border-servirest-terracota peer-checked:text-servirest-terracota bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-md py-3 text-center text-[10px] font-black uppercase tracking-[0.16em] text-[rgba(42,40,38,0.5)] transition-colors">
                        {u}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SrLabel className="block mb-2">Cantidad actual</SrLabel>
                  <SrInput name="quantity" type="number" defaultValue={editingItem?.quantity ?? 0} />
                </div>
                <div>
                  <SrLabel className="block mb-2">Costo / unidad</SrLabel>
                  <SrInput name="cost" type="number" step="0.01" defaultValue={editingItem?.costPerUnit} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SrLabel className="block mb-2">Mínimo crítico</SrLabel>
                  <SrInput name="minStock" type="number" defaultValue={editingItem?.minStock ?? 10} />
                </div>
                <div>
                  <SrLabel className="block mb-2">Capacidad ideal</SrLabel>
                  <SrInput name="maxStock" type="number" defaultValue={editingItem?.maxStock ?? 100} />
                </div>
              </div>

              <SrButton type="submit" variant="primary" size="lg" fullWidth icon={<CheckCircle2 size={16} />}>
                {editingItem ? 'Guardar cambios' : 'Agregar al inventario'}
              </SrButton>
            </form>
          </SrModal>
        )}
      </AnimatePresence>

      {/* ─── RESTOCK MODAL ─────────────────────────────────────── */}
      <AnimatePresence>
        {restockItem && (
          <SrModal open onClose={() => setRestockItem(null)} maxWidth={420}>
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full bg-[rgba(196,99,63,0.10)] text-servirest-terracota flex items-center justify-center mx-auto mb-6 border border-servirest-terracota/30">
                <Truck size={28} />
              </div>
              <SrKicker className="block mb-2">Pedir reposición</SrKicker>
              <h3 className="font-serif italic font-medium text-[26px] text-servirest-midnight tracking-[-0.02em] m-0 mb-2 leading-tight">
                {restockItem.name}
              </h3>
              <p className="text-[12px] text-[rgba(42,40,38,0.6)] font-medium leading-relaxed m-0 mb-8">
                Stock actual: <SrMono className="text-servirest-midnight">{restockItem.quantity}</SrMono> de {restockItem.maxStock} {restockItem.unit}
              </p>

              <div className="flex items-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => setRestockQty(Math.max(0, restockQty - 1))}
                  className="w-14 h-14 rounded-sr-lg bg-servirest-hueso-sunken text-servirest-midnight hover:bg-servirest-surface hover:shadow-sr-card active:scale-95 transition-all border border-[rgba(42,40,38,0.08)] flex items-center justify-center"
                  aria-label="Restar"
                >
                  <Minus size={18} />
                </button>
                <input
                  type="number"
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="flex-1 bg-transparent border-b-2 border-[rgba(42,40,38,0.20)] outline-none text-[48px] font-black italic text-center text-servirest-midnight tracking-[-0.03em] py-2 focus:border-servirest-terracota transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setRestockQty(restockQty + 1)}
                  className="w-14 h-14 rounded-sr-lg bg-servirest-hueso-sunken text-servirest-midnight hover:bg-servirest-surface hover:shadow-sr-card active:scale-95 transition-all border border-[rgba(42,40,38,0.08)] flex items-center justify-center"
                  aria-label="Sumar"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex gap-3">
                <SrButton variant="ghost" size="md" fullWidth onClick={() => setRestockItem(null)}>
                  Cancelar
                </SrButton>
                <SrButton
                  variant="primary"
                  size="md"
                  fullWidth
                  icon={<ShoppingCart size={14} />}
                  onClick={() => addToCart(restockItem, restockQty)}
                >
                  Agregar al carrito
                </SrButton>
              </div>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      {/* ─── CART DRAWER ───────────────────────────────────────── */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div
              className="flex-1 bg-[rgba(10,12,20,0.92)] backdrop-blur-[14px]"
              onClick={() => setIsCartOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full md:w-[460px] bg-servirest-surface border-l border-[rgba(42,40,38,0.12)] shadow-sr-modal flex flex-col"
            >
              <div className="p-8 border-b border-[rgba(42,40,38,0.10)]">
                <div className="flex justify-between items-start">
                  <div>
                    <SrKicker className="block mb-1.5">Carrito de compras</SrKicker>
                    <h2 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
                      Pedido a proveedores
                    </h2>
                    <SrLabel className="block mt-2">{cart.length} productos en la lista</SrLabel>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="w-11 h-11 rounded-sr-md border border-[rgba(42,40,38,0.12)] bg-[rgba(42,40,38,0.04)] text-[rgba(42,40,38,0.6)] hover:text-servirest-carbon hover:bg-[rgba(42,40,38,0.08)] flex items-center justify-center transition-colors"
                    aria-label="Cerrar"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {cart.length === 0 ? (
                  <SrEmptyState
                    icon={<ShoppingCart size={24} />}
                    title="Carrito vacío"
                    description="Toca Pedir en cualquier producto del stock para empezar a armar tu pedido."
                  />
                ) : (
                  (Object.entries(
                    cart.reduce((acc: Record<string, CartItem[]>, item) => {
                      const key = item.supplier || 'Sin proveedor';
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(item);
                      return acc;
                    }, {})
                  ) as [string, CartItem[]][]).map(([supplier, items]) => (
                    <div key={supplier}>
                      <div className="flex items-center gap-2 mb-3">
                        <Truck size={12} className="text-servirest-terracota" />
                        <SrLabel className="text-servirest-terracota">{supplier}</SrLabel>
                        <SrMono className="ml-auto text-[11px] text-[rgba(42,40,38,0.6)]">
                          ${items.reduce((s, i) => s + i.costPerUnit * i.orderQuantity, 0).toFixed(2)}
                        </SrMono>
                      </div>
                      <div className="space-y-2 pl-4 border-l-2 border-servirest-terracota/20">
                        {items.map((item) => (
                          <SrCard key={item.id} className="px-4 py-3 flex justify-between items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-extrabold text-[13px] text-servirest-midnight tracking-tight truncate mb-0.5">{item.name}</div>
                              <SrMono className="text-[10px] text-[rgba(42,40,38,0.6)]">
                                {item.orderQuantity} {item.unit} · ${item.costPerUnit}/{item.unit}
                              </SrMono>
                            </div>
                            <div className="text-right shrink-0">
                              <SrMono className="text-servirest-terracota font-extrabold text-[12px] block">
                                ${(item.costPerUnit * item.orderQuantity).toFixed(2)}
                              </SrMono>
                              <button
                                type="button"
                                onClick={() => setCart((prev) => prev.filter((c) => c.id !== item.id))}
                                className="text-[9px] font-black uppercase tracking-[0.16em] text-servirest-danger/60 hover:text-servirest-danger transition-colors mt-1"
                              >
                                Quitar
                              </button>
                            </div>
                          </SrCard>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-[rgba(42,40,38,0.10)] bg-servirest-hueso-sunken/40">
                <div className="flex justify-between items-baseline mb-5">
                  <SrLabel>Total estimado</SrLabel>
                  <div className="font-black italic text-[32px] text-servirest-midnight tracking-[-0.03em] leading-none">
                    ${cartTotal.toFixed(2)}
                  </div>
                </div>
                <SrButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon={<Truck size={16} />}
                  onClick={handleCreateOrder}
                  disabled={cart.length === 0}
                >
                  Crear pedido a proveedor
                </SrButton>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventoryScreen;
