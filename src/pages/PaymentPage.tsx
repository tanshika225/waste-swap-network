import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { IndianRupee, CheckCircle2, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { auth } from '../firebase';
import axios from 'axios';
import { toast } from 'sonner';
import PayButton from '../components/PayButton';

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  
  const requestId = searchParams.get('requestId');
  const amount = Number(searchParams.get('amount')) || 0;
  const itemName = searchParams.get('itemName') || 'Waste Item';
  const wasteId = searchParams.get('wasteId');
  
  // In a real app, this would come from environment variables
  const UPI_ID = (import.meta as any).env.VITE_UPI_ID || "demo@upi";

  useEffect(() => {
    if (!requestId || amount <= 0) {
      toast.error("Invalid payment details");
      navigate('/dashboard');
    }
  }, [requestId, amount, navigate]);

  const handleConfirmPayment = async () => {
    setConfirming(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      await axios.post('/api/payments/confirm', {
        requestId,
        amount,
        wasteId
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
            <h1 className="text-2xl font-bold mb-1">Payment for Swap</h1>
            <p className="text-emerald-100 opacity-90">{itemName}</p>
          </div>

          <div className="p-8">
            <div className="text-center mb-8">
              <span className="text-stone-400 text-sm uppercase tracking-wider font-bold">Amount to Pay</span>
              <div className="text-5xl font-black text-stone-900 mt-1">₹{amount}</div>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200 mb-8">
              <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                <QRCodeSVG 
                  value={`upi://pay?pa=${UPI_ID}&pn=WasteSwap&am=${amount}&cu=INR&tn=Payment for ${itemName}`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-stone-500 text-sm text-center px-4">
                Scan this QR code with any UPI app (GPay, PhonePe, Paytm) to pay.
              </p>
            </div>

            <div className="space-y-4">
              <PayButton 
                amount={amount} 
                upiId={UPI_ID} 
                transactionNote={`Payment for ${itemName}`}
              />
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-stone-400 font-medium">After Payment</span>
                </div>
              </div>

              <button
                onClick={handleConfirmPayment}
                disabled={confirming}
                className="flex items-center justify-center gap-2 w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all disabled:opacity-50"
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

            <div className="mt-8 flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Please ensure you have completed the payment in your UPI app before clicking "I have paid". 
                False confirmations may lead to account suspension.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
