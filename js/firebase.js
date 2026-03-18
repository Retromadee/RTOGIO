/* ═══════════════════════════════════════════════════════════════
   FRAMES — API helpers (Replaces Firebase Client SDK)
   ═══════════════════════════════════════════════════════════════ */

// ── CONFIGURATION LOAD ────────────────────────────────────────────────────────

// We need to fetch public config (IBAN, WhatsApp) dynamically
async function fetchConfig() {
  const res = await fetch('/api/config');
  if (res.ok) {
    const data = await res.json();
    Object.assign(CONFIG, data);
    if (typeof setPaymentInfo === 'function') setPaymentInfo();
  }
}
// Load config on startup
fetchConfig();

// ── INVENTORY ─────────────────────────────────────────────────────────────────

async function seedInventoryIfEmpty() {
  const items = await fetch('/api/inventory').then(r => r.json());
  if (items.length === 0) {
    await fetch('/api/inventory', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify(DEFAULT_PRODUCT) 
    });
    console.log('[FRAMES] Inventory seeded with default product.');
  }
}

let _invTimer = null;
function listenToInventory(callback) {
  if (_invTimer) clearInterval(_invTimer);
  const poll = async () => {
    try {
      const res = await fetch('/api/inventory', { cache: 'no-store' });
      if (res.ok) callback(await res.json());
    } catch(e) {}
  };
  poll();
  // Poll every 5s instead of websocket
  _invTimer = setInterval(poll, 5000);
}

async function updateProductStock(productId, newStock) {
  const clamped = Math.max(0, Math.min(CONFIG.maxStock, Math.floor(newStock)));
  await updateProduct(productId, { stock: clamped });
  return clamped;
}

async function decrementStock(productId, qty) {
  // Handled by the backend checkout securely. This is a no-op here now.
  return Promise.resolve();
}

async function updateProduct(productId, fields) {
  if (fields.stock !== undefined) {
    fields.stock = Math.max(0, Math.min(CONFIG.maxStock, Math.floor(fields.stock)));
  }
  const res = await fetch('/api/inventory', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: productId, updates: fields })
  });
  if (!res.ok) throw new Error('Update failed');
}

// ── ORDERS ────────────────────────────────────────────────────────────────────

async function saveOrder(order) {
  // This sends the order to the backend, which saves it AND triggers the email.
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  });
  if (!res.ok) throw new Error('Failed to save order');
}

let _orderTimer = null;
function listenToOrder(orderId, callback) {
  // In the real app, we need an endpoint to fetch a single order. 
  // Let's create a polling mechanism for demo purposes.
  // Wait, /api/orders GET is admin-only. We don't expose single orders publicly for security.
  // The local tracking screen just simulates it or uses a specific endpoint if we make one.
  // Let's assume it gets its local status.
  return {}; 
}

function detachOrderListener() {
  clearInterval(_orderTimer);
}

async function updateOrderStatus(orderId, statusIdx, statusKey) {
  const res = await fetch('/api/orders', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: orderId, updates: { statusIdx, statusKey } })
  });
  if (!res.ok) throw new Error('Failed to update status');
}

let _adminOrderTimer = null;
function listenToAllOrders(callback) {
  if (_adminOrderTimer) clearInterval(_adminOrderTimer);
  const poll = async () => {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (res.ok) {
        const orders = await res.json();
        orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        callback(orders);
      } else if (res.status === 401) {
         // Token expired
         detachAllOrdersListener();
         if(typeof logout === 'function') logout();
      }
    } catch(e) {}
  };
  poll();
  _adminOrderTimer = setInterval(poll, 5000);
}

function detachAllOrdersListener() {
  clearInterval(_adminOrderTimer);
}
