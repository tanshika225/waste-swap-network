import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../../firebase';
import AdminLayout from '../../components/AdminLayout';
import { Package, Trash2, ShieldAlert, Loader2, Search, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function ManageWaste() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const fetchWaste = async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await axios.get('/api/admin/waste', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(res.data);
    } catch (err: any) {
      setError(err.response?.data?.details || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaste();
  }, []);

  const handleDeleteWaste = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await axios.delete(`/api/admin/waste/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Item deleted successfully');
      fetchWaste();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const categories = ['All', ...Array.from(new Set(items.map(item => item.category)))];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-10">
        <h1 className="text-4xl font-black text-stone-900 tracking-tight flex items-center gap-3">
          <Package className="w-10 h-10 text-emerald-600" />
          Manage Waste
        </h1>
        <p className="text-stone-500 font-medium mt-1">Monitor and moderate all waste listings in the ecosystem</p>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-stone-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input 
            type="text"
            placeholder="Search listings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-5 h-5 text-stone-400" />
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 md:w-48 px-4 py-3 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-stone-600"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item: any) => (
          <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            key={item.id} 
            className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm group"
          >
            <div className="relative h-48">
              <img 
                src={item.imageUrl} 
                alt={item.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => handleDeleteWaste(item.id)}
                  className="bg-white/90 backdrop-blur-sm p-2 rounded-xl text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-lg"
                  title="Delete Listing"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="absolute bottom-4 left-4">
                <span className="bg-stone-900/80 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                  {item.category}
                </span>
              </div>
            </div>
            <div className="p-6">
              <h3 className="font-black text-stone-900 mb-1 truncate">{item.title}</h3>
              <p className="text-stone-500 text-sm line-clamp-2 mb-4">{item.description}</p>
              <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                <div className="flex flex-col">
                  <div className="text-xs font-bold text-stone-400">Value: ₹{item.estimatedValue}</div>
                  {item.ownerName && <div className="text-[10px] text-stone-400">Owner: {item.ownerName}</div>}
                </div>
                <div className={`text-[10px] font-black uppercase tracking-wider ${
                  item.status === 'available' ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {item.status}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </AdminLayout>
  );
}
