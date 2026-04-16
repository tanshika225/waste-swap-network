import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { IndianRupee, CheckCircle2, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { toast } from 'sonner';
import PayButton from '../components/PayButton';

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [sellerUpiId, setSellerUpiId] = useState<string>("");
  const [sellerId, setSellerId] = useState<string>("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  
  const requestId = searchParams.get('requestId');
  const amount = Number(searchParams.get('amount')) || 0;
  const itemName = searchParams.get('itemName') || 'Waste Item';
  const wasteId = searchParams.get('wasteId');
  
  useEffect(() => {
    if (!requestId || amount <= 0) {
      toast.error("Invalid payment details");
      navigate('/dashboard');
      return;
    }

    const fetchSellerDetails = async () => {
      try {
        setLoading(true);
        // 1. Fetch swap request directly from Firestore
        const requestDoc = await getDoc(doc(db, 'swapRequests', requestId));
        if (requestDoc.exists()) {
          const reqData = requestDoc.data();
          const sId = reqData.ownerId;
          setSellerId(sId);
          
          // 2. Fetch seller profile to get upiId
          const sellerRes = await axios.get(`/api/users/${sId}`);
          if (sellerRes.data.upiId) {
            setSellerUpiId(sellerRes.data.upiId);
          } else {
            toast.error("Seller has not set up a UPI ID yet.");
          }
        } else {
          toast.error("Swap request not found");
          navigate('/dashboard');
        }
      } catch (error) {
        console.error("Error fetching seller details:", error);
        toast.error("Failed to load payment details");
      } finally {
        setLoading(false);
      }
    };

    fetchSellerDetails();
  }, [requestId, amount, navigate]);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmPayment = async () => {
    if (!sellerUpiId && !searchParams.get('demo')) {
      toast.error("Cannot confirm: Seller UPI ID missing");
      return;
    }

    setConfirming(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      await axios.post('/api/payments/confirm', {
        requestId,
        amount,
        wasteId,
        sellerId,
        screenshotUrl: screenshot || "demo-simulation"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Payment confirmed successfully!");
      navigate('/dashboard?payment=success');
    } catch (error: any) {
      console.error("Confirmation Error:", error);
      toast.error("Failed to confirm payment. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleDemoSimulation = () => {
    setSellerUpiId("vishalinibasu1055@okhdfcbank");
    toast.info("Demo Mode Activated: Using vishalinibasu1055@okhdfcbank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  const maskedUpi = sellerUpiId ? `${sellerUpiId.split('@')[0].slice(0, 3)}***@${sellerUpiId.split('@')[1]}` : "Not Available";

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-12 px-4">
      <div className="max-w-md mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-stone-200/50 overflow-hidden border border-stone-100">
          <div className="bg-emerald-600 p-8 text-white text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
              <IndianRupee className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold mb-1">Direct P2P Payment</h1>
            <p className="text-emerald-100 opacity-90">Paying for: {itemName}</p>
          </div>

          <div className="p-8">
            <div className="text-center mb-8">
              <span className="text-stone-400 text-sm uppercase tracking-wider font-bold">Amount to Pay</span>
              <div className="text-5xl font-black text-stone-900 mt-1">₹{amount}</div>
              <div className="mt-2 text-stone-500 text-xs font-medium">
                To Seller UPI: <span className="text-stone-900 font-bold">{maskedUpi}</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200 mb-8">
              {!sellerUpiId && (
                <div className="mb-4 text-center">
                  <p className="text-xs text-amber-600 font-bold mb-2 uppercase">Testing Mode</p>
                  <button 
                    onClick={handleDemoSimulation}
                    className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-200 transition-all"
                  >
                    Activate Demo UPI
                  </button>
                </div>
              )}
              <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                {sellerUpiId ? (
                  <QRCodeSVG 
                    value={`upi://pay?pa=${sellerUpiId}&pn=WasteSwap&am=${amount}&cu=INR&tn=Payment for ${itemName}`}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center text-stone-300">
                    <AlertCircle className="w-12 h-12" />
                  </div>
                )}
              </div>
              <p className="text-stone-500 text-sm text-center px-4">
                Scan this QR code with any UPI app to pay the seller directly.
              </p>
            </div>

            <div className="space-y-4">
              {sellerUpiId && (
                <PayButton 
                  amount={amount} 
                  upiId={sellerUpiId} 
                  transactionNote={`Payment for ${itemName}`}
                />
              )}
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-stone-400 font-medium">Confirmation</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase px-1">Upload Payment Screenshot (Optional)</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      className="hidden" 
                      id="screenshot-upload"
                    />
                    <label 
                      htmlFor="screenshot-upload"
                      className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-stone-200 rounded-2xl text-stone-500 text-sm font-medium hover:bg-stone-50 cursor-pointer transition-all"
                    >
                      {screenshot ? "Screenshot Selected ✓" : "Choose Image"}
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={confirming || !sellerUpiId}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all disabled:opacity-50 shadow-lg shadow-stone-200"
                >
                  {confirming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>I have paid ₹{amount}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-8 flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                This is a direct P2P payment. WasteSwap does not hold your funds. 
                Please ensure you have completed the payment before confirming.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
