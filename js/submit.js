'use strict';

// ═══════════════════════════════════════════
// Submit — Ultra-simple 2-click upload
// 1. Click big button → pick photo/video
// 2. Type name → send
// Also: story modal, voice recording, paste
// ═══════════════════════════════════════════

const Submit = (() => {
  let selectedFile = null;

  // Voice recording state
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingTimer = null;
  let recordingSeconds = 0;
  let recordedBlob = null;

  function init() {
    bindEvents();
  }

  const MAX_FILE_MB = 50;
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

  // Track uploaded file hashes to detect duplicates
  let uploadedHashes = new Set();

  async function fileHash(file) {
    const buffer = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function validateFile(file) {
    if (file.size > MAX_FILE_BYTES) {
      showToast(`הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)}MB). מקסימום ${MAX_FILE_MB}MB`);
      return false;
    }
    return true;
  }

  function bindEvents() {
    // ── Quick file upload (big button) ──
    const quickInput = document.getElementById('quickFileInput');
    if (quickInput) {
      quickInput.addEventListener('change', async (e) => {
        if (e.target.files.length) {
          const file = e.target.files[0];
          if (!validateFile(file)) { quickInput.value = ''; return; }

          // Duplicate check
          const hash = await fileHash(file);
          if (uploadedHashes.has(hash)) {
            showToast('הקובץ הזה כבר הועלה לאתר');
            quickInput.value = '';
            return;
          }

          selectedFile = file;
          selectedFile._hash = hash;
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

    // ── Voice recording ──
    const voiceBtn = document.getElementById('voiceRecordBtn');
    if (voiceBtn) voiceBtn.addEventListener('click', openVoiceModal);

    const voiceStart = document.getElementById('voiceStartBtn');
    if (voiceStart) voiceStart.addEventListener('click', startRecording);

    const voiceStop = document.getElementById('voiceStopBtn');
    if (voiceStop) voiceStop.addEventListener('click', stopRecording);

    const voiceRetry = document.getElementById('voiceRetryBtn');
    if (voiceRetry) voiceRetry.addEventListener('click', retryRecording);

    const voiceSubmit = document.getElementById('voiceSubmitBtn');
    if (voiceSubmit) voiceSubmit.addEventListener('click', handleVoiceSubmit);

    const voiceCancel = document.getElementById('voiceCancelBtn');
    if (voiceCancel) voiceCancel.addEventListener('click', closeVoiceModal);

    const voiceBackdrop = document.getElementById('voiceBackdrop');
    if (voiceBackdrop) voiceBackdrop.addEventListener('click', (e) => {
      if (e.target === voiceBackdrop) closeVoiceModal();
    });

    // ── Paste anywhere (Ctrl+V) ──
    document.addEventListener('paste', handlePaste);

    // ── Admin button ──
    const adminBtn = document.getElementById('adminToggle');
    if (adminBtn) adminBtn.addEventListener('click', openAdmin);
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

    const ok = await DB.publishDirect(item);
    btn.disabled = false;
    btn.textContent = '\u{1F499} שלחו';

    if (ok) {
      if (selectedFile && selectedFile._hash) uploadedHashes.add(selectedFile._hash);
      closeQuickName();
      showToast('תודה! הזיכרון פורסם \u{1F499}');
      Wall.loadMemories();
    } else {
      showToast('שגיאה בשליחה');
    }
  }

  // ═══ PASTE (Ctrl+V anywhere) ═══

  async function handlePaste(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (!validateFile(file)) return;
          const ext = item.type.split('/')[1] || 'png';
          selectedFile = new File([file], 'pasted.' + ext, { type: file.type });
          const hash = await fileHash(selectedFile);
          if (uploadedHashes.has(hash)) {
            showToast('הקובץ הזה כבר הועלה לאתר');
            return;
          }
          selectedFile._hash = hash;
          openQuickName();
        }
        return;
      }
    }
  }

  // ═══ VOICE RECORDING ═══

  function openVoiceModal() {
    resetVoiceState();
    document.getElementById('voiceBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeVoiceModal() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    clearInterval(recordingTimer);
    document.getElementById('voiceBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    resetVoiceState();
  }

  function resetVoiceState() {
    mediaRecorder = null;
    audioChunks = [];
    recordedBlob = null;
    recordingSeconds = 0;
    clearInterval(recordingTimer);

    const startBtn = document.getElementById('voiceStartBtn');
    const recState = document.getElementById('voiceRecordingState');
    const preview = document.getElementById('voicePreview');
    const nameInput = document.getElementById('voiceName');

    if (startBtn) startBtn.style.display = '';
    if (recState) recState.style.display = 'none';
    if (preview) preview.style.display = 'none';
    if (nameInput) nameInput.value = '';
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });

        const playback = document.getElementById('voicePlayback');
        if (playback) {
          playback.src = URL.createObjectURL(recordedBlob);
        }

        document.getElementById('voiceRecordingState').style.display = 'none';
        document.getElementById('voicePreview').style.display = 'block';
        clearInterval(recordingTimer);
      };

      mediaRecorder.start();

      // UI: show recording state
      document.getElementById('voiceStartBtn').style.display = 'none';
      document.getElementById('voiceRecordingState').style.display = '';
      document.getElementById('voicePreview').style.display = 'none';

      // Timer
      recordingSeconds = 0;
      updateTimerDisplay();
      recordingTimer = setInterval(() => {
        recordingSeconds++;
        updateTimerDisplay();
        // Auto-stop at 5 minutes
        if (recordingSeconds >= 300) stopRecording();
      }, 1000);

    } catch (err) {
      showToast('לא ניתן לגשת למיקרופון. אנא אשרו גישה.');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }

  function retryRecording() {
    recordedBlob = null;
    document.getElementById('voicePreview').style.display = 'none';
    document.getElementById('voiceStartBtn').style.display = '';
  }

  function updateTimerDisplay() {
    const el = document.getElementById('voiceTimer');
    if (!el) return;
    const m = Math.floor(recordingSeconds / 60);
    const s = recordingSeconds % 60;
    el.textContent = m + ':' + String(s).padStart(2, '0');
  }

  async function handleVoiceSubmit() {
    const name = document.getElementById('voiceName').value.trim();
    if (!name) { showToast('נא לכתוב את שמכם'); return; }
    if (!recordedBlob) { showToast('לא הוקלטה הודעה'); return; }

    const btn = document.getElementById('voiceSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'מעלה...';

    const file = new File([recordedBlob], 'voice_' + Date.now() + '.webm', { type: 'audio/webm' });
    const mediaUrl = await DB.uploadMedia(file);

    if (!mediaUrl) {
      showToast('שגיאה בהעלאה, נסו שנית');
      btn.disabled = false;
      btn.textContent = '\u{1F499} שלחו';
      return;
    }

    const item = {
      type: 'audio',
      author: name,
      text: null,
      media_url: mediaUrl,
      video_url: null,
      link_data: null,
    };

    const ok = await DB.publishDirect(item);
    btn.disabled = false;
    btn.textContent = '\u{1F499} שלחו';

    if (ok) {
      closeVoiceModal();
      showToast('תודה! ההקלטה פורסמה \u{1F499}');
      Wall.loadMemories();
      updateAdminDot();
    } else {
      showToast('שגיאה בשליחה');
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

    const ok = await DB.publishDirect(item);
    btn.disabled = false;
    btn.textContent = '\u{1F499} שלחו';

    if (ok) {
      closeStoryModal();
      showToast('תודה! הזיכרון פורסם \u{1F499}');
      Wall.loadMemories();
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
