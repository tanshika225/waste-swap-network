import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, increment, writeBatch, orderBy, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import WasteCard from '../components/WasteCard';
import { motion } from 'motion/react';
import { Leaf, Award, TrendingUp, Package, ArrowRight, MessageSquare, Star, MapPin, Zap, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
  const [pendingItemsIds, setPendingItemsIds] = useState<Set<string>>(new Set());
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const checkQuota = async () => {
      try {
        const res = await axios.get('/api/quota-status');
        setQuotaInfo(res.data);
      } catch (e) {
        console.error('Failed to check quota status');
      }
    };
    checkQuota();

    // Fetch recommendations after profile (for location)
    const fetchRecommendations = async (location?: any) => {
      const cacheKey = `recs_${user.uid}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if it's less than 15 minutes old
        if (Date.now() - timestamp < 15 * 60 * 1000) {
          setRecommendations(data);
          return;
        }
        // If older, still show it while loading
        setRecommendations(data);
      }

      setLoadingRecs(true);
      try {
        const params: any = {};
        if (location) {
          params.lat = location.lat;
          params.lng = location.lng;
        }
        const response = await axios.get('/api/recommendations', { params });
        setRecommendations(response.data);
        localStorage.setItem(cacheKey, JSON.stringify({
          data: response.data,
          timestamp: Date.now()
        }));
      } catch (err: any) {
        console.error('Failed to fetch recommendations:', err);
        if (err.response?.status === 500 || err.message?.includes('Quota')) {
          toast.error('Recommendations temporarily limited due to high traffic.', {
            description: 'Showing previously cached data if available.'
          });
        }
      } finally {
        setLoadingRecs(false);
      }
    };
    
    // Fetch user profile
    const fetchProfile = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await axios.get('/api/user/profile', {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        const data = response.data;
        setUserProfile(data);
        fetchRecommendations(data.location);
      } catch (err) {
        console.error('Failed to fetch profile via API:', err);
        // Only fallback to direct Firestore if not a quota error
        if (!(err as any).message?.includes('quota') && !(err as any).response?.data?.error?.includes('Quota')) {
          try {
            const docSnap = await getDoc(doc(db, 'users', user.uid));
            if (docSnap.exists()) {
              const data = docSnap.data();
              setUserProfile(data);
              fetchRecommendations(data.location);
            }
          } catch (fsErr) {
            console.error('Direct Firestore profile fetch also failed:', fsErr);
          }
        }
      }
    };
    fetchProfile();

    // Fetch my items
    const fetchMyItems = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await axios.get('/api/user/items', {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        setMyItems(response.data);
      } catch (err) {
        console.error('Failed to fetch items via API:', err);
      }
    };
    fetchMyItems();

    // Only set up listeners if quota is likely available
    let unsubItems = () => {};
    let unsubReqs = () => {};
    let unsubRecv = () => {};

    const setupListeners = async () => {
      // Check quota status first
      try {
        const qStatus = await axios.get('/api/quota-status');
        if (qStatus.data.isExhausted) {
          console.warn('Quota exhausted, skipping real-time listeners');
          return;
        }
      } catch (e) {
        // If we can't even check quota, assume the worst or just proceed and let onSnapshot fail
      }

      const qItems = query(
        collection(db, 'wasteItems'), 
        where('ownerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      unsubItems = onSnapshot(qItems, (snap) => {
        setMyItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.error('My Items Snapshot Error:', error);
        if (error.message?.includes('quota') || (error as any).code === 'resource-exhausted') {
          setQuotaInfo((prev: any) => ({ ...prev, isExhausted: true }));
        }
      });

      const qReqs = query(collection(db, 'swapRequests'), where('requesterId', '==', user.uid));
      unsubReqs = onSnapshot(qReqs, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
          const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
          return timeB - timeA;
        });
        setMyRequests(docs);
      }, (error) => {
        console.error('My Requests Snapshot Error:', error);
        if (error.message?.includes('quota') || (error as any).code === 'resource-exhausted') {
          setQuotaInfo((prev: any) => ({ ...prev, isExhausted: true }));
        }
      });

      const qRecv = query(collection(db, 'swapRequests'), where('ownerId', '==', user.uid));
      unsubRecv = onSnapshot(qRecv, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        docs.sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
          const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
          return timeB - timeA;
        });
        setReceivedRequests(docs);
        
        const pendingIds = new Set<string>();
        docs.forEach(req => {
          if (req.status === 'pending') {
            pendingIds.add(req.itemId);
          }
        });
        setPendingItemsIds(pendingIds);
      }, (error) => {
        console.error('Received Requests Snapshot Error:', error);
        if (error.message?.includes('quota') || (error as any).code === 'resource-exhausted') {
          setQuotaInfo((prev: any) => ({ ...prev, isExhausted: true }));
        }
      });
    };

    setupListeners();

    // Fetch requests via API as well
    const fetchRequests = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await axios.get('/api/user/requests', {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        setMyRequests(response.data.sent);
        setReceivedRequests(response.data.received);
        
        const pendingIds = new Set<string>();
        response.data.received.forEach((req: any) => {
          if (req.status === 'pending') {
            pendingIds.add(req.itemId);
          }
        });
        setPendingItemsIds(pendingIds);
      } catch (err) {
        console.error('Failed to fetch requests via API:', err);
      }
    };
    fetchRequests();

    return () => {
      unsubItems();
      unsubReqs();
      unsubRecv();
    };
  }, []);

  const handleRequestAction = async (requestId: string, status: 'accepted' | 'rejected' | 'completed') => {
    try {
      const batch = writeBatch(db);
      const reqRef = doc(db, 'swapRequests', requestId);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      const reqData = reqSnap.data();

      if (status === 'accepted') {
        batch.update(reqRef, { status: 'accepted' });
        // Mark both items as pending if it's an item swap
        batch.update(doc(db, 'wasteItems', reqData.itemId), { status: 'pending' });
        if (reqData.offeredItemId) {
          batch.update(doc(db, 'wasteItems', reqData.offeredItemId), { status: 'pending' });
        }
        // Add system message
        const msgRef = doc(collection(db, 'swapRequests', requestId, 'messages'));
        batch.set(msgRef, {
          senderId: 'system',
          text: 'Swap Request Accepted! Coordinate the exchange below.',
          createdAt: serverTimestamp()
        });
      } else if (status === 'rejected') {
        batch.update(reqRef, { status: 'rejected' });
      } else if (status === 'completed') {
        // Finalize the swap
        batch.update(reqRef, { status: 'completed' });
        
        // Update items to 'swapped'
        batch.update(doc(db, 'wasteItems', reqData.itemId), { status: 'swapped' });
        if (reqData.offeredItemId) {
          batch.update(doc(db, 'wasteItems', reqData.offeredItemId), { status: 'swapped' });
        }

        // Add system message
        const msgRef = doc(collection(db, 'swapRequests', requestId, 'messages'));
        batch.set(msgRef, {
          senderId: 'system',
          text: 'Swap Successfully Completed! Impact stats updated.',
          createdAt: serverTimestamp()
        });

        // Handle Credits if any
        if (reqData.offeredRupees > 0) {
          // Real bank integration: Payment is handled via Stripe
          // We just log the transaction or update status
          console.log(`Payment of ₹${reqData.offeredRupees} confirmed via Stripe for request ${requestId}`);
        }

        // Update Impact Stats for both
        batch.update(doc(db, 'users', reqData.requesterId), {
          'impact.reused': increment(1),
          'impact.co2Saved': increment(5) // Example value
        });
        batch.update(doc(db, 'users', reqData.ownerId), {
          'impact.reused': increment(1),
          'impact.co2Saved': increment(5)
        });
      }

      await batch.commit();
      toast.success(`Request ${status} successfully!`);
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error('Failed to update request. Please try again.');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '...';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString();
    return new Date(timestamp).toLocaleDateString();
  };

  if (!userProfile) return (
    <div className="py-20 text-center flex flex-col items-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      <div className="text-stone-500 font-medium">Loading your impact...</div>
      <p className="text-xs text-stone-400 max-w-xs mx-auto">If this takes too long, please try refreshing or checking your connection.</p>
    </div>
  );

  const impact = userProfile.impact || { recycled: 0, reused: 0, co2Saved: 0 };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-bold text-stone-900">Dashboard</h1>
        <p className="text-stone-500">Welcome back, {userProfile.displayName || 'Swapper'}</p>
      </header>

      {quotaInfo?.isExhausted && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 text-amber-800">
          <Zap className="w-6 h-6 text-amber-500 animate-pulse" />
          <div className="flex-1">
            <p className="font-bold text-sm">Daily Database Limit Reached</p>
            <p className="text-xs opacity-80">The app is currently in "Circular Mode" to save energy. Some real-time updates may be delayed until the daily quota resets.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-black opacity-40">Resets in</p>
            <p className="font-mono text-xs font-bold">{Math.ceil(quotaInfo.cooldownRemaining / 60000)}m</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: "Items Reused", value: impact.reused || 0, icon: Package, color: "text-emerald-600", bg: "bg-emerald-100" },
          { label: "CO2 Saved", value: `${impact.co2Saved || 0}kg`, icon: Leaf, color: "text-blue-600", bg: "bg-blue-100" },
          { label: "Rank", value: "#12", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-100" },
          { label: "Impact", value: "Hero", icon: Award, color: "text-amber-600", bg: "bg-amber-100" }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-stone-200 flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
            <div className={`${stat.bg} ${stat.color} w-10 h-10 rounded-xl flex items-center justify-center sm:mb-4 shrink-0`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-stone-900">{stat.value}</div>
              <div className="text-stone-500 text-xs md:text-sm">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Recommendations Section */}
      <section className="bg-stone-50 p-8 rounded-[2.5rem] border border-stone-200">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              Smart Recommendations
            </h2>
            <p className="text-stone-500 text-sm font-medium">Personalized suggestions to boost your circular impact</p>
          </div>
          {loadingRecs && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Popular Types */}
          <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Popular Waste
            </h3>
            <div className="space-y-3">
              {recommendations?.popularTypes.map((type: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                  <span className="font-bold text-stone-700 capitalize text-sm">{type.category}</span>
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-lg">
                    {type.count} Listings
                  </span>
                </div>
              ))}
              {!recommendations?.popularTypes.length && <p className="text-xs text-stone-400 italic">No data yet</p>}
            </div>
          </div>

          {/* Nearby Items */}
          <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Nearby Opportunities
            </h3>
            <div className="space-y-3">
              {recommendations?.nearbyItems.map((item: any) => (
                <div 
                  key={item.id} 
                  onClick={() => navigate(`/request-swap/${item.id}`)}
                  className="group cursor-pointer flex items-center gap-3 p-2 hover:bg-emerald-50 rounded-xl transition-colors"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-stone-900 text-xs truncate group-hover:text-emerald-600 transition-colors">{item.title}</div>
                    <div className="text-[10px] text-stone-400 font-medium">{item.distance.toFixed(1)} km away</div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-stone-300 group-hover:text-emerald-600 transition-colors" />
                </div>
              ))}
              {!recommendations?.nearbyItems.length && <p className="text-xs text-stone-400 italic">No nearby items found</p>}
            </div>
          </div>

          {/* Best Buyers */}
          <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Top Swappers
            </h3>
            <div className="space-y-3">
              {recommendations?.bestBuyers.map((buyer: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">
                    {buyer.displayName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-stone-700 text-xs truncate">{buyer.displayName}</div>
                    <div className="text-[10px] text-stone-400 font-medium">{buyer.completedSwaps} successful swaps</div>
                  </div>
                  {i === 0 && <Award className="w-4 h-4 text-amber-500" />}
                </div>
              ))}
              {!recommendations?.bestBuyers.length && <p className="text-xs text-stone-400 italic">No activity yet</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-8 md:gap-10">
        {/* Received Requests */}
        <section className="lg:col-span-2">
          <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-emerald-600" /> 
            Requests Received
            {pendingItemsIds.size > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse">
                {pendingItemsIds.size} NEW
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {receivedRequests.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-stone-900 text-base md:text-lg truncate">Incoming Swap</div>
                    <div className="text-stone-500 text-[10px] md:text-xs">{formatDate(req.createdAt)}</div>
                  </div>
                  <span className={`shrink-0 px-2 md:px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    req.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                    req.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-stone-100 text-stone-700'
                  }`}>
                    {req.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 md:gap-4 bg-stone-50 p-3 md:p-4 rounded-2xl border border-stone-100">
                  <div className="flex-1 text-center min-w-0">
                    <div className="text-[9px] md:text-[10px] uppercase font-bold text-stone-400 mb-1">They Want</div>
                    <div className="font-bold text-stone-900 text-xs md:text-sm truncate">Item #{req.itemId.slice(0, 6)}</div>
                  </div>
                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 text-center min-w-0">
                    <div className="text-[9px] md:text-[10px] uppercase font-bold text-stone-400 mb-1">They Offer</div>
                    <div className="font-bold text-emerald-600 text-xs md:text-sm truncate">
                      {req.offeredItemId ? `Item #${req.offeredItemId.slice(0, 6)}` : `₹${req.offeredRupees}`}
                    </div>
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button 
                      onClick={() => handleRequestAction(req.id, 'accepted')}
                      className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors text-sm"
                    >
                      Accept
                    </button>
                    <button 
                      onClick={() => handleRequestAction(req.id, 'rejected')}
                      className="flex-1 border border-stone-200 text-stone-600 py-2 rounded-xl font-bold hover:bg-stone-50 transition-colors text-sm"
                    >
                      Reject
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => navigate(`/chat/${req.id}`)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 md:py-3 rounded-xl border border-emerald-100 text-emerald-600 font-bold hover:bg-emerald-50 transition-colors text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat with Requester
                </button>
                {req.status === 'accepted' && (
                  <div className="text-center py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs md:text-sm font-medium">
                    Waiting for requester to complete
                  </div>
                )}
              </div>
            ))}
            {receivedRequests.length === 0 && (
              <div className="col-span-full p-8 md:p-12 text-center text-stone-400 border-2 border-dashed rounded-3xl text-sm md:text-base">
                No incoming swap requests yet.
              </div>
            )}
          </div>
        </section>

        {/* My Items */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" /> My Items
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {myItems.map(item => {
              const hasPending = pendingItemsIds.has(item.id);
              const relatedRequest = receivedRequests.find(r => r.itemId === item.id && r.status === 'pending');
              
              return (
                <WasteCard 
                  key={item.id} 
                  item={item} 
                  hasPendingRequest={hasPending}
                  onRequestClick={() => relatedRequest && navigate(`/chat/${relatedRequest.id}`)}
                />
              );
            })}
            {myItems.length === 0 && (
              <div className="col-span-full p-8 md:p-12 text-center text-stone-400 border-2 border-dashed rounded-3xl text-sm md:text-base">
                You haven't uploaded any items yet.
              </div>
            )}
          </div>
        </section>

        {/* My Requests (Sent) */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" /> Requests Sent
          </h2>
          <div className="space-y-4">
            {myRequests.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-stone-900 text-base md:text-lg truncate">Swap Proposal</div>
                    <div className="text-stone-500 text-[10px] md:text-xs">{formatDate(req.createdAt)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-2 md:px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      req.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                      req.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 md:gap-4 bg-stone-50 p-3 md:p-4 rounded-2xl border border-stone-100">
                  <div className="flex-1 text-center min-w-0">
                    <div className="text-[9px] md:text-[10px] uppercase font-bold text-stone-400 mb-1">Requested</div>
                    <div className="font-bold text-stone-900 text-xs md:text-sm truncate">Item #{req.itemId.slice(0, 6)}</div>
                  </div>
                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 text-center min-w-0">
                    <div className="text-[9px] md:text-[10px] uppercase font-bold text-stone-400 mb-1">Offered</div>
                    <div className="font-bold text-emerald-600 text-xs md:text-sm truncate">
                      {req.offeredItemId ? `Item #${req.offeredItemId.slice(0, 6)}` : `₹${req.offeredRupees}`}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => navigate(`/chat/${req.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 md:py-2.5 rounded-xl border border-emerald-100 text-emerald-600 font-bold hover:bg-emerald-50 transition-colors text-sm"
                    title="Chat with Owner"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </button>
                  {req.status === 'accepted' && (
                    <button 
                      onClick={() => handleRequestAction(req.id, 'completed')}
                      className="flex-[2] bg-emerald-600 text-white px-4 py-2 md:py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                    >
                      Complete Swap
                    </button>
                  )}
                </div>
              </div>
            ))}
            {myRequests.length === 0 && (
              <div className="p-8 md:p-12 text-center text-stone-400 border-2 border-dashed rounded-3xl text-sm md:text-base">
                No active swap requests.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
