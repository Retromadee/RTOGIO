/* ═══════════════════════════════════════════════════════════════
   FRAMES — Inventory (Firebase-driven)
   ═══════════════════════════════════════════════════════════════ */

let inventoryData = [];
let lastInventoryJson = '';

function initInventory() {
  seedInventoryIfEmpty().then(() => {
    listenToInventory(items => {
      const currentJson = JSON.stringify(items);
      if (currentJson === lastInventoryJson) return; // No change, skip render to prevent flicker
      
      lastInventoryJson = currentJson;
      inventoryData = items;
      renderInventoryGrid();
      renderProdGrid();
      updateHeroStats();
    });
  });
}

function getProduct(id) {
  return inventoryData.find(i => i.id === id) || null;
}

// ── INVENTORY GRID (home page) ────────────────────────────────────────────────

function renderInventoryGrid() {
  const grid = document.getElementById('invGrid');
  if (!grid) return;

  if (inventoryData.length === 0) {
    grid.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
    return;
  }

  grid.innerHTML = '';
  inventoryData.forEach(item => {
    const pct   = Math.min(100, (item.stock / CONFIG.maxStock) * 100);
    const isOos = item.stock === 0;
    const isLow = item.stock > 0 && item.stock <= 4;

    let tagHTML = '';
    if (isOos)      tagHTML = '<span class="inv-card-tag out">Out of Stock</span>';
    else if (isLow) tagHTML = '<span class="inv-card-tag low">Low Stock</span>';

    grid.innerHTML += `
      <div class="inv-card ${isOos ? 'oos' : ''}" ${!isOos ? `onclick="selectFromGrid('${item.id}')"` : ''}>
        ${tagHTML}
        <img src="images/product.jpg" alt="${item.name}" class="inv-card-img">
        <div class="inv-name">${item.name}</div>
        <div class="inv-stock-bar">
          <div class="inv-stock-fill ${isLow ? 'low' : isOos ? 'out' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="inv-count">${isOos ? 'Sold out' : `${item.stock} of ${CONFIG.maxStock} available`}</div>
        <div class="inv-price">${CONFIG.currency}${item.price}</div>
      </div>`;
  });
}

// ── PRODUCT GRID (order overlay step 1) ──────────────────────────────────────

function renderProdGrid() {
  const grid = document.getElementById('prodGrid');
  if (!grid) return;

  grid.innerHTML = '';
  inventoryData.forEach(item => {
    const isOos = item.stock === 0;
    grid.innerHTML += `
      <div class="prod-opt ${isOos ? 'oos-opt' : ''}" id="po_${item.id}"
           ${!isOos ? `onclick="selectProduct('${item.id}')"` : ''}>
        <img src="images/product2.jpg" alt="${item.name}" class="po-img">
        <div class="po-name">${item.name}</div>
        <div class="po-stk">${isOos ? 'Out of stock' : item.stock + ' left'}</div>
        <div class="po-price">${CONFIG.currency}${item.price}</div>
      </div>`;
  });
}

// ── HERO STATS ────────────────────────────────────────────────────────────────

function updateHeroStats() {
  const total = inventoryData.reduce((s, i) => s + (i.stock || 0), 0);
  const el = (id) => document.getElementById(id);
  if (el('heroTotalStock')) el('heroTotalStock').textContent = total;
  if (el('heroModels'))     el('heroModels').textContent     = CONFIG.maxStock;
  if (el('heroAvail'))      el('heroAvail').textContent      = total > 0 ? total : '—';
}

// ── HELPER: select from home grid ────────────────────────────────────────────

function selectFromGrid(id) {
  openOrder(id);
}
