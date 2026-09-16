/* ==========================================================================
   CPA 考点速记卡 —— 模拟考试模式
   纯前端判分：单选 / 多选（全对才得分）/ 主观题采分点客观化（填空/选择/判断）
   ========================================================================== */
(function () {
  'use strict';

  const LS_EXAM_HISTORY = 'cpa_exam_history'; // { subjectId: { score, total, date, usedSec } }

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // 运行时状态
  const exam = {
    subjectId: null,
    flat: [],        // [{ g, s, q, section, question }] 全局题目平铺
    answers: {},     // { g: 单选=下标 | 多选=[下标] | 主观={点下标:值} }
    durationSec: 0,
    remaining: 0,
    timer: null,
    startedAt: 0,
    submitted: false,
  };

  // ---------- 工具 ----------
  function examData() { return (window.CPA && window.CPA.exams) || {}; }
  function subjectMeta(id) { return (window.CPA && window.CPA.SUBJECTS || []).find(s => s.id === id); }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function md(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // 归一化文字：去首尾/内部空格、全角转半角、忽略大小写
  function normalize(s) {
    return String(s == null ? '' : s)
      .replace(/[　\s]+/g, '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .toLowerCase();
  }
  // 解析数字：去千分位逗号，支持 万/亿 单位
  function parseNum(s) {
    let t = String(s == null ? '' : s).replace(/[,\s，　]/g, '');
    let mult = 1;
    if (/万/.test(t)) { t = t.replace(/万/g, ''); mult = 10000; }
    else if (/亿/.test(t)) { t = t.replace(/亿/g, ''); mult = 100000000; }
    const v = parseFloat(t);
    return isNaN(v) ? NaN : v * mult;
  }

  function saveHistory(score) {
    try {
      const h = JSON.parse(localStorage.getItem(LS_EXAM_HISTORY)) || {};
      h[exam.subjectId] = {
        score, total: examData()[exam.subjectId].total,
        date: Date.now(), usedSec: Math.round((Date.now() - exam.startedAt) / 1000),
      };
      localStorage.setItem(LS_EXAM_HISTORY, JSON.stringify(h));
    } catch (e) { /* 忽略存储失败 */ }
  }

  // ---------- 入口 ----------
  function openPicker() {
    const data = examData();
    const ids = Object.keys(data);
    const host = $('#exam-overlay');
    host.classList.add('open');

    let cards = '';
    ids.forEach(id => {
      const ex = data[id];
      const meta = subjectMeta(id) || {};
      const qn = ex.sections.reduce((n, s) => n + s.questions.length, 0);
      const last = lastScore(id);
      cards += `
        <div class="exam-pick" data-id="${id}">
          <div class="ep-head">
            <span class="ep-dot" style="background:${meta.color || '#059669'}"></span>
            <span class="ep-name">${esc(ex.name)}</span>
            <span class="ep-qn">${qn} 题</span>
          </div>
          <div class="ep-meta">
            ${ex.sections.map(s => `<span class="ep-tag">${esc(s.label)} ${s.questions.length}题</span>`).join('')}
          </div>
          <div class="ep-foot">
            <span>⏱ ${ex.duration} 分钟 · 满分 ${ex.total}</span>
            ${last ? `<span class="ep-last">上次 ${last.score}/${last.total}</span>` : ''}
          </div>
        </div>`;
    });

    host.innerHTML = `
      <div class="exam-picker">
        <div class="exam-picker-head">
          <div class="eph-title">🎯 模拟考试</div>
          <div class="eph-sub">选择科目开始全真模拟，客观题自动判分，主观题按采分点判分</div>
          <button class="icon-btn" id="exam-picker-close" title="关闭">✕</button>
        </div>
        <div class="exam-picker-list">${cards || '<div class="exam-empty">暂无考试数据</div>'}</div>
      </div>`;

    $('#exam-picker-close').addEventListener('click', closeExam);
    $$('.exam-pick').forEach(el => el.addEventListener('click', () => {
      if (confirmStart(examData()[el.dataset.id])) startExam(el.dataset.id);
    }));
  }
  function lastScore(id) {
    try {
      const h = JSON.parse(localStorage.getItem(LS_EXAM_HISTORY)) || {};
      return h[id] || null;
    } catch (e) { return null; }
  }

  function confirmStart(ex) {
    const last = lastScore(exam.subjectId);
    return true; // 直接开始，入口列表已展示信息
  }

  // ---------- 开始考试 ----------
  function startExam(id) {
    const ex = examData()[id];
    if (!ex) return;
    exam.subjectId = id;
    exam.flat = [];
    ex.sections.forEach((section, s) => {
      section.questions.forEach((question, q) => {
        exam.flat.push({ g: exam.flat.length, s, q, section, question });
      });
    });
    exam.answers = {};
    exam.durationSec = ex.duration * 60;
    exam.remaining = exam.durationSec;
    exam.startedAt = Date.now();
    exam.submitted = false;
    renderExam();
    startTimer();
  }

  function startTimer() {
    clearInterval(exam.timer);
    exam.timer = setInterval(() => {
      exam.remaining--;
      if (exam.remaining <= 0) { exam.remaining = 0; updateClock(); submitExam(); return; }
      updateClock();
    }, 1000);
    updateClock();
  }
  function updateClock() {
    const el = $('#exam-clock');
    if (!el) return;
    const m = Math.floor(exam.remaining / 60), s = exam.remaining % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    el.classList.toggle('warn', exam.remaining <= 600);
  }

  // ---------- 渲染考试界面 ----------
  function renderExam() {
    const ex = examData()[exam.subjectId];
    const meta = subjectMeta(exam.subjectId) || {};
    const host = $('#exam-overlay');

    let body = '';
    ex.sections.forEach((section, s) => {
      const scoreNote = section.type === 'subjective'
        ? `（共 ${fmtScore(section.questions.reduce((n, q) => n + q.points.reduce((m, p) => m + p.score, 0), 0))} 分）`
        : `（每题 ${fmtScore(section.score)} 分）`;
      body += `<div class="exam-section"><div class="es-label">${esc(section.label)}${scoreNote}</div>`;
      section.questions.forEach((q, qi) => {
        const g = exam.flat.findIndex(f => f.s === s && f.q === qi);
        body += renderQuestion(g, section, q);
      });
      body += '</div>';
    });

    host.innerHTML = `
      <div class="exam-shell">
        <header class="exam-top">
          <div class="et-subj">
            <span class="ep-dot" style="background:${meta.color || '#059669'}"></span>
            <span>${esc(ex.name)}</span>
          </div>
          <div class="et-clock" id="exam-clock">00:00</div>
          <button class="nav-btn primary et-submit" id="exam-submit">交卷</button>
        </header>
        <div class="exam-body">
          <aside class="exam-sheet">
            <div class="sheet-head">答题卡</div>
            <div class="sheet-grid" id="exam-sheet"></div>
            <div class="sheet-legend"><i class="ok"></i>已答 <i class="no"></i>未答</div>
          </aside>
          <main class="exam-main" id="exam-main">
            <div class="exam-main-inner">${body}</div>
          </main>
        </div>
      </div>`;

    renderSheet();
    bindAnswers();
    $('#exam-submit').addEventListener('click', askSubmit);
  }

  function fmtScore(v) { return Number.isInteger(v) ? v : v.toFixed(1); }

  function renderQuestion(g, section, q) {
    if (section.type === 'subjective') {
      const points = q.points.map((p, pi) => {
        let input = '';
        if (p.kind === 'choice') {
          input = (p.options || []).map((o, oi) => `
            <label class="p-opt" data-g="${g}" data-pi="${pi}" data-oi="${oi}">
              <span class="po-radio"></span>${esc(o)}
            </label>`).join('');
        } else {
          input = `<input class="p-blank" data-g="${g}" data-pi="${pi}" type="text" placeholder="${p.unit ? '单位：' + esc(p.unit) : '填写答案'}" autocomplete="off" />`;
        }
        return `
          <div class="point" data-g="${g}" data-pi="${pi}" data-kind="${p.kind}">
            <div class="pt-prompt">${md(p.prompt)} <span class="pt-score">${fmtScore(p.score)} 分</span></div>
            <div class="pt-input">${input}</div>
          </div>`;
      }).join('');
      return `
        <div class="exam-q" id="eq-${g}" data-g="${g}">
          <div class="eq-num">${g + 1}</div>
          <div class="eq-stem">${md(q.stem)}</div>
          <div class="eq-points">${points}</div>
        </div>`;
    }

    const multi = section.type === 'multiple';
    const opts = q.options.map((o, oi) => `
      <div class="eq-opt" data-g="${g}" data-oi="${oi}">
        <span class="eo-mark">${multi ? '□' : '○'}</span>
        <span class="eo-text">${esc(o)}</span>
      </div>`).join('');
    return `
      <div class="exam-q" id="eq-${g}" data-g="${g}">
        <div class="eq-num">${g + 1}</div>
        <div class="eq-stem">${md(q.stem)}</div>
        <div class="eq-opts">${opts}</div>
      </div>`;
  }

  function renderSheet() {
    const host = $('#exam-sheet');
    if (!host) return;
    let html = '';
    exam.flat.forEach((f, g) => {
      const ans = exam.answers[g];
      const done = isAnswered(g);
      html += `<div class="sheet-num ${done ? 'done' : ''}" data-g="${g}">${g + 1}</div>`;
    });
    host.innerHTML = html;
    $$('#exam-sheet .sheet-num').forEach(el => el.addEventListener('click', () => {
      const target = $(`#eq-${el.dataset.g}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function isAnswered(g) {
    const f = exam.flat[g];
    if (!f) return false;
    const a = exam.answers[g];
    if (a == null) return false;
    if (f.section.type === 'multiple') return Array.isArray(a) && a.length > 0;
    if (f.section.type === 'subjective') {
      if (typeof a !== 'object') return false;
      return f.question.points.some((_, pi) => a[pi] != null && a[pi] !== '');
    }
    return true;
  }

  // ---------- 答题绑定 ----------
  function bindAnswers() {
    // 单选
    $$('#exam-main .eq-opt').forEach(el => {
      el.addEventListener('click', () => {
        const g = +el.dataset.g, oi = +el.dataset.oi;
        const f = exam.flat[g];
        if (f.section.type === 'multiple') {
          let arr = exam.answers[g] || [];
          arr = arr.includes(oi) ? arr.filter(x => x !== oi) : arr.concat(oi);
          exam.answers[g] = arr;
        } else {
          exam.answers[g] = oi;
        }
        paintOptions(g);
        renderSheet();
      });
    });
    // 主观题：选择型采分点
    $$('#exam-main .p-opt').forEach(el => {
      el.addEventListener('click', () => {
        const g = +el.dataset.g, pi = +el.dataset.pi, oi = +el.dataset.oi;
        if (!exam.answers[g] || typeof exam.answers[g] !== 'object') exam.answers[g] = {};
        exam.answers[g][pi] = oi;
        paintPoint(g, pi);
        renderSheet();
      });
    });
    // 主观题：填空
    $$('#exam-main .p-blank').forEach(el => {
      el.addEventListener('input', () => {
        const g = +el.dataset.g, pi = +el.dataset.pi;
        if (!exam.answers[g] || typeof exam.answers[g] !== 'object') exam.answers[g] = {};
        exam.answers[g][pi] = el.value;
        renderSheet();
      });
    });
  }

  function paintOptions(g) {
    const f = exam.flat[g];
    const a = exam.answers[g];
    $$(`#exam-main .eq-opt[data-g="${g}"]`).forEach(el => {
      const oi = +el.dataset.oi;
      const on = f.section.type === 'multiple' ? (Array.isArray(a) && a.includes(oi)) : (a === oi);
      el.classList.toggle('on', on);
    });
  }
  function paintPoint(g, pi) {
    const a = exam.answers[g];
    $$(`#exam-main .p-opt[data-g="${g}"][data-pi="${pi}"]`).forEach(el => {
      el.classList.toggle('on', (a && a[pi] === +el.dataset.oi));
    });
  }

  // ---------- 交卷 ----------
  function askSubmit() {
    const total = exam.flat.length;
    const answered = exam.flat.filter((_, g) => isAnswered(g)).length;
    const ok = confirm(`还有 ${total - answered} 题未作答，确定交卷吗？`);
    if (ok) submitExam();
  }
  function submitExam() {
    if (exam.submitted) return;
    exam.submitted = true;
    clearInterval(exam.timer);
    const result = grade();
    saveHistory(result.score);
    renderResult(result);
  }

  function grade() {
    const ex = examData()[exam.subjectId];
    const secScore = { single: 0, multiple: 0, subjective: 0 };
    const secMax = { single: 0, multiple: 0, subjective: 0 };
    const details = []; // { g, label, userText, rightText, got, max, analysis }

    exam.flat.forEach(f => {
      const s = f.section, q = f.question;
      if (s.type === 'single') {
        secMax.single += s.score;
        const got = (exam.answers[f.g] === q.answer) ? s.score : 0;
        secScore.single += got;
        details.push({
          g: f.g, label: `${s.label} ${f.q + 1}`, got, max: s.score,
          userText: q.options[exam.answers[f.g]] || '未作答',
          rightText: q.options[q.answer], analysis: q.analysis,
        });
      } else if (s.type === 'multiple') {
        secMax.multiple += s.score;
        const a = (exam.answers[f.g] || []).slice().sort();
        const r = q.answer.slice().sort();
        const same = a.length === r.length && a.every((v, i) => v === r[i]);
        const got = same ? s.score : 0;
        secScore.multiple += got;
        details.push({
          g: f.g, label: `${s.label} ${f.q + 1}`, got, max: s.score,
          userText: a.length ? a.map(i => q.options[i]).join('；') : '未作答',
          rightText: q.answer.map(i => q.options[i]).join('；'), analysis: q.analysis,
        });
      } else {
        const max = q.points.reduce((n, p) => n + p.score, 0);
        secMax.subjective += max;
        let got = 0;
        q.points.forEach((p, pi) => {
          const val = exam.answers[f.g] && exam.answers[f.g][pi];
          const ok = judgePoint(p, val);
          const ps = ok ? p.score : 0;
          got += ps;
        });
        secScore.subjective += got;
        details.push({
          g: f.g, label: `${s.label} ${f.q + 1}`, got, max,
          userText: summaryPoints(q, exam.answers[f.g]),
          rightText: summaryRightPoints(q), analysis: q.analysis || '',
        });
      }
    });

    const score = secScore.single + secScore.multiple + secScore.subjective;
    const max = secMax.single + secMax.multiple + secMax.subjective;
    return { score, max, secScore, secMax, details };
  }

  function judgePoint(p, val) {
    if (val == null || val === '') return false;
    if (p.kind === 'choice') return val === p.answer;
    if (p.kind === 'number') {
      const n = parseNum(val);
      if (isNaN(n)) return false;
      const tol = (p.tol != null ? p.tol : 0.005);
      if (p.answer === 0) return Math.abs(n) <= tol;
      return Math.abs(n - p.answer) <= tol * Math.abs(p.answer);
    }
    // text
    const nv = normalize(val);
    return (Array.isArray(p.answer) ? p.answer : [p.answer]).some(a => normalize(a) === nv);
  }

  function summaryPoints(q, ans) {
    return q.points.map((p, pi) => {
      const v = ans && ans[pi];
      if (p.kind === 'choice') return (p.options || [])[v] || '未作答';
      return v || '未作答';
    }).join('；');
  }
  function summaryRightPoints(q) {
    return q.points.map(p => {
      if (p.kind === 'choice') return (p.options || [])[p.answer];
      return Array.isArray(p.answer) ? p.answer[0] : String(p.answer);
    }).join('；');
  }

  // ---------- 成绩单 ----------
  function renderResult(r) {
    const ex = examData()[exam.subjectId];
    const usedSec = Math.round((Date.now() - exam.startedAt) / 1000);
    const pct = r.max ? Math.round(r.score / r.max * 100) : 0;
    const pass = pct >= 60;
    const host = $('#exam-overlay');

    const secRows = ex.sections.map(s => {
      const key = s.type;
      return `<div class="rs-row"><span>${esc(s.label)}</span><b>${fmtScore(r.secScore[key])} / ${fmtScore(r.secMax[key])}</b></div>`;
    }).join('');

    const wrong = r.details.filter(d => d.got < d.max);
    const wrongHtml = wrong.map(d => `
      <div class="rd-item">
        <div class="rd-head"><span class="rd-label">${esc(d.label)}</span><span class="rd-score ${d.got === d.max ? 'ok' : 'bad'}">${fmtScore(d.got)}/${fmtScore(d.max)}</span></div>
        <div class="rd-line ${d.got === d.max ? '' : 'bad'}">你的答案：${esc(d.userText)}</div>
        ${d.got < d.max ? `<div class="rd-line ok">正确答案：${esc(d.rightText)}</div>` : ''}
        ${d.analysis ? `<div class="rd-ana">${md(d.analysis)}</div>` : ''}
      </div>`).join('');

    host.innerHTML = `
      <div class="exam-result">
        <div class="er-hero ${pass ? 'pass' : 'fail'}">
          <div class="er-ring">${pct}<span>分</span></div>
          <div class="er-meta">
            <div class="er-title">${pass ? '🎉 通过参考线' : '📚 未达通过线'}</div>
            <div class="er-sub">${esc(ex.name)} · 用时 ${fmtTime(usedSec)} · 满分 ${ex.total}</div>
            <div class="er-sub">${r.score >= 0 ? '折算分 ' + pct + ' 分' : ''}（通过参考 60 分）</div>
          </div>
        </div>
        <div class="er-secs">${secRows}</div>
        <div class="er-detail-title">答题详情（${wrong.length} 题未得满分）</div>
        <div class="er-detail">${wrongHtml || '<div class="exam-empty">全部答对，太棒了！</div>'}</div>
        <div class="er-actions">
          <button class="nav-btn" id="er-retry">🔄 重考一次</button>
          <button class="nav-btn primary" id="er-back">返回学习</button>
        </div>
      </div>`;

    $('#er-retry').addEventListener('click', () => startExam(exam.subjectId));
    $('#er-back').addEventListener('click', closeExam);
  }
  function fmtTime(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m} 分 ${s} 秒` : `${s} 秒`;
  }

  function closeExam() {
    clearInterval(exam.timer);
    $('#exam-overlay').classList.remove('open');
    $('#exam-overlay').innerHTML = '';
  }

  // ---------- 初始化 ----------
  function init() {
    const btn = $('#exam-btn');
    if (btn) btn.addEventListener('click', openPicker);
    // ESC 关闭考试
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('#exam-overlay').classList.contains('open') && !exam.submitted) {
        // 考试进行中不允许 ESC 误退出
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
