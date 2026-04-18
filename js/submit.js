'use strict';

// ═══════════════════════════════════════════
// Submit — Memory submission form
// Upload from phone, drag & drop, paste (Ctrl+V)
// ═══════════════════════════════════════════

const Submit = (() => {
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

    // Submit
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.addEventListener('click', handleSubmit);

    // File inputs (photo, video, audio)
    ['fileInputPhoto', 'fileInputVideo', 'fileInputAudio'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.addEventListener('change', (e) => {
        if (e.target.files.length) setFile(e.target.files[0]);
      });
    });

    // Drag & drop on drop zone
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
          setFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Drag & drop on entire modal
    const modal = document.getElementById('submitModal');
    if (modal) {
      modal.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (fileDrop) fileDrop.classList.add('dragover');
      });
      modal.addEventListener('dragleave', (e) => {
        if (!modal.contains(e.relatedTarget)) {
          if (fileDrop) fileDrop.classList.remove('dragover');
        }
      });
      modal.addEventListener('drop', (e) => {
        e.preventDefault();
        if (fileDrop) fileDrop.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          setFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Paste (Ctrl+V) — works when modal is open
    document.addEventListener('paste', handlePaste);

    // Admin button
    const adminBtn = document.getElementById('adminToggle');
    if (adminBtn) adminBtn.addEventListener('click', openAdmin);
  }

  // ── Paste handler ──
  function handlePaste(e) {
    // Only handle paste when submit modal is open
    const backdrop = document.getElementById('submitBackdrop');
    if (!backdrop || !backdrop.classList.contains('open')) return;

    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Pasted image
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Give it a meaningful name
          const ext = item.type.split('/')[1] || 'png';
          const named = new File([file], 'pasted-image.' + ext, { type: file.type });
          setFile(named);
        }
        return;
      }

      // Pasted video
      if (item.type.startsWith('video/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) setFile(file);
        return;
      }
    }
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

  // ── Auto-detect type from file ──
  function detectType(file) {
    if (file.type.startsWith('image/')) return 'photo';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'photo'; // default
  }

  // ── Auto-detect type from URL ──
  function detectTypeFromUrl(url) {
    if (!url) return null;
    const lower = url.toLowerCase();
    // YouTube
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'video';
    // Vimeo
    if (lower.includes('vimeo.com')) return 'video';
    // Instagram
    if (lower.includes('instagram.com')) return 'social';
    // Facebook
    if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'social';
    // TikTok
    if (lower.includes('tiktok.com')) return 'video';
    // Image extensions
    if (/\.(jpg|jpeg|png|gif|webp|heic|heif)(\?|$)/i.test(lower)) return 'photo';
    // Audio extensions
    if (/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i.test(lower)) return 'audio';
    // Video extensions
    if (/\.(mp4|mov|avi|webm)(\?|$)/i.test(lower)) return 'video';
    return 'social'; // default for URLs
  }

  function setFile(file) {
    selectedFile = file;
    const preview = document.getElementById('filePreview');
    if (!preview) return;

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const type = detectType(file);
    let thumbHtml = '';

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      thumbHtml = `<img src="${Wall.esc(url)}" alt="preview">`;
    } else if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      thumbHtml = `<video src="${Wall.esc(url)}" muted></video>`;
    } else {
      thumbHtml = `<span style="font-size:2rem">\u{1F4CE}</span>`;
    }

    preview.innerHTML = `
      ${thumbHtml}
      <div class="file-preview-info">
        <div class="file-preview-name">${Wall.esc(file.name)}</div>
        <div class="file-preview-size">${sizeMB} MB &middot; ${type === 'photo' ? 'תמונה' : type === 'video' ? 'סרטון' : 'הקלטה'}</div>
      </div>
      <button class="file-preview-remove" title="הסר">&times;</button>
    `;
    preview.style.display = 'flex';

    // Remove button
    preview.querySelector('.file-preview-remove').addEventListener('click', () => {
      clearFile();
    });

    showToast(type === 'photo' ? 'תמונה נבחרה \u{1F4F8}' : type === 'video' ? 'סרטון נבחר \u{1F3AC}' : 'קובץ נבחר \u{1F4CE}');
  }

  function clearFile() {
    selectedFile = null;
    const preview = document.getElementById('filePreview');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    ['fileInputPhoto', 'fileInputVideo', 'fileInputAudio'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });
  }

  // ── Format file size ──
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ── Submit ──
  async function handleSubmit() {
    const name = document.getElementById('subName').value.trim();
    const text = document.getElementById('subText').value.trim();
    const link = document.getElementById('subLink').value.trim();

    if (!name) { showToast('נא לכתוב את שמכם'); return; }
    if (!text && !link && !selectedFile) { showToast('נא להוסיף תוכן — קובץ, קישור, או סיפור'); return; }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'שולח...';

    let mediaUrl = null;
    let autoType = 'story';

    // Detect type automatically
    if (selectedFile) {
      autoType = detectType(selectedFile);
    } else if (link) {
      autoType = detectTypeFromUrl(link);
    }

    // Upload file if present
    if (selectedFile) {
      submitBtn.textContent = 'מעלה קובץ...';
      mediaUrl = await DB.uploadMedia(selectedFile);
      if (!mediaUrl) {
        showToast('שגיאה בהעלאת הקובץ');
        submitBtn.disabled = false;
        submitBtn.textContent = 'שלחו לאישור \u{1F499}';
        return;
      }
    }

    const item = {
      type: autoType,
      author: name,
      text: text || null,
      media_url: (autoType === 'photo' || autoType === 'audio') ? (mediaUrl || link || null) : null,
      video_url: autoType === 'video' ? (mediaUrl || link || null) : null,
      link_data: autoType === 'social' && link
        ? [{ url: link, label: 'קישור שהוגש', sub: name, icon: 'link' }]
        : null,
    };

    submitBtn.textContent = 'שולח...';
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
    clearFile();
  }

  // ── Admin ──
  async function openAdmin() {
    const pass = prompt('סיסמת ניהול:');
    if (!pass) return;
    if (pass !== 'asi2022') {
      showToast('סיסמה שגויה');
      return;
    }
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

  return { init, open, close, updateAdminDot };
})();

document.addEventListener('DOMContentLoaded', () => Submit.init());
