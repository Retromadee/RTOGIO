/* ═══════════════════════════════════════════════════════════════
   FRAMES — Order Tracking (Firebase real-time)
   ═══════════════════════════════════════════════════════════════ */

let _activeTrackRef = null;
let _activeTrackId  = null;

// ── OVERLAY OPEN / CLOSE ──────────────────────────────────────────────────────

function showTrack() {
  document.getElementById('trackOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('trackIdInput').value = '';
  document.getElementById('trackVerifyInput').value = '';
  showTrackEmpty();
}

function closeTrack() {
  document.getElementById('trackOverlay').classList.remove('open');
  document.body.style.overflow = '';
  detachCurrentTrackListener();
}

function showTrackFromOrder() {
  closeOrder();
  showTrack();
}

// ── ORDER LOOKUP ──────────────────────────────────────────────────────────────

function lookupOrder(overrideId) {
  const input   = document.getElementById('trackIdInput');
  const vInput  = document.getElementById('trackVerifyInput');
  const orderId = (overrideId || input.value.trim()).toUpperCase().replace(/\s+/g, '');
  const verify  = vInput.value.trim().toLowerCase();

  if (!orderId) { showTrackError('Please enter an Order ID.'); return; }
  // Removed strict requirement for verification input; will only verify if present
  // if (!verify)  { showTrackError('Please enter your Phone or Email for verification.'); return; }

  // Show loading
  document.getElementById('trackEmpty').classList.add('hidden');
  document.getElementById('trackContent').classList.add('hidden');
  document.getElementById('trackError').classList.add('hidden');
  document.getElementById('trackLoading').classList.remove('hidden');

  // Detach previous listener
  detachCurrentTrackListener();

  // Set up new real-time listener
  _activeTrackId  = orderId;
  _activeTrackRef = listenToOrder(orderId, order => {
    document.getElementById('trackLoading').classList.add('hidden');

    if (!order) {
      showTrackError(`Order "${orderId}" not found. Check the ID on your invoice.`);
      return;
    }

    // VERIFICATION CHECK (Only if verification input is provided)
    if (verify) {
      const dbPhone = order.phone.replace(/\D/g, ''); // digits only
      const dbEmail = order.email?.toLowerCase();
      const inputClean = verify.replace(/\D/g, '');
      const isMatch = (verify === dbEmail) || (inputClean && dbPhone.endsWith(inputClean) && inputClean.length >= 4);
      if (!isMatch) {
         showTrackError('Verification failed. The Phone or Email does not match this order.');
         return;
      }
    }

    // Check for status change vs last seen (for in-app notification)
    const lastKnown = localStorage.getItem('frames_last_known_status_' + orderId);
    if (lastKnown && lastKnown !== order.statusKey) {
      const msg = NOTIF_MESSAGES[order.statusKey];
      if (msg) showNotif(msg);
    }
    localStorage.setItem('frames_last_known_status_' + orderId, order.statusKey);

    renderTrackContent(order);
  });
}

function detachCurrentTrackListener() {
  if (_activeTrackId) {
    detachOrderListener(_activeTrackId);
    _activeTrackId  = null;
    _activeTrackRef = null;
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function showTrackEmpty() {
  document.getElementById('trackEmpty').classList.remove('hidden');
  document.getElementById('trackContent').classList.add('hidden');
  document.getElementById('trackError').classList.add('hidden');
  document.getElementById('trackLoading').classList.add('hidden');
}

function showTrackError(msg) {
  document.getElementById('trackError').textContent = msg;
  document.getElementById('trackError').classList.remove('hidden');
  document.getElementById('trackContent').classList.add('hidden');
  document.getElementById('trackEmpty').classList.add('hidden');
}

function renderTrackContent(order) {
  document.getElementById('trackContent').classList.remove('hidden');
  document.getElementById('trackEmpty').classList.add('hidden');
  document.getElementById('trackError').classList.add('hidden');

  document.getElementById('trackIdDisplay').textContent  = order.id;
  document.getElementById('trackCustomer').textContent   = order.name + ' — ' + order.location;
  document.getElementById('trackItem').textContent       =
    order.productName + ' × ' + order.qty +
    '  (' + CONFIG.currency + order.total.toLocaleString() + ')';

  // Build timeline steps
  const stepsEl = document.getElementById('trackSteps');
  stepsEl.innerHTML = '';

  ORDER_STATUSES.forEach((s, idx) => {
    const isDone   = idx < order.statusIdx;
    const isActive = idx === order.statusIdx;
    const ts       = order.timestamps?.[s.key];
    const timeStr  = ts
      ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';

    const dotClass = isDone ? 'done' : isActive ? 'active' : 'pending';
    const titleStyle = (isDone || isActive) ? '' : 'color:var(--gray);font-weight:400;';

    stepsEl.innerHTML += `
      <div class="t-step">
        <div class="t-dot-col">
          <div class="t-dot ${dotClass}"></div>
        </div>
        <div>
          <div class="t-title" style="${titleStyle}">${s.title}</div>
          <div class="t-desc">${s.desc}</div>
          ${timeStr ? `<div class="t-time">${timeStr}</div>` : ''}
        </div>
      </div>`;
  });
}

// ── KEYBOARD: press Enter in input ────────────────────────────────────────────

function trackKeydown(e) {
  if (e.key === 'Enter') lookupOrder();
}
