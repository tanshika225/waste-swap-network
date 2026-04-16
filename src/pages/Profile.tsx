import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { User, Mail, Shield, Calendar, Award, CreditCard, Edit2, Save, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ displayName: '', upiId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Real-time profile listener
    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setEditData({ 
          displayName: data.displayName || '', 
          upiId: data.upiId || '' 
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Fetch leaderboard
    const q = query(collection(db, 'users'), where('impact.reused', '>', 0));
    const unsubLeaderboard = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map(d => d.data())
        .sort((a, b) => b.impact.reused - a.impact.reused)
        .slice(0, 5);
      setLeaderboard(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubProfile();
      unsubLeaderboard();
    };
  }, []);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
    return new Date(timestamp).toLocaleDateString();
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!editData.displayName.trim()) {
      toast.error("Display name is required");
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editData.displayName,
        upiId: editData.upiId
      });
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (error: any) {
      console.error("Update Profile Error:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <div className="py-20 text-center">Loading profile...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
      <div className="lg:col-span-2 space-y-6 md:space-y-8">
        <section className="bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-sm relative">
          <div className="absolute top-6 right-6">
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8 text-center sm:text-left">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 shrink-0">
              <User className="w-10 h-10 md:w-12 md:h-12" />
            </div>
            <div className="min-w-0 w-full sm:w-auto">
              {isEditing ? (
                <div className="space-y-2 mt-2">
                  <label className="text-[10px] text-stone-400 uppercase font-bold">Display Name</label>
                  <input 
                    type="text"
                    value={editData.displayName}
                    onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    className="w-full sm:w-64 p-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-2xl md:text-3xl font-bold text-stone-900 truncate">{profile.displayName}</h1>
                  <p className="text-sm md:text-base text-stone-500 flex items-center justify-center sm:justify-start gap-1 truncate">
                    <Mail className="w-4 h-4" /> {profile.email}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-stone-50 rounded-2xl flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-[10px] text-stone-400 uppercase font-bold">Role</div>
                <div className="font-bold capitalize text-sm md:text-base">{profile.role}</div>
              </div>
            </div>
            <div className="p-4 bg-stone-50 rounded-2xl flex items-center gap-3">
              <Calendar className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-[10px] text-stone-400 uppercase font-bold">Joined</div>
                <div className="font-bold text-sm md:text-base">{formatDate(profile.createdAt)}</div>
              </div>
            </div>
            <div className="p-4 bg-stone-50 rounded-2xl flex items-center gap-3 sm:col-span-2">
              <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="w-full">
                <div className="text-[10px] text-stone-400 uppercase font-bold">UPI ID (For Receiving Payments)</div>
                {isEditing ? (
                  <div className="space-y-2">
                    <input 
                      type="text"
                      value={editData.upiId}
                      onChange={(e) => setEditData({ ...editData, upiId: e.target.value })}
                      placeholder="e.g. yourname@upi"
                      className="w-full mt-1 p-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm"
                    />
                    <button 
                      type="button"
                      onClick={() => setEditData({ ...editData, upiId: 'vishalinibasu1055@okhdfcbank' })}
                      className="text-[10px] text-emerald-600 font-bold hover:underline"
                    >
                      Use Demo UPI: vishalinibasu1055@okhdfcbank
                    </button>
                  </div>
                ) : (
                  <div className="font-bold text-sm md:text-base">{profile.upiId || 'Not set (Required for sellers)'}</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-emerald-900 text-white p-6 md:p-8 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2">
              <Award className="w-6 h-6 text-emerald-400" /> Eco Achievements
            </h2>
            <div className="grid grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                <div className="text-2xl md:text-3xl font-bold text-emerald-400 mb-1">Level 4</div>
                <div className="text-xs md:text-sm text-emerald-100">Waste Warrior</div>
              </div>
              <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                <div className="text-2xl md:text-3xl font-bold text-emerald-400 mb-1">{profile.impact.reused}</div>
                <div className="text-xs md:text-sm text-emerald-100">Items Reused</div>
              </div>
            </div>
          </div>
          <Award className="absolute -bottom-10 -right-10 w-32 h-32 md:w-48 md:h-48 text-white/5" />
        </section>
      </div>

      <aside className="space-y-8">
        <section className="bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h2 className="text-lg md:text-xl font-bold mb-6">Chennai Leaderboard</h2>
          <div className="space-y-4">
            {leaderboard.map((user, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-stone-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-600' : 
                    i === 1 ? 'bg-stone-100 text-stone-600' : 
                    'bg-stone-50 text-stone-400'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="font-semibold text-stone-900 text-sm md:text-base truncate">{user.displayName}</div>
                </div>
                <div className="font-bold text-emerald-600 text-xs md:text-sm shrink-0">{user.impact.reused} Reused</div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
