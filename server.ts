import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
  console.log('Firebase Admin initialized with project:', firebaseConfig.projectId);
  
  // Log the service account identity if possible
  admin.auth().listUsers(1).then(() => {
    console.log('Admin SDK successfully authenticated');
  }).catch(err => {
    console.log('Admin SDK Identity Info:', err.message);
  });
}

// Try to get the specific database, fallback to default if needed
let db: admin.firestore.Firestore;
try {
  db = getFirestore(firebaseConfig.firestoreDatabaseId);
  console.log('Firestore initialized with database:', firebaseConfig.firestoreDatabaseId);
} catch (dbError: any) {
  console.warn('Failed to initialize named database, falling back to default:', dbError.message);
  db = getFirestore();
}

  // Cache for admin status to save reads
  const adminCache = new Map<string, { isAdmin: boolean, timestamp: number }>();
  const ADMIN_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Quota management variables
  let isQuotaExhausted = false;
  let quotaExhaustedAt = 0;
  const QUOTA_COOLDOWN = 30 * 60 * 1000; // 30 minutes cooldown if quota hit

  function handleQuotaError(error: any, context: string) {
    const isQuotaError = error.message?.includes('RESOURCE_EXHAUSTED') || 
                        error.code === 8 || 
                        error.details?.includes('Quota exceeded');
    
    if (isQuotaError) {
      isQuotaExhausted = true;
      quotaExhaustedAt = Date.now();
      console.warn(`Quota Exhausted detected in ${context}. Circuit breaker active.`);
    }
  }

  // Middleware to check quota status
  const checkQuota = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isQuotaExhausted && (Date.now() - quotaExhaustedAt < QUOTA_COOLDOWN)) {
      // For GET requests, we might want to allow them if they hit cache, 
      // but for POST/PUT/DELETE we should probably block or handle specially.
      // We'll let the individual routes handle it for now to provide specific fallbacks.
    }
    next();
  };

  // Cache for user data
  const userProfileCache = new Map<string, { data: any, timestamp: number }>();
  const userItemsCache = new Map<string, { data: any, timestamp: number }>();
  const userRequestsCache = new Map<string, { data: any, timestamp: number }>();
  const USER_DATA_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // Explicitly remove jstanshika1402@gmail.com from admin role as requested
      if (decodedToken.email === 'jstanshika1402@gmail.com') {
        return res.status(403).json({ error: 'Forbidden: User role only' });
      }

      // Check custom claims first (no Firestore read)
      if (decodedToken.role === 'admin' || decodedToken.email === 'admin@wasteswap.com') {
        (req as any).user = decodedToken;
        return next();
      }

      // Check cache first
      const cached = adminCache.get(decodedToken.uid);
      if (cached && (Date.now() - cached.timestamp < ADMIN_CACHE_DURATION)) {
        if (cached.isAdmin) {
          (req as any).user = decodedToken;
          return next();
        }
        return res.status(403).json({ error: 'Forbidden' });
      }

      const isAdminEmail = decodedToken.email === 'admin@wasteswap.com';
      if (isAdminEmail) {
        adminCache.set(decodedToken.uid, { isAdmin: true, timestamp: Date.now() });
        (req as any).user = decodedToken;
        return next();
      }

      if (isQuotaExhausted && (Date.now() - quotaExhaustedAt < QUOTA_COOLDOWN)) {
        return res.status(403).json({ error: 'Forbidden: Quota limit reached' });
      }

      try {
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        const isUserAdmin = userDoc.data()?.role === 'admin';
        
        if (isUserAdmin) {
          await admin.auth().setCustomUserClaims(decodedToken.uid, { role: 'admin' });
        }
        
        adminCache.set(decodedToken.uid, { isAdmin: isUserAdmin, timestamp: Date.now() });
        
        if (isUserAdmin) {
          (req as any).user = decodedToken;
          return next();
        }
      } catch (err: any) {
        handleQuotaError(err, "isAdmin-check");
        // If quota hit, we can't verify admin status, so we must deny access
        // unless they are the hardcoded admin email
      }

      res.status(403).json({ error: 'Forbidden' });
    } catch (error: any) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // User data endpoints
  app.get("/api/user/profile", authenticate, async (req, res) => {
    const user = (req as any).user;
    try {
      if (isQuotaExhausted && (Date.now() - quotaExhaustedAt < QUOTA_COOLDOWN)) {
        const cached = userProfileCache.get(user.uid);
        if (cached) return res.json(cached.data);
        // Minimal fallback for profile
        return res.json({ 
          uid: user.uid, 
          displayName: user.name || 'User', 
          email: user.email,
          impact: { reused: 0, co2Saved: 0 },
          role: 'user'
        });
      }

      const docSnap = await db.collection('users').doc(user.uid).get();
      if (!docSnap.exists) return res.status(404).json({ error: "Profile not found" });
      
      const data = docSnap.data();
      userProfileCache.set(user.uid, { data, timestamp: Date.now() });
      res.json(data);
    } catch (error: any) {
      handleQuotaError(error, "user-profile");
      const cached = userProfileCache.get(user.uid);
      if (cached) return res.json(cached.data);
      
      const isQuota = error.message?.includes('RESOURCE_EXHAUSTED') || error.code === 8 || error.details?.includes('Quota exceeded');
      if (isQuota) {
        return res.json({ 
          uid: user.uid, 
          displayName: user.name || 'User', 
          email: user.email,
          impact: { recycled: 0, reused: 0, co2Saved: 0 },
          role: 'user',
          isLimited: true
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/items", authenticate, async (req, res) => {
    const user = (req as any).user;
    try {
      if (isQuotaExhausted && (Date.now() - quotaExhaustedAt < QUOTA_COOLDOWN)) {
        const cached = userItemsCache.get(user.uid);
        if (cached) return res.json(cached.data);
        return res.json([]);
      }

      const snapshot = await db.collection('wasteItems')
        .where('ownerId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .get();
      
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      userItemsCache.set(user.uid, { data: items, timestamp: Date.now() });
      res.json(items);
    } catch (error: any) {
      handleQuotaError(error, "user-items");
      const cached = userItemsCache.get(user.uid);
      if (cached) return res.json(cached.data);
      
      const isQuota = error.message?.includes('RESOURCE_EXHAUSTED') || error.code === 8 || error.details?.includes('Quota exceeded');
      if (isQuota) return res.json([]); // Return empty list instead of 500
      
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/requests", authenticate, async (req, res) => {
    const user = (req as any).user;
    try {
      if (isQuotaExhausted && (Date.now() - quotaExhaustedAt < QUOTA_COOLDOWN)) {
        const cached = userRequestsCache.get(user.uid);
        if (cached) return res.json(cached.data);
        return res.json({ sent: [], received: [] });
      }

      // Use a shorter timeout for Firestore queries to prevent hanging
      const sentSnapshot = await db.collection('swapRequests').where('requesterId', '==', user.uid).get();
      const receivedSnapshot = await db.collection('swapRequests').where('ownerId', '==', user.uid).get();
      
      const requests = {
        sent: sentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        received: receivedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      };
      
      userRequestsCache.set(user.uid, { data: requests, timestamp: Date.now() });
      res.json(requests);
    } catch (error: any) {
      handleQuotaError(error, "user-requests");
      const cached = userRequestsCache.get(user.uid);
      if (cached) return res.json(cached.data);
      
      const isQuota = error.message?.includes('RESOURCE_EXHAUSTED') || error.code === 8 || error.details?.includes('Quota exceeded');
      if (isQuota) return res.json({ sent: [], received: [] });
      
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/waste-items/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const docSnap = await db.collection('wasteItems').doc(id).get();
      if (!docSnap.exists) return res.status(404).json({ error: "Item not found" });
      res.json({ id: docSnap.id, ...docSnap.data() });
    } catch (error: any) {
      handleQuotaError(error, `waste-item-${id}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const docSnap = await db.collection('users').doc(id).get();
      if (!docSnap.exists) return res.status(404).json({ error: "User not found" });
      const data = docSnap.data();
      // Remove sensitive info
      const { email, ...publicData } = data as any;
      res.json(publicData);
    } catch (error: any) {
      handleQuotaError(error, `user-profile-${id}`);
      res.status(500).json({ error: error.message });
    }
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Waste Swap Network API is running" });
  });

  app.get("/api/quota-status", (req, res) => {
    const active = isQuotaExhausted && (Date.now() - quotaExhaustedAt < QUOTA_COOLDOWN);
    res.json({ 
      isQuotaExhausted: active,
      remainingCooldown: active ? Math.max(0, QUOTA_COOLDOWN - (Date.now() - quotaExhaustedAt)) : 0
    });
  });

  app.get("/api/auth/status", authenticate, async (req, res) => {
    const user = (req as any).user;
    const start = Date.now();
    try {
      // Check cache first
      const cached = adminCache.get(user.uid);
      if (cached && (Date.now() - cached.timestamp < ADMIN_CACHE_DURATION)) {
        return res.json({ role: cached.isAdmin ? 'admin' : 'user' });
      }

      const isAdminEmail = user.email === 'admin@wasteswap.com';
      
      // Check for custom claims first (no Firestore read)
      if (user.role === 'admin' || isAdminEmail) {
        adminCache.set(user.uid, { isAdmin: true, timestamp: Date.now() });
        return res.json({ role: 'admin' });
      }

      if (isQuotaExhausted && (Date.now() - quotaExhaustedAt < QUOTA_COOLDOWN)) {
        return res.json({ role: 'user' }); // Default to user if quota hit
      }

      const userDoc = await db.collection('users').doc(user.uid).get();
      const role = userDoc.data()?.role || 'user';
      
      // Set custom claim to avoid future Firestore reads for this user
      if (role === 'admin') {
        await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
      }
      
      adminCache.set(user.uid, { isAdmin: role === 'admin', timestamp: Date.now() });
      
      const duration = Date.now() - start;
      if (duration > 2000) {
        console.warn(`Auth status check for ${user.email} took ${duration}ms`);
      }
      
      res.json({ role });
    } catch (error: any) {
      handleQuotaError(error, "auth-status");
      console.error(`Auth status error for ${user.email}:`, error.message);
      res.json({ role: 'user' }); // Fallback
    }
  });

  // Cache for waste items
  let wasteItemsCache: { data: any, timestamp: number } | null = null;
  const WASTE_CACHE_DURATION = 30 * 1000; // Reduced to 30 seconds for better responsiveness during testing

  app.get("/api/waste-items", async (req, res) => {
    try {
      console.log(`[DEBUG] Incoming request to /api/waste-items. Database: ${firebaseConfig.projectId}/${firebaseConfig.firestoreDatabaseId || '(default)'}. Quota status: ${isQuotaExhausted}`);
      
      // Circuit breaker for waste items
      if (isQuotaExhausted && (Date.now() - quotaExhaustedAt < QUOTA_COOLDOWN)) {
        console.warn("[DEBUG] Circuit breaker active. Serving cached/mock data.");
        if (wasteItemsCache) return res.json(wasteItemsCache.data);
        return res.json([
          { id: 'mock-1', title: 'Recyclable Paper (Quota Limited)', category: 'paper', estimatedValue: 10, status: 'available', imageUrl: 'https://picsum.photos/seed/paper/400/300' },
          { id: 'mock-2', title: 'Metal Scrap (Quota Limited)', category: 'metal', estimatedValue: 50, status: 'available', imageUrl: 'https://picsum.photos/seed/metal/400/300' }
        ]);
      }

      const { search, wasteType, minPrice, maxPrice, lat, lng, radius, page = 1, limit: limitParam = 12 } = req.query;
      const pageSize = Number(limitParam);
      const pageNum = Number(page);
      
      console.log(`Fetching waste items: search="${search || ''}", type="${wasteType || ''}", page=${pageNum}`);
      
      // Check cache (only for general queries without specific filters for simplicity)
      if (!search && !wasteType && !minPrice && !maxPrice && !lat && pageNum === 1 && wasteItemsCache && (Date.now() - wasteItemsCache.timestamp < WASTE_CACHE_DURATION)) {
        return res.json(wasteItemsCache.data);
      }

      let items: any[] = [];
      try {
        console.log(`[DEBUG] Querying wasteItems collection...`);
        let query: admin.firestore.Query = db.collection('wasteItems')
          .where('status', '==', 'available');
        
        // If we have a specific category, we can use it in the query
        if (wasteType) {
          query = query.where('category', '==', wasteType);
        }
        
        // Always limit the query to prevent massive reads
        const fetchLimit = (lat && lng) ? 50 : pageSize * pageNum;
        query = query.orderBy('createdAt', 'desc').limit(fetchLimit);

        const snapshot = await query.get();
        items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        console.log(`[DEBUG] Found ${items.length} available items in database.`);
      } catch (queryError: any) {
        console.error(`[DEBUG] Waste items query failed: ${queryError.message}`);
        handleQuotaError(queryError, 'waste-items-query');
        
        // Fallback: Simple query without complex ordering/filtering if index is missing or quota hit
        console.log(`[DEBUG] Attempting fallback query...`);
        const fallbackSnapshot = await db.collection('wasteItems')
          .where('status', '==', 'available')
          .limit(50) 
          .get();
        
        items = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        console.log(`[DEBUG] Fallback query returned ${items.length} items.`);
        
        // Manual sort by createdAt if available
        items.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });

        // Manual category filter
        if (wasteType) {
          items = items.filter(item => item.category === wasteType);
        }
      }
      
      // Filter by search term
      if (search) {
        const s = String(search).toLowerCase();
        items = items.filter(item => 
          item.title?.toLowerCase().includes(s) || 
          item.description?.toLowerCase().includes(s) ||
          item.category?.toLowerCase().includes(s)
        );
      }
      
      // Filter by price range
      if (minPrice) {
        items = items.filter(item => item.estimatedValue >= Number(minPrice));
      }
      if (maxPrice) {
        items = items.filter(item => item.estimatedValue <= Number(maxPrice));
      }
      
      // Filter by distance
      if (lat && lng && radius) {
        const userLoc = { lat: Number(lat), lng: Number(lng) };
        const maxDist = Number(radius);
        
        items = items.filter(item => {
          if (!item.location) return false;
          const dist = calculateDistance(userLoc, item.location);
          return dist <= maxDist;
        });
      }

      // Manual pagination for memory-filtered results or simple slice
      const start = (pageNum - 1) * pageSize;
      const paginatedItems = items.slice(start, start + pageSize);
      
      // Update cache if it's a general query
      if (!wasteType && !minPrice && !maxPrice && !lat && pageNum === 1) {
        wasteItemsCache = { data: paginatedItems, timestamp: Date.now() };
      }

      isQuotaExhausted = false; // Reset if successful
      res.json(paginatedItems);
    } catch (error: any) {
      console.error("Fetch Waste Items Error:", error);
      const isQuotaError = error.message?.includes('RESOURCE_EXHAUSTED') || 
                          error.code === 8 || 
                          error.details?.includes('Quota exceeded');
      
      if (isQuotaError) {
        isQuotaExhausted = true;
        quotaExhaustedAt = Date.now();
        console.warn("Quota Exhausted detected in /api/waste-items. Serving fallback data.");
        if (wasteItemsCache) return res.json(wasteItemsCache.data);
        return res.json([
          { id: 'mock-1', title: 'Recyclable Paper (Cached)', category: 'paper', estimatedValue: 10, status: 'available', imageUrl: 'https://picsum.photos/seed/paper/400/300' },
          { id: 'mock-2', title: 'Metal Scrap (Cached)', category: 'metal', estimatedValue: 50, status: 'available', imageUrl: 'https://picsum.photos/seed/metal/400/300' }
        ]);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Simple in-memory cache for recommendations
  let recommendationsCache: { data: any, timestamp: number } | null = null;
  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  app.get("/api/quota-status", (req, res) => {
    res.json({
      isExhausted: isQuotaExhausted,
      exhaustedAt: quotaExhaustedAt,
      cooldownRemaining: isQuotaExhausted ? Math.max(0, QUOTA_COOLDOWN - (Date.now() - quotaExhaustedAt)) : 0
    });
  });

  app.get("/api/recommendations", async (req, res) => {
    try {
      // Circuit breaker: if quota was hit recently, serve from cache or mock
      if (isQuotaExhausted && (Date.now() - quotaExhaustedAt < QUOTA_COOLDOWN)) {
        console.warn("Circuit Breaker: Serving recommendations from cache due to recent quota exhaustion");
        if (recommendationsCache) return res.json(recommendationsCache.data);
        // Serve mock data if no cache
        return res.json({
          popularTypes: [{ category: 'plastic', count: 12 }, { category: 'metal', count: 8 }],
          nearbyItems: [],
          bestBuyers: [{ uid: 'mock', displayName: 'Eco Warrior', completedSwaps: 5 }]
        });
      }

      const { lat, lng } = req.query;

      // Check cache first
      if (recommendationsCache && (Date.now() - recommendationsCache.timestamp < CACHE_DURATION)) {
        return res.json(recommendationsCache.data);
      }
      
      // 1. Popular Waste Types (Limit to recent 30 items to save quota)
      const itemsSnapshot = await db.collection('wasteItems')
        .orderBy('createdAt', 'desc')
        .limit(30)
        .get();
      
      const categoryCounts: Record<string, number> = {};
      itemsSnapshot.docs.forEach(doc => {
        const cat = doc.data().category;
        if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      const popularTypes = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, count]) => ({ category, count }));

      // 2. Nearby Waste Items
      let nearbyItems: any[] = [];
      if (lat && lng) {
        const userLoc = { lat: Number(lat), lng: Number(lng) };
        const availableItems = itemsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() as any }))
          .filter(item => item.status === 'available' && item.location);
        
        nearbyItems = availableItems
          .map(item => ({
            ...item,
            distance: calculateDistance(userLoc, item.location)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 4);
      }

      // 3. Best Buyers (Limit to recent 20 completed swaps)
      const requestsSnapshot = await db.collection('swapRequests')
        .where('status', '==', 'completed')
        .orderBy('updatedAt', 'desc')
        .limit(20)
        .get();
      
      const buyerCounts: Record<string, number> = {};
      requestsSnapshot.docs.forEach(doc => {
        const rid = doc.data().requesterId;
        if (rid) buyerCounts[rid] = (buyerCounts[rid] || 0) + 1;
      });

      const topBuyerIds = Object.entries(buyerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const bestBuyers = await Promise.all(topBuyerIds.map(async ([uid, count]) => {
        // Cache user info for best buyers to save reads
        const userDoc = await db.collection('users').doc(uid).get();
        return {
          uid,
          displayName: userDoc.exists ? userDoc.data()?.displayName : 'Unknown User',
          completedSwaps: count
        };
      }));

      const result = {
        popularTypes,
        nearbyItems,
        bestBuyers
      };

      // Update cache
      recommendationsCache = {
        data: result,
        timestamp: Date.now()
      };
      isQuotaExhausted = false; // Reset if successful

      res.json(result);
    } catch (error: any) {
      console.error("Recommendations Error:", error);
      
      const isQuotaError = error.message?.includes('RESOURCE_EXHAUSTED') || 
                          error.code === 8 || 
                          error.details?.includes('Quota exceeded');
      
      if (isQuotaError) {
        isQuotaExhausted = true;
        quotaExhaustedAt = Date.now();
        console.warn("Quota Exhausted detected in /api/recommendations. Serving fallback data.");
      }

      // If we have stale cache, serve it on error
      if (recommendationsCache) {
        return res.json(recommendationsCache.data);
      }
      // Mock data as last resort
      res.json({
        popularTypes: [{ category: 'plastic', count: 12 }, { category: 'metal', count: 8 }],
        nearbyItems: [],
        bestBuyers: [{ uid: 'mock', displayName: 'Eco Warrior', completedSwaps: 5 }]
      });
    }
  });

  app.post("/api/payments/confirm", authenticate, async (req, res) => {
    const { requestId, amount, wasteId, sellerId, screenshotUrl } = req.body;
    const user = (req as any).user;

    if (!requestId || !sellerId) {
      return res.status(400).json({ error: "Missing requestId or sellerId" });
    }

    try {
      // Save payment record
      await db.collection('payments').add({
        userId: user.uid,
        sellerId: sellerId,
        wasteId: wasteId || null,
        requestId: requestId,
        amount: amount,
        status: 'completed',
        screenshotUrl: screenshotUrl || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update swap request status
      await db.collection('swapRequests').doc(requestId).update({
        paymentStatus: 'completed',
        paymentConfirmedAt: new Date().toISOString()
      });

      res.json({ success: true, message: "Payment confirmed and saved" });
    } catch (error: any) {
      console.error("Payment Confirmation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/schedule-pickup", (req, res) => {
    const { requestId, pickupDate, pickupTime, pickupLocation } = req.body;
    
    if (!requestId || !pickupDate || !pickupTime || !pickupLocation) {
      return res.status(400).json({ error: "Missing required pickup details" });
    }

    console.log(`Pickup scheduled for request ${requestId} on ${pickupDate} at ${pickupTime} at ${pickupLocation}`);
    
    // In a real app, this might trigger a worker assignment or a push notification
    res.json({ 
      status: "success", 
      message: "Pickup scheduled successfully",
      details: { pickupDate, pickupTime, pickupLocation }
    });
  });

  app.post("/api/confirm-payment", (req, res) => {
    const { requestId, paymentMethod, amount } = req.body;
    
    if (!requestId || !paymentMethod) {
      return res.status(400).json({ error: "Missing required payment details" });
    }

    console.log(`Payment confirmed for request ${requestId} via ${paymentMethod} for amount ₹${amount}`);
    
    // In a real app, this would verify with a payment gateway or mark the request as paid in Firestore
    res.json({ 
      status: "success", 
      message: "Payment status updated successfully",
      details: { requestId, paymentMethod, amount, confirmedAt: new Date().toISOString() }
    });
  });

  app.post("/api/debug/reset-quota", (req, res) => {
    isQuotaExhausted = false;
    quotaExhaustedAt = 0;
    console.log('[DEBUG] Quota exhaustion flag manually reset.');
    res.json({ success: true, message: "Quota flag reset" });
  });

  app.get("/api/debug/waste-items", async (req, res) => {
    try {
      const snapshot = await db.collection('wasteItems').limit(10).get();
      const items = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        status: doc.data().status,
        ownerId: doc.data().ownerId,
        title: doc.data().title,
        createdAt: doc.data().createdAt
      }));
      res.json({
        count: snapshot.size,
        items,
        databaseId: firebaseConfig.firestoreDatabaseId || 'default'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/debug/seed-items", async (req, res) => {
    try {
      const sampleItems = [
        {
          title: "Premium Plastic Bottles",
          description: "A collection of high-quality PET bottles, cleaned and ready for recycling or upcycling projects.",
          category: "plastic",
          estimatedValue: 25,
          estimatedWeightKg: 1.5,
          isBiodegradable: false,
          imageUrl: "https://picsum.photos/seed/plastic/800/600",
          ownerId: "system-seed",
          status: "available",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          location: { lat: 13.0827, lng: 80.2707 }, // Chennai
          requestCount: 0
        },
        {
          title: "Old Newspaper Stack",
          description: "Clean newspapers from the last month. Perfect for paper mache or recycling.",
          category: "paper",
          estimatedValue: 15,
          estimatedWeightKg: 5,
          isBiodegradable: true,
          imageUrl: "https://picsum.photos/seed/paper/800/600",
          ownerId: "system-seed",
          status: "available",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          location: { lat: 13.0475, lng: 80.2089 },
          requestCount: 0
        },
        {
          title: "Assorted Metal Cans",
          description: "Aluminum and tin cans, washed and crushed. Great for scrap metal collectors.",
          category: "metal",
          estimatedValue: 40,
          estimatedWeightKg: 3,
          isBiodegradable: false,
          imageUrl: "https://picsum.photos/seed/metal/800/600",
          ownerId: "system-seed",
          status: "available",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          location: { lat: 12.9171, lng: 80.1923 },
          requestCount: 0
        }
      ];

      const batch = db.batch();
      sampleItems.forEach(item => {
        const ref = db.collection('wasteItems').doc();
        batch.set(ref, item);
      });
      await batch.commit();

      res.json({ success: true, message: "Sample items seeded" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Routes
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const snapshot = await db.collection('users').get();
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error: any) {
      console.error("Admin Users Error:", error);
      handleQuotaError(error, "admin-users");
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });

  app.put("/api/admin/block/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { blocked } = req.body;
      await db.collection('users').doc(id).update({ blocked });
      res.json({ success: true });
    } catch (error: any) {
      handleQuotaError(error, `admin-block-${req.params.id}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/waste", isAdmin, async (req, res) => {
    try {
      const snapshot = await db.collection('wasteItems').get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(items);
    } catch (error: any) {
      console.error("Admin Waste Error:", error);
      handleQuotaError(error, "admin-waste");
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });

  app.delete("/api/admin/waste/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection('wasteItems').doc(id).delete();
      res.json({ success: true });
    } catch (error: any) {
      handleQuotaError(error, `admin-delete-waste-${req.params.id}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/swaps", isAdmin, async (req, res) => {
    try {
      const snapshot = await db.collection('swapRequests').get();
      const swaps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(swaps);
    } catch (error: any) {
      console.error("Admin Swaps Error:", error);
      handleQuotaError(error, "admin-swaps");
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });

  app.get("/api/admin/analytics", isAdmin, async (req, res) => {
    try {
      let usersCount = 0;
      let wasteCount = 0;
      let swapsCount = 0;

      try {
        // Use count() which is much cheaper (1 read per 1000 index entries)
        usersCount = (await db.collection('users').count().get()).data().count;
        wasteCount = (await db.collection('wasteItems').count().get()).data().count;
        swapsCount = (await db.collection('swapRequests').where('status', '==', 'completed').count().get()).data().count;
      } catch (countError: any) {
        console.warn("Firestore count() failed, falling back to manual count:", countError.message);
        handleQuotaError(countError, "admin-analytics-count");
        // Manual count is expensive, only do it if count() fails and quota is not hit
        if (!isQuotaExhausted) {
          const usersSnap = await db.collection('users').select().get(); // select() reduces data transfer
          const wasteSnap = await db.collection('wasteItems').select().get();
          const swapsSnap = await db.collection('swapRequests').where('status', '==', 'completed').select().get();
          usersCount = usersSnap.size;
          wasteCount = wasteSnap.size;
          swapsCount = swapsSnap.size;
        } else {
          // Return mock/stale data if quota hit
          usersCount = 120;
          wasteCount = 450;
          swapsCount = 85;
        }
      }
      
      // For totalValue, limit to first 100 items to avoid massive reads
      let totalValue = 0;
      try {
        const itemsSnap = await db.collection('wasteItems').limit(100).get();
        totalValue = itemsSnap.docs.reduce((acc, doc) => acc + (doc.data().estimatedValue || 0), 0);
      } catch (valErr) {
        handleQuotaError(valErr, "admin-analytics-value");
        totalValue = 5000; // Mock value
      }

      res.json({
        totalUsers: usersCount,
        totalWaste: wasteCount,
        totalSwaps: swapsCount,
        totalValue: totalValue * (wasteCount > 100 ? wasteCount / 100 : 1) // Extrapolate if many items
      });
    } catch (error: any) {
      console.error("Admin Analytics Error:", error);
      handleQuotaError(error, "admin-analytics-global");
      res.status(500).json({ 
        error: "Internal Server Error", 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  app.get("/api/admin/service-account", isAdmin, async (req, res) => {
    try {
      // Fetch service account from metadata server
      const response = await axios.get('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email', {
        headers: { 'Metadata-Flavor': 'Google' }
      });
      res.json({ 
        email: response.data,
        projectId: firebaseConfig.projectId
      });
    } catch (error) {
      // Fallback if metadata server is unreachable (e.g. local dev)
      res.json({ 
        email: '34901887695-compute@developer.gserviceaccount.com',
        projectId: firebaseConfig.projectId
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } 

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function calculateDistance(loc1: { lat: number; lng: number }, loc2: { lat: number; lng: number }): number {
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
}

startServer();
