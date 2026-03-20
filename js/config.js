/* ═══════════════════════════════════════════════════════════════
   FRAMES — Configuration
   Fill in the values below before going live.
   ═══════════════════════════════════════════════════════════════ */

// ── 1. FIREBASE (Removed for security) ─────────────────────────────────────────
// Keys are now stored in backend .env

// ── 2. BRAND ──────────────────────────────────────────────────────────────────
const CONFIG = {
  brandName:   'rtro.GIO',
  currency:    '£',
  // Single product max capacity
  maxStock:    24,
};

// ── 3. EMAILJS (Removed for security) ─────────────────────────────────────────
// Keys are now stored in backend .env

// ── 4. DEFAULT PRODUCT ────────────────────────────────────────────────────────
// Seeded via logic if empty.
const DEFAULT_PRODUCT = {
  id:    'product_01',
  name:  'RTRO.01',
  price: 25,
  stock: 24
};

// ── 5. ORDER STATUSES ─────────────────────────────────────────────────────────
const ORDER_STATUSES = [
  { key: 'placed',     title: 'Order Received',  desc: 'Your order has been confirmed.' },
  { key: 'processing', title: 'Processing',       desc: 'Your frames are being prepared.' },
  { key: 'ready',      title: 'Ready for Pickup', desc: 'Your frames are ready! We will contact you shortly.' },
  { key: 'ontheway',   title: 'On the Way',       desc: 'Your order is out for delivery.' },
  { key: 'delivered',  title: 'Delivered',        desc: 'Your order has been delivered. Enjoy!' },
];

// Notification messages shown in the in-app banner
const NOTIF_MESSAGES = {
  processing: '⚙️ Your order is being processed — frames are being prepared!',
  ready:      '✨ Your frames are ready! We will contact you to arrange delivery.',
  ontheway:   '🚚 Your order is on the way! Expect delivery soon.',
  delivered:  '✅ Your order has been delivered. Enjoy your frames!',
};
