'use strict';

// ═══════════════════════════════════════════
// Supabase Client & DB Operations
// Falls back to localStorage when Supabase is not configured
// ═══════════════════════════════════════════

const DB = (() => {
  let supabase = null;

  // ── Init ──
  function init() {
    if (CONFIG.isConfigured && window.supabase) {
      supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON);
    }
  }

  // ── Local Storage Helpers ──
  function localGet(key, def) {
    try { return JSON.parse(localStorage.getItem('asaf_' + key)) || def; }
    catch { return def; }
  }
  function localSet(key, val) {
    try { localStorage.setItem('asaf_' + key, JSON.stringify(val)); }
    catch (e) { console.warn('localStorage error:', e); }
  }

  // ── Fingerprint (simple browser ID for like dedup) ──
  function getFingerprint() {
    let fp = localStorage.getItem('asaf_fp');
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('asaf_fp', fp);
    }
    return fp;
  }

  // ═══ MEMORIES ═══

  async function fetchMemories() {
    if (supabase) {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('pinned', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) { console.error('fetchMemories error:', error); return SEED_DATA; }
      return data.length > 0 ? data : SEED_DATA;
    }
    // Local fallback
    const approved = localGet('approved', []);
    return [...SEED_DATA, ...approved];
  }

  // ═══ PUBLISH DIRECT (no approval) ═══

  async function publishDirect(item) {
    if (supabase) {
      const { error } = await supabase.from('memories').insert([{
        type: item.type,
        author: item.author,
        text: item.text || null,
        media_url: item.media_url || null,
        video_url: item.video_url || null,
        link_data: item.link_data || null,
        size_hint: item.size_hint || null,
      }]);
      if (error) { console.error('publishDirect error:', error); return false; }
      return true;
    }
    // Local fallback
    const approved = localGet('approved', []);
    approved.push({ ...item, id: 'direct-' + Date.now(), created_at: new Date().toISOString() });
    localSet('approved', approved);
    return true;
  }

  // ═══ PENDING (submissions) ═══

  async function submitPending(item) {
    if (supabase) {
      const { error } = await supabase.from('pending').insert([{
        type: item.type,
        author: item.author,
        text: item.text || null,
        media_url: item.media_url || null,
        video_url: item.video_url || null,
        link_data: item.link_data || null,
      }]);
      if (error) { console.error('submitPending error:', error); return false; }
      return true;
    }
    // Local fallback
    const pending = localGet('pending', []);
    pending.push({
      ...item,
      id: 'user-' + Date.now(),
      submitted_at: new Date().toISOString(),
      status: 'pending'
    });
    localSet('pending', pending);
    return true;
  }

  async function fetchPending() {
    if (supabase) {
      const { data, error } = await supabase
        .from('pending')
        .select('*')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });
      if (error) { console.error('fetchPending error:', error); return []; }
      return data;
    }
    return localGet('pending', []);
  }

  async function approvePending(id, sizeHint) {
    if (supabase) {
      // Get the pending item
      const { data: item, error: fetchErr } = await supabase
        .from('pending').select('*').eq('id', id).single();
      if (fetchErr) { console.error('approve fetch error:', fetchErr); return false; }

      // Insert into memories
      const { error: insertErr } = await supabase.from('memories').insert([{
        type: item.type,
        author: item.author,
        text: item.text,
        media_url: item.media_url,
        video_url: item.video_url,
        link_data: item.link_data,
        size_hint: sizeHint || null,
      }]);
      if (insertErr) { console.error('approve insert error:', insertErr); return false; }

      // Mark as approved
      await supabase.from('pending').update({ status: 'approved' }).eq('id', id);
      return true;
    }
    // Local fallback
    const pending = localGet('pending', []);
    const idx = pending.findIndex(p => p.id === id);
    if (idx === -1) return false;
    const item = pending.splice(idx, 1)[0];
    if (sizeHint) item.size_hint = sizeHint;
    const approved = localGet('approved', []);
    approved.push(item);
    localSet('pending', pending);
    localSet('approved', approved);
    return true;
  }

  async function rejectPending(id) {
    if (supabase) {
      const { error } = await supabase.from('pending')
        .update({ status: 'rejected' }).eq('id', id);
      if (error) { console.error('reject error:', error); return false; }
      return true;
    }
    const pending = localGet('pending', []);
    const idx = pending.findIndex(p => p.id === id);
    if (idx === -1) return false;
    pending.splice(idx, 1);
    localSet('pending', pending);
    return true;
  }

  // ═══ COMMENTS ═══

  async function fetchComments(memoryId) {
    if (supabase) {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('memory_id', memoryId)
        .order('created_at', { ascending: true });
      if (error) { console.error('fetchComments error:', error); return []; }
      return data;
    }
    const all = localGet('comments', {});
    return all[memoryId] || [];
  }

  async function addComment(memoryId, author, text) {
    if (supabase) {
      const { error } = await supabase.from('comments').insert([{
        memory_id: memoryId,
        author,
        text
      }]);
      if (error) { console.error('addComment error:', error); return false; }
      return true;
    }
    const all = localGet('comments', {});
    if (!all[memoryId]) all[memoryId] = [];
    all[memoryId].push({
      id: 'c-' + Date.now(),
      author,
      text,
      created_at: new Date().toISOString()
    });
    localSet('comments', all);
    return true;
  }

  // ═══ LIKES ═══

  async function getLikeCount(memoryId) {
    if (supabase) {
      const { count, error } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('memory_id', memoryId);
      if (error) return 0;
      return count || 0;
    }
    const all = localGet('likes', {});
    return all[memoryId] || 0;
  }

  async function isLikedByMe(memoryId) {
    const fp = getFingerprint();
    if (supabase) {
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('memory_id', memoryId)
        .eq('fingerprint', fp)
        .maybeSingle();
      return !!data;
    }
    return !!localGet('liked_' + memoryId, false);
  }

  async function toggleLike(memoryId) {
    const fp = getFingerprint();
    const liked = await isLikedByMe(memoryId);

    if (supabase) {
      if (liked) {
        await supabase.from('likes').delete()
          .eq('memory_id', memoryId).eq('fingerprint', fp);
      } else {
        await supabase.from('likes').insert([{
          memory_id: memoryId,
          fingerprint: fp
        }]);
      }
      return !liked;
    }
    // Local fallback
    const all = localGet('likes', {});
    if (liked) {
      all[memoryId] = Math.max(0, (all[memoryId] || 1) - 1);
      localSet('liked_' + memoryId, false);
    } else {
      all[memoryId] = (all[memoryId] || 0) + 1;
      localSet('liked_' + memoryId, true);
    }
    localSet('likes', all);
    return !liked;
  }

  // ═══ BULK LIKES (for initial load) ═══

  async function fetchAllLikes(memoryIds) {
    if (supabase) {
      const { data, error } = await supabase
        .from('likes')
        .select('memory_id, fingerprint')
        .in('memory_id', memoryIds);
      if (error) return {};
      const counts = {};
      const fp = getFingerprint();
      const myLikes = {};
      data.forEach(row => {
        counts[row.memory_id] = (counts[row.memory_id] || 0) + 1;
        if (row.fingerprint === fp) myLikes[row.memory_id] = true;
      });
      return { counts, myLikes };
    }
    const allLikes = localGet('likes', {});
    const myLikes = {};
    memoryIds.forEach(id => {
      if (localGet('liked_' + id, false)) myLikes[id] = true;
    });
    return { counts: allLikes, myLikes };
  }

  // ═══ UPLOAD MEDIA ═══

  async function uploadMedia(file) {
    if (supabase) {
      const ext = file.name.split('.').pop();
      const fileName = Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
      const { data, error } = await supabase.storage
        .from('media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) { console.error('upload error:', error); return null; }
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
      return urlData.publicUrl;
    }
    // Local fallback — convert to data URL (not for production)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  // ═══ DELETE MEMORY (admin) ═══

  async function deleteMemory(id) {
    if (supabase) {
      const { error } = await supabase.from('memories').delete().eq('id', id);
      if (error) { console.error('delete error:', error); return false; }
      return true;
    }
    const approved = localGet('approved', []);
    const idx = approved.findIndex(a => a.id === id);
    if (idx !== -1) {
      approved.splice(idx, 1);
      localSet('approved', approved);
    }
    return true;
  }

  // ── Public API ──
  return {
    init,
    fetchMemories,
    publishDirect,
    submitPending,
    fetchPending,
    approvePending,
    rejectPending,
    fetchComments,
    addComment,
    getLikeCount,
    isLikedByMe,
    toggleLike,
    fetchAllLikes,
    uploadMedia,
    deleteMemory
  };
})();
