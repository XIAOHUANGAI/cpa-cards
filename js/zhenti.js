/* ==========================================================================
   CPA 考点速记卡 —— 真题练习模式
   按科目 + 章节专题刷「历年高频真题改编」客观题（单选/多选）
   选完即判、逐题解析、错题重做、进度存 localStorage
   ========================================================================== */
(function () {
  'use strict';

  const LS_KEY = 'cpa_zhenti'; // { [subjectId]: { [g-q]: 'right'|'wrong' } }

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const zt = {
    subjectId: null,
    scope: 'all',      // 'all' | groupId | 'wrong'
    order: [],         // [{g, q, group, question}] 当前范围平铺
    i: 0,
    selected: null,    // 单选=下标 | 多选=[下标]
    locked: false,
  };

  function ztData() { return (window.CPA && window.CPA.zhenti) || {}; }
  function subjectMeta(id) { return (window.CPA && window.CPA.SUBJECTS || []).find(s => s.id === id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- 进度存储 ----------
  function store() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {} }
  function subjResults(id) { return store()[id] || {}; }
  function keyOf(g, q) { return g + '-' + q; }

  function subjStats(id) {
    const r = subjResults(id);
    const vals = Object.values(r);
    return { done: vals.length, right: vals.filter(v => v === 'right').length };
  }

  // ---------- 入口：科目选择 ----------
  function openPicker() {
    const data = ztData();
    const ids = Object.keys(data);
    const host = $('#zhenti-overlay');
    host.classList.add('open');

    let cards = '';
    ids.forEach(id => {
      const z = data[id];
      const meta = subjectMeta(id) || {};
      const qn = z.groups.reduce((n, g) => n + g.questions.length, 0);
      const st = subjStats(id);
      const pct = st.done ? Math.round(st.right / st.done * 100) : null;
      cards += `
        <div class="zt-pick" data-id="${id}">
          <div class="zp-head">
            <span class="zp-dot" style="background:${meta.color || '#059669'}"></span>
            <span class="zp-name">${esc(z.name)}</span>
            <span class="zp-qn">${qn} 题</span>
          </div>
          <div class="zp-meta">${z.groups.length} 个专题 · 单选 + 多选</div>
          <div class="zp-foot">
            <span>${pct == null ? '未开始练习' : `已完成 ${st.done}/${qn} · 正确率 ${pct}%`}</span>
          </div>
        </div>`;
    });

    host.innerHTML = `
      <div class="zt-picker">
        <div class="zt-picker-head">
          <div class="zph-title">📝 真题练习</div>
          <div class="zph-sub">历年高频真题改编 · 按专题刷客观题，选完即判、逐题解析</div>
          <button class="icon-btn" id="zt-picker-close" title="关闭">✕</button>
        </div>
        <div class="zt-picker-list">${cards || '<div class="exam-empty">暂无真题数据</div>'}</div>
      </div>`;

    $('#zt-picker-close').addEventListener('click', closeZt);
    $$('.zt-pick').forEach(el => el.addEventListener('click', () => openSubject(el.dataset.id)));
  }

  // ---------- 进入练习 ----------
  function openSubject(id) {
    zt.subjectId = id;
    zt.scope = 'all';
    zt.i = 0;
    zt.selected = null;
    zt.locked = false;
    buildOrder();
    renderPractice();
  }

  function buildOrder() {
    const z = ztData()[zt.subjectId];
    zt.order = [];
    z.groups.forEach((group, g) => {
      group.questions.forEach((q, qi) => {
        const k = keyOf(g, qi);
        const res = subjResults(zt.subjectId)[k];
        const inScope = zt.scope === 'all' || zt.scope === group.id;
        const inWrong = zt.scope !== 'wrong' || res === 'wrong';
        if (inScope && inWrong) zt.order.push({ g, q: qi, group, question: q });
      });
    });
    if (zt.i >= zt.order.length) zt.i = 0;
  }

  // ---------- 练习界面 ----------
  function renderPractice() {
    const z = ztData()[zt.subjectId];
    const meta = subjectMeta(zt.subjectId) || {};
    const host = $('#zhenti-overlay');
    const st = subjStats(zt.subjectId);
    const pct = st.done ? Math.round(st.right / st.done * 100) : 0;

    const chips = [`<button class="zt-chip ${zt.scope === 'all' ? 'on' : ''}" data-scope="all">全部</button>`]
      .concat(z.groups.map(g => `<button class="zt-chip ${zt.scope === g.id ? 'on' : ''}" data-scope="${g.id}">${esc(g.title)}</button>`))
      .concat([`<button class="zt-chip wrong ${zt.scope === 'wrong' ? 'on' : ''}" data-scope="wrong">错题</button>`])
      .join('');

    host.innerHTML = `
      <div class="zt-shell">
        <header class="zt-top">
          <div class="zt-subj">
            <span class="zp-dot" style="background:${meta.color || '#059669'}"></span>
            <span>${esc(z.name)} · 真题练习</span>
          </div>
          <div class="zt-prog">已答 ${st.done} · 正确率 ${pct}%</div>
          <button class="icon-btn" id="zt-summary" title="成绩与错题">📊</button>
          <button class="icon-btn" id="zt-reset" title="重置进度">↺</button>
          <button class="icon-btn" id="zt-close" title="退出">✕</button>
        </header>
        <div class="zt-groups" id="zt-groups">${chips}</div>
        <div class="zt-body">
          <div class="zt-stage" id="zt-stage"></div>
        </div>
      </div>`;

    $$('#zt-groups .zt-chip').forEach(el => el.addEventListener('click', () => {
      zt.scope = el.dataset.scope;
      zt.i = 0; zt.selected = null; zt.locked = false;
      buildOrder();
      renderPractice();
    }));
    $('#zt-close').addEventListener('click', closeZt);
    $('#zt-reset').addEventListener('click', () => {
      if (confirm('确定重置该科目全部练习进度吗？')) {
        const s = store(); delete s[zt.subjectId]; save(s);
        renderPractice();
      }
    });
    $('#zt-summary').addEventListener('click', showSummary);

    renderQuestion();
  }

  function renderQuestion() {
    const stage = $('#zt-stage');
    if (!stage) return;
    const item = zt.order[zt.i];

    if (!item) {
      stage.innerHTML = `<div class="zt-empty">
        <div class="zt-empty-emoji">${zt.scope === 'wrong' ? '🎉' : '✅'}</div>
        <div>${zt.scope === 'wrong' ? '太棒了，没有错题！' : '本专题暂无题目'}</div>
        <button class="nav-btn primary" id="zt-backall">返回全部</button>
      </div>`;
      const ba = $('#zt-backall');
      if (ba) ba.addEventListener('click', () => { zt.scope = 'all'; zt.i = 0; buildOrder(); renderPractice(); });
      return;
    }

    const { g, q, question } = item;
    const res = subjResults(zt.subjectId)[keyOf(g, q)];
    const isAnswered = !!res;
    const multi = question.type === 'multiple';
    const done = zt.order.length;

    let opts = '';
    question.options.forEach((o, oi) => {
      let cls = 'zt-opt';
      let mark = multi ? '□' : '○';
      if (isAnswered) {
        const isRight = multi ? question.answer.includes(oi) : question.answer === oi;
        if (isRight) { cls += ' right'; mark = '✓'; }
      } else if (multi ? (Array.isArray(zt.selected) && zt.selected.includes(oi)) : zt.selected === oi) {
        cls += ' on';
        mark = multi ? '☑' : '●';
      }
      opts += `<div class="${cls}" data-oi="${oi}"><span class="zo-mark">${mark}</span><span class="zo-text">${esc(o)}</span></div>`;
    });

    const answered = res === 'right' ? '✅ 回答正确' : (res === 'wrong' ? '❌ 回答错误' : '');

    stage.innerHTML = `
      <div class="zt-q">
        <div class="zt-qhead">
          <span class="zt-qnum">${zt.i + 1} / ${done}</span>
          <span class="zt-qtags">${multi ? '多选题' : '单选题'}${question.source ? ' · ' + esc(question.source) : ''}</span>
        </div>
        <div class="zt-stem">${esc(question.stem)}</div>
        <div class="zt-opts">${opts}</div>
        ${res ? `<div class="zt-feedback ${res === 'right' ? 'ok' : 'bad'}">${answered}</div>
                 <div class="zt-analysis"><b>解析：</b>${esc(question.analysis || '')}</div>` : ''}
        <div class="zt-nav">
          <button class="nav-btn" id="zt-prev" ${zt.i === 0 ? 'disabled' : ''}>← 上一题</button>
          ${res ? '' : `<button class="nav-btn primary" id="zt-submit" disabled>确认答案</button>`}
          <button class="nav-btn" id="zt-next">${zt.i >= done - 1 ? '完成 ▸' : '下一题 →'}</button>
        </div>
      </div>`;

    // 选择交互
    $$('#zt-stage .zt-opt').forEach(el => {
      el.addEventListener('click', () => {
        if (res) return;
        const oi = +el.dataset.oi;
        if (multi) {
          let arr = Array.isArray(zt.selected) ? zt.selected.slice() : [];
          arr = arr.includes(oi) ? arr.filter(x => x !== oi) : arr.concat(oi);
          zt.selected = arr;
        } else {
          zt.selected = oi;
        }
        paintSelection(multi);
        const btn = $('#zt-submit');
        if (btn) btn.disabled = multi ? !(Array.isArray(zt.selected) && zt.selected.length) : (zt.selected == null);
      });
    });

    const btnSubmit = $('#zt-submit');
    if (btnSubmit) btnSubmit.addEventListener('click', () => submit(multi));

    const prev = $('#zt-prev');
    if (prev) prev.addEventListener('click', () => { zt.i--; zt.selected = null; zt.locked = false; renderQuestion(); });
    const next = $('#zt-next');
    if (next) next.addEventListener('click', () => {
      if (zt.i >= done - 1) { showSummary(); return; }
      zt.i++; zt.selected = null; zt.locked = false; renderQuestion();
    });
  }

  function paintSelection(multi) {
    $$('#zt-stage .zt-opt').forEach(el => {
      const oi = +el.dataset.oi;
      const on = multi ? (Array.isArray(zt.selected) && zt.selected.includes(oi)) : zt.selected === oi;
      el.classList.toggle('on', on);
    });
  }

  function submit(multi) {
    const item = zt.order[zt.i];
    if (!item) return;
    const { g, q, question } = item;
    let ok;
    if (multi) {
      const a = (Array.isArray(zt.selected) ? zt.selected : []).slice().sort();
      const r = question.answer.slice().sort();
      ok = a.length === r.length && a.every((v, i) => v === r[i]);
    } else {
      ok = zt.selected === question.answer;
    }
    const s = store();
    s[zt.subjectId] = s[zt.subjectId] || {};
    s[zt.subjectId][keyOf(g, q)] = ok ? 'right' : 'wrong';
    save(s);
    renderQuestion(); // 重新渲染显示反馈
  }

  // ---------- 成绩单 / 错题 ----------
  function showSummary() {
    const z = ztData()[zt.subjectId];
    const meta = subjectMeta(zt.subjectId) || {};
    const host = $('#zhenti-overlay');
    const total = z.groups.reduce((n, g) => n + g.questions.length, 0);
    const st = subjStats(zt.subjectId);
    const pct = st.done ? Math.round(st.right / st.done * 100) : 0;

    const wrongs = [];
    z.groups.forEach((g, gi) => g.questions.forEach((q, qi) => {
      const r = subjResults(zt.subjectId)[keyOf(gi, qi)];
      if (r === 'wrong') wrongs.push({ g: gi, q: qi, group: g, question: q });
    }));

    const wrongHtml = wrongs.map((w, idx) => `
      <div class="zw-item" data-g="${w.g}" data-q="${w.q}">
        <div class="zw-stem">${idx + 1}. ${esc(w.question.stem)}</div>
        <div class="zw-ans">答案：${esc(w.question.type === 'multiple' ? w.question.answer.map(i => w.question.options[i]).join('、') : w.question.options[w.question.answer])}</div>
      </div>`).join('');

    host.innerHTML = `
      <div class="zt-summary">
        <div class="zs-hero">
          <div class="zs-ring">${pct}<span>%</span></div>
          <div class="zs-meta">
            <div class="zs-title">${esc(z.name)} · 练习成绩</div>
            <div class="zs-sub">已答 ${st.done} / ${total} · 答对 ${st.right} · 答错 ${st.done - st.right}</div>
          </div>
        </div>
        <div class="zs-detail-title">错题回顾（${wrongs.length} 题）</div>
        <div class="zs-wrong">${wrongHtml || '<div class="exam-empty">暂无错题，继续加油！</div>'}</div>
        <div class="zs-actions">
          <button class="nav-btn" id="zs-redo" ${wrongs.length ? '' : 'disabled'}>🔄 重做错题</button>
          <button class="nav-btn" id="zs-back">← 返回练习</button>
          <button class="nav-btn primary" id="zs-close">完成</button>
        </div>
      </div>`;

    $$('.zw-item').forEach(el => el.addEventListener('click', () => {
      zt.scope = 'wrong';
      buildOrder();
      const g = +el.dataset.g, q = +el.dataset.q;
      const idx = zt.order.findIndex(o => o.g === g && o.q === q);
      zt.i = idx >= 0 ? idx : 0;
      renderPractice();
    }));
    $('#zs-redo').addEventListener('click', () => { zt.scope = 'wrong'; zt.i = 0; buildOrder(); renderPractice(); });
    $('#zs-back').addEventListener('click', () => { zt.scope = 'all'; zt.i = 0; buildOrder(); renderPractice(); });
    $('#zs-close').addEventListener('click', closeZt);
  }

  function closeZt() {
    $('#zhenti-overlay').classList.remove('open');
    $('#zhenti-overlay').innerHTML = '';
  }

  // ---------- 初始化 ----------
  function init() {
    const btn = $('#zhenti-btn');
    if (btn) btn.addEventListener('click', openPicker);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
