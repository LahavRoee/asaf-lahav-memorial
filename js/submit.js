'use strict';

// ═══════════════════════════════════════════
// Submit — Ultra-simple 2-click upload
// 1. Click big button → pick photo/video
// 2. Type name → send
// Also: story/link modal, WhatsApp, paste
// ═══════════════════════════════════════════

const Submit = (() => {
  let selectedFile = null;

  // WhatsApp number for receiving memories
  const WHATSAPP_NUMBER = '972501234567'; // ← change to real number
  const WHATSAPP_MSG = encodeURIComponent('היי, אני רוצה לשתף זיכרון מאסי להב ז״ל.\nהשם שלי: \nהנה התמונה/סרטון:');

  function init() {
    bindEvents();
    setupWhatsApp();
  }

  function bindEvents() {
    // ── Quick file upload (big button) — supports multiple ──
    const quickInput = document.getElementById('quickFileInput');
    if (quickInput) {
      quickInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          // Take first file (we upload one at a time for simplicity)
          selectedFile = e.target.files[0];
          openQuickName();
        }
      });
    }

    // ── Quick name modal ──
    const quickSubmit = document.getElementById('quickSubmitBtn');
    if (quickSubmit) quickSubmit.addEventListener('click', handleQuickSubmit);

    const quickCancel = document.getElementById('quickCancelBtn');
    if (quickCancel) quickCancel.addEventListener('click', closeQuickName);

    const quickBackdrop = document.getElementById('quickNameBackdrop');
    if (quickBackdrop) quickBackdrop.addEventListener('click', (e) => {
      if (e.target === quickBackdrop) closeQuickName();
    });

    // Enter key in quick name
    const quickName = document.getElementById('quickName');
    if (quickName) quickName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleQuickSubmit();
    });

    // ── Story/link modal ──
    const openBtn = document.getElementById('openSubmitBtn');
    if (openBtn) openBtn.addEventListener('click', openStoryModal);

    const cancelBtn = document.getElementById('cancelSubmitBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeStoryModal);

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.addEventListener('click', handleStorySubmit);

    const backdrop = document.getElementById('submitBackdrop');
    if (backdrop) backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeStoryModal();
    });

    // ── Paste anywhere (Ctrl+V) ──
    document.addEventListener('paste', handlePaste);

    // ── Admin button ──
    const adminBtn = document.getElementById('adminToggle');
    if (adminBtn) adminBtn.addEventListener('click', openAdmin);
  }

  function setupWhatsApp() {
    const btn = document.getElementById('whatsappBtn');
    if (btn) {
      btn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;
    }
  }

  // ═══ QUICK UPLOAD FLOW (2 clicks) ═══

  function openQuickName() {
    const preview = document.getElementById('quickPreview');
    if (preview && selectedFile) {
      const sizeMB = (selectedFile.size / (1024 * 1024)).toFixed(1);
      const isImage = selectedFile.type.startsWith('image/');
      const isVideo = selectedFile.type.startsWith('video/');
      const typeLabel = isImage ? 'תמונה' : isVideo ? 'סרטון' : 'קובץ';
      let thumbHtml = '';

      if (isImage) {
        thumbHtml = `<img src="${URL.createObjectURL(selectedFile)}" alt="preview">`;
      } else if (isVideo) {
        thumbHtml = `<video src="${URL.createObjectURL(selectedFile)}" muted></video>`;
      } else {
        thumbHtml = `<span style="font-size:2rem">\u{1F4CE}</span>`;
      }

      preview.innerHTML = `
        ${thumbHtml}
        <div class="file-preview-info">
          <div class="file-preview-name">${Wall.esc(selectedFile.name)}</div>
          <div class="file-preview-size">${sizeMB} MB &middot; ${typeLabel}</div>
        </div>
      `;
    }

    document.getElementById('quickNameBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const nameInput = document.getElementById('quickName');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  function closeQuickName() {
    document.getElementById('quickNameBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    selectedFile = null;
    document.getElementById('quickName').value = '';
    document.getElementById('quickCaption').value = '';
    const quickInput = document.getElementById('quickFileInput');
    if (quickInput) quickInput.value = '';
  }

  async function handleQuickSubmit() {
    const name = document.getElementById('quickName').value.trim();
    if (!name) { showToast('נא לכתוב את שמכם'); return; }
    if (!selectedFile) { showToast('לא נבחר קובץ'); return; }

    const caption = document.getElementById('quickCaption').value.trim();
    const btn = document.getElementById('quickSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'מעלה...';

    const mediaUrl = await DB.uploadMedia(selectedFile);
    if (!mediaUrl) {
      showToast('שגיאה בהעלאה, נסו שנית');
      btn.disabled = false;
      btn.textContent = '\u{1F499} שלחו';
      return;
    }

    const isVideo = selectedFile.type.startsWith('video/');
    const item = {
      type: isVideo ? 'video' : selectedFile.type.startsWith('audio/') ? 'audio' : 'photo',
      author: name,
      text: caption || null,
      media_url: isVideo ? null : mediaUrl,
      video_url: isVideo ? mediaUrl : null,
      link_data: null,
    };

    const ok = await DB.submitPending(item);
    btn.disabled = false;
    btn.textContent = '\u{1F499} שלחו';

    if (ok) {
      closeQuickName();
      showToast('תודה! הזיכרון ממתין לאישור \u{1F499}');
      updateAdminDot();
    } else {
      showToast('שגיאה בשליחה');
    }
  }

  // ═══ PASTE (Ctrl+V anywhere) ═══

  function handlePaste(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const ext = item.type.split('/')[1] || 'png';
          selectedFile = new File([file], 'pasted.' + ext, { type: file.type });
          openQuickName();
        }
        return;
      }
    }
  }

  // ═══ STORY / LINK MODAL ═══

  function openStoryModal() {
    document.getElementById('submitBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeStoryModal() {
    document.getElementById('submitBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('subName').value = '';
    document.getElementById('subText').value = '';
    document.getElementById('subLink').value = '';
  }

  async function handleStorySubmit() {
    const name = document.getElementById('subName').value.trim();
    const text = document.getElementById('subText').value.trim();
    const link = document.getElementById('subLink').value.trim();

    if (!name) { showToast('נא לכתוב את שמכם'); return; }
    if (!text && !link) { showToast('נא לכתוב סיפור או להדביק קישור'); return; }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'שולח...';

    // Auto detect type from link
    let type = 'story';
    if (link) {
      const l = link.toLowerCase();
      if (l.includes('youtube.com') || l.includes('youtu.be') || l.includes('vimeo.com') || l.includes('tiktok.com')) type = 'video';
      else if (l.includes('instagram.com') || l.includes('facebook.com') || l.includes('fb.com')) type = 'social';
      else if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(l)) type = 'photo';
      else if (/\.(mp4|mov|webm)(\?|$)/i.test(l)) type = 'video';
      else if (link && !text) type = 'social';
    }

    const item = {
      type,
      author: name,
      text: text || null,
      media_url: type === 'photo' ? link : null,
      video_url: type === 'video' ? link : null,
      link_data: type === 'social' && link
        ? [{ url: link, label: 'קישור שהוגש', sub: name, icon: 'link' }]
        : null,
    };

    const ok = await DB.submitPending(item);
    btn.disabled = false;
    btn.textContent = '\u{1F499} שלחו לאישור';

    if (ok) {
      closeStoryModal();
      showToast('תודה! ממתין לאישור \u{1F499}');
      updateAdminDot();
    } else {
      showToast('שגיאה בשליחה');
    }
  }

  // ═══ ADMIN ═══

  async function openAdmin() {
    const pass = prompt('סיסמת ניהול:');
    if (!pass) return;
    if (pass !== 'asi2022') { showToast('סיסמה שגויה'); return; }
    window.location.href = 'admin.html';
  }

  async function updateAdminDot() {
    const btn = document.getElementById('adminToggle');
    if (!btn) return;
    const pending = await DB.fetchPending();
    btn.innerHTML = pending.length
      ? `\u2726 ניהול <span class="pdot"></span>${pending.length}`
      : '\u2726 ניהול';
  }

  return { init, open: openStoryModal, close: closeStoryModal, updateAdminDot };
})();

document.addEventListener('DOMContentLoaded', () => Submit.init());
