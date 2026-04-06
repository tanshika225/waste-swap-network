import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Recycle, LogIn, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Create user profile if it doesn't exist
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const isAdminEmail = user.email === 'jstanshika1402@gmail.com';
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          role: isAdminEmail ? 'admin' : 'user',
          impact: {
            recycled: 0,
            reused: 0,
            co2Saved: 0
          },
          createdAt: serverTimestamp()
        });
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-stone-200 max-w-md w-full text-center mx-4"
      >
        <div className="bg-emerald-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8">
          <Recycle className="w-12 h-12 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Welcome Back</h1>
        <p className="text-stone-500 mb-10">Join the Waste Swap Network and start your sustainable journey.</p>
        
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-stone-200 py-4 rounded-2xl font-bold hover:bg-stone-50 transition-all disabled:opacity-50"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p className="mt-8 text-xs text-stone-400">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>

        <div className="mt-10 pt-8 border-t border-stone-100">
          <button 
            onClick={() => navigate('/admin/login')}
            className="text-stone-400 hover:text-stone-900 font-bold text-xs flex items-center justify-center gap-2 mx-auto transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Portal Access
          </button>
        </div>
      </motion.div>
    </div>
  );
}
