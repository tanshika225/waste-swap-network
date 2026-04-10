import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { analyzeWaste, WasteAnalysis } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';
import { Upload, Camera, Loader2, CheckCircle2, Scale, Leaf, Info, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { getCurrentLocation, Location } from '../lib/location';
import { compressImage } from '../lib/imageUtils';
import { toast } from 'sonner';

export default function UploadWaste() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [repairability, setRepairability] = useState('');
  const [isBiodegradable, setIsBiodegradable] = useState(false);
  const [estimatedWeight, setEstimatedWeight] = useState(0);
  const [estimatedValue, setEstimatedValue] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCurrentLocation()
      .then(setUserLocation)
      .catch(err => console.error('Failed to get location for upload:', err));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          setLoading(true);
          const compressed = await compressImage(base64);
          setPreview(compressed);
        } catch (err) {
          console.error('Compression failed:', err);
          setPreview(base64);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleAIAnalyze = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const result = await analyzeWaste(preview);
      setCategory(result.category);
      setCondition(result.condition);
      setRepairability(result.repairability);
      setIsBiodegradable(result.isBiodegradable);
      setEstimatedWeight(result.estimatedWeightKg);
      setDescription(result.description);
      setStep(2);
    } catch (error) {
      console.error('Analysis failed:', error);
      setCategory('other');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      // Safety check for base64 size (Firestore limit is 1MB)
      if (preview && preview.length > 1000000) {
        toast.error('Image is too large. Please try a smaller photo.');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'wasteItems'), {
        ownerId: auth.currentUser.uid,
        ownerName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Anonymous',
        title,
        description,
        category,
        condition,
        repairability,
        isBiodegradable,
        estimatedWeightKg: estimatedWeight,
        imageUrl: preview, // In a real app, upload to storage first
        status: 'available',
        estimatedValue,
        createdAt: serverTimestamp(),
        location: userLocation || { lat: 13.0827, lng: 80.2707 } // Use user location or default Chennai
      });
      toast.success('Item listed for swap successfully! ♻️');
      navigate('/dashboard');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to list item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4">
      <header className="mb-8 md:mb-10 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-stone-900">Advanced Waste Analysis</h1>
        <p className="text-sm md:text-base text-stone-500">AI-powered segregation, biodegradability check, and weight estimation</p>
      </header>

      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-stone-200">
        {step === 1 ? (
          <div className="space-y-6 md:space-y-8">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-4 border-dashed border-stone-100 rounded-3xl p-8 md:p-12 text-center cursor-pointer hover:bg-stone-50 transition-colors group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
                capture="environment"
              />
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-48 md:max-h-64 mx-auto rounded-2xl shadow-md" />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-emerald-100 p-4 md:p-6 rounded-2xl group-hover:scale-110 transition-transform">
                    <Camera className="w-10 h-10 md:w-12 md:h-12 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-base md:text-lg font-bold">Click to upload photo</p>
                    <p className="text-xs md:text-sm text-stone-400">Take a clear picture of the waste item</p>
                  </div>
                </div>
              )}
            </div>

            {preview && (
              <button
                onClick={handleAIAnalyze}
                disabled={loading}
                className="w-full bg-emerald-600 text-white py-3 md:py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Analyze with Advanced AI
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
              <div className="p-3 md:p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <Info className="w-3 h-3 md:w-4 h-4" />
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">Type</span>
                </div>
                <div className="font-bold text-emerald-900 capitalize text-sm md:text-base">{category}</div>
              </div>
              <div className="p-3 md:p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <Leaf className="w-3 h-3 md:w-4 h-4" />
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">Nature</span>
                </div>
                <div className="font-bold text-emerald-900 text-sm md:text-base">
                  {isBiodegradable ? 'Biodegradable' : 'Non-Biodegradable'}
                </div>
              </div>
              <div className="p-3 md:p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <Scale className="w-3 h-3 md:w-4 h-4" />
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">Weight</span>
                </div>
                <div className="font-bold text-emerald-900 text-sm md:text-base">{estimatedWeight} kg</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6">
              <div className="p-3 md:p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <CheckCircle2 className="w-3 h-3 md:w-4 h-4" />
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">Condition</span>
                </div>
                <div className="font-bold text-amber-900 capitalize text-sm md:text-base">{condition}</div>
              </div>
              <div className="p-3 md:p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <Loader2 className="w-3 h-3 md:w-4 h-4" />
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">Repairability</span>
                </div>
                <div className="font-bold text-blue-900 capitalize text-sm md:text-base">{repairability}</div>
              </div>
            </div>

            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm font-bold text-stone-700">Item Title</label>
              <input 
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Plastic Bottles for Recycling"
                className="w-full p-3 md:p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm md:text-base"
              />
            </div>

            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm font-bold text-stone-700">Description (AI Generated)</label>
              <textarea 
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the condition and quantity..."
                rows={4}
                className="w-full p-3 md:p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm md:text-base"
              />
            </div>

            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm font-bold text-stone-700">Estimated Value (₹)</label>
              <input 
                required
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(Number(e.target.value))}
                placeholder="0"
                className="w-full p-3 md:p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm md:text-base"
              />
            </div>

            <div className="flex items-center gap-2 text-stone-500 bg-stone-50 p-3 rounded-2xl border border-stone-100">
              <MapPin className={`w-4 h-4 ${userLocation ? 'text-emerald-600' : 'text-stone-400'}`} />
              <span className="text-xs">
                {userLocation 
                  ? `Location captured: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` 
                  : 'Capturing location...'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full sm:flex-1 border-2 border-stone-200 py-3 md:py-4 rounded-2xl font-bold hover:bg-stone-50 transition-all text-sm md:text-base"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:flex-[2] bg-emerald-600 text-white py-3 md:py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 text-sm md:text-base"
              >
                {loading ? 'Uploading...' : 'List for Swap'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
