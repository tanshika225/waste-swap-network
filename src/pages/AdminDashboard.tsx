import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../firebase';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { 
  Users, 
  Package, 
  ArrowLeftRight, 
  CheckCircle, 
  ShieldCheck,
  ShieldAlert,
  Loader2,
  TrendingUp,
  ArrowRight,
  BarChart3  
} from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
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

      // Try to get service account email and project ID first to help with debugging
      try {
        const saRes = await axios.get('/api/admin/service-account', config);
        setServiceAccountEmail(saRes.data.email);
        setProjectId(saRes.data.projectId);
      } catch (e) {
        console.warn('Could not fetch service account info');
      }

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
      const errorMessage = err.response?.data?.details 
        ? `${err.response.data.error}: ${err.response.data.details}` 
        : (err.response?.data?.error || err.message);
      setError(errorMessage);
      
      if (errorMessage.includes('PERMISSION_DENIED')) {
        setPermissionError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  if (permissionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100">
          <div className="flex items-center gap-4 mb-6 text-red-600">
            <div className="p-3 bg-red-50 rounded-full">
              <ShieldAlert size={32} />
            </div>
            <h1 className="text-2xl font-bold">Database Permission Required</h1>
          </div>
          
          <div className="space-y-4 text-gray-600 mb-8">
            <p className="font-medium text-gray-900">The application's service account needs permission to access Firestore in project <code className="bg-gray-200 px-1 rounded text-sm font-mono">{projectId || 'gen-lang-client-0445465783'}</code>.</p>
            <p>As the project owner, please follow these steps to grant access:</p>
            
            <ol className="list-decimal list-inside space-y-3 bg-gray-50 p-6 rounded-xl border border-gray-100">
              <li>Go to the <a href={`https://console.cloud.google.com/iam-admin/iam?project=${projectId || 'gen-lang-client-0445465783'}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">Google Cloud IAM Console</a></li>
              <li>Ensure you are in the correct project: <code className="bg-gray-200 px-1 rounded text-sm font-mono">{projectId || 'gen-lang-client-0445465783'}</code></li>
              <li>Click <strong>GRANT ACCESS</strong> at the top</li>
              <li>In the "New principals" field, paste: <code className="bg-gray-200 px-1 rounded text-sm font-mono">{serviceAccountEmail || '34901887695-compute@developer.gserviceaccount.com'}</code></li>
              <li>Search for and select <strong>Cloud Datastore User</strong> as the role</li>
              <li>Click <strong>Save</strong> and refresh this page</li>
            </ol>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            I've added the role, refresh page
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
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
    <AdminLayout>
      <div className="mb-10">
        <h1 className="text-4xl font-black text-stone-900 tracking-tight flex items-center gap-3">
          <ShieldCheck className="w-10 h-10 text-emerald-600" />
          Admin Dashboard
        </h1>
        <p className="text-stone-500 font-medium mt-1">System overview and quick actions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {[
          { label: 'Total Users', value: data.analytics.totalUsers, icon: Users, color: 'blue', link: '/admin/users' },
          { label: 'Waste Listings', value: data.analytics.totalWaste, icon: Package, color: 'emerald', link: '/admin/waste' },
          { label: 'Completed Swaps', value: data.analytics.totalSwaps, icon: CheckCircle, color: 'amber', link: '/admin/analytics' }
        ].map((stat, i) => (
          <Link 
            key={i} 
            to={stat.link}
            className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all group"
          >
            <div className={`w-14 h-14 rounded-2xl bg-${stat.color}-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-7 h-7 text-${stat.color}-600`} />
            </div>
            <div className="text-4xl font-black text-stone-900 mb-1">{stat.value}</div>
            <div className="text-stone-500 font-bold text-sm uppercase tracking-wider flex items-center justify-between">
              {stat.label}
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-stone-900 text-white p-10 rounded-[3rem] relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-4">System Health</h2>
            <p className="text-stone-400 max-w-sm mb-8">The Waste Swap Network is operating normally. All services are online and responding within expected latency.</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl font-bold text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Database Online
              </div>
              <div className="flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-2 rounded-xl font-bold text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Auth Service Active
              </div>
            </div>
          </div>
          <BarChart3 className="absolute right-[-40px] bottom-[-40px] w-80 h-80 text-white/5 rotate-12" />
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-stone-200 shadow-sm">
          <h2 className="text-2xl font-black text-stone-900 mb-6 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => navigate('/admin/users')}
              className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group"
            >
              <span className="font-bold">Manage Users</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => navigate('/admin/waste')}
              className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group"
            >
              <span className="font-bold">Review Waste</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => navigate('/admin/analytics')}
              className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group"
            >
              <span className="font-bold">View Analytics</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="bg-white p-10 rounded-[3rem] border border-stone-200 shadow-sm">
          <h2 className="text-2xl font-black text-stone-900 mb-6 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            Recent Activity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.swaps.slice(0, 6).map((swap: any) => (
              <div key={swap.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <ArrowLeftRight className="w-5 h-5 text-stone-400" />
                  </div>
                  <div>
                    <div className="font-bold text-stone-900 text-sm">Swap Request</div>
                    <div className="text-stone-400 text-xs font-medium">{new Date(swap.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  swap.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                  swap.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {swap.status}
                </span>
              </div>
            ))}
          </div>
          <Link 
            to="/admin/analytics"
            className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-stone-100 text-stone-600 font-bold hover:bg-stone-200 transition-all"
          >
            View All Activity
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}

