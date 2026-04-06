import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../../firebase';
import AdminLayout from '../../components/AdminLayout';
import { Users, Ban, CheckCircle, ShieldAlert, Loader2, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function ManageUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await axios.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err: any) {
      setError(err.response?.data?.details || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleBlockUser = async (userId: string, currentlyBlocked: boolean) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      await axios.put(`/api/admin/block/${userId}`, { blocked: !currentlyBlocked }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(currentlyBlocked ? 'User unblocked' : 'User blocked');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update user status');
    }
  };

  const filteredUsers = users.filter(user => 
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <Users className="w-10 h-10 text-emerald-600" />
          Manage Users
        </h1>
        <p className="text-stone-500 font-medium mt-1">View and manage all registered users in the network</p>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-stone-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input 
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            />
          </div>
          <div className="text-stone-400 font-bold text-sm">
            Total: {filteredUsers.length} users
          </div>
        </div>

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
              {filteredUsers.map((user: any) => (
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
    </AdminLayout>
  );
}
