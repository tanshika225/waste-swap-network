import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion } from 'motion/react';
import { ArrowLeft, Package, Recycle, Award, Loader2 } from 'lucide-react';
import Chat from '../components/Chat';

export default function ChatPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<any>(null);
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!requestId || !auth.currentUser) return;

      try {
        const reqDoc = await getDoc(doc(db, 'swapRequests', requestId));
        if (reqDoc.exists()) {
          const reqData = { id: reqDoc.id, ...reqDoc.data() } as any;
          setRequest(reqData);
          
          if (reqData.itemId) {
            const itemDoc = await getDoc(doc(db, 'wasteItems', reqData.itemId));
            if (itemDoc.exists()) setItem({ id: itemDoc.id, ...itemDoc.data() });
          }
        }
      } catch (error) {
        console.error('Error fetching chat data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId]);

  if (loading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-600" /></div>;
  if (!request) return <div className="py-20 text-center text-stone-500">Swap request not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors font-bold"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
            <Recycle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Swap Negotiation</h1>
            <p className="text-stone-500 text-sm">Discussing: <span className="font-bold text-stone-800">{item?.title || 'Item'}</span></p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 px-6 py-3 bg-stone-50 rounded-2xl border border-stone-100">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-stone-400">Status</div>
            <div className="text-sm font-bold text-emerald-600 capitalize">{request.status}</div>
          </div>
          <div className="w-px h-8 bg-stone-200 mx-2" />
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-stone-400">Offer</div>
            <div className="text-sm font-bold text-stone-800">
              {request.offeredItemId ? 'Item Swap' : `${request.offeredCredits} Credits`}
            </div>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Chat requestId={request.id} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wider">Swap Details</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                <Package className="w-5 h-5 text-emerald-600" />
                <div className="text-xs font-bold text-stone-800">{item?.title}</div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                <Award className="w-5 h-5 text-amber-500" />
                <div className="text-xs font-bold text-stone-800">
                  {request.offeredItemId ? 'Item Exchange' : `${request.offeredCredits} Eco-Credits`}
                </div>
              </div>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Use the chat to coordinate pickup, verify item condition, or finalize credit transfers.
            </p>
          </div>
          
          <div className="bg-emerald-600 p-6 rounded-3xl text-white space-y-4">
            <h3 className="font-bold">Safety Tips</h3>
            <ul className="text-xs space-y-3 opacity-90">
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-white rounded-full mt-1 shrink-0" />
                Meet in public places for item exchanges.
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-white rounded-full mt-1 shrink-0" />
                Verify the item condition before completing the swap.
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-white rounded-full mt-1 shrink-0" />
                Never share personal financial information.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
