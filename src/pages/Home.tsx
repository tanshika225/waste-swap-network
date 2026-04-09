import React, { useEffect, useState } from 'react';
import axios from 'axios';
import WasteCard from '../components/WasteCard';
import { motion } from 'motion/react';
import { Recycle, ArrowRight, ShieldCheck, Globe, Sparkles, Zap, MessageSquare, Scale, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  const [recentItems, setRecentItems] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecentItems = async () => {
      try {
        const response = await axios.get('/api/waste-items');
        // Take only the first 4 available items
        setRecentItems(response.data.slice(0, 4));
      } catch (error) {
        console.error('Failed to fetch recent items:', error);
      }
    };
    fetchRecentItems();
  }, []);

  return (
    <div className="space-y-32 pb-20">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] md:min-h-[80vh] flex items-center justify-center text-center px-4 py-12 md:py-0">
        <div className="max-w-4xl z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] md:text-xs font-black uppercase tracking-widest mb-6 md:mb-8 border border-emerald-200"
          >
            <Sparkles className="w-3 h-3" />
            AI-Powered Circular Economy
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-8xl font-black leading-[1.1] md:leading-[0.9] mb-6 md:mb-8 text-stone-900 tracking-tighter"
          >
            Swap Waste. <br />
            <span className="text-emerald-600">Save Chennai.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base md:text-xl text-stone-500 mb-8 md:mb-12 max-w-2xl mx-auto font-medium px-4"
          >
            Join the next generation of waste management. Use advanced AI to classify, weigh, and swap your reusable waste with neighbors.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6 px-4"
          >
            <Link to="/upload" className="w-full sm:w-auto bg-emerald-600 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-emerald-200 group">
              Start Swapping <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/swaps" className="w-full sm:w-auto bg-white text-stone-900 px-8 md:px-10 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black hover:bg-stone-50 transition-all border border-stone-200 shadow-xl shadow-stone-100 flex items-center justify-center">
              Explore Items
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Advanced Tech Showcase */}
      <section className="grid lg:grid-cols-2 gap-12 items-center px-4">
        <div className="space-y-6 md:space-y-8 order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-[10px] md:text-xs font-black uppercase tracking-widest border border-blue-200">
            <Zap className="w-3 h-3" />
            Advanced Technologies
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Powered by <span className="text-blue-600">Next-Gen AI</span>
          </h2>
          <p className="text-base md:text-lg text-stone-500 font-medium">
            Our platform leverages multimodal AI to automate the most tedious parts of waste management.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-6">
            {[
              { icon: ShieldCheck, title: "Automated Segregation", desc: "Instantly identifies plastic, paper, metal, and glass from a single photo." },
              { icon: Leaf, title: "Biodegradability Analysis", desc: "Know exactly what's good for the earth and what needs special care." },
              { icon: Scale, title: "Visual Weight Estimation", desc: "AI estimates the weight of your items to calculate your environmental impact." },
              { icon: MessageSquare, title: "24/7 Eco Assistant", desc: "Our intelligent chatbot helps you navigate the platform and provides waste advice." }
            ].map((item, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="bg-white p-3 h-fit rounded-2xl shadow-sm border border-stone-100 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                  <item.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-stone-900 text-sm md:text-base">{item.title}</h4>
                  <p className="text-xs md:text-sm text-stone-500 font-medium">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative order-1 lg:order-2">
          <div className="absolute inset-0 bg-emerald-600/10 rounded-[2rem] md:rounded-[4rem] blur-3xl -rotate-6"></div>
          <div className="relative bg-white p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-stone-200 shadow-2xl">
            <div className="aspect-square bg-stone-50 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center border-2 border-dashed border-stone-200 overflow-hidden relative">
              <img 
                src="https://picsum.photos/seed/waste-ai/800/800" 
                alt="AI Analysis Demo" 
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/40 to-transparent"></div>
              <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6 flex flex-col gap-2">
                <div className="bg-white/90 backdrop-blur px-3 md:px-4 py-1.5 md:py-2 rounded-xl flex items-center justify-between shadow-lg">
                  <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Category</span>
                  <span className="text-xs md:text-sm font-black text-emerald-600">Plastic Bottles</span>
                </div>
                <div className="bg-white/90 backdrop-blur px-3 md:px-4 py-1.5 md:py-2 rounded-xl flex items-center justify-between shadow-lg">
                  <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Weight</span>
                  <span className="text-xs md:text-sm font-black text-blue-600">~2.5 kg</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Items */}
      <section className="px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 md:mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight">Latest Listings</h2>
            <p className="text-sm md:text-base text-stone-500 font-medium">Items available for swap near you</p>
          </div>
          <Link to="/swaps" className="text-emerald-600 font-black hover:text-emerald-700 transition-colors flex items-center gap-2 group text-sm md:text-base">
            View all items <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {recentItems.map(item => (
            <WasteCard key={item.id} item={item} />
          ))}
          {recentItems.length === 0 && (
            <div className="col-span-full py-16 md:py-24 text-center text-stone-400 bg-white rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-stone-200 px-4">
              <Recycle className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-sm md:text-base">No items available yet. Be the first to upload!</p>
            </div>
          )}
        </div>
      </section>

      {/* Impact Stats */}
      <section className="relative overflow-hidden bg-stone-900 rounded-[2rem] md:rounded-[4rem] p-8 sm:p-16 md:p-24 text-white mx-4">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-600/10 blur-[120px] rounded-full"></div>
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-6xl font-black mb-12 md:mb-16 tracking-tight">Our Collective Impact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 md:gap-16">
            <div className="space-y-2">
              <div className="text-4xl md:text-6xl font-black text-emerald-400 tracking-tighter">1,250+</div>
              <div className="text-stone-400 uppercase tracking-widest text-[10px] font-black">Items Reused</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-6xl font-black text-blue-400 tracking-tighter">4.2 T</div>
              <div className="text-stone-400 uppercase tracking-widest text-[10px] font-black">CO2 Saved</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-6xl font-black text-emerald-400 tracking-tighter">850</div>
              <div className="text-stone-400 uppercase tracking-widest text-[10px] font-black">Active Swappers</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
