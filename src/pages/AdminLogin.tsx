import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAdminLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user is admin
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const isAdminEmail = user.email === 'jstanshika1402@gmail.com';

      if (isAdminEmail || (userSnap.exists() && userSnap.data().role === 'admin')) {
        // If it's the admin email but role isn't set, update it
        if (isAdminEmail && (!userSnap.exists() || userSnap.data().role !== 'admin')) {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            role: 'admin',
            impact: userSnap.exists() ? userSnap.data().impact : { recycled: 0, reused: 0, co2Saved: 0 },
            createdAt: userSnap.exists() ? userSnap.data().createdAt : serverTimestamp()
          }, { merge: true });
        }
        navigate('/admin/dashboard');
      } else {
        await auth.signOut();
        setError('Access denied. This account does not have administrator privileges.');
      }
    } catch (error: any) {
      console.error('Admin login failed:', error);
      if (error.code === 'auth/popup-blocked') {
        setError('Login popup was blocked by your browser. Please allow popups for this site and try again.');
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-stone-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-stone-200 max-w-md w-full text-center mx-4"
      >
        <div className="bg-stone-900 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
          <ShieldCheck className="w-12 h-12 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-black text-stone-900 mb-2 tracking-tight">Admin Portal</h1>
        <p className="text-stone-500 mb-10 font-medium">Restricted access for Waste Swap Network administrators.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold text-left">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleAdminLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-stone-900 text-white py-4 rounded-2xl font-black hover:bg-stone-800 transition-all disabled:opacity-50 shadow-lg"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5 brightness-200" alt="Google" />
          {loading ? 'Verifying...' : 'Admin Sign In with Google'}
        </button>

        <button 
          onClick={() => navigate('/login')}
          className="mt-6 text-stone-400 font-bold text-sm hover:text-stone-600 transition-colors"
        >
          Back to Regular Login
        </button>
      </motion.div>
    </div>
  );
}
