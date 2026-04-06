import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from 'stripe';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}
const db = getFirestore(firebaseConfig.firestoreDatabaseId);

const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    const isAdminEmail = decodedToken.email === 'jstanshika1402@gmail.com';

    if (isAdminEmail || userData?.role === 'admin') {
      (req as any).user = decodedToken;
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
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
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:userId/block", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { blocked } = req.body;
      await db.collection('users').doc(userId).update({ blocked });
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
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/waste/:itemId", isAdmin, async (req, res) => {
    try {
      const { itemId } = req.params;
      await db.collection('wasteItems').doc(itemId).delete();
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
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
