'use strict';

// ═══════════════════════════════════════════
// Submit — Memory submission form
// ═══════════════════════════════════════════

const Submit = (() => {
  let selectedType = 'story';
  let selectedFile = null;

  function init() {
    bindEvents();
  }

  function bindEvents() {
    // Open submit
    const openBtn = document.getElementById('openSubmitBtn');
    if (openBtn) openBtn.addEventListener('click', open);

    // Cancel
    const cancelBtn = document.getElementById('cancelSubmitBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    // Backdrop click
    const backdrop = document.getElementById('submitBackdrop');
    if (backdrop) backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    // Type selection
    const typeGrid = document.getElementById('typeGrid');
    if (typeGrid) typeGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.type-btn');
      if (!btn) return;
      selectType(btn.dataset.type, btn);
    });

    // Submit
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.addEventListener('click', handleSubmit);

    // File input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileSelect);
    }

    // Drag & drop
    const fileDrop = document.getElementById('fileDrop');
    if (fileDrop) {
      fileDrop.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDrop.classList.add('dragover');
      });
      fileDrop.addEventListener('dragleave', () => {
        fileDrop.classList.remove('dragover');
      });
      fileDrop.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDrop.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          handleFileFromDrop(e.dataTransfer.files[0]);
        }
      });
    }

    // Admin button
    const adminBtn = document.getElementById('adminToggle');
    if (adminBtn) adminBtn.addEventListener('click', openAdmin);
  }

  function open() {
    document.getElementById('submitBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    document.getElementById('submitBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    resetForm();
  }

  function selectType(type, btn) {
    selectedType = type;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');

    const needLink = type === 'photo' || type === 'video' || type === 'audio' || type === 'social';
    const needFile = type === 'photo' || type === 'audio';

    document.getElementById('linkGroup').style.display = needLink ? 'block' : 'none';
    document.getElementById('textGroup').style.display = type === 'social' ? 'none' : 'block';
    document.getElementById('fileGroup').style.display = needFile ? 'block' : 'none';

    const hints = {
      photo: 'קישור לתמונה (Google Photos, Dropbox, iCloud)',
      video: 'קישור YouTube או Vimeo',
      audio: 'קישור להקלטה (Google Drive, Dropbox)',
      social: 'קישור לפוסט פייסבוק, אינסטגרם וכד׳'
    };
    const hintEl = document.getElementById('linkHint');
    if (hintEl) hintEl.textContent = hints[type] || '';
  }

  function handleFileSelect(e) {
    if (e.target.files.length) {
      setFile(e.target.files[0]);
    }
  }

  function handleFileFromDrop(file) {
    setFile(file);
    // Also update the file input
    const input = document.getElementById('fileInput');
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }
  }

  function setFile(file) {
    selectedFile = file;
    const preview = document.getElementById('filePreview');
    if (!preview) return;

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${url}" alt="preview"> ${Wall.esc(file.name)}`;
    } else {
      preview.innerHTML = `\u{1F4CE} ${Wall.esc(file.name)}`;
    }
    preview.style.display = 'flex';
  }

  async function handleSubmit() {
    const name = document.getElementById('subName').value.trim();
    const text = document.getElementById('subText').value.trim();
    const link = document.getElementById('subLink').value.trim();

    if (!name) { showToast('נא לכתוב את שמכם'); return; }
    if (!text && !link && !selectedFile) { showToast('נא למלא תוכן'); return; }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'שולח...';

    let mediaUrl = null;

    // Upload file if present
    if (selectedFile) {
      mediaUrl = await DB.uploadMedia(selectedFile);
      if (!mediaUrl) {
        showToast('שגיאה בהעלאת הקובץ');
        submitBtn.disabled = false;
        submitBtn.textContent = 'שלחו לאישור \u{1F499}';
        return;
      }
    }

    const item = {
      type: selectedType,
      author: name,
      text: text || null,
      media_url: mediaUrl || (selectedType === 'photo' ? link : null) || (selectedType === 'audio' ? link : null),
      video_url: selectedType === 'video' ? link : null,
      link_data: selectedType === 'social' && link
        ? [{ url: link, label: 'קישור שהוגש', sub: name, icon: 'link' }]
        : null,
    };

    const ok = await DB.submitPending(item);

    submitBtn.disabled = false;
    submitBtn.textContent = 'שלחו לאישור \u{1F499}';

    if (ok) {
      close();
      showToast('תודה! הזיכרון שלכם ממתין לאישור \u{1F499}');
      updateAdminDot();
    } else {
      showToast('שגיאה בשליחה, נסו שנית');
    }
  }

  function resetForm() {
    document.getElementById('subName').value = '';
    document.getElementById('subText').value = '';
    document.getElementById('subLink').value = '';
    selectedFile = null;
    const preview = document.getElementById('filePreview');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
  }

  // ── Admin ──
  async function openAdmin() {
    const pass = prompt('סיסמת ניהול:');
    if (!pass) return;

    // Simple comparison (in production, use hash)
    if (pass !== 'asi2022') {
      showToast('סיסמה שגויה');
      return;
    }

    // Navigate to admin page
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

  // ── Public ──
  return { init, open, close, updateAdminDot };
})();

// Init when wall is ready
document.addEventListener('DOMContentLoaded', () => Submit.init());
