'use strict';

// ═══════════════════════════════════════════
// Submit — Upload flow
// Supports multiple files at once
// Also: story/link modal, voice recording, paste
// ═══════════════════════════════════════════

const Submit = (() => {
  let selectedFiles = []; // array of files

  // Voice recording state
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingTimer = null;
  let recordingSeconds = 0;
  let recordedBlob = null;

  const MAX_FILE_MB = 50;
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

  // Track uploaded file names+sizes to detect duplicates (lightweight, no hash)
  let uploadedFingerprints = new Set();

  function fileFP(file) {
    return file.name + '|' + file.size + '|' + file.lastModified;
  }

  function validateFile(file) {
    if (file.size > MAX_FILE_BYTES) {
      showToast(`הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)}MB). מקסימום ${MAX_FILE_MB}MB`);
      return false;
    }
    return true;
  }

  function init() {
    bindEvents();
  }

  // Detect audio even when MIME type is missing/wrong (WhatsApp .opus files)
  function isAudioFile(f) {
    if (f.type && f.type.startsWith('audio/')) return true;
    return /\.(opus|m4a|ogg|mp3|aac|wav|3gp|amr)$/i.test(f.name);
  }

  function isVideoFile(f) {
    if (f.type && f.type.startsWith('video/')) return true;
    return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(f.name);
  }

  function handleFileSelection(e, inputEl) {
    if (!e.target.files.length) return;
    const files = Array.from(e.target.files);

    const valid = [];
    let skippedSize = 0;
    let skippedDup = 0;
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) { skippedSize++; continue; }
      if (uploadedFingerprints.has(fileFP(f))) { skippedDup++; continue; }
      valid.push(f);
    }
    if (skippedSize) showToast(`${skippedSize} קבצים גדולים מדי (מקס׳ ${MAX_FILE_MB}MB)`);
    if (skippedDup) showToast(`${skippedDup} קבצים כבר הועלו`);
    if (!valid.length) { inputEl.value = ''; return; }

    selectedFiles = valid;
    openQuickName();
  }

  function bindEvents() {
    // ── Quick file upload (big button) — supports multiple ──
    const quickInput = document.getElementById('quickFileInput');
    if (quickInput) {
      quickInput.addEventListener('change', (e) => handleFileSelection(e, quickInput));
    }

    // ── Voice file upload (for WhatsApp voice messages / existing audio) ──
    const voiceInput = document.getElementById('voiceFileInput');
    if (voiceInput) {
      voiceInput.addEventListener('change', (e) => handleFileSelection(e, voiceInput));
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

  // ═══ QUICK UPLOAD FLOW (supports multiple files) ═══

  function openQuickName() {
    const preview = document.getElementById('quickPreview');
    if (preview && selectedFiles.length) {
      if (selectedFiles.length === 1) {
        const f = selectedFiles[0];
        const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
        const isImage = f.type && f.type.startsWith('image/');
        const isVideo = isVideoFile(f);
        const isAudio = isAudioFile(f);
        const typeLabel = isImage ? 'תמונה' : isVideo ? 'סרטון' : isAudio ? 'הקלטה' : 'קובץ';
        let thumbHtml = '';
        if (isImage) {
          thumbHtml = `<img src="${URL.createObjectURL(f)}" alt="preview" style="max-height:120px;border-radius:8px;object-fit:cover">`;
        } else if (isVideo) {
          thumbHtml = `<video src="${URL.createObjectURL(f)}" muted style="max-height:120px;border-radius:8px"></video>`;
        } else if (isAudio) {
          thumbHtml = `<div style="display:flex;flex-direction:column;align-items:center;gap:0.4rem">
            <span style="font-size:2.5rem">\u{1F399}\uFE0F</span>
            <audio controls src="${URL.createObjectURL(f)}" style="width:220px;height:36px"></audio>
          </div>`;
        } else {
          thumbHtml = `<span style="font-size:2rem">\u{1F4CE}</span>`;
        }
        preview.innerHTML = `<div style="display:flex;align-items:center;gap:0.8rem">
          ${thumbHtml}
          <div>
            <div style="font-size:0.85rem;color:var(--text)">${Wall.esc(f.name)}</div>
            <div style="font-size:0.75rem;color:var(--muted)">${sizeMB} MB &middot; ${typeLabel}</div>
          </div>
        </div>`;
      } else {
        // Multiple files — show grid of thumbnails
        const thumbs = selectedFiles.slice(0, 12).map(f => {
          if (f.type.startsWith('image/')) {
            return `<img src="${URL.createObjectURL(f)}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:6px">`;
          } else if (f.type.startsWith('video/')) {
            return `<div style="width:60px;height:60px;background:var(--surface2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.5rem">\u{1F3AC}</div>`;
          }
          return `<div style="width:60px;height:60px;background:var(--surface2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.5rem">\u{1F4CE}</div>`;
        }).join('');
        const extra = selectedFiles.length > 12 ? `<div style="font-size:0.8rem;color:var(--muted)">+${selectedFiles.length - 12} נוספים</div>` : '';
        preview.innerHTML = `<div>
          <div style="font-size:0.9rem;font-weight:600;color:var(--gold-light);margin-bottom:0.5rem">${selectedFiles.length} קבצים נבחרו</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">${thumbs}</div>
          ${extra}
        </div>`;
      }
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
    selectedFiles = [];
    document.getElementById('quickName').value = '';
    document.getElementById('quickCaption').value = '';
    const progress = document.getElementById('uploadProgress');
    if (progress) progress.style.display = 'none';
    const quickInput = document.getElementById('quickFileInput');
    if (quickInput) quickInput.value = '';
  }

  async function handleQuickSubmit() {
    const caption = document.getElementById('quickCaption').value.trim();
    const name = document.getElementById('quickName').value.trim() || 'אנונימי';
    if (!caption) { showToast('נא לכתוב כותרת או כמה מילים'); return; }
    if (!selectedFiles.length) { showToast('לא נבחרו קבצים'); return; }
    const btn = document.getElementById('quickSubmitBtn');
    const progressEl = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');

    btn.disabled = true;
    if (progressEl) progressEl.style.display = 'block';

    const total = selectedFiles.length;
    let uploaded = 0;
    let failed = 0;

    for (const file of selectedFiles) {
      if (progressText) progressText.textContent = `מעלה ${uploaded + 1} מתוך ${total}...`;
      if (progressBar) progressBar.style.width = ((uploaded / total) * 100) + '%';

      try {
        const mediaUrl = await DB.uploadMedia(file);
        if (!mediaUrl) { failed++; continue; }

        const isVideo = isVideoFile(file);
        const isAudio = isAudioFile(file);
        const type = isVideo ? 'video' : isAudio ? 'audio' : 'photo';
        const item = {
          type,
          author: name,
          text: caption || null,
          media_url: isVideo ? null : mediaUrl,
          video_url: isVideo ? mediaUrl : null,
          link_data: null,
        };

        const ok = await DB.publishDirect(item);
        if (ok) {
          uploadedFingerprints.add(fileFP(file));
          uploaded++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error('Upload error:', err);
        failed++;
      }

      if (progressBar) progressBar.style.width = ((uploaded / total) * 100) + '%';
    }

    btn.disabled = false;
    btn.textContent = 'שלחו';

    if (uploaded > 0) {
      closeQuickName();
      const msg = total === 1
        ? 'תודה! הזיכרון פורסם \u{1F499}'
        : `${uploaded} זיכרונות פורסמו!${failed ? ' (' + failed + ' נכשלו)' : ''} \u{1F499}`;
      showToast(msg);
      Wall.loadMemories();
    } else {
      showToast('שגיאה בהעלאה, נסו שנית');
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
          if (!validateFile(file)) return;
          const ext = item.type.split('/')[1] || 'png';
          const pasted = new File([file], 'pasted.' + ext, { type: file.type });
          if (uploadedFingerprints.has(fileFP(pasted))) {
            showToast('הקובץ הזה כבר הועלה לאתר');
            return;
          }
          selectedFiles = [pasted];
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

      document.getElementById('voiceStartBtn').style.display = 'none';
      document.getElementById('voiceRecordingState').style.display = '';
      document.getElementById('voicePreview').style.display = 'none';

      recordingSeconds = 0;
      updateTimerDisplay();
      recordingTimer = setInterval(() => {
        recordingSeconds++;
        updateTimerDisplay();
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
    localStorage.setItem('asaf_admin', 'true');
    showToast('מצב מנהל הופעל — ניתן למחוק זיכרונות');
    Wall.loadMemories();
  }

  return { init, open: openStoryModal, close: closeStoryModal };
})();

document.addEventListener('DOMContentLoaded', () => Submit.init());
