/* ═══════════════════════════════════════════════════════════════
   FRAMES — Admin Panel Logic
   ═══════════════════════════════════════════════════════════════ */

let _adminOrders  = [];
let _adminProduct = null;

// ── PIN AUTH ──────────────────────────────────────────────────────────────────

async function checkPin() {
  const input = document.getElementById('pinInput').value;
  try {
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: input })
    });
    
    if (res.ok) {
      document.getElementById('pinScreen').classList.add('hidden');
      document.getElementById('adminMain').classList.remove('hidden');
      initAdmin();
    } else {
      throw new Error('Invalid PIN');
    }
  } catch(err) {
    const errEl = document.getElementById('pinError');
    errEl.textContent = 'Incorrect PIN. Try again.';
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
    setTimeout(() => errEl.textContent = '', 2000);
  }
}

function pinKeydown(e) {
  if (e.key === 'Enter') checkPin();
}

async function logout() {
  await fetch('/api/admin-logout');
  document.getElementById('adminMain').classList.add('hidden');
  document.getElementById('pinScreen').classList.remove('hidden');
  document.getElementById('pinInput').value = '';
  detachAllOrdersListener();
}

// ── INIT ──────────────────────────────────────────────────────────────────────

function initAdmin() {
  // Load orders
  listenToAllOrders(orders => {
    _adminOrders = orders;
    renderOrdersTable(orders);
    updateAdminStats(orders);
  });

  // Load inventory
  listenToInventory(items => {
    _adminInventory = items;
    renderAdminInventory(items);
  });
}

// ── STATS ─────────────────────────────────────────────────────────────────────

function updateAdminStats(orders) {
  const total     = orders.length;
  const pending   = orders.filter(o => o.statusKey !== 'delivered').length;
  const delivered = orders.filter(o => o.statusKey === 'delivered').length;
  const revenue   = orders.reduce((s, o) => s + (o.total || 0), 0);

  setValue('statTotal',     total);
  setValue('statPending',   pending);
  setValue('statDelivered', delivered);
  setValue('statRevenue',   CONFIG.currency + revenue.toLocaleString());
}

// ── ORDERS TABLE ──────────────────────────────────────────────────────────────

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersBody');
  if (!orders || orders.length === 0) {
    document.getElementById('ordersEmpty').classList.remove('hidden');
    document.getElementById('ordersTableWrap').classList.add('hidden');
    return;
  }

  document.getElementById('ordersEmpty').classList.add('hidden');
  document.getElementById('ordersTableWrap').classList.remove('hidden');

  tbody.innerHTML = '';
  orders.forEach(order => {
    const status = ORDER_STATUSES[order.statusIdx] || ORDER_STATUSES[0];
    const isLast = order.statusIdx >= ORDER_STATUSES.length - 1;

    const dateStr = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : order.date || '—';

    tbody.innerHTML += `
      <tr>
        <td><div class="order-id-cell">${order.id}</div></td>
        <td class="order-customer">
          <div class="order-customer-name">${order.name}</div>
          <div class="order-customer-contact">${order.phone}</div>
          <div class="order-customer-contact">${order.email}</div>
        </td>
        <td>${order.productName} × ${order.qty}</td>
        <td>${CONFIG.currency}${(order.total || 0).toLocaleString()}</td>
        <td>${order.payment}
            ${order.proofOfPayment ? `<br><a href="#" onclick="viewProof('${order.id}'); return false;" style="font-size:0.65rem;color:var(--gray);text-decoration:underline;">📎 View Proof</a>` : ''}
        </td>
        <td><span class="status-badge ${order.statusKey}">${status.title}</span></td>
        <td style="font-size:.65rem;color:var(--gray);">${dateStr}</td>
        <td>
          <div class="action-btns">
            ${isLast
              ? '<span class="action-btn done-btn">✓ Delivered</span>'
              : `<button class="action-btn advance" onclick="advanceOrderStatus('${order.id}', ${order.statusIdx})">Advance →</button>`
            }
            <a class="action-btn wa" href="${buildWALink(order)}" target="_blank">WhatsApp</a>
            <button class="action-btn email" onclick="sendEmailNotif('${order.id}')">Email</button>
          </div>
        </td>
      </tr>`;
  });
}

function buildWALink(order) {
  const statusObj = ORDER_STATUSES[order.statusIdx] || ORDER_STATUSES[0];
  const msg = buildStatusUpdateWhatsApp(order, statusObj);
  return generateWhatsAppLink(order.phone, msg);
}

function viewProof(orderId) {
  const order = _adminOrders.find(o => o.id === orderId);
  if (order && order.proofOfPayment) {
    const win = window.open();
    win.document.write(`<title>Proof of Payment - ${order.id}</title><img src="${order.proofOfPayment}" style="max-width:100%; display:block; margin:auto;">`);
  }
}

// ── ADVANCE STATUS ────────────────────────────────────────────────────────────

async function advanceOrderStatus(orderId, currentIdx) {
  const nextIdx = currentIdx + 1;
  if (nextIdx >= ORDER_STATUSES.length) return;

  const nextStatus = ORDER_STATUSES[nextIdx];

  try {
    await updateOrderStatus(orderId, nextIdx, nextStatus.key);
    adminToast(`✓ Order ${orderId} → ${nextStatus.title}`);
    
    // Automatically trigger the status update email
    sendEmailNotif(orderId);
  } catch (err) {
    adminToast('⚠️ Failed to update status. Check connection.');
    console.error(err);
  }
}

