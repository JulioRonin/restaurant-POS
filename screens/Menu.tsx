import React, { useState, useMemo, useRef } from 'react';
import { useMenu } from '../contexts/MenuContext';
import { MenuItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import {
  Utensils,
  Plus,
  Upload,
  Search,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Tag,
  Circle,
  Layers
} from 'lucide-react';

const BASE_CATEGORIES = ['Variante', 'Entradas', 'Plato Fuerte', 'Bebidas', 'Postres', 'Extras', 'Tacos', 'Tortas', 'General'];

export const MenuScreen: React.FC = () => {
    const { menuItems, addItem, updateItem, deleteItem, toggleStatus, importCSV, clearMenu } = useMenu();
    const [activeCategory, setActiveCategory] = useState('All');
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

    const addVariant = () => {
        if (variants.length < 4) setVariants(prev => [...prev, { name: '', price: '' }]);
    };
    const updateVariant = (idx: number, field: 'name' | 'price', val: string) => {
        setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v));
    };
    const removeVariant = (idx: number) => {
        setVariants(prev => prev.filter((_, i) => i !== idx));
    };

    const allCategories = useMemo(() => {
        const fromItems = Array.from(new Set(menuItems.map(i => i.category).filter(Boolean)));
        return Array.from(new Set([...BASE_CATEGORIES, ...customCategories, ...fromItems]));
    }, [menuItems, customCategories]);

    const dynamicCategories = useMemo(() => ['All', ...allCategories], [allCategories]);

    const filteredItems = useMemo(() => {
        return menuItems.filter(item => {
            const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [menuItems, activeCategory, searchQuery]);

    const handleOpenAdd = () => {
        setEditingItem(null);
        setImagePreview(null);
        setFormCategory('General');
        setFormStatus('ACTIVE');
        setIsAddingNewCategory(false);
        setNewCategoryName('');
        setVariants(item.variants?.map(v => ({ name: v.name, price: v.price?.toString() || "" })) || []);
        setIsAddModalOpen(true);
    };

    const handleOpenEdit = (item: MenuItem) => {
        setEditingItem(item);
        setImagePreview(item.image || null);
        setFormCategory(item.category || 'General');
        setFormStatus((item.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE');
        setIsAddingNewCategory(false);
        setNewCategoryName('');
        setVariants(item.variants?.map(v => ({ name: v.name, price: v.price?.toString() || "" })) || []);
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

    const handleSaveItem = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const finalCategory = isAddingNewCategory && newCategoryName.trim()
            ? newCategoryName.trim()
            : formCategory;

        if (isAddingNewCategory && newCategoryName.trim() && !allCategories.includes(newCategoryName.trim())) {
            setCustomCategories(prev => [...prev, newCategoryName.trim()]);
        }

        const data: Omit<MenuItem, 'id'> = {
            name: formData.get('name') as string,
            category: finalCategory,
            price: parseFloat(formData.get('price') as string),
            description: formData.get('description') as string,
            gramaje: formData.get('gramaje') as string,
            status: formStatus,
            image: imagePreview || editingItem?.image || `https://picsum.photos/seed/${formData.get('name')}/400/300`,
            inventoryLevel: 4,
            variants: variants.filter(v => v.name.trim()).map(v => ({
                name: v.name.trim(),
                price: v.price ? parseFloat(v.price) : undefined
            }))
        };

        if (editingItem) {
            updateItem(editingItem.id, data as Partial<MenuItem>);
        } else {
            addItem(data);
        }
        setIsAddModalOpen(false);
        setEditingItem(null);
        setVariants(item.variants?.map(v => ({ name: v.name, price: v.price?.toString() || "" })) || []);
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
        <div className="h-full w-full bg-[#FAFAF3] text-[#1a1c14] flex flex-col overflow-hidden antialiased">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center px-8 pt-8 pb-6 gap-4 shrink-0 border-b border-white/5">
                <div>
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-1">KOSO Menu</h1>
                    <p className="text-[#505530]/30 font-bold text-[10px] uppercase tracking-[0.4em]">Gastronomical Asset Registry & Pricing Logic</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { if(confirm('⚠️ ¿ESTÁ SEGURO DE QUERER BORRAR TODO EL MENÚ?\n\nEsta acción eliminará de forma PERMANENTE todos los artículos de su dispositivo y de la nube.')) clearMenu(); }}
                        className="flex items-center gap-2 px-5 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-500/20 transition-all"
                    >
                        <Trash2 size={15} /> Borrar Todo
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-white/[0.03] border border-white/5 text-[#505530]/45 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/[0.06] transition-all"
                    >
                        <Upload size={15} /> Bulk Import
                    </button>
                    <button
                        onClick={handleOpenAdd}
                        className="flex items-center gap-2 px-6 py-3 bg-[#F98359] text-[#1a1c14] text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-solaris-glow hover:scale-105 transition-all"
                    >
                        <Plus size={15} /> Register Asset
                    </button>
                </div>
            </header>

            {/* Filters Bar */}
            <div className="px-8 py-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center shrink-0 border-b border-white/5">
                {/* Search */}
                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-3 flex-1 max-w-sm">
                    <Search className="text-[#505530]/30 shrink-0" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-transparent outline-none text-[#1a1c14] text-sm font-bold w-full placeholder:text-[#505530]/10"
                    />
                </div>

                {/* Category Pills */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar flex-wrap">
                    {dynamicCategories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                                activeCategory === cat
                                    ? 'bg-[#F98359] text-[#1a1c14] border-solaris-orange shadow-solaris-glow'
                                    : 'bg-white/[0.03] text-[#505530]/45 border-white/5 hover:text-[#1a1c14] hover:border-white/20'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Counter */}
                <div className="shrink-0 ml-auto text-right">
                    <p className="text-[9px] font-black uppercase text-[#505530]/30 tracking-widest">Total Registry</p>
                    <p className="text-2xl font-black italic text-solaris-orange leading-tight">{menuItems.length}</p>
                </div>
            </div>

            {/* Items Grid */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-8">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-10">
                        <Utensils size={64} className="mb-4" />
                        <p className="text-[11px] font-black uppercase tracking-widest">No assets in registry</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
                        {filteredItems.map(item => (
                            <motion.div key={item.id} layout>
                                <div className={`group relative rounded-[28px] border overflow-hidden flex flex-col bg-[#FAFAF3] transition-all ${item.status === 'ACTIVE' ? 'border-white/[0.07]' : 'border-red-500/10 opacity-60'}`}>
                                    {/* Image */}
                                    <div className="h-44 relative overflow-hidden shrink-0">
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0e] via-transparent to-transparent" />
                                        {/* Status toggle */}
                                        <button
                                            onClick={() => toggleStatus(item.id)}
                                            className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border transition-all ${
                                                item.status === 'ACTIVE'
                                                    ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                                                    : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                                            }`}
                                        >
                                            <Circle size={7} fill="currentColor" />
                                            {item.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                        </button>
                                    </div>

                                    {/* Content */}
                                    <div className="p-5 flex flex-col flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-black italic text-[#1a1c14] uppercase tracking-tight text-base leading-tight flex-1 mr-2 truncate">{item.name}</h3>
                                            <span className="text-solaris-orange font-black italic text-lg shrink-0">${item.price.toFixed(0)}</span>
                                        </div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#505530]/30 mb-4 flex items-center gap-1.5">
                                            <Tag size={9} /> {item.category}
                                        </p>
                                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl mb-4 flex-1">
                                            <p className="text-[10px] text-[#505530]/45 line-clamp-2 italic font-medium leading-relaxed">
                                                {item.description || 'No description recorded.'}
                                            </p>
                                        </div>
                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleOpenEdit(item)}
                                                className="flex-1 py-2.5 bg-white/[0.04] border border-white/5 text-[9px] font-black uppercase tracking-widest text-[#505530]/45 hover:text-[#1a1c14] hover:bg-white/10 transition-all flex items-center justify-center gap-2 rounded-xl"
                                            >
                                                <Edit3 size={12} /> Edit
                                            </button>
                                            <button
                                                onClick={() => { if (confirm('Remove asset from registry?')) deleteItem(item.id); }}
                                                className="px-4 bg-red-500/5 border border-red-500/10 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center rounded-xl"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── ADD / EDIT MODAL ── */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-4"
                    >
                        <div className="w-full max-w-3xl bg-[#FAFAF3] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
                            {/* Modal Header */}
                            <div className="flex justify-between items-center px-10 py-7 border-b border-white/5 shrink-0">
                                <div>
                                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-[#1a1c14]">
                                        {editingItem ? 'Edit Asset' : 'New Menu Registry'}
                                    </h2>
                                    <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.4em] mt-1 italic">
                                        {editingItem ? `Recalibrating: ${editingItem.name}` : 'Register new gastronomical asset'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="w-12 h-12 bg-white/[0.04] rounded-full flex items-center justify-center text-[#505530]/30 hover:text-[#1a1c14] hover:bg-white/10 transition-all"
                                >
                                    <XCircle size={22} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto no-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
                                    {/* Left: Image upload */}
                                    <div className="p-8 border-r border-white/5 flex flex-col items-center gap-4">
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full aspect-square bg-white/[0.02] border-2 border-dashed border-white/10 rounded-3xl overflow-hidden cursor-pointer flex items-center justify-center transition-all hover:border-solaris-orange/40 relative group"
                                        >
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-center">
                                                    <Plus className="mx-auto text-[#505530]/10 mb-3 group-hover:text-solaris-orange transition-colors" size={36} />
                                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#505530]/10 group-hover:text-[#505530]/45 transition-colors">Upload Image</p>
                                                </div>
                                            )}
                                            <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                                        </div>
                                        <p className="text-[8px] font-black uppercase text-[#505530]/10 tracking-[0.3em] text-center italic">Image Verification Buffer</p>

                                        {/* Active/Inactive Toggle */}
                                        <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[9px] font-black uppercase text-[#505530]/30 tracking-widest mb-3 italic">Status on POS</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormStatus('ACTIVE')}
                                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-1.5 ${formStatus === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-white/[0.02] text-[#505530]/30 border-white/5'}`}
                                                >
                                                    <Circle size={7} fill="currentColor" /> Active
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormStatus('INACTIVE')}
                                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-1.5 ${formStatus === 'INACTIVE' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/[0.02] text-[#505530]/30 border-white/5'}`}
                                                >
                                                    <Circle size={7} fill="currentColor" /> Inactive
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Form Fields */}
                                    <div className="p-8 space-y-5">
                                        {/* Name */}
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-[#505530]/30 tracking-widest block mb-2">Dish Name *</label>
                                            <input
                                                name="name"
                                                defaultValue={editingItem?.name}
                                                required
                                                placeholder="e.g. Corte New York"
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-[#1a1c14] outline-none focus:border-solaris-orange/50 transition-all font-bold text-sm"
                                            />
                                        </div>

                                        {/* Price + Gramaje */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-[#505530]/30 tracking-widest block mb-2">Price (MXN) *</label>
                                                <input
                                                    name="price"
                                                    type="number"
                                                    step="0.01"
                                                    defaultValue={editingItem?.price}
                                                    required
                                                    placeholder="0.00"
                                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-[#1a1c14] text-sm outline-none focus:border-solaris-orange/50 transition-all font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-[#505530]/30 tracking-widest block mb-2">Gramaje / Portion</label>
                                                <input
                                                    name="gramaje"
                                                    defaultValue={editingItem?.gramaje}
                                                    placeholder="e.g. 300g"
                                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-[#1a1c14] text-sm outline-none focus:border-solaris-orange/50 transition-all font-bold"
                                                />
                                            </div>
                                        </div>

                                        {/* Category */}
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-[#505530]/30 tracking-widest block mb-2">Category</label>
                                            {!isAddingNewCategory ? (
                                                <div className="flex gap-2">
                                                    <select
                                                        value={formCategory}
                                                        onChange={e => setFormCategory(e.target.value)}
                                                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-[#1a1c14] text-sm outline-none focus:border-solaris-orange/50 transition-all font-bold appearance-none cursor-pointer"
                                                    >
                                                        {allCategories.map(cat => (
                                                            <option key={cat} value={cat} className="bg-[#FAFAF3]">{cat}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsAddingNewCategory(true)}
                                                        className="px-4 bg-[#F98359]/10 border border-solaris-orange/20 text-solaris-orange rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-[#F98359]/20 transition-all whitespace-nowrap"
                                                    >
                                                        + New
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newCategoryName}
                                                        onChange={e => setNewCategoryName(e.target.value)}
                                                        placeholder="New category name..."
                                                        autoFocus
                                                        className="flex-1 bg-white/[0.03] border border-solaris-orange/40 rounded-2xl py-4 px-5 text-[#1a1c14] text-sm outline-none font-bold"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsAddingNewCategory(false)}
                                                        className="px-4 bg-white/[0.03] border border-white/10 text-[#505530]/45 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:text-[#1a1c14] transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-[#505530]/30 tracking-widest block mb-2">Description</label>
                                            <textarea
                                                name="description"
                                                defaultValue={editingItem?.description}
                                                placeholder="Describe ingredients, preparation, allergens..."
                                                rows={3}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-[#1a1c14] text-sm outline-none focus:border-solaris-orange/50 transition-all font-medium resize-none"
                                            />
                                        </div>

                                        {/* Variants */}
                                        <div className="border border-white/5 rounded-2xl p-5 bg-white/[0.01]">
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Layers size={14} className="text-solaris-orange" />
                                                    <span className="text-[9px] font-black uppercase text-[#505530]/45 tracking-widest">Variantes <span className="text-solaris-orange">({variants.length}/4)</span></span>
                                                </div>
                                                {variants.length < 4 && (
                                                    <button
                                                        type="button"
                                                        onClick={addVariant}
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-[#F98359]/10 border border-solaris-orange/20 text-solaris-orange rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-[#F98359]/20 transition-all"
                                                    >
                                                        <Plus size={10} /> Variante
                                                    </button>
                                                )}
                                            </div>
                                            {variants.length === 0 && (
                                                <p className="text-[9px] text-[#505530]/10 font-black uppercase tracking-widest text-center py-3 italic">Sin variantes — añade hasta 4</p>
                                            )}
                                            <div className="space-y-3">
                                                {variants.map((v, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center">
                                                        <input
                                                            type="text"
                                                            placeholder={`Variante ${idx + 1} (ej. Grande)`}
                                                            value={v.name}
                                                            onChange={e => updateVariant(idx, 'name', e.target.value)}
                                                            className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-[#1a1c14] text-xs outline-none focus:border-solaris-orange/40 font-bold"
                                                        />
                                                        <input
                                                            type="number"
                                                            placeholder="Precio"
                                                            value={v.price}
                                                            onChange={e => updateVariant(idx, 'price', e.target.value)}
                                                            className="w-24 bg-white/[0.03] border border-white/10 rounded-xl py-3 px-3 text-[#1a1c14] text-xs outline-none focus:border-solaris-orange/40 font-bold text-center"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeVariant(idx)}
                                                            className="w-8 h-8 flex items-center justify-center text-red-500/40 hover:text-red-500 transition-colors"
                                                        >
                                                            <XCircle size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Submit */}
                                        <button
                                            type="submit"
                                            className="w-full bg-[#F98359] text-[#1a1c14] font-black uppercase tracking-[0.2em] py-5 rounded-2xl shadow-solaris-glow hover:bg-orange-500 active:scale-95 transition-all text-[11px] flex items-center justify-center gap-3"
                                        >
                                            <CheckCircle size={18} />
                                            {editingItem ? 'Save Changes' : 'Add to Menu'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── BULK IMPORT MODAL ── */}
            <AnimatePresence>
                {isImportModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-4"
                    >
                        <div className="w-full max-w-2xl bg-[#FAFAF3] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden">
                            <div className="flex justify-between items-center px-10 py-7 border-b border-white/5">
                                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-[#1a1c14]">Bulk Import CSV</h2>
                                <button onClick={() => setIsImportModalOpen(false)} className="w-12 h-12 bg-white/[0.04] rounded-full flex items-center justify-center text-[#505530]/30 hover:text-[#1a1c14] hover:bg-white/10 transition-all">
                                    <XCircle size={22} />
                                </button>
                            </div>
                            <div className="p-10 space-y-6">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] text-[#505530]/45 font-black uppercase tracking-widest">
                                        Format: <span className="text-solaris-orange">name, category, price, description</span>
                                    </p>
                                    <button
                                        onClick={() => csvFileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/10 text-[#505530]/60 text-[8px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 hover:text-[#1a1c14] transition-all transition-colors"
                                    >
                                        <Upload size={12} /> Upload CSV File
                                    </button>
                                    <input
                                        type="file"
                                        ref={csvFileInputRef}
                                        onChange={handleCsvFileUpload}
                                        className="hidden"
                                        accept=".csv,.txt"
                                    />
                                </div>
                                <textarea
                                    value={csvInput}
                                    onChange={e => setCsvInput(e.target.value)}
                                    placeholder={"Tacos de Carne, Tacos, 75, Tacos de carne asada\nEnsalada César, Entradas, 120, Lechuga romana, aderezo"}
                                    rows={8}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-[#1a1c14] text-sm outline-none focus:border-solaris-orange/50 transition-all font-mono resize-none"
                                />
                                {importResult && (
                                    <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${importResult.errors.length ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                        {importResult.errors.length ? importResult.errors.join(', ') : `${importResult.count} assets imported successfully`}
                                    </div>
                                )}
                                <button onClick={handleImport} className="w-full py-5 bg-[#F98359] text-[#1a1c14] font-black uppercase tracking-[0.2em] rounded-2xl shadow-solaris-glow hover:scale-[1.02] active:scale-95 transition-all text-[11px]">
                                    Execute Import
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
