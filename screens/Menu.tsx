import React, { useState, useMemo, useRef } from 'react';
import { useMenu } from '../contexts/MenuContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { uploadMenuPhoto } from '../services/auth';
import { MenuItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils, Plus, Upload, Search, Edit3, Trash2, CheckCircle2,
  Tag, Layers, X, ImageIcon, FileSpreadsheet, Sparkles,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrInput, SrLabel, SrKicker, SrMono,
  SrModal, SrModalHeader, SrEmptyState, SrTabs, SrTierUpgradeModal,
} from '../components/ui/servirest';

const BASE_CATEGORIES = ['Variante', 'Entradas', 'Plato Fuerte', 'Bebidas', 'Postres', 'Extras', 'Tacos', 'Tortas', 'General'];

export const MenuScreen: React.FC = () => {
  const { menuItems, addItem, updateItem, deleteItem, toggleStatus, importCSV, clearMenu } = useMenu();
  const { tier, isWithinLimit } = useSubscription();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [csvInput, setCsvInput] = useState('');
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formCategory, setFormCategory] = useState('General');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // Variants state
  const [variants, setVariants] = useState<{ name: string; price: string }[]>([]);
  const [variantMode, setVariantMode] = useState<'single' | 'multi'>('single');

  const addVariant = () => {
    if (variants.length < 10) setVariants((prev) => [...prev, { name: '', price: '' }]);
  };
  const updateVariant = (idx: number, field: 'name' | 'price', val: string) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: val } : v)));
  };
  const removeVariant = (idx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const allCategories = useMemo(() => {
    const fromItems = Array.from(new Set(menuItems.map((i) => i.category).filter(Boolean)));
    return Array.from(new Set([...BASE_CATEGORIES, ...customCategories, ...fromItems]));
  }, [menuItems, customCategories]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, activeCategory, searchQuery]);

  const stats = useMemo(() => {
    const total = menuItems.length;
    const active = menuItems.filter((i) => i.status === 'ACTIVE').length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [menuItems]);

  const categoryTabs = useMemo(
    () =>
      [
        { id: 'All', label: 'Todo', count: menuItems.length },
        ...allCategories.map((c) => ({
          id: c,
          label: c,
          count: menuItems.filter((m) => m.category === c).length,
        })),
      ] as const,
    [allCategories, menuItems]
  );

  const handleOpenAdd = () => {
    setEditingItem(null);
    setImagePreview(null);
    setFormCategory('General');
    setFormStatus('ACTIVE');
    setIsAddingNewCategory(false);
    setNewCategoryName('');
    setVariants([]);
    setVariantMode('single');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setImagePreview(item.image || null);
    setFormCategory(item.category || 'General');
    setFormStatus((item.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE');
    setIsAddingNewCategory(false);
    setNewCategoryName('');
    setVariants(item.variants?.map((v) => ({ name: v.name, price: v.price?.toString() || '' })) || []);
    setVariantMode(item.variantMode || 'single');
    setIsAddModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const [savingItem, setSavingItem] = useState(false);

  const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingItem) return;
    const formData = new FormData(e.currentTarget);
    const finalCategory = isAddingNewCategory && newCategoryName.trim()
      ? newCategoryName.trim()
      : formCategory;

    if (isAddingNewCategory && newCategoryName.trim() && !allCategories.includes(newCategoryName.trim())) {
      setCustomCategories((prev) => [...prev, newCategoryName.trim()]);
    }

    // Tier limit para nuevos — chequear antes de subir la foto.
    if (!editingItem && !isWithinLimit('maxProducts', menuItems.length + 1)) {
      setShowLimitModal(true);
      return;
    }

    setSavingItem(true);
    try {
      // ── Subir la foto a Supabase Storage (si es una nueva imagen local) ──
      // Antes se guardaba base64 en la BD → se truncaba al sincronizar y las
      // fotos no se veían. Ahora subimos el archivo y guardamos la URL.
      const businessId = (menuItems[0] as any)?.businessId || (editingItem as any)?.businessId || '';
      const photoItemId = editingItem?.id || crypto.randomUUID();
      let finalImage = imagePreview || editingItem?.image || `https://picsum.photos/seed/${formData.get('name')}/400/300`;

      if (imagePreview && imagePreview.startsWith('data:') && businessId) {
        const url = await uploadMenuPhoto(businessId, photoItemId, imagePreview);
        if (url) finalImage = url; // si falla la subida, cae al base64 (fallback)
      }

      const data: Omit<MenuItem, 'id'> = {
        name: formData.get('name') as string,
        category: finalCategory,
        price: parseFloat(formData.get('price') as string),
        description: formData.get('description') as string,
        gramaje: formData.get('gramaje') as string,
        status: formStatus,
        image: finalImage,
        inventoryLevel: 4,
        variants: variants.filter((v) => v.name.trim()).map((v) => ({
          name: v.name.trim(),
          price: v.price ? parseFloat(v.price) : undefined,
        })),
        variantMode,
      };

      if (editingItem) {
        await updateItem(editingItem.id, data as Partial<MenuItem>);
      } else {
        await addItem(data);
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
      setVariants([]);
      setImagePreview(null);
    } finally {
      setSavingItem(false);
    }
  };

  const handleImport = async () => {
    const result = await importCSV(csvInput);
    setImportResult({ count: result.count, errors: result.errors });
    if (result.success) {
      setCsvInput('');
      setTimeout(() => setIsImportModalOpen(false), 2000);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvInput(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon antialiased">
      <div className="px-[38px] py-10 max-w-[1480px] mx-auto pb-32 lg:pb-12">
        {/* ─── HEADER ────────────────────────────────────────────── */}
        <div className="flex justify-between items-start flex-wrap gap-6 mb-12">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Catálogo de platillos</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              Menú
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[480px] leading-relaxed">
              Aquí vive tu menú. Crea, edita y publica los platillos que tus meseros van a vender hoy mismo.
            </p>
          </motion.div>

          {/* Mini-stats rail */}
          <div className="flex gap-3 flex-wrap">
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Total</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-midnight tracking-[-0.03em] leading-none">
                {stats.total}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Activos</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-success tracking-[-0.03em] leading-none">
                {stats.active}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Inactivos</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-mostaza tracking-[-0.03em] leading-none">
                {stats.inactive}
              </div>
            </SrCard>
          </div>
        </div>

        {/* ─── CONTROLS BAR ──────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between mb-6">
          <div className="flex-1 max-w-md">
            <SrInput
              shape="pill"
              icon={<Search size={14} />}
              placeholder="Buscar platillo por nombre o descripción…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            <SrButton
              variant="outline"
              size="md"
              icon={<Trash2 size={14} />}
              onClick={() => {
                if (window.confirm('¿Estás seguro de borrar todo el menú? Esta acción es permanente y elimina los platillos en la nube.')) {
                  clearMenu();
                }
              }}
            >
              Borrar todo
            </SrButton>
            <SrButton
              variant="outline"
              size="md"
              icon={<Upload size={14} />}
              onClick={() => setIsImportModalOpen(true)}
            >
              Importar CSV
            </SrButton>
            <SrButton
              variant="primary"
              size="md"
              icon={<Plus size={14} />}
              onClick={handleOpenAdd}
            >
              Nuevo platillo
            </SrButton>
          </div>
        </div>

        {/* ─── CATEGORY TABS ─────────────────────────────────────── */}
        <div className="mb-8">
          <SrTabs<string>
            tabs={categoryTabs as any}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        {/* ─── ITEMS GRID ────────────────────────────────────────── */}
        {filteredItems.length === 0 ? (
          <SrCard variant="solaris" className="p-12">
            <SrEmptyState
              icon={<Utensils size={28} />}
              title={menuItems.length === 0 ? 'Aún no tienes platillos' : 'Sin coincidencias'}
              description={
                menuItems.length === 0
                  ? 'Crea tu primer platillo para empezar a vender. Te toma menos de un minuto.'
                  : 'Prueba con otra búsqueda o cambia de categoría.'
              }
              action={
                menuItems.length === 0 ? (
                  <SrButton variant="primary" icon={<Plus size={14} />} onClick={handleOpenAdd}>
                    Crear primer platillo
                  </SrButton>
                ) : undefined
              }
            />
          </SrCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SrCard
                    hover
                    className={`overflow-hidden flex flex-col h-full ${item.status === 'INACTIVE' ? 'opacity-70' : ''}`}
                  >
                    {/* Image */}
                    <div className="h-44 relative overflow-hidden shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => toggleStatus(item.id)}
                        className="absolute top-3 right-3"
                        title={item.status === 'ACTIVE' ? 'Activo — toca para pausar' : 'Inactivo — toca para activar'}
                      >
                        <SrChip tone={item.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {item.status === 'ACTIVE' ? 'Activo' : 'Pausado'}
                        </SrChip>
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex justify-between items-start gap-3 mb-1.5">
                        <h3 className="font-serif italic font-medium text-[18px] text-servirest-midnight tracking-[-0.015em] leading-tight m-0 flex-1 line-clamp-2">
                          {item.name}
                        </h3>
                        <SrMono className="text-servirest-terracota font-extrabold text-[16px] shrink-0">
                          ${item.price.toFixed(0)}
                        </SrMono>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Tag size={10} className="text-[rgba(42,40,38,0.4)]" />
                        <SrLabel>{item.category}</SrLabel>
                        {item.gramaje && (
                          <>
                            <span className="text-[rgba(42,40,38,0.2)]">·</span>
                            <SrMono className="text-[10px] text-[rgba(42,40,38,0.5)]">{item.gramaje}</SrMono>
                          </>
                        )}
                      </div>

                      <p className="text-[12px] text-[rgba(42,40,38,0.6)] font-medium leading-relaxed mb-4 flex-1 line-clamp-2">
                        {item.description || 'Sin descripción todavía.'}
                      </p>

                      {item.variants && item.variants.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                          <Layers size={10} className="text-servirest-terracota" />
                          <SrLabel className="text-servirest-terracota">{item.variants.length} variantes</SrLabel>
                        </div>
                      )}

                      <div className="flex gap-2 mt-auto">
                        <SrButton
                          variant="outline"
                          size="sm"
                          icon={<Edit3 size={12} />}
                          onClick={() => handleOpenEdit(item)}
                          className="flex-1"
                        >
                          Editar
                        </SrButton>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Eliminar "${item.name}" del menú? Esta acción no se puede revertir.`)) {
                              deleteItem(item.id);
                            }
                          }}
                          className="w-11 h-11 rounded-sr-md bg-[rgba(225,85,75,0.06)] text-servirest-danger/60 hover:text-servirest-danger hover:bg-[rgba(225,85,75,0.10)] flex items-center justify-center transition-colors"
                          aria-label="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </SrCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ─── ADD / EDIT MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <SrModal open onClose={() => setIsAddModalOpen(false)} maxWidth={880}>
            <SrModalHeader
              title={editingItem ? 'Editar platillo' : 'Nuevo platillo'}
              kicker={editingItem ? `Estás editando · ${editingItem.name}` : 'Agrega un platillo al menú'}
              onClose={() => setIsAddModalOpen(false)}
            />

            <form onSubmit={handleSaveItem} className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 max-h-[72vh] overflow-y-auto custom-scrollbar pr-1">
              {/* LEFT — image + status */}
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square bg-servirest-hueso-sunken/40 border-2 border-dashed border-[rgba(42,40,38,0.20)] rounded-sr-xl overflow-hidden cursor-pointer flex items-center justify-center transition-colors hover:border-servirest-terracota/40 relative group"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center px-4">
                      <ImageIcon className="mx-auto text-[rgba(42,40,38,0.3)] mb-3 group-hover:text-servirest-terracota transition-colors" size={36} />
                      <SrLabel className="block">Toca para subir foto</SrLabel>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                </div>

                <SrCard className="p-4">
                  <SrLabel className="block mb-3">Estado en POS</SrLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormStatus('ACTIVE')}
                      className={`py-3 rounded-sr-md text-[9px] font-black uppercase tracking-[0.18em] transition-colors border ${
                        formStatus === 'ACTIVE'
                          ? 'bg-[rgba(34,160,107,0.10)] border-servirest-success/40 text-servirest-success'
                          : 'bg-servirest-surface border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.4)]'
                      }`}
                    >
                      Activo
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus('INACTIVE')}
                      className={`py-3 rounded-sr-md text-[9px] font-black uppercase tracking-[0.18em] transition-colors border ${
                        formStatus === 'INACTIVE'
                          ? 'bg-[rgba(225,85,75,0.08)] border-servirest-danger/40 text-servirest-danger'
                          : 'bg-servirest-surface border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.4)]'
                      }`}
                    >
                      Pausado
                    </button>
                  </div>
                </SrCard>
              </div>

              {/* RIGHT — fields */}
              <div className="space-y-5">
                <div>
                  <SrLabel className="block mb-2">Nombre del platillo *</SrLabel>
                  <SrInput name="name" defaultValue={editingItem?.name} required placeholder="Ej. Corte New York" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <SrLabel className="block mb-2">Precio (MXN) *</SrLabel>
                    <SrInput name="price" type="number" step="0.01" defaultValue={editingItem?.price} required placeholder="0.00" />
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Gramaje / Porción</SrLabel>
                    <SrInput name="gramaje" defaultValue={editingItem?.gramaje} placeholder="Ej. 300g" />
                  </div>
                </div>

                <div>
                  <SrLabel className="block mb-2">Categoría</SrLabel>
                  {!isAddingNewCategory ? (
                    <div className="flex gap-2">
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="flex-1 bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg py-3 px-4 text-[13px] font-medium text-servirest-carbon outline-none focus:border-servirest-terracota transition-colors cursor-pointer"
                      >
                        {allCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <SrButton type="button" variant="outline" size="sm" icon={<Plus size={12} />} onClick={() => setIsAddingNewCategory(true)}>
                        Nueva
                      </SrButton>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <SrInput
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nombre de la categoría…"
                        autoFocus
                      />
                      <SrButton type="button" variant="ghost" size="sm" onClick={() => setIsAddingNewCategory(false)}>
                        Cancelar
                      </SrButton>
                    </div>
                  )}
                </div>

                <div>
                  <SrLabel className="block mb-2">Descripción</SrLabel>
                  <textarea
                    name="description"
                    defaultValue={editingItem?.description}
                    placeholder="Describe ingredientes, preparación, alérgenos…"
                    rows={3}
                    className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg py-3 px-4 text-[13px] font-medium text-servirest-carbon placeholder:text-[rgba(42,40,38,0.4)] outline-none focus:border-servirest-terracota transition-colors resize-none"
                  />
                </div>

                {/* Variants */}
                <SrCard className="p-5">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-servirest-terracota" />
                      <SrLabel>
                        Variantes <span className="text-servirest-terracota">({variants.length}/10)</span>
                      </SrLabel>
                    </div>
                    {variants.length < 10 && (
                      <SrButton type="button" variant="outline" size="sm" icon={<Plus size={10} />} onClick={addVariant}>
                        Variante
                      </SrButton>
                    )}
                  </div>

                  {/* Modo de selección */}
                  {variants.length > 0 && (
                    <div className="mb-4 p-3 rounded-sr-sm bg-servirest-hueso-sunken/40 border border-[rgba(42,40,38,0.08)]">
                      <SrLabel className="block mb-2 text-[10px]">Cómo elige el cliente</SrLabel>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setVariantMode('single')}
                          className={`p-3 rounded-sr-sm text-left transition-all ${
                            variantMode === 'single'
                              ? 'bg-servirest-terracota text-servirest-hueso shadow-sr-glow'
                              : 'bg-servirest-surface text-[rgba(42,40,38,0.6)] border border-[rgba(42,40,38,0.12)]'
                          }`}
                        >
                          <div className="text-[11px] font-black uppercase tracking-[0.12em]">Elige UNA</div>
                          <div className="text-[10px] mt-1 opacity-80">Ej. tamaños, sabores</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVariantMode('multi')}
                          className={`p-3 rounded-sr-sm text-left transition-all ${
                            variantMode === 'multi'
                              ? 'bg-servirest-terracota text-servirest-hueso shadow-sr-glow'
                              : 'bg-servirest-surface text-[rgba(42,40,38,0.6)] border border-[rgba(42,40,38,0.12)]'
                          }`}
                        >
                          <div className="text-[11px] font-black uppercase tracking-[0.12em]">Puede combinar</div>
                          <div className="text-[10px] mt-1 opacity-80">Ej. toppings extra</div>
                        </button>
                      </div>
                    </div>
                  )}
                  {variants.length === 0 ? (
                    <p className="text-[11px] text-[rgba(42,40,38,0.4)] font-medium italic text-center py-3">
                      Sin variantes — añade hasta 10 (ej. tamaños, ingredientes opcionales).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {variants.map((v, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <div className="flex-1">
                            <SrInput
                              placeholder={`Variante ${idx + 1} (ej. Grande)`}
                              value={v.name}
                              onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                            />
                          </div>
                          <div className="w-24">
                            <SrInput
                              type="number"
                              placeholder="Precio"
                              value={v.price}
                              onChange={(e) => updateVariant(idx, 'price', e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVariant(idx)}
                            className="w-9 h-9 rounded-sr-md text-servirest-danger/50 hover:text-servirest-danger hover:bg-[rgba(225,85,75,0.08)] flex items-center justify-center transition-colors"
                            aria-label="Quitar variante"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SrCard>

                {/* Submit */}
                <SrButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={savingItem}
                  icon={<CheckCircle2 size={16} />}
                >
                  {savingItem ? 'Guardando foto…' : editingItem ? 'Guardar cambios' : 'Agregar al menú'}
                </SrButton>
              </div>
            </form>
          </SrModal>
        )}
      </AnimatePresence>

      {/* ─── BULK IMPORT MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {isImportModalOpen && (
          <SrModal open onClose={() => setIsImportModalOpen(false)} maxWidth={680}>
            <SrModalHeader
              title="Importar CSV"
              kicker="Sube tu menú en bloque"
              onClose={() => setIsImportModalOpen(false)}
            />

            <div className="space-y-5">
              <SrCard className="p-5 bg-[rgba(196,99,63,0.04)] border-servirest-terracota/20">
                <div className="flex items-start gap-3">
                  <Sparkles size={16} className="text-servirest-terracota shrink-0 mt-0.5" />
                  <div>
                    <SrLabel className="block mb-1.5 text-servirest-terracota">Formato esperado</SrLabel>
                    <SrMono className="text-[12px] text-servirest-carbon">
                      nombre, categoría, precio, descripción
                    </SrMono>
                  </div>
                </div>
              </SrCard>

              <div className="flex justify-end">
                <SrButton
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<FileSpreadsheet size={12} />}
                  onClick={() => csvFileInputRef.current?.click()}
                >
                  Subir archivo CSV
                </SrButton>
                <input
                  type="file"
                  ref={csvFileInputRef}
                  onChange={handleCsvFileUpload}
                  className="hidden"
                  accept=".csv,.txt"
                />
              </div>

              <div>
                <SrLabel className="block mb-2">O pega aquí tu CSV</SrLabel>
                <textarea
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder={'Tacos de Carne, Tacos, 75, Tacos de carne asada\nEnsalada César, Entradas, 120, Lechuga romana con aderezo'}
                  rows={8}
                  className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg py-3 px-4 text-[12px] font-mono text-servirest-carbon placeholder:text-[rgba(42,40,38,0.4)] outline-none focus:border-servirest-terracota transition-colors resize-none"
                />
              </div>

              {importResult && (
                <SrCard className={importResult.errors.length ? 'p-4 bg-[rgba(225,85,75,0.06)] border-servirest-danger/30' : 'p-4 bg-[rgba(34,160,107,0.06)] border-servirest-success/30'}>
                  <span className={`text-[11px] font-extrabold tracking-tight ${importResult.errors.length ? 'text-servirest-danger' : 'text-servirest-success'}`}>
                    {importResult.errors.length
                      ? importResult.errors.join(', ')
                      : `${importResult.count} platillos importados con éxito`}
                  </span>
                </SrCard>
              )}

              <SrButton
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                icon={<Upload size={16} />}
                onClick={handleImport}
              >
                Importar al menú
              </SrButton>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      <SrTierUpgradeModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limit="maxProducts"
        currentTier={tier}
      />
    </div>
  );
};

export default MenuScreen;
