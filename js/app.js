/* ==========================================================================
   CPA 考点速记卡 —— 交互逻辑
   ========================================================================== */
(function () {
  'use strict';

  const LS_THEME = 'cpa_theme';
  const LS_PROGRESS = 'cpa_progress_v1'; // { subjectId: { chapterId: { cardIdx: 'mastered'|'review' } } }

  const state = {
    subjectId: null,
    chapterIdx: 0,
    cardIdx: 0,
    flipped: false,
    shuffled: false,       // 当前章节卡片顺序是否已打乱
    order: [],             // 打乱后的卡片下标顺序
    filter: 'all',         // 'all' | 'key' | 'unmastered'
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ---------- 工具 ----------
  function progressStore() {
    try { return JSON.parse(localStorage.getItem(LS_PROGRESS)) || {}; }
    catch (e) { return {}; }
  }
  function saveProgress(p) { localStorage.setItem(LS_PROGRESS, JSON.stringify(p)); }

  function getSubject() { return window.CPA.SUBJECTS.find(s => s.id === state.subjectId); }
  function getChapters() { return (window.CPA.chapters[state.subjectId]) || []; }
  function getChapter() { return getChapters()[state.chapterIdx]; }

  function cardStatus(subjectId, chapterId, idx) {
    const p = progressStore();
    return (p[subjectId] && p[subjectId][chapterId] && p[subjectId][chapterId][idx]) || null;
  }
  function setCardStatus(status) {
    const subj = getSubject(), ch = getChapter();
    const p = progressStore();
    p[subj.id] = p[subj.id] || {};
    p[subj.id][ch.id] = p[subj.id][ch.id] || {};
    p[subj.id][ch.id][state.cardIdx] = status;
    saveProgress(p);
    renderChapterProgress();
    updateNav();
  }

  function visibleOrder() {
    const ch = getChapter();
    if (!ch) return [];
    const n = ch.cards.length;
    let idxs = state.order.length === n ? state.order : Array.from({ length: n }, (_, i) => i);
    if (state.filter === 'key') {
      idxs = idxs.filter(i => (ch.cards[i].star || 3) >= 4);
    } else if (state.filter === 'unmastered') {
      idxs = idxs.filter(i => cardStatus(state.subjectId, ch.id, i) !== 'mastered');
    }
    return idxs;
  }

  // ---------- 渲染：科目标签 ----------
  function renderSubjectTabs() {
    const host = $('#subject-tabs');
    host.innerHTML = '';
    window.CPA.SUBJECTS.forEach(sub => {
      const btn = document.createElement('button');
      btn.className = 'subject-tab' + (sub.status === 'todo' ? ' todo' : '') + (sub.id === state.subjectId ? ' active' : '');
      btn.style.setProperty('--sc', sub.color);
      const ready = window.CPA.chapters[sub.id] && window.CPA.chapters[sub.id].length;
      btn.innerHTML =
        `<span class="s-dot"></span>${sub.name}` +
        (sub.status === 'todo' ? `<span class="badge">待整理</span>` : `<span class="badge">${ready}章</span>`);
      btn.addEventListener('click', () => selectSubject(sub.id));
      host.appendChild(btn);
    });
  }

  function selectSubject(id) {
    const sub = window.CPA.SUBJECTS.find(s => s.id === id);
    if (!sub) return;
    if (sub.status === 'todo') {
      showEmpty(sub);
      state.subjectId = id;
      renderSubjectTabs();
      return;
    }
    state.subjectId = id;
    state.chapterIdx = 0;
    state.cardIdx = 0;
    state.flipped = false;
    state.shuffled = false;
    state.order = [];
    applySubjectTheme(sub);
    renderSubjectTabs();
    renderChapterList();
    renderCard();
  }

  function applySubjectTheme(sub) {
    document.documentElement.style.setProperty('--subject-color', sub.color);
    document.documentElement.style.setProperty('--subject-color-2', sub.color + 'cc');
    document.documentElement.style.setProperty('--subject-soft', sub.soft);
    document.documentElement.style.setProperty('--accent', sub.color);
    document.documentElement.style.setProperty('--accent-2', sub.color + 'cc');
  }

  // ---------- 渲染：章节列表 ----------
  function renderChapterList() {
    const host = $('#chapter-list');
    host.innerHTML = '';
    const chapters = getChapters();
    chapters.forEach((ch, i) => {
      const done = chapterDoneCount(state.subjectId, ch);
      const item = document.createElement('div');
      item.className = 'chapter-item' + (i === state.chapterIdx ? ' active' : '') + (done === ch.cards.length && ch.cards.length ? ' done' : '');
      item.innerHTML =
        `<div class="chapter-num">${String(i + 1).padStart(2, '0')}</div>` +
        `<div class="ch-body"><div class="ch-title">${esc(ch.title)}</div>` +
        `<div class="ch-meta">${ch.cards.length} 张卡</div></div>` +
        `<div class="ch-progress">${done}/${ch.cards.length}</div>` +
        `<div class="ch-dot"></div>`;
      item.addEventListener('click', () => {
        state.chapterIdx = i; state.cardIdx = 0; state.flipped = false; state.order = [];
        renderChapterList(); renderCard(); closeSidebarMobile();
      });
      host.appendChild(item);
    });
  }

  function chapterDoneCount(subjectId, ch) {
    const p = progressStore();
    let done = 0;
    ch.cards.forEach((_, i) => {
      if (p[subjectId] && p[subjectId][ch.id] && p[subjectId][ch.id][i] === 'mastered') done++;
    });
    return done;
  }
  function renderChapterProgress() {
    renderChapterList();
  }

  // ---------- 渲染：卡片 ----------
  function renderCard() {
    const ch = getChapter();
    const subj = getSubject();
    const stage = $('#stage');
    if (!ch || !ch.cards.length) { stage.innerHTML = ''; showEmpty(subj); return; }

    const order = visibleOrder();
    if (!order.length) {
      stage.innerHTML =
        `<div class="empty"><div class="big">🎉</div>` +
        `<div class="t">本章已全部掌握</div>` +
        `<div class="d">当前筛选下没有更多卡片了。可以切换筛选或重置进度重新学习。</div></div>`;
      updateNav();
      return;
    }
    if (state.cardIdx >= order.length) state.cardIdx = 0;
    const realIdx = order[state.cardIdx];
    const card = ch.cards[realIdx];
    const star = card.star || 3;
    const status = cardStatus(state.subjectId, ch.id, realIdx);

    const stars = Array.from({ length: 5 }, (_, i) =>
      `<span class="${i < star ? '' : 'off'}">★</span>`).join('');
    const tags = (card.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('');
    const mnemonic = card.mnemonic
      ? `<div class="mnemonic-box"><div class="m-label">🧠 记忆口诀</div><div class="m-text">${esc(card.mnemonic)}</div></div>` : '';

    stage.innerHTML =
      `<div class="card-wrap">
        <div class="card ${state.flipped ? 'flipped' : ''}" id="card">
          <div class="card-face front">
            <div class="card-top">${tags}<div class="stars">${stars}</div></div>
            <div class="card-body">
              <div class="card-body-inner">
                <div class="prompt">— 考点提问 —</div>
                <div class="q">${esc(card.front)}</div>
              </div>
            </div>
            <div class="card-foot">
              <span class="hint">${status === 'mastered' ? '✅ 已掌握' : status === 'review' ? '🔄 复习中' : '点击卡片翻转查看答案'}</span>
            </div>
            <div class="flip-hint">点击翻转 · 空格键</div>
          </div>
          <div class="card-face back">
            <div class="card-top">${tags}<div class="stars">${stars}</div></div>
            <div class="card-body">
              <div class="card-body-inner">
                <div class="prompt">— 详解 —</div>
                <div class="a">${md(card.back)}</div>
              </div>
            </div>
            ${mnemonic}
            <div class="card-foot">
              <button class="chip" data-act="master">✅ 已掌握</button>
              <button class="chip" data-act="review">🔄 再复习</button>
              <span class="hint" style="margin-left:auto">点击卡片翻回</span>
            </div>
          </div>
        </div>
      </div>`;

    const cardEl = $('#card');
    if (cardEl) cardEl.addEventListener('click', toggleFlip);
    $$('#stage [data-act]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      setCardStatus(e.target.dataset.act);
    }));

    updateNav();
  }

  function toggleFlip() { state.flipped = !state.flipped; renderCard(); }

  function updateNav() {
    const ch = getChapter();
    const order = visibleOrder();
    const total = order.length;
    const cur = total ? state.cardIdx + 1 : 0;
    $('#counter').textContent = `${cur} / ${total}`;
    $('#btn-prev').disabled = total <= 1;
    $('#btn-next').disabled = total <= 1;
    // 进度条
    const p = progressStore();
    const done = ch ? ch.cards.filter((_, i) => p[state.subjectId] && p[state.subjectId][ch.id] && p[state.subjectId][ch.id][i] === 'mastered').length : 0;
    const pct = ch && ch.cards.length ? Math.round(done / ch.cards.length * 100) : 0;
    $('#progress-fill').style.width = pct + '%';
    $('#progress-text').textContent = ch ? `${done}/${ch.cards.length} 张已掌握` : '';
    $('#progress-pct').textContent = pct + '%';
  }

  function go(delta) {
    const order = visibleOrder();
    if (!order.length) return;
    state.cardIdx = (state.cardIdx + delta + order.length) % order.length;
    state.flipped = false;
    renderCard();
  }
  function goNext() { go(1); }
  function goPrev() { go(-1); }

  // ---------- 渲染：空状态（未整理科目） ----------
  function showEmpty(sub) {
    const stage = $('#stage');
    const ready = window.CPA.chapters[sub.id] && window.CPA.chapters[sub.id].length;
    stage.innerHTML = ready
      ? `<div class="empty"><div class="big">📭</div><div class="t">本章暂无卡片</div><div class="d">内容整理中，敬请期待。</div></div>`
      : `<div class="empty"><div class="big">🚧</div><div class="t">${sub.name} · 待整理</div><div class="d">${sub.note || '该科目的小卡正在整理中。目前税法（14章）已完整，可先学习税法。'}</div></div>`;
    $('#chapter-list').innerHTML = '';
    $('#progress-fill').style.width = '0%';
    $('#progress-text').textContent = '';
    $('#progress-pct').textContent = '0%';
    $('#counter').textContent = '0 / 0';
    $('#btn-prev').disabled = true; $('#btn-next').disabled = true;
  }

  // ---------- 搜索 ----------
  function openSearch() { $('#search-overlay').classList.add('open'); $('#search-input').focus(); }
  function closeSearch() { $('#search-overlay').classList.remove('open'); }
  function doSearch() {
    const q = $('#search-input').value.trim();
    const host = $('#search-results');
    host.innerHTML = '';
    if (!q) { host.innerHTML = ''; return; }
    const subject = getSubject();
    const chapters = getChapters();
    let hits = 0;
    chapters.forEach(ch => {
      ch.cards.forEach((c, idx) => {
        if ((c.front + c.back + (c.mnemonic || '')).indexOf(q) >= 0) {
          hits++;
          const el = document.createElement('div');
          el.className = 'search-item';
          el.innerHTML = `<div class="si-ch">${esc(ch.title)}</div><div class="si-q">${esc(c.front)}</div>`;
          el.addEventListener('click', () => {
            state.chapterIdx = chapters.indexOf(ch);
            // 定位到该卡（重置筛选与随机，确保能直接命中）
            state.filter = 'all'; syncFilterChips();
            state.order = Array.from({ length: ch.cards.length }, (_, i) => i);
            state.cardIdx = ch.cards.indexOf(c);
            state.flipped = false;
            $('#chip-shuffle').classList.remove('on');
            renderChapterList(); renderCard(); closeSearch();
          });
          host.appendChild(el);
        }
      });
    });
    if (!hits) host.innerHTML = `<div class="search-empty">未找到与「${esc(q)}」相关的卡片</div>`;
  }

  // ---------- 主题 ----------
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(LS_THEME, next);
    $('#theme-btn').textContent = next === 'dark' ? '☀️' : '🌙';
  }
  function initTheme() {
    const saved = localStorage.getItem(LS_THEME) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    $('#theme-btn').textContent = saved === 'dark' ? '☀️' : '🌙';
  }

  // ---------- 工具：转义 / 简易富文本 ----------
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function md(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^[-•]\s?(.+)$/gm, '· $1');
  }

  // ---------- 移动端侧栏 ----------
  function toggleSidebar() { $('#sidebar').classList.toggle('open'); }
  function closeSidebarMobile() { $('#sidebar').classList.remove('open'); }

  // ---------- 初始化 ----------
  function init() {
    initTheme();
    renderSubjectTabs();

    // 事件绑定
    $('#theme-btn').addEventListener('click', toggleTheme);
    $('#menu-btn').addEventListener('click', toggleSidebar);
    $('#search-btn').addEventListener('click', openSearch);
    $('#search-close').addEventListener('click', closeSearch);
    $('#search-input').addEventListener('input', doSearch);
    $('#search-overlay').addEventListener('click', e => { if (e.target.id === 'search-overlay') closeSearch(); });

    $('#btn-prev').addEventListener('click', goPrev);
    $('#btn-next').addEventListener('click', goNext);
    $('#btn-flip').addEventListener('click', toggleFlip);

    $('#chip-key').addEventListener('click', () => { toggleFilter('key'); });
    $('#chip-unmastered').addEventListener('click', () => { toggleFilter('unmastered'); });
    $('#chip-shuffle').addEventListener('click', shuffle);
    $('#chip-reset').addEventListener('click', resetProgress);

    // 键盘
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') closeSearch();
      if ($('#search-overlay').classList.contains('open')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleFlip(); }
    });

    // 默认选中第一门可用科目（税法）
    const firstReady = window.CPA.SUBJECTS.find(s => s.status === 'ready');
    const first = firstReady || window.CPA.SUBJECTS[0];
    selectSubject(first.id);
  }

  function toggleFilter(f) {
    state.filter = state.filter === f ? 'all' : f;
    state.cardIdx = 0; state.flipped = false;
    syncFilterChips();
    renderCard();
  }
  function syncFilterChips() {
    $('#chip-key').classList.toggle('on', state.filter === 'key');
    $('#chip-unmastered').classList.toggle('on', state.filter === 'unmastered');
  }

  function shuffle() {
    const ch = getChapter();
    if (!ch) return;
    const n = ch.cards.length;
    state.order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    }
    state.shuffled = true;
    state.cardIdx = 0; state.flipped = false;
    $('#chip-shuffle').classList.add('on');
    renderCard();
  }

  function resetProgress() {
    const subj = getSubject();
    if (!subj || !confirm(`确定清空「${subj.name}」的全部学习进度吗？`)) return;
    const p = progressStore();
    delete p[subj.id];
    saveProgress(p);
    state.cardIdx = 0; state.flipped = false;
    renderChapterList(); renderCard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
