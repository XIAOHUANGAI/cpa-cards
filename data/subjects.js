/**
 * CPA 考点速记卡 —— 科目注册表
 *
 * 数据契约（所有科目数据文件都遵循）：
 *   window.CPA.SUBJECTS         六门科目的元数据（id/name/color/status）
 *   window.CPA.chapters[id]     某科目下所有章节，结构见下方说明
 *
 * 章节结构：
 *   {
 *     id: 'ch01',                 // 唯一 ID
 *     title: '税法总论',           // 章节名（不含"第X章"）
 *     summary: '一句话概括',       // 章节导语
 *     cards: [
 *       {
 *         front: '正面问题/考点',   // 卡片正面（提问）
 *         back: '背面详解',         // 卡片背面（答案，可含换行 \n）
 *         mnemonic: '记忆口诀',     // 可选，背诵口诀/顺口溜
 *         star: 5,                 // 重要程度 1~5 星（>=4 视为"重点"）
 *         tags: ['原则'],          // 可选，分类标签
 *       },
 *       ...
 *     ],
 *   }
 */
window.CPA = window.CPA || {};

window.CPA.SUBJECTS = [
  { id: 'kuaiji',   name: '会计',                 short: '会', color: '#2563eb', soft: '#eaf1ff', status: 'ready', note: '30章 · 已完整' },
  { id: 'shenji',   name: '审计',                 short: '审', color: '#7c3aed', soft: '#f3eeff', status: 'ready', note: '23章 · 已完整' },
  { id: 'caiguan',  name: '财务成本管理',         short: '财', color: '#d97706', soft: '#fff3e0', status: 'ready', note: '20章 · 已完整' },
  { id: 'shuifa',   name: '税法',                 short: '税', color: '#059669', soft: '#e6f7f1', status: 'ready', note: '14章 · 已完整' },
  { id: 'jingjifa', name: '经济法',               short: '经', color: '#e11d48', soft: '#ffe9ee', status: 'ready', note: '12章 · 已完整' },
  { id: 'zhanlue',  name: '公司战略与风险管理',   short: '战', color: '#0284c7', soft: '#e8f5fd', status: 'ready', note: '7章 · 已完整' },
];

window.CPA.chapters = window.CPA.chapters || {};
