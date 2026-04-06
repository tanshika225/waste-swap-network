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
import UpcycleForum from './pages/UpcycleForum';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hideLayout, setHideLayout] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        const isAdminEmail = u.email === 'jstanshika1402@gmail.com';
        setIsAdmin(isAdminEmail || (userDoc.exists() && userDoc.data().role === 'admin'));
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
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={user && isAdmin ? <Navigate to="/admin/dashboard" /> : <AdminLogin />} />
          <Route path="/admin/dashboard" element={user && isAdmin ? <AdminDashboard /> : <Navigate to="/admin/login" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

