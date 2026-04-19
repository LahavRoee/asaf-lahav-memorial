'use strict';

// ═══════════════════════════════════════════
// Wall — Render tiles, lightbox, filters
// ═══════════════════════════════════════════

const Wall = (() => {
  let allMemories = [];
  let currentFilter = 'all';
  let likeCounts = {};
  let myLikes = {};

  // ── Type metadata ──
  const TYPE_META = {
    story:  { emoji: '\u{1F499}', name: 'זיכרון' },
    photo:  { emoji: '\u{1F4F8}', name: 'תמונה' },
    video:  { emoji: '\u{1F3AC}', name: 'וידאו' },
    audio:  { emoji: '\u{1F399}\uFE0F', name: 'הקלטה' },
    social: { emoji: '\u{1F517}', name: 'קישור' },
  };

  // ── Init ──
  async function init() {
    DB.init();
    initStars();
    initBirthdayCountdown();
    bindEvents();
    await loadMemories();
  }

  // ── Stars background ──
  function initStars() {
    const container = document.getElementById('stars');
    if (!container) return;
    for (let i = 0; i < 80; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      const sz = Math.random() * 2 + 1;
      star.style.cssText = `
        width:${sz}px;height:${sz}px;
        top:${Math.random() * 100}%;left:${Math.random() * 100}%;
        --dur:${2 + Math.random() * 4}s;
        --delay:-${Math.random() * 5}s;
        --max:${0.3 + Math.random() * 0.5};
      `;
      container.appendChild(star);
    }
  }

  // ── Birthday countdown ──
  function initBirthdayCountdown() {
    const el = document.getElementById('birthdayCountdown');
    if (!el) return;

    const today = new Date();
    const year = today.getFullYear();
    let birthday = new Date(year, 4, 19); // May 19 (month is 0-indexed)

    // If birthday already passed this year, count to next year
    if (today > birthday) {
      birthday = new Date(year + 1, 4, 19);
    }

    const diffMs = birthday - today;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (days === 0) {
      el.textContent = 'היום יום ההולדת של אסי \u2764';
    } else {
      el.innerHTML = `<span class="countdown-days">${days}</span> ימים ליום ההולדת של אסי`;
    }
  }

  // ── Event bindings ──
  function bindEvents() {
    // Tabs
    document.getElementById('tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderGrid();
    });

    // Scroll down arrow
    const scrollBtn = document.getElementById('scrollDown');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', () => {
        document.getElementById('main').scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Lightbox close
    const lbClose = document.getElementById('lightboxClose');
    const lb = document.getElementById('lightbox');
    if (lbClose) lbClose.addEventListener('click', closeLightbox);
    if (lb) lb.addEventListener('click', (e) => {
      if (e.target === lb) closeLightbox();
    });

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
        Submit.close();
      }
    });

    // Grid click delegation
    document.getElementById('mainGrid').addEventListener('click', (e) => {
      const tile = e.target.closest('.tile');
      if (!tile) return;
      const id = tile.dataset.id;
      if (id) openLightbox(id);
    });
  }

  // ── Load memories ──
  async function loadMemories() {
    allMemories = await DB.fetchMemories();

    // Fetch likes in bulk
    const ids = allMemories.map(m => m.id);
    const likeData = await DB.fetchAllLikes(ids);
    likeCounts = likeData.counts || {};
    myLikes = likeData.myLikes || {};

    renderGrid();
  }

  // ── Render grid ──
  function renderGrid() {
    const grid = document.getElementById('mainGrid');
    const countEl = document.getElementById('tileCount');

    const filtered = currentFilter === 'all'
      ? allMemories
      : allMemories.filter(m => m.type === currentFilter);

    if (countEl) {
      countEl.textContent = `${filtered.length} זיכרונות`;
    }

    if (!filtered.length) {
      grid.innerHTML = '<div class="loading">אין זיכרונות בקטגוריה זו עדיין.<br>היו הראשונים לשתף! \u{1F499}</div>';
      return;
    }

    grid.innerHTML = filtered.map((m, i) => buildTile(m, i)).join('');
  }

  // ── Build tile (tiny square) ──
  function buildTile(memory, index) {
    const m = memory;
    const meta = TYPE_META[m.type] || { emoji: '\u{1F499}', name: m.type };
    const delay = Math.min(index * 0.03, 1.5);
    const sz = getSizeClass(m);
    const likeCount = likeCounts[m.id] || 0;
    const preview = m.text ? truncate(m.text, 30) : '';
    const hoverPreview = m.text ? truncate(m.text, 80) : '';

    // Photo tile — show thumbnail
    if (m.type === 'photo' && m.media_url) {
      return `<div class="tile ${sz}" data-id="${esc(m.id)}" data-type="${m.type}" style="animation-delay:${delay}s" role="button" tabindex="0">
        <img class="tile-thumb" src="${esc(m.media_url)}" alt="${esc(m.text || '')}" loading="lazy" onerror="this.style.display='none'">
        <div class="tile-hover-info">
          <span class="tile-label">${esc(m.author)}</span>
          ${m.text ? `<span class="tile-sub">${esc(truncate(m.text, 60))}</span>` : ''}
        </div>
        ${likeCount ? `<span class="tile-likes">\u2764 ${likeCount}</span>` : ''}
      </div>`;
    }

    // Video tile — show uploaded video preview (muted, no controls)
    if (m.type === 'video' && m.video_url && isUploadedVideo(m.video_url)) {
      return `<div class="tile ${sz} tile-video" data-id="${esc(m.id)}" data-type="${m.type}" style="animation-delay:${delay}s" role="button" tabindex="0">
        <video class="tile-thumb" src="${esc(m.video_url)}#t=0.5" muted playsinline preload="metadata" loading="lazy" onerror="this.style.display='none'"></video>
        <span class="tile-play-icon">\u25B6</span>
        <div class="tile-hover-info">
          <span class="tile-label">${esc(m.author)}</span>
          ${m.text ? `<span class="tile-sub">${esc(truncate(m.text, 60))}</span>` : ''}
        </div>
        ${likeCount ? `<span class="tile-likes">\u2764 ${likeCount}</span>` : ''}
      </div>`;
    }

    // All other tiles — icon + label, hover reveals more
    const firstLink = m.link_data && m.link_data[0];
    let icon = meta.emoji;
    if (m.type === 'social' && firstLink) {
      icon = firstLink.icon === 'ig' ? '\u{1F4F7}' : '\u{1F4D8}';
    }

    return `<div class="tile ${sz}" data-id="${esc(m.id)}" data-type="${m.type}" style="animation-delay:${delay}s" role="button" tabindex="0">
      <span class="tile-icon">${icon}</span>
      <span class="tile-label">${esc(m.author)}</span>
      <div class="tile-hover-info">
        <span class="tile-label">${esc(m.author)}</span>
        <span class="tile-sub">${esc(hoverPreview || (firstLink ? firstLink.label : meta.name))}</span>
      </div>
      ${likeCount ? `<span class="tile-likes">\u2764 ${likeCount}</span>` : ''}
    </div>`;
  }

  function getSizeClass(m) {
    if (m.size_hint === 'large') return 'sz-lg';
    if (m.size_hint === 'wide') return 'sz-w';
    if (m.size_hint === 'tall') return 'sz-t';
    if (m.type === 'photo' && m.pinned) return 'sz-lg';
    return '';
  }

  // ── Lightbox ──
  async function openLightbox(id) {
    const memory = allMemories.find(m => m.id === id);
    if (!memory) return;

    const lb = document.getElementById('lightbox');
    const content = document.getElementById('lightboxContent');
    const meta = TYPE_META[memory.type] || { emoji: '\u{1F499}', name: memory.type };
    const likeCount = likeCounts[id] || 0;
    const isLiked = myLikes[id] || false;

    // Load comments
    const comments = await DB.fetchComments(id);

    let mediaHtml = '';
    if (memory.type === 'photo' && memory.media_url) {
      mediaHtml = `<div class="lb-media"><img src="${esc(memory.media_url)}" alt="${esc(memory.text || 'תמונה')}" loading="lazy"></div>`;
    } else if (memory.type === 'video' && memory.video_url) {
      const ytId = extractYT(memory.video_url);
      if (ytId) {
        mediaHtml = `<iframe class="lb-yt-frame" src="https://www.youtube.com/embed/${ytId}" allowfullscreen loading="lazy"></iframe>`;
      } else if (isUploadedVideo(memory.video_url)) {
        mediaHtml = `<div class="lb-media"><video src="${esc(memory.video_url)}" controls playsinline style="width:100%;max-height:70vh;border-radius:8px;background:#000"></video></div>`;
      }
    } else if (memory.type === 'audio' && memory.media_url) {
      mediaHtml = `<div style="padding:1rem"><audio controls style="width:100%" src="${esc(memory.media_url)}"></audio></div>`;
    }

    let linksHtml = '';
    if (memory.type === 'social' && memory.link_data) {
      linksHtml = memory.link_data.map(l => {
        const cls = l.icon === 'fb' ? 'fb' : l.icon === 'ig' ? 'ig' : '';
        const icon = l.icon === 'fb' ? '\u{1F4D8}' : l.icon === 'ig' ? '\u{1F4F7}' : '\u{1F517}';
        return `<a class="lb-social-link ${cls}" href="${esc(l.url)}" target="_blank" rel="noopener">
          <span class="lb-social-icon">${icon}</span>
          <span class="lb-social-text"><strong>${esc(l.label)}</strong>${esc(l.sub || '')}</span>
        </a>`;
      }).join('');
    }

    const commentsHtml = comments.map(c =>
      `<div class="comment-item"><strong>${esc(c.author)}: </strong>${esc(c.text)}</div>`
    ).join('');

    content.innerHTML = `<div class="lb-card">
      ${mediaHtml}
      ${linksHtml}
      <div class="lb-body">
        <span class="lb-type-badge">${meta.emoji} ${meta.name}</span>
        <div class="lb-top">
          <span class="lb-author">${esc(memory.author || 'אנונימי')}</span>
          <span class="lb-date">${esc(memory.date_label || '')}</span>
        </div>
        ${memory.text ? `<p class="lb-text">${esc(memory.text)}</p>` : ''}
        <div class="lb-footer">
          <button class="icon-btn like-btn ${isLiked ? 'liked' : ''}" data-id="${esc(id)}">
            \u2764\uFE0F <span class="like-count">${likeCount || ''}</span>
          </button>
          <button class="icon-btn comment-toggle-btn" data-id="${esc(id)}">
            \u{1F4AC} ${comments.length ? comments.length + ' תגובות' : 'הוסיפו תגובה'}
          </button>
          ${isAdmin() ? `<button class="lb-delete-btn" data-id="${esc(id)}">\u{1F5D1} מחק</button>` : ''}
        </div>
      </div>
      <div class="lb-comments" id="lb-comments-${esc(id)}">
        ${commentsHtml}
        <div class="add-comment">
          <input type="text" placeholder="שמכם" id="lb-cname-${esc(id)}" style="width:90px;flex:0 0 90px"/>
          <input type="text" placeholder="כתבו משהו..." id="lb-ctxt-${esc(id)}"/>
          <button class="lb-comment-submit" data-id="${esc(id)}">שלח</button>
        </div>
      </div>
    </div>`;

    // Bind lightbox interactions
    const likeBtn = content.querySelector('.like-btn');
    if (likeBtn) likeBtn.addEventListener('click', () => handleLike(id, likeBtn));

    const commentBtn = content.querySelector('.comment-toggle-btn');
    const commentsSection = content.querySelector('.lb-comments');
    if (commentBtn && commentsSection) {
      // Always show comments in lightbox
      commentsSection.style.display = 'block';
    }

    const commentSubmit = content.querySelector('.lb-comment-submit');
    if (commentSubmit) {
      commentSubmit.addEventListener('click', () => handleComment(id));
    }

    // Enter key submits comment
    const commentInput = document.getElementById('lb-ctxt-' + id);
    if (commentInput) {
      commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleComment(id);
      });
    }

    // Admin delete
    const deleteBtn = content.querySelector('.lb-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => handleDelete(id));
    }

    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    const lb = document.getElementById('lightbox');
    lb.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Like handler ──
  async function handleLike(id, btn) {
    const nowLiked = await DB.toggleLike(id);
    myLikes[id] = nowLiked;
    likeCounts[id] = (likeCounts[id] || 0) + (nowLiked ? 1 : -1);
    if (likeCounts[id] < 0) likeCounts[id] = 0;

    btn.classList.toggle('liked', nowLiked);
    const countEl = btn.querySelector('.like-count');
    if (countEl) countEl.textContent = likeCounts[id] || '';

    // Update tile likes too
    const tile = document.querySelector(`.tile[data-id="${id}"] .tile-likes`);
    if (tile) tile.textContent = likeCounts[id] ? '\u2764 ' + likeCounts[id] : '';
  }

  // ── Comment handler ──
  async function handleComment(id) {
    const nameEl = document.getElementById('lb-cname-' + id);
    const textEl = document.getElementById('lb-ctxt-' + id);
    if (!nameEl || !textEl) return;

    const name = nameEl.value.trim();
    const text = textEl.value.trim();
    if (!name || !text) { showToast('נא למלא שם ותגובה'); return; }

    const ok = await DB.addComment(id, name, text);
    if (ok) {
      nameEl.value = '';
      textEl.value = '';
      // Re-render lightbox
      openLightbox(id);
      showToast('תגובה נוספה! \u{1F499}');
    }
  }

  // ── Admin ──
  function isAdmin() {
    return localStorage.getItem('asaf_admin') === 'true';
  }

  async function handleDelete(id) {
    if (!isAdmin()) return;
    if (!confirm('למחוק את הזיכרון הזה?')) return;
    const ok = await DB.deleteMemory(id);
    if (ok) {
      closeLightbox();
      showToast('הזיכרון נמחק');
      loadMemories();
    } else {
      showToast('שגיאה במחיקה');
    }
  }

  // ── Utilities ──
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function truncate(str, len) {
    if (!str || str.length <= len) return str;
    return str.slice(0, len) + '...';
  }

  function extractYT(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // Detect uploaded video files (Supabase Storage or direct file URLs)
  function isUploadedVideo(url) {
    if (!url) return false;
    return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url) ||
           url.includes('supabase.co/storage/') ||
           url.includes('/storage/v1/object/');
  }

  // ── Public ──
  return {
    init,
    loadMemories,
    renderGrid,
    esc,
    showToast
  };
})();

// ── Toast (global) ──
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Start ──
document.addEventListener('DOMContentLoaded', () => Wall.init());
