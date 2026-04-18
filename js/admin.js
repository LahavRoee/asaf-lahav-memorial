'use strict';

// ═══════════════════════════════════════════
// Admin — Approve/reject pending memories
// ═══════════════════════════════════════════

const Admin = (() => {
  const ADMIN_PASS = 'asi2022';
  let pendingItems = [];
  let selectedSizes = {};

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

    container.innerHTML = pendingItems.map((item, i) => {
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

      return `<div class="pending-card" data-id="${esc(item.id)}">
        <div class="pending-meta">
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
          <button class="btn-approve" onclick="Admin.approve('${esc(item.id)}')">\u2713 אשר ופרסם</button>
          <button class="btn-reject" onclick="Admin.reject('${esc(item.id)}')">\u2717 דחה</button>
        </div>
      </div>`;
    }).join('');
  }

  function setSize(id, size) {
    selectedSizes[id] = size;
    // Update button states
    const card = document.querySelector(`.pending-card[data-id="${id}"]`);
    if (card) {
      card.querySelectorAll('.size-opt').forEach(b => b.classList.remove('sel'));
      const labels = { '': 'רגיל', wide: 'רחב', tall: 'גבוה', large: 'גדול' };
      card.querySelectorAll('.size-opt').forEach(b => {
        if (b.textContent === labels[size]) b.classList.add('sel');
      });
    }
  }

  async function approve(id) {
    const ok = await DB.approvePending(id);
    if (ok) {
      showToast('הזיכרון אושר ופורסם! \u{1F499}');
      await loadPending();
    } else {
      showToast('שגיאה באישור');
    }
  }

  async function reject(id) {
    if (!confirm('למחוק את הזיכרון הזה?')) return;
    const ok = await DB.rejectPending(id);
    if (ok) {
      showToast('הזיכרון נמחק');
      await loadPending();
    } else {
      showToast('שגיאה במחיקה');
    }
  }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init, approve, reject, setSize };
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
