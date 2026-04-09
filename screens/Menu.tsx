import React, { useState, useMemo, useRef } from 'react';
import { useMenu } from '../contexts/MenuContext';
import { MenuItem } from '../types';
import { CATEGORIES } from '../constants';

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
    const [newCategoryName, setNewCategoryName] = useState('');

    // Dynamic Categories from existing items + initial ones
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
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        <div className="flex h-full w-full bg-[#F3F4F6] text-gray-800 p-8 overflow-hidden font-sans">
            <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full">
                {/* Header */}
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestión de Menú</h1>
                        <p className="text-gray-500 font-medium">Administra tus platillos, precios y disponibilidad en tiempo real.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 px-5 py-3 bg-white text-gray-700 font-bold rounded-2xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-all active:scale-95"
                        >
                            <span className="material-icons-round text-primary">upload_file</span>
                            Carga Masiva CSV
                        </button>
                        <button
                            onClick={() => { 
                                setEditingItem(null); 
                                setImagePreview(null);
                                setIsAddModalOpen(true); 
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all active:scale-95"
                        >
                            <span className="material-icons-round">add</span>
                            Nuevo Platillo
                        </button>
                    </div>
                </header>

                {/* Filters & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="md:col-span-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 px-4 border-r border-gray-100">
                            <span className="material-icons-round text-gray-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar por nombre o descripción..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none outline-none font-medium py-2"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto p-1 no-scrollbar max-w-full">
                            {dynamicCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="bg-primary/5 border-2 border-primary/10 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Total Platillos</p>
                            <p className="text-2xl font-black text-primary">{menuItems.length}</p>
                        </div>
                        <span className="material-icons-round text-primary/30 text-3xl">restaurant</span>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl shadow-soft border border-gray-100 flex-1 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Platillo</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest text-center">Precio</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Categoría</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Gramaje/Desglose</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest text-center">Estatus</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shadow-sm">
                                                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{item.name}</p>
                                                    <p className="text-xs text-gray-400 line-clamp-1">{item.description || 'Sin descripción'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-black text-primary">${item.price.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-wider border border-gray-200">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-gray-500">{item.gramaje || '—'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => toggleStatus(item.id)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                                item.status === 'ACTIVE' ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                {item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => { 
                                                        setEditingItem(item); 
                                                        setImagePreview(item.image);
                                                        setIsAddModalOpen(true); 
                                                    }}
                                                    className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-primary hover:border-primary/50 rounded-xl transition-all shadow-sm"
                                                >
                                                    <span className="material-icons-round text-sm">edit</span>
                                                </button>
                                                <button 
                                                    onClick={() => { if(confirm('¿Seguro?')) deleteItem(item.id); }}
                                                    className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 rounded-xl transition-all shadow-sm"
                                                >
                                                    <span className="material-icons-round text-sm">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredItems.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-20 text-gray-300">
                                <span className="material-icons-round text-6xl mb-4 text-gray-100">restaurant_menu</span>
                                <p className="font-bold text-lg">No se encontraron platillos</p>
                                <p className="text-sm">Ajusta los filtros o agrega uno nuevo.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-[600px] overflow-hidden transform scale-100 animate-in zoom-in-95 duration-200 border border-gray-100">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-primary/5">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">{editingItem ? 'Editar Platillo' : 'Nuevo Platillo'}</h2>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Completa la información del menú</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>
                        <div className="px-8 pt-8 flex items-center gap-6">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-3xl bg-gray-100 overflow-hidden border-4 border-white shadow-xl relative">
                                    <img 
                                        src={imagePreview || (editingItem?.image) || 'https://via.placeholder.com/200?text=SIN+FOTO'} 
                                        alt="Preview" 
                                        className="w-full h-full object-cover" 
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="material-icons-round text-2xl">photo_camera</span>
                                        <span className="text-[10px] font-black uppercase mt-1">Cambiar</span>
                                    </button>
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleImageChange} 
                                    className="hidden" 
                                    accept="image/*"
                                />
                            </div>
                            <div>
                                <p className="font-black text-gray-900 text-lg leading-tight">{editingItem?.name || 'Nuevo Platillo'}</p>
                                <p className="text-xs text-primary font-bold uppercase tracking-widest mt-1">Fotografía del Platillo</p>
                                <button 
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-3 px-4 py-1.5 bg-white border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-500 rounded-full hover:bg-gray-50 transition-all"
                                >
                                    Seleccionar Archivo
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleSaveItem} className="p-8 grid grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nombre del Platillo</label>
                                <input name="name" defaultValue={editingItem?.name} required className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl outline-none font-bold text-gray-800 transition-all" placeholder="Ej. Ceviche especial de camarón" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Categoría</label>
                                <div className="flex gap-2">
                                    {!isAddingNewCategory ? (
                                        <>
                                            <select name="category" defaultValue={editingItem?.category || 'General'} className="flex-1 px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl outline-none font-bold text-gray-800 transition-all appearance-none cursor-pointer">
                                                {dynamicCategories.filter(c => c !== 'All').map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                            <button 
                                                type="button"
                                                onClick={() => setIsAddingNewCategory(true)}
                                                className="w-14 bg-gray-50 hover:bg-white border-2 border-transparent hover:border-primary rounded-2xl flex items-center justify-center text-primary transition-all"
                                                title="Nueva Categoría"
                                            >
                                                <span className="material-icons-round">add_circle</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <input 
                                                autoFocus
                                                name="category"
                                                className="flex-1 px-5 py-4 bg-blue-50 border-2 border-primary focus:bg-white rounded-2xl outline-none font-bold text-gray-800 transition-all"
                                                placeholder="Nombre de categoría..."
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setIsAddingNewCategory(false)}
                                                className="w-14 bg-gray-50 hover:bg-red-50 border-2 border-transparent hover:border-red-200 rounded-2xl flex items-center justify-center text-red-500 transition-all"
                                                title="Cancelar"
                                            >
                                                <span className="material-icons-round">close</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Precio (MXN)</label>
                                <input name="price" type="number" step="0.01" defaultValue={editingItem?.price} required className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl outline-none font-bold text-gray-800 transition-all" placeholder="0.00" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Descripción Corta</label>
                                <textarea name="description" defaultValue={editingItem?.description} className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl outline-none font-medium text-gray-700 transition-all h-24 resize-none" placeholder="Ingredientes principales, preparación, etc." />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Gramaje / Desglose</label>
                                <input name="gramaje" defaultValue={editingItem?.gramaje} className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl outline-none font-bold text-gray-800 transition-all" placeholder="Ej. 180g Camarón, 50g Cebolla" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Estatus</label>
                                <select name="status" defaultValue={editingItem?.status || 'ACTIVE'} className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl outline-none font-bold text-gray-800 transition-all appearance-none">
                                    <option value="ACTIVE">Activo</option>
                                    <option value="INACTIVE">Inactivo</option>
                                </select>
                            </div>
                            <div className="col-span-2 mt-4 flex gap-4">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 text-gray-400 font-bold uppercase tracking-widest text-xs hover:text-gray-600 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-[2] py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all active:scale-95">Guardar Platillo</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import CSV Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-[800px] overflow-hidden transform scale-100 animate-in zoom-in-95 duration-200 border border-gray-100">
                         <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-primary/5">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Carga Masiva de Menú</h2>
                                <p className="text-[10px] text-primary/60 font-black uppercase tracking-[0.2em] mt-1">Importar desde archivo CSV</p>
                            </div>
                            <button onClick={() => { setIsImportModalOpen(false); setImportResult(null); }} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>
                        <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Opción 1: Pegar Texto CSV</p>
                            <div className="flex gap-2">
                                <input 
                                    type="file" 
                                    ref={importFileRef} 
                                    onChange={handleFileUpload} 
                                    className="hidden" 
                                    accept=".csv,.txt" 
                                />
                                <button 
                                    onClick={() => importFileRef.current?.click()}
                                    className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all flex items-center gap-2"
                                >
                                    <span className="material-icons-round text-sm">upload_file</span>
                                    Subir Archivo .CSV
                                </button>
                            </div>
                        </div>
                        <div className="p-8">
                            {!importResult ? (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
                                        <h3 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2">
                                            <span className="material-icons-round text-lg">info</span>
                                            Formato de Columnas (Orden sugerido):
                                        </h3>
                                        <p className="text-blue-700 text-xs font-mono bg-white/50 p-3 rounded-lg border border-blue-100/50">
                                            Nombre, Categoría, Precio, Descripción, Gramaje, Estatus
                                        </p>
                                        <p className="text-[10px] text-blue-500 mt-2 font-bold uppercase tracking-wider italic">
                                            * El estatus puede ser 'Activo' o 'Inactivo'. Por defecto será 'Activo'.
                                        </p>
                                    </div>
                                    <textarea
                                        value={csvInput}
                                        onChange={(e) => setCsvInput(e.target.value)}
                                        className="w-full h-64 p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl outline-none focus:border-primary focus:bg-white font-mono text-xs transition-all"
                                        placeholder="Ceviche Mixto, Ceviches, 220, Delicioso ceviche, 200g mixto, Activo
Aguachile Camarón, Aguachiles, 230, Picante tradicional, 150g camaron, Activo..."
                                    />
                                    <button
                                        onClick={handleImport}
                                        disabled={!csvInput.trim()}
                                        className="w-full py-5 bg-primary text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-icons-round">bolt</span>
                                        Procesar e Importar al Menú
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-12 space-y-4 animate-in zoom-in-95">
                                    <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center ${importResult.count > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <span className={`material-icons-round text-5xl ${importResult.count > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {importResult.count > 0 ? 'check_circle' : 'error'}
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900">
                                        {importResult.count > 0 ? `¡${importResult.count} Platillos Importados!` : 'Error en la Importación'}
                                    </h3>
                                    {importResult.errors.length > 0 && (
                                        <div className="max-h-40 overflow-y-auto bg-gray-50 p-4 rounded-xl border border-gray-200 text-left">
                                            {importResult.errors.map((err, i) => (
                                                <p key={i} className="text-red-500 text-[10px] font-bold mb-1">• {err}</p>
                                            ))}
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => setImportResult(null)}
                                        className="px-8 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition-all"
                                    >
                                        Volver a Intentar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
