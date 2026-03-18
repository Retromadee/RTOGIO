/* ═══════════════════════════════════════════════════════════════
   FRAMES — 4-Step Order Flow
   ═══════════════════════════════════════════════════════════════ */

let orderState = {
  selectedProduct: null,
  qty:             1,
  currentStep:     1,
  paymentMethod:   'cash',
  order:           null,
};

// ── OVERLAY OPEN / CLOSE ──────────────────────────────────────────────────────

function openOrder(productId) {
  document.getElementById('orderOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  goStep(1);
  if (productId) {
    // Wait for inventory to load if needed
    const trySelect = () => {
      const p = getProduct(productId);
      if (p) selectProduct(productId);
      else setTimeout(trySelect, 100);
    };
    trySelect();
  }
}

function closeOrder() {
  document.getElementById('orderOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── STEP NAVIGATION ───────────────────────────────────────────────────────────

function goStep(n) {
  [1, 2, 3, 4].forEach(i => {
    document.getElementById('step' + i).classList.toggle('hidden', i !== n);
    const sb = document.getElementById('sb' + i);
    sb.classList.remove('active', 'done');
    if (i === n)      sb.classList.add('active');
    else if (i < n)   sb.classList.add('done');
  });
  orderState.currentStep = n;
  document.getElementById('orderOverlay').scrollTo(0, 0);
  if (n === 3) fillStep3Review();
}

// ── STEP 1: PRODUCT SELECTION ─────────────────────────────────────────────────

function selectProduct(id) {
  const p = getProduct(id);
  if (!p || p.stock === 0) return;

  orderState.selectedProduct = p;
  orderState.qty = 1;
  document.getElementById('qtyNum').textContent = 1;

  document.querySelectorAll('.prod-opt').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById('po_' + id);
  if (el) el.classList.add('selected');

  updateStep1Summary();
  document.getElementById('step1Next').disabled = false;
}

function changeQty(d) {
  if (!orderState.selectedProduct) return;
  const max = orderState.selectedProduct.stock;
  orderState.qty = Math.max(1, Math.min(max, orderState.qty + d));
  document.getElementById('qtyNum').textContent = orderState.qty;
  updateStep1Summary();
}

function updateStep1Summary() {
  const p = orderState.selectedProduct;
  if (!p) return;
  const box = document.getElementById('step1Summary');
  box.style.display = 'block';
  document.getElementById('s1Model').textContent = p.name;
  document.getElementById('s1Qty').textContent   = orderState.qty;
  document.getElementById('s1Total').textContent = CONFIG.currency + (p.price * orderState.qty).toLocaleString();
}

// ── STEP 2: CUSTOMER DETAILS ──────────────────────────────────────────────────

function validateForm() {
  const name  = document.getElementById('fName').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  const loc   = document.getElementById('fLocation').value.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  document.getElementById('step2Next').disabled = !(name && phone && emailOk && loc);
  document.getElementById('errEmail').classList.toggle('hidden', emailOk || !email);
}

// ── STEP 3: PAYMENT ───────────────────────────────────────────────────────────

function fillStep3Review() {
  const p = orderState.selectedProduct;
  if (!p) return;
  document.getElementById('s3Model').textContent = p.name + ' × ' + orderState.qty;
  document.getElementById('s3Name').textContent  = document.getElementById('fName').value.trim();
  document.getElementById('s3Loc').textContent   = document.getElementById('fLocation').value.trim();
  document.getElementById('s3Total').textContent = CONFIG.currency + (p.price * orderState.qty).toLocaleString();
}

function setPayment(method) {
  orderState.paymentMethod = method;
  ['cash', 'bank', 'crypto'].forEach(m => {
    const cap = m.charAt(0).toUpperCase() + m.slice(1);
    document.getElementById('tab' + cap).classList.toggle('active', m === method);
    document.getElementById('box' + cap).classList.toggle('show', m === method);
  });
}

// ── STEP 4: PLACE ORDER ───────────────────────────────────────────────────────

async function placeOrder() {
  const p = orderState.selectedProduct;
  if (!p) return;

  const btn = document.querySelector('#step3 .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Saving order…';

  const now = new Date();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars O, I, 1, 0
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));

  const orderId =
    'FR-' +
    now.getFullYear().toString().slice(-2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    '-' + suffix;

  const payLabels = { cash: 'Cash on Delivery', bank: 'Bank Transfer', crypto: 'USDT (Polygon)' };

  const order = {
    id:           orderId,
    date:         now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    createdAt:    now.toISOString(),
    name:         document.getElementById('fName').value.trim(),
    phone:        document.getElementById('fPhone').value.trim(),
    email:        document.getElementById('fEmail').value.trim(),
    location:     document.getElementById('fLocation').value.trim(),
    productId:    p.id,
    productName:  p.name,
    qty:          orderState.qty,
    unitPrice:    p.price,
    total:        p.price * orderState.qty,
    payment:      payLabels[orderState.paymentMethod],
    statusKey:    'placed',
    statusIdx:    0,
    timestamps:   { placed: now.toISOString() },
  };

  try {
    // 1. Save order to Backend (Stock update & Email sending are handled there)
    await saveOrder(order);

    // 3. Store order ID locally (for auto-load on track page)
    localStorage.setItem('frames_last_order_id', orderId);

    // 4. Send confirmation email
    sendOrderConfirmationEmail(order);

    // 5. Build invoice  
    orderState.order = order;
    populateInvoice(order);
    goStep(4);

  } catch (err) {
    console.error('[FRAMES] Order save failed:', err);
    btn.textContent = 'Error — Try Again';
    btn.disabled = false;
    showNotif('⚠️ Could not save order. Check your connection and try again.');
  }
}

// ── INVOICE ───────────────────────────────────────────────────────────────────

function populateInvoice(o) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('invNo',        o.id);
  set('invDate',      o.date);
  set('invStatus',    'Pending Payment');
  set('invName',      o.name);
  set('invPhone',     o.phone);
  set('invEmail',     o.email);
  set('invLoc',       o.location);
  set('invModel',     o.productName);
  set('invQty',       o.qty);
  set('invUnitPrice', CONFIG.currency + o.unitPrice.toLocaleString());
  set('invPayMethod', o.payment);
  set('invSubtotal',  CONFIG.currency + o.total.toLocaleString());
  set('invTotal',     CONFIG.currency + o.total.toLocaleString());
  set('invStampText', o.payment === 'Cash on Delivery' ? 'COD' : 'Awaiting Payment');

  const proofSec = document.getElementById('proofSection');
  if (proofSec) {
    proofSec.style.display = o.payment !== 'Cash on Delivery' ? 'block' : 'none';
  }

  // WhatsApp contact link in invoice footer
  const waEl = document.getElementById('invWaLink');
  if (waEl && CONFIG.adminWhatsapp !== '90XXXXXXXXXX') {
    const msg = buildOrderPlacedWhatsApp(o);
    waEl.href = generateWhatsAppLink(CONFIG.adminWhatsapp, msg);
    waEl.style.display = 'inline-flex';
  }
}

function handleProofUpload(event) {
  const file = event.target.files[0];
  if (!file || !orderState.order) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Str = e.target.result;
    try {
      await fetch('/api/upload-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderState.order.id,
          base64Str: base64Str,
          order: orderState.order
        })
      });
      document.getElementById('btnProofUpload').style.display = 'none';
      document.getElementById('proofStatus').style.display = 'block';

      if (typeof sendAdminProofEmail === 'function') {
        sendAdminProofEmail(orderState.order);
      }

      const waMsg = `Hello! I have just uploaded my proof of payment for Order ID: ${orderState.order.id} (${CONFIG.currency}${orderState.order.total}). Please verify!`;
      const waLink = generateWhatsAppLink(CONFIG.adminWhatsapp, waMsg);
      // Slight delay to ensure the UI updates before the popup blocker might intercept
      setTimeout(() => { window.open(waLink, '_blank'); }, 300);

    } catch (err) {
      console.error('Failed to upload proof:', err);
      alert('Failed to attach proof. Please try again.');
    }
  };
  reader.readAsDataURL(file);
}

// ── PAYMENT INFO INIT ─────────────────────────────────────────────────────────

function setPaymentInfo() {
  const el = (id) => document.getElementById(id);
  if (el('ibanName'))   el('ibanName').textContent   = CONFIG.ibanHolder;
  if (el('ibanNum'))    el('ibanNum').textContent     = CONFIG.iban;
  if (el('cryptoAddr')) el('cryptoAddr').textContent = CONFIG.usdtAddress;
}

// ── COPY TO CLIPBOARD ─────────────────────────────────────────────────────────

function copyText(elId, defaultLabel, successLabel) {
  const val = document.getElementById(elId).textContent.trim();
  navigator.clipboard.writeText(val).then(() => {
    const btn = event.target;
    btn.textContent = successLabel;
    setTimeout(() => btn.textContent = defaultLabel, 2000);
  });
}

// ── NOTIFICATION BANNER ───────────────────────────────────────────────────────

let _notifTimer;
function showNotif(msg) {
  document.getElementById('notifText').textContent = msg;
  document.getElementById('notifBar').classList.add('show');
  clearTimeout(_notifTimer);
  _notifTimer = setTimeout(hideNotif, 6000);
}
function hideNotif() {
  document.getElementById('notifBar').classList.remove('show');
}
