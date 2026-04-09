import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn, AlertCircle, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const checkAdminStatus = async (user: any) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    const isAdminEmail = user.email === 'jstanshika1402@gmail.com' || user.email === 'admin@wasteswap.com';

    if (isAdminEmail || (userSnap.exists() && userSnap.data().role === 'admin')) {
      // If it's the admin email but role isn't set, update it
      if (isAdminEmail && (!userSnap.exists() || userSnap.data().role !== 'admin')) {
        try {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: 'admin',
            impact: userSnap.exists() ? userSnap.data().impact : { recycled: 0, reused: 0, co2Saved: 0 },
            createdAt: userSnap.exists() ? userSnap.data().createdAt : serverTimestamp()
          }, { merge: true });
        } catch (err: any) {
          console.error('Failed to update admin role in Firestore:', err);
          // If it's a permission error, we still let them in if they are a hardcoded admin
          // The dashboard will show the IAM error if the backend also fails
          if (err.message?.includes('permission') || err.code === 'permission-denied') {
            toast.warning('Admin role verified, but Firestore profile update failed. You may need to update your security rules.');
          } else {
            throw err;
          }
        }
      }
      return true;
    }
    return false;
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const isAdmin = await checkAdminStatus(result.user);

      if (isAdmin) {
        toast.success('Admin access granted!');
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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const isAdmin = await checkAdminStatus(result.user);

      if (isAdmin) {
        toast.success('Admin access granted!');
        navigate('/admin/dashboard');
      } else {
        await auth.signOut();
        setError('Access denied. This account does not have administrator privileges.');
      }
    } catch (error: any) {
      console.error('Admin email login failed:', error);
      if (error.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is not enabled in Firebase. Please enable it in the Firebase Console > Authentication > Sign-in method.');
      } else if (error.code === 'auth/invalid-credential') {
        setError('Invalid credentials. If you haven\'t created an account yet, please Sign Up on the regular login page first.');
      } else {
        setError(error.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-stone-50 py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-stone-200 max-w-md w-full text-center"
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

        <form onSubmit={handleEmailLogin} className="space-y-4 mb-8">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-emerald-600 transition-colors" />
            <input 
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin Email"
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-emerald-600 transition-colors" />
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black hover:bg-stone-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Admin Sign In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest font-black">
            <span className="bg-white px-4 text-stone-400">Or</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          type="button"
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-stone-100 py-4 rounded-2xl font-bold hover:bg-stone-50 transition-all disabled:opacity-50 text-stone-700"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Sign In with Google
        </button>

        <button 
          onClick={() => navigate('/login')}
          className="mt-8 text-stone-400 font-bold text-sm hover:text-stone-600 transition-colors"
        >
          Back to Regular Login
        </button>
      </motion.div>
    </div>
  );
}
