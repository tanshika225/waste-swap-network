import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../firebase';
import { motion } from 'motion/react';
import { Recycle, Lock, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    if (!oobCode) {
      setError('Invalid or missing reset code.');
      setLoading(false);
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        console.error('Verify code error:', err);
        setError('The reset link is invalid or has expired.');
        setLoading(false);
      });
  }, [oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setResetting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
      toast.success('Password reset successful!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      console.error('Reset password error:', err);
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-stone-200 border border-stone-100 max-w-md w-full text-center"
        >
          <div className="bg-red-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-black text-stone-900 mb-4 tracking-tight">Oops!</h1>
          <p className="text-stone-500 mb-8 font-medium">{error}</p>
          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            Back to Login
          </button>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-stone-200 border border-stone-100 max-w-md w-full text-center"
        >
          <div className="bg-emerald-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-stone-900 mb-4 tracking-tight">Success!</h1>
          <p className="text-stone-500 mb-8 font-medium">Your password has been reset successfully. Redirecting you to login...</p>
          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            Go to Login Now
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-stone-200 border border-stone-100 max-w-md w-full text-center"
      >
        <div className="bg-emerald-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
          <Recycle className="w-10 h-10 text-emerald-600" />
        </div>
        
        <h1 className="text-3xl font-black text-stone-900 mb-2 tracking-tight">Set New Password</h1>
        <p className="text-stone-500 mb-10 font-medium">Please enter your new password below.</p>

        <form onSubmit={handleReset} className="space-y-4">
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-emerald-600 transition-colors" />
            <input 
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New Password"
              className="w-full pl-12 pr-12 py-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-emerald-600 transition-colors" />
            <input 
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Password"
              className="w-full pl-12 pr-12 py-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            />
          </div>
          
          <button
            type="submit"
            disabled={resetting}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {resetting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
