import React from 'react';
import { MapPin, Tag, User, Leaf, Scale } from 'lucide-react';
import { motion } from 'motion/react';

interface WasteItem {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  status: string;
  ownerId: string;
  estimatedValue: number;
  isBiodegradable?: boolean;
  estimatedWeightKg?: number;
  location?: { lat: number; lng: number };
}

export default function WasteCard({ item, onSwap }: { item: any; onSwap?: (id: string) => void; key?: any }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-200 hover:shadow-md transition-shadow"
    >
      <div className="relative">
        <img 
          src={item.imageUrl} 
          alt={item.title} 
          className="w-full h-48 object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {item.ownerName && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/90 text-stone-900 shadow-sm backdrop-blur-sm flex items-center gap-1">
              <User className="w-2 h-2" />
              {item.ownerName}
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider shadow-sm ${
            item.category === 'plastic' ? 'bg-blue-500 text-white' :
            item.category === 'paper' ? 'bg-amber-500 text-white' :
            item.category === 'metal' ? 'bg-stone-500 text-white' :
            'bg-emerald-500 text-white'
          }`}>
            {item.category}
          </span>
          {item.isBiodegradable !== undefined && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider shadow-sm flex items-center gap-1 ${
              item.isBiodegradable ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-700'
            }`}>
              <Leaf className="w-2 h-2" />
              {item.isBiodegradable ? 'Bio' : 'Non-Bio'}
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-stone-900">{item.title}</h3>
        </div>
        <p className="text-stone-600 text-sm mb-4 line-clamp-2">{item.description}</p>
        
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-2 text-stone-500 text-xs">
            <MapPin className="w-3 h-3" />
            <span>Chennai</span>
          </div>
          <div className="flex items-center gap-2 text-stone-500 text-xs">
            <Tag className="w-3 h-3" />
            <span className="font-bold text-emerald-600">₹{item.estimatedValue}</span>
          </div>
          {item.estimatedWeightKg !== undefined && (
            <div className="flex items-center gap-2 text-stone-500 text-xs col-span-2">
              <Scale className="w-3 h-3" />
              <span>Weight: <span className="font-bold text-stone-700">{item.estimatedWeightKg} kg</span></span>
            </div>
          )}
        </div>

        {onSwap && item.status === 'available' && (
          <div className="flex gap-2">
            <button 
              onClick={() => onSwap(item.id)}
              className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm"
            >
              Swap
            </button>
            <button 
              onClick={() => onSwap(item.id)} // For now, both lead to RequestSwap where user can choose UPI
              className="flex-1 bg-stone-900 text-white py-2 rounded-xl font-semibold hover:bg-black transition-colors text-sm"
            >
              Pay ₹{item.estimatedValue}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