// ── EMAIL NOTIFICATION ────────────────────────────────────────────────────────

async function sendEmailNotif(orderId) {
  const order = _adminOrders.find(o => o.id === orderId);
  if (!order) return;

  const statusObj = ORDER_STATUSES[order.statusIdx] || ORDER_STATUSES[0];

  try {
    await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_name: order.name,
        to_email: order.email,
        order_id: order.id,
        status_title: statusObj.title,
        status_desc: statusObj.desc
      })
    });
    adminToast(`✓ Email sent to ${order.email}`);
  } catch (err) {
    adminToast('⚠️ Email failed. Check connection.');
    console.error(err);
  }
}

// ── INVENTORY EDITOR ──────────────────────────────────────────────────────────

function renderAdminInventory(items) {
  const list = document.getElementById('adminInventoryList');
  if (!list) return;
  list.innerHTML = '';
  items.forEach(product => {
    list.innerHTML += `
      <div class="inv-editor" style="margin-bottom: 1rem;">
        <div class="inv-editor-header" style="grid-template-columns: 1fr 1fr 120px 140px 200px;">
          <span>Name</span>
          <span>Image Path</span>
          <span>Price (£)</span>
          <span>Stock</span>
          <span></span>
        </div>
        <div class="inv-editor-row" style="grid-template-columns: 1fr 1fr 120px 140px 200px;">
          <div class="inv-editor-cell"><input type="text" id="editName_${product.id}" value="${product.name}"></div>
          <div class="inv-editor-cell"><input type="text" id="editImage_${product.id}" value="${product.image || 'images/product.jpg'}"></div>
          <div class="inv-editor-cell"><input type="number" id="editPrice_${product.id}" value="${product.price}" min="0"></div>
          <div class="inv-editor-cell">
            <input type="number" id="editStock_${product.id}" value="${product.stock}" min="0" max="24" oninput="onStockInput('${product.id}')">
            <div class="stock-bar-admin">
              <div class="stock-bar-admin-fill" id="stockBarFill_${product.id}" style="width:${(product.stock/CONFIG.maxStock)*100}%"></div>
            </div>
          </div>
          <div class="inv-editor-cell" style="display:flex;gap:.5rem;">
            <button class="save-inv-btn" id="saveInvBtn_${product.id}" onclick="saveProductEdits('${product.id}')">Save</button>
            <button class="save-inv-btn" onclick="deleteProduct('${product.id}')" style="background:#dc3545;border-color:#dc3545;">Delete</button>
          </div>
        </div>
      </div>
    `;
  });
}

function onStockInput(id) {
  const val = parseInt(document.getElementById('editStock_' + id).value) || 0;
  const clamped = Math.max(0, Math.min(CONFIG.maxStock, val));
  if (val > CONFIG.maxStock) {
    document.getElementById('editStock_' + id).value = CONFIG.maxStock;
  }
  const fill = document.getElementById('stockBarFill_' + id);
  if (fill) fill.style.width = (clamped / CONFIG.maxStock) * 100 + '%';
}

async function saveProductEdits(id) {
  const btn = document.getElementById('saveInvBtn_' + id);
  if (!btn) return;
  btn.textContent = 'Saving…';

  const updates = {
    name:  document.getElementById('editName_' + id).value.trim(),
    image: document.getElementById('editImage_' + id).value.trim(),
    price: parseFloat(document.getElementById('editPrice_' + id).value) || 0,
    stock: Math.max(0, Math.min(CONFIG.maxStock, parseInt(document.getElementById('editStock_' + id).value) || 0)),
  };

  try {
    await updateProduct(id, updates);
    adminToast('✓ Product updated successfully');
    btn.textContent = 'Save';
  } catch (err) {
    adminToast('⚠️ Save failed. Check connection.');
    btn.textContent = 'Save';
    console.error(err);
  }
}

async function addNewProduct() {
  const name = document.getElementById('addName').value.trim();
  if (!name) return adminToast('⚠️ Name required');
  const id = 'prod_' + Date.now();
  const product = {
    id: id,
    name: name,
    image: document.getElementById('addImage').value.trim() || 'images/product.jpg',
    price: parseFloat(document.getElementById('addPrice').value) || 25,
    stock: Math.max(0, Math.min(CONFIG.maxStock, parseInt(document.getElementById('addStock').value) || 24))
  };
  try {
    await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    adminToast('✓ Product added');
    document.getElementById('addName').value = '';
    document.getElementById('addImage').value = '';
    document.getElementById('addPrice').value = '25';
    document.getElementById('addStock').value = '24';
  } catch (e) {
    adminToast('⚠️ Failed to add. Check connection.');
  }
}

async function deleteProduct(id) {
  if (confirm('Are you sure you want to delete this product?')) {
    try {
      await fetch('/api/inventory?id=' + id, { method: 'DELETE' });
      adminToast('✓ Product deleted');
    } catch (e) {
      adminToast('⚠️ Failed to delete.');
    }
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function setValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'INPUT') el.value = val;
  else el.textContent = val;
}

let _toastTimer;
function adminToast(msg) {
  const el = document.getElementById('adminToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// Sort / filter helpers
function filterOrdersByStatus(statusKey) {
  if (!statusKey) return renderOrdersTable(_adminOrders);
  renderOrdersTable(_adminOrders.filter(o => o.statusKey === statusKey));
}
