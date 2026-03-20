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
            ${(order.hasProof || order.proofOfPayment) ? `<br><a href="#" onclick="viewProof('${order.id}'); return false;" style="font-size:0.65rem;color:var(--gray);text-decoration:underline;">📎 View Proof</a>` : ''}
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
            <button class="action-btn" onclick="deleteOrder('${order.id}')" style="border-color:var(--red); color:var(--red);">🗑️</button>
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

async function viewProof(orderId) {
  adminToast('Loading proof...');
  try {
    const res = await fetch(`/api/orders?id=${encodeURIComponent(orderId)}`);
    if (res.ok) {
      const order = await res.json();
      if (order.proofOfPayment) {
        const win = window.open();
        win.document.write(`<title>Proof of Payment - ${order.id}</title><img src="${order.proofOfPayment}" style="max-width:100%; display:block; margin:auto;">`);
      } else {
        adminToast('No proof found for this order.');
      }
    }
  } catch(e) {
    adminToast('Failed to load proof.');
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

async function deleteOrder(id) {
  if (!confirm(`Are you sure you want to delete order ${id}?`)) return;
  adminToast('Deleting order…');
  try {
    const res = await fetch(`/api/orders?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      adminToast(`✓ Order ${id} deleted`);
    } else {
      throw new Error('Delete failed');
    }
  } catch (err) {
    adminToast('⚠️ Delete failed. Check connection.');
    console.error(err);
  }
}

// ── INVENTORY EDITOR ──────────────────────────────────────────────────────────

function renderAdminInventory(items) {
  const list = document.getElementById('adminInvRow');
  if (!list) return;
  list.innerHTML = '';
  items.forEach(product => {
    // We use CONFIG.maxStock as a fallback, but per-product maxStock is better if we have it
    const max = product.maxStock || CONFIG.maxStock || 24;
    const pct = (product.stock / max) * 100;

    list.innerHTML += `
      <div class="inv-editor-cell" style="padding-right:1rem;">
        <input type="text" id="editName_${product.id}" value="${product.name}">
      </div>
      <div class="inv-editor-cell">
        <input type="number" id="editPrice_${product.id}" value="${product.price}" min="0">
      </div>
      <div class="inv-editor-cell">
        <div style="display:flex; align-items:center; gap:.5rem;">
          <input type="number" id="editStock_${product.id}" value="${product.stock}" min="0" max="${max}" style="width:70px;" oninput="onStockInput('${product.id}', ${max})">
          <span style="font-size:0.65rem; color:var(--gray);">/ ${max}</span>
        </div>
        <div class="stock-bar-admin" style="margin-top:5px;">
          <div class="stock-bar-admin-fill" id="stockBarFill_${product.id}" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="inv-editor-cell">
        <input type="number" id="editMax_${product.id}" value="${max}" min="1" step="1" style="width:80px;">
      </div>
      <div class="inv-editor-cell" style="display:flex;gap:.5rem;">
        <button class="save-inv-btn" id="saveInvBtn_${product.id}" onclick="saveProductEdits('${product.id}')">Save</button>
        <button class="save-inv-btn" onclick="restockItem('${product.id}')" style="background:var(--gray);border-color:var(--gray);">Restock</button>
      </div>
    `;
  });
}

function onStockInput(id, max) {
  const input = document.getElementById('editStock_' + id);
  const val = parseInt(input.value) || 0;
  const clamped = Math.max(0, Math.min(max, val));
  if (val > max) input.value = max;
  const fill = document.getElementById('stockBarFill_' + id);
  if (fill) fill.style.width = (clamped / max) * 100 + '%';
}

async function restockItem(id) {
  const max = parseInt(document.getElementById('editMax_' + id).value) || 24;
  document.getElementById('editStock_' + id).value = max;
  onStockInput(id, max);
  await saveProductEdits(id);
}

async function restockAllToMax() {
  if (!confirm('Restock all products to their maximum capacity?')) return;
  try {
    for (const p of _adminInventory) {
      const max = p.maxStock || CONFIG.maxStock || 24;
      await updateProduct(p.id, { stock: max, maxStock: max });
    }
    adminToast('⚡ All items restocked!');
  } catch (e) {
    adminToast('⚠️ Restock failed.');
  }
}

async function saveProductEdits(id) {
  const btn = document.getElementById('saveInvBtn_' + id);
  if (!btn) return;
  btn.textContent = 'Saving…';

  const max = parseInt(document.getElementById('editMax_' + id).value) || 24;
  const updates = {
    name:  document.getElementById('editName_' + id).value.trim(),
    price: parseFloat(document.getElementById('editPrice_' + id).value) || 0,
    stock: Math.max(0, Math.min(max, parseInt(document.getElementById('editStock_' + id).value) || 0)),
    maxStock: max
  };

  try {
    await updateProduct(id, updates);
    adminToast('✓ Product updated');
    btn.textContent = 'Save';
  } catch (err) {
    adminToast('⚠️ Save failed');
    btn.textContent = 'Save';
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
