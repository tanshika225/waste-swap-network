import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import WasteCard from '../components/WasteCard';
import { Search, Grid, Navigation, Filter, X, ChevronDown } from 'lucide-react';
import { getCurrentLocation, Location } from '../lib/location';

const CATEGORIES = ["plastic", "paper", "metal", "glass", "organic", "other"];

export default function SwapPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [wasteType, setWasteType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [radius, setRadius] = useState('5');
  const [useRadiusFilter, setUseRadiusFilter] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'wasteItems'),
      where('status', '==', 'available')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Client-side filtering for complex filters
      if (wasteType) {
        fetchedItems = fetchedItems.filter(item => item.category === wasteType);
      }
      if (minPrice) {
        fetchedItems = fetchedItems.filter(item => item.estimatedValue >= Number(minPrice));
      }
      if (maxPrice) {
        fetchedItems = fetchedItems.filter(item => item.estimatedValue <= Number(maxPrice));
      }
      if (useRadiusFilter && userLocation) {
        fetchedItems = fetchedItems.filter(item => {
          if (!item.location) return false;
          const dist = calculateDistance(userLocation, item.location);
          return dist <= Number(radius);
        });
      }

      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch items:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [wasteType, minPrice, maxPrice, useRadiusFilter, userLocation, radius]);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const loc = await getCurrentLocation();
        setUserLocation(loc);
        
        // Update user location in Firestore if logged in
        if (auth.currentUser) {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userRef, {
            location: loc,
            lastLocationUpdate: new Date().toISOString()
          }).catch(err => console.error('Failed to update user location:', err));
        }
      } catch (err) {
        console.error('Failed to get user location:', err);
      }
    };
    fetchLocation();
  }, []);

  const calculateDistance = (loc1: Location, loc2: { lat: number; lng: number }): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
    const dLng = (loc2.lng - loc1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.lat * (Math.PI / 180)) *
        Math.cos(loc2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleSwapRequest = (itemId: string) => {
    if (!auth.currentUser) return alert('Please login to request a swap');
    navigate(`/request-swap/${itemId}`);
  };

  const filteredItems = items.filter(i => {
    const matchesSearch = i.title.toLowerCase().includes(search.toLowerCase()) || 
                         i.category.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const clearFilters = () => {
    setWasteType('');
    setMinPrice('');
    setMaxPrice('');
    setRadius('5');
    setUseRadiusFilter(false);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900">Exchange Network</h1>
          <p className="text-sm md:text-base text-stone-500">Find reusable items near you in Chennai</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium ${
                showFilters || wasteType || minPrice || maxPrice || useRadiusFilter
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(wasteType || minPrice || maxPrice || useRadiusFilter) && (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </button>

            <button
              onClick={() => setUseRadiusFilter(!useRadiusFilter)}
              disabled={!userLocation}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium ${
                useRadiusFilter 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' 
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
              } ${!userLocation && 'opacity-50 cursor-not-allowed'}`}
              title={!userLocation ? "Location access required" : "Show items within radius"}
            >
              <Navigation className={`w-4 h-4 ${useRadiusFilter ? 'animate-pulse' : ''}`} />
              {useRadiusFilter ? `Within ${radius}km` : 'Nearby'}
            </button>
          </div>
        </div>
      </header>

      {/* Filter UI */}
      {showFilters && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-stone-900 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Smart Filters
            </h3>
            <button 
              onClick={clearFilters}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Waste Type */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-stone-400">Waste Type</label>
              <div className="relative">
                <select
                  value={wasteType}
                  onChange={(e) => setWasteType(e.target.value)}
                  className="w-full appearance-none bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-stone-400">Price Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="text-stone-300">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Distance Radius */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-stone-400">Distance (km)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full accent-emerald-600"
                />
                <span className="text-sm font-bold text-stone-600 w-12">{radius}km</span>
              </div>
            </div>

            {/* Apply Button */}
            <div className="flex items-end">
              <button
                onClick={() => setShowFilters(false)}
                className="w-full bg-stone-900 text-white py-2.5 rounded-xl font-bold hover:bg-stone-800 transition-colors text-sm"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-stone-100 animate-pulse rounded-3xl aspect-[3/4]"></div>
          ))
        ) : (
          filteredItems.map(item => (
            <WasteCard key={item.id} item={item} onSwap={handleSwapRequest} />
          ))
        )}
        {!loading && filteredItems.length === 0 && (
          <div className="col-span-full py-20 text-center text-stone-400">
            No items found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}
