/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UploadWaste from './pages/UploadWaste';
import SwapPage from './pages/SwapPage';
import RequestSwap from './pages/RequestSwap';
import ChatPage from './pages/ChatPage';
import Profile from './pages/Profile';
import PaymentPage from './pages/PaymentPage';
import UpcycleForum from './pages/UpcycleForum';
import ResetPassword from './pages/ResetPassword';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ManageUsers from './pages/admin/ManageUsers';
import ManageWaste from './pages/admin/ManageWaste';
import Analytics from './pages/admin/Analytics';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import axios from 'axios';

import { Toaster, toast } from 'sonner';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hideLayout, setHideLayout] = useState(false);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);

  useEffect(() => {
    const checkQuota = async () => {
      try {
        const res = await axios.get('/api/quota-status');
        if (res.data.isQuotaExhausted) {
          setIsQuotaExhausted(true);
          toast.warning('App is in limited mode due to high traffic. Some features may be slow.', {
            duration: 10000,
          });
        }
      } catch (err) {
        console.error('Failed to check quota status:', err);
      }
    };
    checkQuota();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Optimistic check based on email to unblock UI faster
        setIsAdmin(u.email === 'admin@wasteswap.com');

        try {
          const idToken = await u.getIdToken();
          // Increase timeout to 15 seconds to handle slow cold starts or Firestore delays
          const response = await axios.get('/api/auth/status', {
            headers: { Authorization: `Bearer ${idToken}` },
            timeout: 15000 
          });
          setIsAdmin(response.data.role === 'admin');
        } catch (err) {
          console.error('Failed to fetch auth status via API:', err);
          // Fallback to hardcoded admin email if API fails or times out
          setIsAdmin(u.email === 'admin@wasteswap.com');
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-emerald-200 rounded-full"></div>
          <div className="text-stone-400 font-medium">Loading Waste Swap Network...</div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-center" richColors />
      {isQuotaExhausted && (
        <div className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest py-1 text-center sticky top-0 z-[100] shadow-lg">
          Limited Mode Active: Daily Quota Reached. Some data may be cached or unavailable.
        </div>
      )}
      <Layout user={user} hideHeaderFooter={hideLayout}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/upload" element={user ? <UploadWaste /> : <Navigate to="/login" />} />
          <Route path="/swaps" element={<SwapPage />} />
          <Route path="/upcycle" element={<UpcycleForum onModalToggle={setHideLayout} />} />
          <Route path="/request-swap/:itemId" element={user ? <RequestSwap /> : <Navigate to="/login" />} />
          <Route path="/chat/:requestId" element={user ? <ChatPage /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/payment" element={user ? <PaymentPage /> : <Navigate to="/login" />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={user && isAdmin ? <Navigate to="/admin/dashboard" /> : <AdminLogin />} />
          <Route path="/admin/dashboard" element={user && isAdmin ? <AdminDashboard /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/users" element={user && isAdmin ? <ManageUsers /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/waste" element={user && isAdmin ? <ManageWaste /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/analytics" element={user && isAdmin ? <Analytics /> : <Navigate to="/admin/login" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

