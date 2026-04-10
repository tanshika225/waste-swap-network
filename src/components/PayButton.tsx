import React from 'react';
import { IndianRupee, ExternalLink } from 'lucide-react';

interface PayButtonProps {
  amount: number;
  upiId: string;
  merchantName?: string;
  transactionNote?: string;
  className?: string;
}

export default function PayButton({ 
  amount, 
  upiId, 
  merchantName = "WasteSwap", 
  transactionNote = "Swap Payment",
  className = "" 
}: PayButtonProps) {
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  const handlePay = () => {
    window.location.href = upiUrl;
  };

  return (
    <button
      onClick={handlePay}
      className={`flex items-center justify-center gap-2 w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 ${className}`}
    >
      <IndianRupee className="w-5 h-5" />
      <span>Pay ₹{amount} via UPI</span>
      <ExternalLink className="w-4 h-4 opacity-70" />
    </button>
  );
}
