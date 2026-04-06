import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import Stripe from 'stripe';
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

const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Admin Auth Error: Missing or malformed Authorization header');
    return res.status(401).json({ error: 'Unauthorized', details: 'Missing or malformed Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken || idToken === 'undefined' || idToken === 'null') {
    console.error('Admin Auth Error: ID token is empty or undefined');
    return res.status(401).json({ error: 'Unauthorized', details: 'ID token is empty or undefined' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const isAdminEmail = decodedToken.email === 'jstanshika1402@gmail.com';

    // If it's the hardcoded admin email, let them through immediately
    if (isAdminEmail) {
      (req as any).user = decodedToken;
      return next();
    }

    // Otherwise, check their role in Firestore
    try {
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();
      if (userData?.role === 'admin') {
        (req as any).user = decodedToken;
        return next();
      }
    } catch (dbError: any) {
      console.error('Admin Auth DB Error (Firestore check failed):', dbError.message);
    }

    console.warn(`Admin Auth Warning: User ${decodedToken.email} attempted to access admin routes without permission`);
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  } catch (error: any) {
    console.error('Admin Auth Error (verifyIdToken):', error.message);
    res.status(401).json({ error: 'Invalid token', details: error.message });
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Waste Swap Network API is running" });
  });

  app.get("/api/waste-items", async (req, res) => {
    try {
      const { wasteType, minPrice, maxPrice, lat, lng, radius } = req.query;
      
      let query: admin.firestore.Query = db.collection('wasteItems').where('status', '==', 'available');
      
      if (wasteType) {
        query = query.where('category', '==', wasteType);
      }
      
      const snapshot = await query.get();
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
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
      
      res.json(items);
    } catch (error: any) {
      console.error("Fetch Waste Items Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/recommendations", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      
      // 1. Popular Waste Types
      const itemsSnapshot = await db.collection('wasteItems').get();
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

      // 3. Best Buyers (Most completed swap requests as requester)
      const requestsSnapshot = await db.collection('swapRequests')
        .where('status', '==', 'completed')
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
        const userDoc = await db.collection('users').doc(uid).get();
        return {
          uid,
          displayName: userDoc.exists ? userDoc.data()?.displayName : 'Unknown User',
          completedSwaps: count
        };
      }));

      res.json({
        popularTypes,
        nearbyItems,
        bestBuyers
      });
    } catch (error: any) {
      console.error("Recommendations Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { amount, requestId, itemName } = req.body;
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      
      // Verification Mode: If key is 'DUMMY', simulate a successful session
      if (stripeSecretKey === 'DUMMY') {
        console.log("Verification Mode: Simulating Stripe Checkout for", itemName);
        return res.json({ 
          url: `${process.env.APP_URL}/dashboard?payment=success&requestId=${requestId}&mode=verification` 
        });
      }

      if (!stripeSecretKey) {
        return res.status(500).json({ error: "STRIPE_SECRET_KEY is not configured. Use 'DUMMY' to verify the app flow." });
      }
      const stripe = new Stripe(stripeSecretKey);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'upi'] as any[],
        line_items: [
          {
            price_data: {
              currency: 'inr',
              product_data: {
                name: `Swap Payment: ${itemName}`,
              },
              unit_amount: amount * 100, // Stripe expects amount in paise
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.APP_URL}/dashboard?payment=success&requestId=${requestId}`,
        cancel_url: `${process.env.APP_URL}/dashboard?payment=cancel`,
        metadata: {
          requestId,
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
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

  // Admin Routes
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const snapshot = await db.collection('users').get();
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error: any) {
      console.error("Admin Users Error:", error.message);
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
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/waste", isAdmin, async (req, res) => {
    try {
      const snapshot = await db.collection('wasteItems').get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(items);
    } catch (error: any) {
      console.error("Admin Waste Error:", error.message);
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });

  app.delete("/api/admin/waste/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection('wasteItems').doc(id).delete();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/swaps", isAdmin, async (req, res) => {
    try {
      const snapshot = await db.collection('swapRequests').get();
      const swaps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(swaps);
    } catch (error: any) {
      console.error("Admin Swaps Error:", error.message);
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });

  app.get("/api/admin/analytics", isAdmin, async (req, res) => {
    try {
      const usersCount = (await db.collection('users').count().get()).data().count;
      const wasteCount = (await db.collection('wasteItems').count().get()).data().count;
      const swapsCount = (await db.collection('swapRequests').where('status', '==', 'completed').count().get()).data().count;
      
      const itemsSnap = await db.collection('wasteItems').get();
      const totalValue = itemsSnap.docs.reduce((acc, doc) => acc + (doc.data().estimatedValue || 0), 0);

      res.json({
        totalUsers: usersCount,
        totalWaste: wasteCount,
        totalSwaps: swapsCount,
        totalValue
      });
    } catch (error: any) {
      console.error("Admin Analytics Error:", error.message);
      res.status(500).json({ error: "Internal Server Error", details: error.message });
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
