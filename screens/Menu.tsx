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
  Coffee,
  Circle
} from 'lucide-react';

export const MenuScreen: React.FC = () => {
    const { menuItems, addItem, updateItem, deleteItem, toggleStatus, importCSV } = useMenu();
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [csvInput, setCsvInput] = useState('');
    const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
    const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);

    const dynamicCategories = useMemo(() => {
        const existing = Array.from(new Set(menuItems.map(item => item.category)));
        const base = ['Entradas', 'Plato Fuerte', 'Bebidas', 'Postres', 'Extras', 'Tacos', 'Tortas'];
        return Array.from(new Set(['All', ...base, ...existing]));
    }, [menuItems]);

    const filteredItems = useMemo(() => {
        return menuItems.filter(item => {
            const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [menuItems, activeCategory, searchQuery]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
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

    const handleSaveItem = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name') as string,
            category: formData.get('category') as string,
            price: parseFloat(formData.get('price') as string),
            description: formData.get('description') as string,
            gramaje: formData.get('gramaje') as string,
            status: (formData.get('status') as string) === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
            image: imagePreview || (editingItem?.image) || `https://picsum.photos/seed/${formData.get('name')}/200`,
            inventoryLevel: 4
        };

        if (editingItem) {
            updateItem(editingItem.id, data as Partial<MenuItem>);
        } else {
            addItem(data as Omit<MenuItem, 'id'>);
        }
        setIsAddModalOpen(false);
        setEditingItem(null);
        setIsAddingNewCategory(false);
    };

    return (
        <div className="h-full w-full bg-solaris-black text-white p-6 md:p-10 overflow-y-auto antialiased">
            <div className="max-w-7xl mx-auto w-full">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Solaris Menu</h1>
                        <p className="text-gray-600 font-bold text-[10px] uppercase tracking-[0.4em]">Gastronomical Asset Registry & Pricing Logic</p>
                    </motion.div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-3 px-6 py-3 bg-white/[0.03] border border-white/5 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/[0.05] transition-all"
                        >
                            <Upload size={16} /> Bulk Import
                        </button>
                        <button
                            onClick={() => { setEditingItem(null); setImagePreview(null); setIsAddModalOpen(true); }}
                            className="flex items-center gap-3 px-8 py-3 bg-solaris-orange text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-solaris-glow hover:scale-105 transition-all"
                        >
                            <Plus size={16} /> Register Asset
                        </button>
                    </div>
                </header>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    <div className="md:col-span-3 bg-white/[0.02] border border-white/5 p-2 rounded-solaris flex items-center gap-4">
                        <div className="flex-1 flex items-center gap-4 px-6 border-r border-white/5">
                            <Search className="text-gray-600" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name or technical spec..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none outline-none font-bold text-white text-sm"
                            />
                        </div>
                        <div className="flex gap-1 overflow-x-auto p-1 max-w-full no-scrollbar">
                            {dynamicCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-white/[0.05] text-solaris-orange border border-solaris-orange/20' : 'text-gray-600 hover:text-gray-400'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-solaris flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-700">Total Registry</p>
                            <p className="text-2xl font-black italic text-solaris-orange">{menuItems.length}</p>
                        </div>
                        <Utensils className="text-gray-800" size={32} />
                    </div>
                </div>

                {/* Grid of Items (Replacing Table for better visual) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
                    {filteredItems.map(item => (
                        <motion.div key={item.id} layout>
                            <GlowCard glowColor="orange" className={`relative group border !p-0 overflow-hidden ${item.status === 'ACTIVE' ? 'border-white/5' : 'border-red-500/10 opacity-60'}`}>
                                <div className="h-48 overflow-hidden relative">
                                    <img src={item.image} alt="" className="w-full h-full object-cover filter contrast-125 transition-transform duration-700 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                    <div className="absolute top-4 right-4">
                                        <button 
                                            onClick={() => toggleStatus(item.id)}
                                            className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 border ${item.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}
                                        >
                                            <Circle size={8} fill="currentColor" /> {item.status}
                                        </button>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-black italic tracking-tight text-white uppercase">{item.name}</h3>
                                        <span className="text-solaris-orange font-black italic text-lg">${item.price.toFixed(0)}</span>
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-6">{item.category}</p>
                                    
                                    <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl mb-6">
                                        <p className="text-[10px] text-gray-400 line-clamp-2 italic font-medium">"{item.description || 'No data recorded for this asset.'}"</p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => { setEditingItem(item); setImagePreview(item.image); setIsAddModalOpen(true); }}
                                            className="flex-1 py-3 px-4 bg-white/[0.03] border border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Edit3 size={12} /> Mod.
                                        </button>
                                        <button 
                                            onClick={() => { if(confirm('Erase asset from network?')) deleteItem(item.id); }}
                                            className="px-4 bg-red-500/5 border border-red-500/10 text-red-500/60 hover:text-red-500 transition-all flex items-center justify-center rounded-xl"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </GlowCard>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Modal Layer */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#0a0a0b] border border-white/10 rounded-solaris w-full max-w-2xl overflow-hidden shadow-2xl">
                            <form onSubmit={handleSaveItem}>
                                <div className="p-8 md:p-12">
                                    <div className="flex justify-between items-center mb-10">
                                        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">{editingItem ? 'Asset Recalibration' : 'New Menu Registry'}</h2>
                                        <XCircle onClick={() => setIsAddModalOpen(false)} className="text-gray-700 hover:text-white cursor-pointer" size={32} />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        {/* Image Upload Area */}
                                        <div className="space-y-4">
                                            <div onClick={() => fileInputRef.current?.click()} className="group relative w-full aspect-square bg-white/[0.02] border-2 border-dashed border-white/10 rounded-solaris overflow-hidden cursor-pointer flex items-center justify-center transition-all hover:border-solaris-orange/40">
                                                {imagePreview || editingItem?.image ? (
                                                    <img src={imagePreview || editingItem?.image} alt="" className="w-full h-full object-cover filter contrast-125" />
                                                ) : (
                                                    <div className="text-center">
                                                        <Plus className="mx-auto text-gray-700 mb-4 group-hover:text-solaris-orange transition-colors" size={40} />
                                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-700">Upload Visual Data</p>
                                                    </div>
                                                )}
                                                <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                                            </div>
                                            <p className="text-[8px] font-black uppercase text-gray-800 tracking-[0.4em] text-center italic">Image Verification Buffer</p>
                                        </div>

                                        {/* Form Fields */}
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Functional Name</label>
                                                <input name="name" defaultValue={editingItem?.name} required placeholder="Asset ID" className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-solaris-orange/50 transition-all font-bold" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Market Category</label>
                                                    <input name="category" defaultValue={editingItem?.category || 'General'} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 px-5 text-white text-xs outline-none focus:border-solaris-orange/50 transition-all font-bold" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Asset Value ($)</label>
                                                    <input name="price" type="number" step="0.01" defaultValue={editingItem?.price} required className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 px-5 text-white text-xs outline-none focus:border-solaris-orange/50 transition-all font-bold" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Technical Specs</label>
                                                <textarea name="description" defaultValue={editingItem?.description} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white text-xs outline-none focus:border-solaris-orange/50 transition-all font-medium h-32 resize-none" />
                                            </div>
                                            <button type="submit" className="w-full bg-solaris-orange text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl shadow-solaris-glow hover:bg-orange-600 transition-all text-[11px] flex items-center justify-center gap-3">
                                                Commit to Solaris Network
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
