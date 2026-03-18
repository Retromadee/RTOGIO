import { getDbInstance, ref, get, set, update } from './utils/db.js';
import { verifyAuth } from './utils/auth.js';

export default async function handler(req, res) {
  const db = getDbInstance();

  if (req.method === 'GET') {
    // Anyone can read inventory
    try {
      const snap = await get(ref(db, 'inventory'));
      if (snap.exists()) {
        const data = snap.val();
        return res.status(200).json(Object.values(data));
      }
      return res.status(200).json([]);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }
  }

  // Must be admin to modify inventory!
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  if (req.method === 'POST') {
    // Seed or add new product
    try {
      const product = body;
      await set(ref(db, `inventory/${product.id}`), product);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  if (req.method === 'PUT') {
    // Update product fields
    try {
      const { id, updates } = body;
      await update(ref(db, `inventory/${id}`), updates);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      await set(ref(db, `inventory/${id}`), null);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  return res.status(405).send('Method Not Allowed');
}
