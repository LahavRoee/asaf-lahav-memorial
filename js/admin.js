'use strict';

// ═══════════════════════════════════════════
// Admin — Approve/reject pending memories
// Supports bulk select + approve/reject all
// ═══════════════════════════════════════════

const Admin = (() => {
  const ADMIN_PASS = 'asi2022';
  let pendingItems = [];
  let selectedSizes = {};
  let selectedIds = new Set();

  function init() {
    DB.init();
    bindEvents();
  }

  function bindEvents() {
    const loginBtn = document.getElementById('loginBtn');
    const passInput = document.getElementById('passInput');

    if (loginBtn) loginBtn.addEventListener('click', tryLogin);
    if (passInput) passInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tryLogin();
    });
  }

  function tryLogin() {
    const pass = document.getElementById('passInput').value;
    if (pass !== ADMIN_PASS) {
      showToast('סיסמה שגויה');
      return;
    }
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    loadPending();
  }

  async function loadPending() {
    pendingItems = await DB.fetchPending();
    selectedIds.clear();
    renderPending();
  }

  function renderPending() {
    const container = document.getElementById('pendingList');

    if (!pendingItems.length) {
      container.innerHTML = `<div class="empty-state">
        <span class="big">\u2728</span>
        אין זיכרונות ממתינים לאישור.<br>כולם אושרו!
      </div>`;
      return;
    }

    // Bulk actions bar
    const allChecked = selectedIds.size === pendingItems.length && pendingItems.length > 0;
    const someChecked = selectedIds.size > 0;
    const bulkBar = `<div class="bulk-bar">
      <label>
        <input type="checkbox" id="selectAll" ${allChecked ? 'checked' : ''} onchange="Admin.toggleAll(this.checked)">
        בחר הכל
      </label>
      <span class="bulk-count" id="bulkCount">${selectedIds.size ? selectedIds.size + ' נבחרו' : ''}</span>
      <button class="btn-bulk-approve" id="bulkApproveBtn" onclick="Admin.bulkApprove()" ${someChecked ? '' : 'disabled'}>
        \u2713 אשר נבחרים (${selectedIds.size})
      </button>
      <button class="btn-bulk-reject" id="bulkRejectBtn" onclick="Admin.bulkReject()" ${someChecked ? '' : 'disabled'}>
        \u2717 דחה נבחרים (${selectedIds.size})
      </button>
    </div>`;

    const cards = pendingItems.map(item => {
      const typeName = {
        story: 'זיכרון', photo: 'תמונה', video: 'וידאו',
        audio: 'הקלטה', social: 'קישור'
      }[item.type] || item.type;

      const date = item.submitted_at
        ? new Date(item.submitted_at).toLocaleDateString('he-IL')
        : '';

      let mediaPreview = '';
      if (item.media_url && item.type === 'photo') {
        mediaPreview = `<div class="pending-media"><img src="${esc(item.media_url)}" alt="preview" onerror="this.style.display='none'"></div>`;
      }

      const linkUrl = item.media_url || item.video_url || '';
      const linkHtml = linkUrl
        ? `<a class="pending-link" href="${esc(linkUrl)}" target="_blank" rel="noopener">${esc(linkUrl)}</a>`
        : '';

      const socialLinks = item.link_data
        ? item.link_data.map(l => `<a class="pending-link" href="${esc(l.url)}" target="_blank">${esc(l.label || l.url)}</a>`).join('')
        : '';

      const curSize = selectedSizes[item.id] || '';
      const isChecked = selectedIds.has(item.id);

      return `<div class="pending-card" data-id="${esc(item.id)}">
        <div class="pending-meta">
          <input type="checkbox" class="pending-check" ${isChecked ? 'checked' : ''} onchange="Admin.toggleItem('${esc(item.id)}', this.checked)">
          <span class="pending-type">${typeName}</span>
          <span class="pending-author">${esc(item.author)}</span>
          <span class="pending-date">${date}</span>
        </div>
        ${item.text ? `<p class="pending-text">${esc(item.text)}</p>` : ''}
        ${mediaPreview}
        ${linkHtml}
        ${socialLinks}
        <div style="margin-bottom:0.6rem">
          <span style="font-size:0.75rem;color:var(--muted)">גודל קוביה:</span>
          <div class="size-select">
            <button class="size-opt ${curSize === '' ? 'sel' : ''}" onclick="Admin.setSize('${esc(item.id)}','')">רגיל</button>
            <button class="size-opt ${curSize === 'wide' ? 'sel' : ''}" onclick="Admin.setSize('${esc(item.id)}','wide')">רחב</button>
            <button class="size-opt ${curSize === 'tall' ? 'sel' : ''}" onclick="Admin.setSize('${esc(item.id)}','tall')">גבוה</button>
            <button class="size-opt ${curSize === 'large' ? 'sel' : ''}" onclick="Admin.setSize('${esc(item.id)}','large')">גדול</button>
          </div>
        </div>
        <div class="pending-actions">
          <button class="btn-approve" onclick="Admin.approve('${esc(item.id)}')">\u2713 אשר</button>
          <button class="btn-reject" onclick="Admin.reject('${esc(item.id)}')">\u2717 דחה</button>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = bulkBar + cards;
  }

  // ── Selection ──

  function toggleItem(id, checked) {
    if (checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
    updateBulkBar();
  }

  function toggleAll(checked) {
    if (checked) {
      pendingItems.forEach(item => selectedIds.add(item.id));
    } else {
      selectedIds.clear();
    }
    // Update all checkboxes
    document.querySelectorAll('.pending-check').forEach(cb => {
      cb.checked = checked;
    });
    updateBulkBar();
  }

  function updateBulkBar() {
    const count = selectedIds.size;
    const countEl = document.getElementById('bulkCount');
    const approveBtn = document.getElementById('bulkApproveBtn');
    const rejectBtn = document.getElementById('bulkRejectBtn');
    const selectAllCb = document.getElementById('selectAll');

    if (countEl) countEl.textContent = count ? count + ' נבחרו' : '';
    if (approveBtn) {
      approveBtn.disabled = count === 0;
      approveBtn.textContent = '\u2713 אשר נבחרים (' + count + ')';
    }
    if (rejectBtn) {
      rejectBtn.disabled = count === 0;
      rejectBtn.textContent = '\u2717 דחה נבחרים (' + count + ')';
    }
    if (selectAllCb) {
      selectAllCb.checked = count === pendingItems.length && count > 0;
    }
  }

  // ── Size ──

  function setSize(id, size) {
    selectedSizes[id] = size;
    const card = document.querySelector(`.pending-card[data-id="${id}"]`);
    if (card) {
      card.querySelectorAll('.size-opt').forEach(b => b.classList.remove('sel'));
      const labels = { '': 'רגיל', wide: 'רחב', tall: 'גבוה', large: 'גדול' };
      card.querySelectorAll('.size-opt').forEach(b => {
        if (b.textContent === labels[size]) b.classList.add('sel');
      });
    }
  }

  // ── Single approve/reject ──

  async function approve(id) {
    const sizeHint = selectedSizes[id] || null;
    const ok = await DB.approvePending(id, sizeHint);
    if (ok) {
      showToast('הזיכרון אושר ופורסם! \u{1F499}');
      await loadPending();
    } else {
      showToast('שגיאה באישור');
    }
  }

  async function reject(id) {
    const ok = await DB.rejectPending(id);
    if (ok) {
      showToast('הזיכרון נמחק');
      await loadPending();
    } else {
      showToast('שגיאה במחיקה');
    }
  }

  // ── Bulk approve/reject ──

  async function bulkApprove() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!confirm(`לאשר ${ids.length} זיכרונות?`)) return;

    const btn = document.getElementById('bulkApproveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'מאשר...'; }

    let success = 0;
    let failed = 0;
    for (const id of ids) {
      const sizeHint = selectedSizes[id] || null;
      const ok = await DB.approvePending(id, sizeHint);
      if (ok) success++;
      else failed++;
    }

    showToast(`${success} זיכרונות אושרו!${failed ? ' (' + failed + ' נכשלו)' : ''} \u{1F499}`);
    await loadPending();
  }

  async function bulkReject() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!confirm(`למחוק ${ids.length} זיכרונות?`)) return;

    const btn = document.getElementById('bulkRejectBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'מוחק...'; }

    let success = 0;
    for (const id of ids) {
      const ok = await DB.rejectPending(id);
      if (ok) success++;
    }

    showToast(`${success} זיכרונות נמחקו`);
    await loadPending();
  }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init, approve, reject, setSize, toggleItem, toggleAll, bulkApprove, bulkReject };
})();

// Toast
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', () => Admin.init());
