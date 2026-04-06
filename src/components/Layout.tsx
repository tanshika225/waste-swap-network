import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LogOut, Recycle, User, PlusCircle, LayoutDashboard, MapPin, Menu, X, LogIn, Sparkles, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ChatBot from './ChatBot';

export default function Layout({ children, user }: { children: React.ReactNode, user: any }) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [user]);

  const handleLogout = async () => {
    await auth.signOut();
    setIsMenuOpen(false);
    navigate('/login');
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navLinks = [
    { to: '/swaps', label: 'Explore Swaps', icon: MapPin },
    { to: '/upcycle', label: 'Upcycling DIY', icon: Sparkles },
    ...(user ? [
      { to: '/upload', label: 'List Waste', icon: PlusCircle },
      { to: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
      { to: '/profile', label: 'My Profile', icon: User },
      ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: Lock }] : []),
    ] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] font-sans text-stone-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-[120px]"></div>
      </div>

      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <Link to="/" className="flex items-center gap-3 group" onClick={() => setIsMenuOpen(false)}>
              <div className="bg-emerald-600 p-2 rounded-2xl group-hover:rotate-12 transition-transform shadow-lg shadow-emerald-200">
                <Recycle className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-xl tracking-tight leading-none text-stone-900">Chennai Waste</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">Swap Network</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link 
                  key={link.to} 
                  to={link.to} 
                  className="text-sm font-bold text-stone-500 hover:text-emerald-600 transition-all flex items-center gap-2 relative group"
                >
                  <link.icon className="w-4 h-4" /> 
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-600 transition-all group-hover:w-full"></span>
                </Link>
              ))}
              {user ? (
                <div className="flex items-center gap-4 pl-4 border-l border-stone-200">
                  <button 
                    onClick={handleLogout} 
                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <Link 
                  to="/login" 
                  className="bg-stone-900 text-white px-6 py-2.5 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </Link>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={toggleMenu}
                className="p-2.5 bg-stone-100 text-stone-600 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden bg-white/90 backdrop-blur-2xl border-b border-stone-200 overflow-hidden"
            >
              <div className="px-4 pt-2 pb-8 space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 px-5 py-4 text-stone-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-2xl transition-all group"
                  >
                    <div className="p-2 bg-stone-100 group-hover:bg-emerald-100 rounded-xl transition-colors">
                      <link.icon className="w-5 h-5" />
                    </div>
                    <span className="font-bold">{link.label}</span>
                  </Link>
                ))}
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-5 py-4 text-red-600 hover:bg-red-50 rounded-2xl transition-all group"
                  >
                    <div className="p-2 bg-red-50 rounded-xl">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span className="font-bold">Logout</span>
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 px-5 py-4 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
                  >
                    <LogIn className="w-5 h-5" />
                    <span className="font-bold">Login</span>
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="relative z-10 flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 w-full">
        {children}
      </main>

      <ChatBot />

      {/* Footer */}
      <footer className="relative z-10 border-t border-stone-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <Recycle className="w-6 h-6 text-emerald-600" />
              <span className="font-black text-lg tracking-tight">Chennai Waste Swap</span>
            </div>
            <div className="flex gap-8 text-sm font-bold text-stone-400">
              <a href="#" className="hover:text-emerald-600 transition-colors">Privacy</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Contact</a>
            </div>
            <div className="text-stone-400 text-sm font-medium">
              © 2026 Chennai Waste Swap Network. Built with Advanced AI.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
