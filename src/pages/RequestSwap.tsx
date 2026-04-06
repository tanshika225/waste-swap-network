import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion } from 'motion/react';
import { ArrowRight, Recycle, Award, Package, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import WasteCard from '../components/WasteCard';
import { toast } from 'sonner';

export default function RequestSwap() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [offerType, setOfferType] = useState<'item' | 'rupees' | 'upi'>('item');
  const [selectedMyItemId, setSelectedMyItemId] = useState<string>('');
  const [offeredRupees, setOfferedRupees] = useState<number>(0);
  const [upiVpa, setUpiVpa] = useState('chennai-swap@upi'); // Placeholder VPA
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');

  const initiateStripePayment = async (amount: number, requestId: string, itemName: string) => {
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount, requestId, itemName }),
      });
      const { url, error } = await response.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (error: any) {
      console.error('Payment initialization failed:', error);
      alert('Payment failed to initialize. Please try again.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!itemId || !auth.currentUser) return;

      try {
        // Fetch the item being requested
        const itemDoc = await getDoc(doc(db, 'wasteItems', itemId));
        if (itemDoc.exists()) {
          const itemData = itemDoc.data();
          setItem({ id: itemDoc.id, ...itemData });
          
          // Fetch the owner's profile
          const ownerDoc = await getDoc(doc(db, 'users', itemData.ownerId));
          if (ownerDoc.exists()) setOwner(ownerDoc.data());
        }

        // Fetch requester's profile
        const profileDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (profileDoc.exists()) setUserProfile(profileDoc.data());

        // Fetch requester's available items
        const q = query(
          collection(db, 'wasteItems'), 
          where('ownerId', '==', auth.currentUser.uid),
          where('status', '==', 'available')
        );
        const querySnapshot = await getDocs(q);
        setMyItems(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) {
        console.error('Error fetching swap data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [itemId]);

  const handleSubmit = async () => {
    if (!auth.currentUser || !item) return;
    
    if (offerType === 'item' && !selectedMyItemId) {
      toast.error('Please select an item to offer in exchange.');
      return;
    }
    
    if (offerType === 'rupees' && offeredRupees <= 0) {
      toast.error('Please enter a valid amount of Rupees.');
      return;
    }
 
    if (offerType === 'upi' && (!paymentConfirmed || offeredRupees <= 0)) {
      toast.error('Please complete the UPI payment and confirm it manually.');
      return;
    }
 
    if (!pickupDate || !pickupTime || !pickupLocation) {
      toast.error('Please provide all pickup details.');
      return;
    }

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'swapRequests'), {
        itemId: item.id,
        requesterId: auth.currentUser.uid,
        ownerId: item.ownerId,
        offeredItemId: offerType === 'item' ? selectedMyItemId : null,
        offeredRupees: (offerType === 'rupees' || offerType === 'upi') ? offeredRupees : null,
        paymentMethod: offerType === 'item' ? null : offerType,
        paymentStatus: offerType === 'upi' ? 'completed' : (offerType === 'rupees' ? 'pending' : null),
        paymentConfirmedAt: offerType === 'upi' ? new Date().toISOString() : null,
        status: 'pending',
        pickupDate,
        pickupTime,
        pickupLocation,
        createdAt: serverTimestamp()
      });
      
      // Call the schedule-pickup API
      await fetch('/api/schedule-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: docRef.id, pickupDate, pickupTime, pickupLocation })
      }).catch(err => console.error('API scheduling failed:', err));

      if (offerType === 'upi') {
        await fetch('/api/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: docRef.id, paymentMethod: 'upi', amount: offeredRupees })
        }).catch(err => console.error('API payment confirmation failed:', err));
      }

      // Send initial message
      await addDoc(collection(db, 'swapRequests', docRef.id, 'messages'), {
        requestId: docRef.id,
        senderId: auth.currentUser.uid,
        text: `Hi! I've requested a swap for your "${item.title}". I'm offering ${offerType === 'item' ? 'an item' : '₹' + offeredRupees} in exchange. ${offerType === 'upi' ? '(Paid via UPI)' : ''} Proposed pickup: ${pickupDate} at ${pickupTime}.`,
        createdAt: serverTimestamp()
      });

      if (offerType === 'rupees') {
        toast.info('Redirecting to secure payment...');
        await initiateStripePayment(offeredRupees, docRef.id, item.title);
      } else {
        toast.success('Swap request sent successfully! 🤝');
        navigate(`/chat/${docRef.id}`);
      }
    } catch (error) {
      console.error('Error submitting swap request:', error);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getUpiLink = () => {
    const name = encodeURIComponent(owner?.displayName || 'Chennai Swap');
    const note = encodeURIComponent(`Swap for ${item.title}`);
    return `upi://pay?pa=${upiVpa}&pn=${name}&am=${offeredRupees}&cu=INR&tn=${note}`;
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-600" /></div>;
  if (!item) return <div className="py-20 text-center text-stone-500">Item not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-stone-900">Propose a Swap</h1>
        <p className="text-stone-500">Negotiate an exchange with {owner?.displayName || 'the owner'}</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Requested Item */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" /> You are requesting:
          </h2>
          <WasteCard item={item} />
          <div className="bg-stone-100 p-6 rounded-3xl border border-stone-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <Recycle className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-stone-900">{owner?.displayName}</div>
                <div className="text-xs text-stone-500">Chennai Swapper</div>
              </div>
            </div>
            <p className="text-sm text-stone-600 italic">"I'm looking for reusable materials or eco-credits in exchange for this item."</p>
          </div>
        </div>

        {/* Negotiation Form */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-8">
          <h2 className="text-xl font-bold">Your Offer</h2>
          
          <div className="flex bg-stone-100 p-1 rounded-2xl overflow-x-auto">
            <button 
              onClick={() => setOfferType('item')}
              className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold transition-all text-sm ${offerType === 'item' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500'}`}
            >
              Item
            </button>
            <button 
              onClick={() => setOfferType('rupees')}
              className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold transition-all text-sm ${offerType === 'rupees' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500'}`}
            >
              Stripe
            </button>
            <button 
              onClick={() => setOfferType('upi')}
              className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold transition-all text-sm ${offerType === 'upi' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500'}`}
            >
              UPI Pay
            </button>
          </div>

          {offerType === 'item' ? (
            <div className="space-y-4">
              <label className="text-sm font-bold text-stone-700">Select one of your items:</label>
              {myItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-2">
                  {myItems.map(myItem => (
                    <div 
                      key={myItem.id}
                      onClick={() => setSelectedMyItemId(myItem.id)}
                      className={`cursor-pointer rounded-2xl border-2 transition-all overflow-hidden ${selectedMyItemId === myItem.id ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-stone-100'}`}
                    >
                      <img src={myItem.imageUrl} alt={myItem.title} className="w-full h-24 object-cover" />
                      <div className="p-2 text-xs font-bold truncate">{myItem.title}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-3xl text-stone-400">
                  <p className="mb-4">You don't have any available items to swap.</p>
                  <button 
                    onClick={() => navigate('/upload')}
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    Upload an item now
                  </button>
                </div>
              )}
            </div>
          ) : offerType === 'rupees' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-stone-700">Amount in Rupees (₹):</label>
                <div className="text-xs text-stone-500 font-bold italic">Secure Bank Transfer via Stripe</div>
              </div>
              <div className="relative">
                <Award className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input 
                  type="number"
                  value={offeredRupees}
                  onChange={(e) => setOfferedRupees(Number(e.target.value))}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                  placeholder="0"
                />
              </div>
              <p className="text-[10px] text-stone-400">You will be redirected to a secure payment page to complete the transaction.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-bold text-stone-700">Enter Amount (₹):</label>
                <input 
                  type="number"
                  value={offeredRupees}
                  onChange={(e) => setOfferedRupees(Number(e.target.value))}
                  className="w-full p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                  placeholder="0"
                />
              </div>

              {offeredRupees > 0 && (
                <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-stone-900">Pay via UPI</div>
                      <div className="text-xs text-stone-500">Scan or click to pay ₹{offeredRupees}</div>
                    </div>
                  </div>
                  
                  <a 
                    href={getUpiLink()}
                    className="block w-full bg-stone-900 text-white py-3 rounded-xl font-bold text-center hover:bg-black transition-all"
                  >
                    Pay with UPI App
                  </a>

                  <div className="flex items-center gap-3 pt-4 border-t border-emerald-200">
                    <input 
                      type="checkbox"
                      id="confirm-upi"
                      checked={paymentConfirmed}
                      onChange={(e) => setPaymentConfirmed(e.target.checked)}
                      className="w-5 h-5 accent-emerald-600"
                    />
                    <label htmlFor="confirm-upi" className="text-xs font-bold text-stone-700 cursor-pointer">
                      I have successfully completed the payment
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-6 pt-6 border-t border-stone-100">
            <h3 className="font-bold text-stone-900 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-emerald-600" /> Pickup Scheduling
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">Date</label>
                <input 
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">Time</label>
                <input 
                  type="time"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 uppercase">Pickup Location / Address</label>
              <textarea 
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="Enter full address for pickup..."
                rows={2}
                className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100">
            <div className="flex items-center justify-between mb-8">
              <div className="text-stone-500 text-sm">Exchange Summary</div>
              <div className="flex items-center gap-2 font-bold text-stone-900">
                {item.title} <ArrowRight className="w-4 h-4 text-emerald-600" /> {offerType === 'item' ? (selectedMyItemId ? myItems.find(i => i.id === selectedMyItemId)?.title : '...') : `₹${offeredRupees}`}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Send Swap Proposal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
