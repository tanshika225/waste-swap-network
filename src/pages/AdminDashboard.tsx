import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { 
  Users, 
  Trash2, 
  ShieldAlert, 
  BarChart3, 
  Package, 
  ArrowLeftRight, 
  ShieldCheck,
  Ban,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'waste' | 'swaps'>('analytics');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      const [analytics, users, waste, swaps] = await Promise.all([
        axios.get('/api/admin/analytics', config),
        axios.get('/api/admin/users', config),
        axios.get('/api/admin/waste', config),
        axios.get('/api/admin/swaps', config)
      ]);

      setData({
        analytics: analytics.data,
        users: users.data,
        waste: waste.data,
        swaps: swaps.data
      });
    } catch (err: any) {
      console.error('Admin fetch error:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleBlockUser = async (userId: string, currentlyBlocked: boolean) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      await axios.post(`/api/admin/users/${userId}/block`, { blocked: !currentlyBlocked }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdminData();
    } catch (err) {
      alert('Failed to update user status');
    }
  };

  const handleDeleteWaste = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await axios.delete(`/api/admin/waste/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdminData();
    } catch (err) {
      alert('Failed to delete item');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Access Denied</h1>
        <p className="text-stone-500 mb-6">{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="bg-stone-900 text-white px-6 py-2 rounded-xl font-bold"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black text-stone-900 tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-10 h-10 text-emerald-600" />
            Admin Control Panel
          </h1>
          <p className="text-stone-500 font-medium mt-1">Manage the Waste Swap Network ecosystem</p>
        </div>
        
        <div className="flex bg-stone-100 p-1 rounded-2xl">
          {[
            { id: 'analytics', icon: BarChart3, label: 'Analytics' },
            { id: 'users', icon: Users, label: 'Users' },
            { id: 'waste', icon: Package, label: 'Waste' },
            { id: 'swaps', icon: ArrowLeftRight, label: 'Swaps' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-stone-900 shadow-sm' 
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Users', value: data.analytics.totalUsers, icon: Users, color: 'blue' },
              { label: 'Waste Listings', value: data.analytics.totalWaste, icon: Package, color: 'emerald' },
              { label: 'Completed Swaps', value: data.analytics.totalSwaps, icon: CheckCircle, color: 'amber' },
              { label: 'Total Value (₹)', value: data.analytics.totalValue.toLocaleString(), icon: BarChart3, color: 'purple' }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm"
              >
                <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 flex items-center justify-center mb-4`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
                <div className="text-3xl font-black text-stone-900">{stat.value}</div>
                <div className="text-stone-500 font-bold text-sm uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </div>
          
          <div className="bg-stone-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-2xl font-black mb-2">Network Health</h2>
              <p className="text-stone-400 max-w-md">The circular economy in Chennai is growing. Monitor these metrics to ensure a healthy swap ecosystem.</p>
            </div>
            <BarChart3 className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white/5 rotate-12" />
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[2.5rem] border border-stone-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-bottom border-stone-200">
                  <th className="px-6 py-4 font-black text-stone-400 uppercase text-xs tracking-widest">User</th>
                  <th className="px-6 py-4 font-black text-stone-400 uppercase text-xs tracking-widest">Email</th>
                  <th className="px-6 py-4 font-black text-stone-400 uppercase text-xs tracking-widest">Role</th>
                  <th className="px-6 py-4 font-black text-stone-400 uppercase text-xs tracking-widest">Status</th>
                  <th className="px-6 py-4 font-black text-stone-400 uppercase text-xs tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.users.map((user: any) => (
                  <tr key={user.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-black text-stone-600">
                          {user.displayName?.charAt(0)}
                        </div>
                        <span className="font-bold text-stone-900">{user.displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-stone-500 font-medium">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.blocked ? (
                        <span className="flex items-center gap-1 text-red-600 font-bold text-xs">
                          <Ban className="w-3 h-3" /> Blocked
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.role !== 'admin' && (
                        <button 
                          onClick={() => handleBlockUser(user.id, !!user.blocked)}
                          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                            user.blocked 
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {user.blocked ? 'Unblock' : 'Block'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'waste' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.waste.map((item: any) => (
            <div key={item.id} className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm group">
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
                  <div className="text-xs font-bold text-stone-400">Value: ₹{item.estimatedValue}</div>
                  <div className={`text-[10px] font-black uppercase tracking-wider ${
                    item.status === 'available' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {item.status}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'swaps' && (
        <div className="bg-white rounded-[2.5rem] border border-stone-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-bottom border-stone-200">
                  <th className="px-6 py-4 font-black text-stone-400 uppercase text-xs tracking-widest">Request ID</th>
                  <th className="px-6 py-4 font-black text-stone-400 uppercase text-xs tracking-widest">Status</th>
                  <th className="px-6 py-4 font-black text-stone-400 uppercase text-xs tracking-widest">Payment</th>
                  <th className="px-6 py-4 font-black text-stone-400 uppercase text-xs tracking-widest">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.swaps.map((swap: any) => (
                  <tr key={swap.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-stone-500">{swap.id}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        swap.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                        swap.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {swap.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold ${
                        swap.paymentStatus === 'completed' ? 'text-emerald-600' : 'text-stone-400'
                      }`}>
                        {swap.paymentStatus || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-stone-400 text-xs">
                      {swap.createdAt ? new Date(swap.createdAt).toLocaleDateString() : 'Unknown'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
