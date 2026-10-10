(function () {
'use strict';

// Trang the co dong HCM202: du lieu tu data/hcm_master.js (sinh boi scraper/build_hcm_master.py).
const DATA = window.__HCM_MASTER__;
const KEY = 'hcm-master-v1';
const $ = (id) => document.getElementById(id);
const SCREENS = ['home', 'flash', 'quiz', 'result', 'read'];
const COUNTS = [20, 50, 100, 0];   // 0 = tat ca

// ---------- Tien do (localStorage, key rieng voi trang on thi chinh) ----------

/** Luon tao object moi - dung chung object long nhau se lam "Xoa tien do" khong xoa duoc. */
function emptyState() {
  return { known: {}, weak: {}, learned: {}, wrongQ: {}, session: null, theme: null };
}

function readState() {
  try {
    return { ...emptyState(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return emptyState();
  }
}

let state = readState();

const saveListeners = [];

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* che do rieng tu / het dung luong - van hoc duoc, chi khong luu */
  }
  saveListeners.forEach((listener) => listener());   // dong bo Firebase (web/hcm-sync.js)
}

/**
 * Gop tien do 2 noi (may nay + dam may / ban file://): hop cac danh sach,
 * khong lam mat cau da hoc o noi nao. Giao dien (theme, so cau moi luot) giu cua may nay.
 */
function mergeStates(local, other) {
  const union = (key) => ({ ...(other[key] || {}), ...(local[key] || {}) });
  const merged = {
    ...emptyState(),
    ...local,
    known: union('known'),
    learned: union('learned'),
    wrongQ: union('wrongQ'),
    weak: union('weak'),
    session: local.session || other.session || null,
  };
  Object.keys(merged.known).forEach((id) => delete merged.weak[id]);
  return merged;
}

/** Ve lai trang chu neu dang mo, khong lam gian doan bai dang lam. */
function refreshHome() {
  if (!$('screen-home').classList.contains('hidden')) renderHome();
}

// Cong cho module dong bo dam may (web/hcm-sync.js) doc / ghi tien do
window.HcmMaster = {
  snapshot: () => JSON.parse(JSON.stringify(state)),
  merge(other) {
    state = mergeStates(state, other || {});
    persist();
    refreshHome();
  },
  replace(next) {
    state = { ...emptyState(), ...next, theme: state.theme, count: state.count };
    persist();
    refreshHome();
  },
  onSave(listener) { saveListeners.push(listener); },
};

// Ban online tren GitHub Pages (domain da duoc phep dang nhap Google o Firebase mln131-4f80d)
const ONLINE_URL = 'https://dotuananhtb.github.io/hcm202-master/web/hcm-master.html';

/**
 * Mo qua http(s): nap module dong bo Firebase. Mo bang file:// thi Firebase Auth (va ca module ES)
 * khong chay -> chi cho chuyen tien do sang ban online qua link #import=...
 */
function setupSync() {
  const box = $('sync-box');
  if (location.protocol !== 'file:') {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'hcm-sync.js?v=1791656026';
    document.body.append(script);
    return;
  }
  const { session, theme, count, ...progress } = state;
  const code = btoa(JSON.stringify(progress)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const note = el('span', 'sync-status warn', 'Đang mở bằng file — không đăng nhập Google được ở đây');
  const go = el('button', 'secondary sync-btn', 'Chuyển tiến độ lên bản online');
  go.type = 'button';
  go.title = 'Mở bản online kèm toàn bộ tiến độ trên trình duyệt này; đăng nhập Google ở đó để lưu lên mây.';
  go.addEventListener('click', () => window.open(`${ONLINE_URL}#import=${code}`, '_blank'));
  box.replaceChildren(note, go);
}

/** Nhan tien do chuyen tu ban mo bang file:// (link #import=... do setupSync tao). */
function importFromHash() {
  const match = location.hash.match(/^#import=([A-Za-z0-9_-]+)$/);
  if (!match) return;
  try {
    const json = atob(match[1].replace(/-/g, '+').replace(/_/g, '/'));
    state = mergeStates(state, JSON.parse(json));
    persist();
    history.replaceState(null, '', location.pathname);
    window.setTimeout(() => {
      $('scope-info').textContent = 'Đã nhận tiến độ chuyển từ bản mở bằng file — đăng nhập Google để lưu lên mây.';
    }, 0);
  } catch {
    /* link hong - bo qua, khong lam hong tien do dang co */
  }
}

/** Thuoc = bo khoi danh sach yeu; chua thuoc / lam sai = them vao. */
function markCard(cardId, known) {
  if (known) {
    state.known[cardId] = true;
    delete state.weak[cardId];
  } else {
    delete state.known[cardId];
    state.weak[cardId] = true;
  }
  persist();
}

/** Luu theo tung cau (nhom mau thuan co 2 cau dai dien voi dap an khac nhau nen khong luu theo nhom). */
function markLearned(question, ok) {
  // wrongQ: danh sach cau tung lam sai, lam dung lai thi xoa (che do "Lam lai cau sai")
  if (ok) {
    state.learned[question.id] = true;
    delete state.wrongQ[question.id];
  } else {
    delete state.learned[question.id];
    state.wrongQ[question.id] = true;
  }
  persist();
}

/** Cau tung sai con trong pham vi chuong dang chon, theo thu tu chuong -> the. */
function wrongItems() {
  return questions
    .filter((q) => state.wrongQ[q.id])
    .map((q) => ({ question: q, card: cardById.get(q.card) }))
    .filter(({ card }) => !settings.chapters.length || settings.chapters.includes(card.ch))
    .sort((a, b) => a.card.ch - b.card.ch || cardOrder.get(a.card.id) - cardOrder.get(b.card.id));
}

// ---------- Du lieu ----------

const cards = DATA ? DATA.cards : [];
const questions = DATA ? DATA.questions : [];
const groups = DATA ? DATA.groups : [];
const questionById = new Map(questions.map((q) => [q.id, q]));
const groupById = new Map(groups.map((g) => [g.gid, g]));
const cardById = new Map(cards.map((c) => [c.id, c]));
const cardOrder = new Map(cards.map((c, i) => [c.id, i]));
const repIds = new Set(groups.flatMap((g) => g.reps));
const repCount = repIds.size;
const learnedReps = () => [...repIds].filter((id) => state.learned[id]).length;
const learnedAll = () => questions.filter((q) => state.learned[q.id]).length;

const settings = { chapters: [], onlyUnknown: false, count: 50 };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function show(name) {
  SCREENS.forEach((key) => $(`screen-${key}`).classList.toggle('hidden', key !== name));
  window.scrollTo(0, 0);
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Bo dau de tim kiem khong phan biet dau tieng Viet. */
function fold(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/**
 * In dam tu khoa (khong phan biet hoa thuong) - dung node van ban nen an toan voi moi noi dung.
 * Tu khoa do Claude chon va build da kiem la chuoi con nguyen van cua de/dap an.
 */
function highlight(text, phrases) {
  const frag = document.createDocumentFragment();
  const lower = text.toLowerCase();
  const ranges = [];
  (phrases || []).forEach((phrase) => {
    const needle = phrase.toLowerCase();
    if (!needle) return;
    for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) {
      ranges.push([i, i + needle.length]);
    }
  });
  ranges.sort((a, b) => a[0] - b[0]);
  let pos = 0;
  ranges.forEach(([start, end]) => {
    if (end <= pos) return;
    const from = Math.max(start, pos);
    if (from > pos) frag.append(text.slice(pos, from));
    frag.append(el('strong', 'kw', text.slice(from, end)));
    pos = end;
  });
  if (pos < text.length) frag.append(text.slice(pos));
  return frag;
}

function keywordsOf(question) {
  return groupById.get(question.g) || { kq: [], ka: [] };
}

function chapterName(ch) {
  return `Chương ${ch}: ${DATA.chapters[ch]}`;
}

/** The trong pham vi dang chon (chuong + chi the chua thuoc). */
function scopedCards() {
  return cards.filter((c) => (!settings.chapters.length || settings.chapters.includes(c.ch))
    && (!settings.onlyUnknown || !state.known[c.id]));
}

// ---------- Trang chu ----------

function renderChips(container, items, isOn, onPick) {
  container.innerHTML = '';
  items.forEach(({ value, label }) => {
    const chip = el('button', 'chip', label);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(isOn(value)));
    chip.addEventListener('click', () => onPick(value));
    container.append(chip);
  });
}

function renderHome() {
  const knownCount = cards.filter((c) => state.known[c.id]).length;
  const learnedCount = learnedReps();
  $('summary').textContent = `${repCount} câu đại diện (${groups.length} nhóm kiến thức) thay cho `
    + `${questions.length} câu HCM202, xếp vào ${cards.length} thẻ theo chủ đề. `
    + 'Học hết số câu đại diện là làm được toàn bộ câu gốc.';
  const stats = $('stats');
  stats.innerHTML = '';
  [
    [repCount, 'câu đại diện cần học'],
    [`${learnedCount}/${repCount}`, `câu đại diện đã làm đúng · còn ${repCount - learnedCount}`],
    [`${learnedAll()}/${questions.length}`, `câu gốc đã làm đúng · còn ${questions.length - learnedAll()}`],
    [cards.length, 'thẻ chủ đề'],
    [knownCount, 'thẻ đã thuộc'],
    [cards.filter((c) => state.weak[c.id]).length, 'thẻ cần ôn lại'],
  ].forEach(([value, label]) => {
    const box = el('div', 'stat');
    box.append(el('b', null, String(value)), el('span', null, label));
    stats.append(box);
  });

  const chapterItems = [{ value: 0, label: 'Tất cả' }].concat(
    Object.keys(DATA.chapters).map((ch) => ({ value: Number(ch), label: `Chương ${ch}` })));
  renderChips($('chapter-chips'), chapterItems,
    (v) => (v === 0 ? !settings.chapters.length : settings.chapters.includes(v)),
    (v) => {
      if (v === 0) settings.chapters = [];
      else if (settings.chapters.includes(v)) settings.chapters = settings.chapters.filter((x) => x !== v);
      else settings.chapters = [...settings.chapters, v];
      renderHome();
    });

  renderChips($('count-chips'), COUNTS.map((n) => ({ value: n, label: n ? `${n} câu` : 'Tất cả' })),
    (v) => v === settings.count, (v) => { settings.count = v; state.count = v; persist(); renderHome(); });

  const scope = scopedCards();
  const qCount = scope.reduce((sum, c) => sum + c.qids.length, 0);
  $('scope-info').textContent = settings.chapters.length
    ? `Đang chọn: ${settings.chapters.map(chapterName).join('; ')} — ${scope.length} thẻ, ${qCount} câu gốc.`
    : `Đang chọn: cả ${Object.keys(DATA.chapters).length} chương — ${scope.length} thẻ, ${qCount} câu gốc.`;
  const wrongCount = wrongItems().length;
  $('learn-label').textContent = `Học câu đại diện — còn ${repCount - learnedCount}/${repCount}`;
  $('learn-all-label').textContent = `Học câu gốc — còn ${questions.length - learnedAll()}/${questions.length}`;
  const saved = state.session;
  $('resume-btn').classList.toggle('hidden', !saved);
  if (saved) {
    $('resume-btn').textContent = `▶ Làm tiếp: ${MODE_LABEL[saved.kind]} — câu ${saved.index + 1}/${saved.qids.length}`;
  }
  $('redo-label').textContent = `Làm lại câu sai (${wrongCount})`;
  $('wrong-info').textContent = `Đã làm đúng ${learnedCount}/${repCount} câu đại diện · thuộc ${knownCount}/${cards.length} thẻ`;
  $('deck-label').textContent = '';
  show('home');
}

// ---------- Ve noi dung the ----------

function list(className, items) {
  const ul = el('ul', className);
  items.forEach((text) => ul.append(el('li', null, text)));
  return ul;
}

function flagTags(card) {
  const wrap = el('div');
  wrap.append(el('span', 'tag', chapterName(card.ch)));
  wrap.append(el('span', 'tag', `${card.qids.length} câu gốc`));
  if (card.conflict) wrap.append(el('span', 'tag warn', 'Các nguồn chọn đáp án khác nhau'));
  if (card.review) wrap.append(el('span', 'tag warn', 'Có câu cần đối chiếu'));
  if (state.known[card.id]) wrap.append(el('span', 'tag ok', 'Đã thuộc'));
  return wrap;
}

/** Danh sach cau goc cua the, mo rong khi can. */
function originDetails(card) {
  const box = el('details', 'origin');
  box.append(el('summary', null, `Xem ${card.qids.length} câu gốc mà thẻ này thay thế`));
  box.addEventListener('click', (event) => event.stopPropagation());
  card.qids.forEach((id) => box.append(originItem(questionById.get(id))));
  return box;
}

/** Mot cau goc day du: de + moi phuong an, dap an dung to xanh, tu khoa in dam. */
function originItem(q) {
  const kw = keywordsOf(q);
  const item = el('div', 'origin-item');
  const stem = el('b');
  stem.append(highlight(q.q, kw.kq));
  item.append(stem);
  Object.entries(q.opts).forEach(([key, text]) => {
    const ok = q.ans.includes(key);
    const opt = el('span', `opt${ok ? ' ok' : ''}`, `${key}. `);
    opt.append(ok ? highlight(text, kw.ka) : text);
    item.append(opt);
  });
  const notes = [q.exam];
  if (q.conflict) notes.push('các nguồn chọn đáp án khác nhau');
  if (q.review) notes.push('cần đối chiếu');
  item.append(el('span', `small ${q.conflict ? 'warn-text' : 'muted'}`, notes.join(' · ')));
  return item;
}

/** Tung cap cach hoi -> dap an; cau phu dinh duoc ghi ro de khong doc nguoc. */
function pairList(card) {
  const ul = el('ul', 'answers');
  card.pairs.forEach((pair) => {
    const kw = groupById.get(pair.g) || { kq: [], ka: [] };
    const li = el('li', pair.neg ? 'neg' : null);
    const pq = el('span', 'pq');
    pq.append(highlight(pair.q, kw.kq));
    li.append(pq);
    if (pair.neg) li.append(el('span', 'tag warn', 'Câu hỏi phủ định — đáp án là ý SAI / KHÔNG thuộc'));
    const pa = el('span', 'pa');
    pa.append(highlight(pair.a, kw.ka));
    li.append(pa);
    ul.append(li);
  });
  return ul;
}

/** Mat sau cua the: y cot loi + dap an nguyen van + phuong an nhieu. */
function cardBody(card) {
  const frag = document.createDocumentFragment();
  frag.append(el('div', 'core', card.core));
  frag.append(el('div', 'section-label', 'Đáp án trong đề (nguyên văn, theo từng cách hỏi)'));
  frag.append(pairList(card));
  if (card.traps.length) {
    frag.append(el('div', 'section-label', 'Phương án nhiễu hay gặp'));
    frag.append(list('traps', card.traps));
  }
  frag.append(originDetails(card));
  return frag;
}

// ---------- Che do lat the ----------

const flash = { deck: [], index: 0, flipped: false };

function startFlash(deck) {
  if (!deck.length) return alertEmpty();
  flash.deck = deck;
  flash.index = 0;
  flash.flipped = false;
  show('flash');
  renderFlash();
}

function renderFlash() {
  const card = flash.deck[flash.index];
  const box = $('flash-card');
  box.innerHTML = '';
  box.append(flagTags(card));
  box.append(el('div', 'topic', card.topic));
  box.append(el('div', 'section-label', 'Các cách đề hỏi'));
  box.append(list('prompts', card.prompts.slice(0, 6)));
  if (card.prompts.length > 6) box.append(el('p', 'small muted', `… và ${card.prompts.length - 6} cách hỏi khác`));
  if (flash.flipped) box.append(cardBody(card));
  else box.append(el('p', 'hint-row', 'Tự nhớ lại đáp án rồi bấm để lật thẻ'));
  $('flash-bar').style.width = `${((flash.index + 1) / flash.deck.length) * 100}%`;
  $('deck-label').textContent = `Thẻ ${flash.index + 1}/${flash.deck.length}`;
  $('flash-prev').disabled = flash.index === 0;
}

function flashMove(step) {
  const next = flash.index + step;
  if (next < 0) return;
  if (next >= flash.deck.length) {
    renderHome();
    return;
  }
  flash.index = next;
  flash.flipped = false;
  renderFlash();
}

function flashGrade(known) {
  markCard(flash.deck[flash.index].id, known);
  flashMove(1);
}

// ---------- Trac nghiem (theo the hoac cau goc) ----------

const quiz = { items: [], index: 0, picked: [], done: false, results: [], kind: '' };

/** items: [{question, card}] */
function startQuiz(items, kind) {
  if (!items.length) return alertEmpty();
  quiz.items = items;
  quiz.index = 0;
  quiz.results = [];
  quiz.kind = kind;
  show('quiz');
  renderQuestion();
}

/** Luu luot dang lam de dong trang roi mo lai van "Lam tiep" dung cau dang lam. */
function saveSession() {
  state.session = {
    kind: quiz.kind,
    qids: quiz.items.map((item) => item.question.id),
    index: quiz.index,
    results: quiz.results.map((r) => ({ id: r.question.id, ok: r.ok, picked: r.picked })),
  };
  persist();
}

function resumeSession() {
  const saved = state.session;
  const toItem = (id) => {
    const question = questionById.get(id);
    return question && { question, card: cardById.get(question.card) };
  };
  const items = (saved && saved.qids.map(toItem).filter(Boolean)) || [];
  if (!items.length) {
    state.session = null;
    persist();
    renderHome();
    return;
  }
  quiz.items = items;
  quiz.kind = saved.kind;
  quiz.index = Math.min(saved.index, items.length - 1);
  quiz.results = saved.results.map((r) => ({ ...toItem(r.id), ok: r.ok, picked: r.picked }))
    .filter((r) => r.question);
  show('quiz');
  renderQuestion();
}

/** So cau con phai lam cua tung che do hoc - hien o trang chu va tren cau dang lam. */
function leftText(kind) {
  if (kind === 'learn') return `Còn ${repCount - learnedReps()}/${repCount} câu đại diện chưa làm đúng`;
  if (kind === 'learn-all') return `Còn ${questions.length - learnedAll()}/${questions.length} câu gốc chưa làm đúng`;
  if (kind === 'redo') return `Còn ${wrongItems().length} câu sai`;
  return '';
}

function renderQuestion() {
  const { question, card } = quiz.items[quiz.index];
  quiz.picked = [];
  quiz.done = false;
  $('quiz-count').textContent = `Câu ${quiz.index + 1}/${quiz.items.length}`;
  $('quiz-meta').textContent = `Chương ${card.ch} · ${question.exam}`;
  $('quiz-left').textContent = leftText(quiz.kind);
  saveSession();
  $('quiz-question').innerHTML = '';
  $('quiz-question').append(highlight(question.q, keywordsOf(question).kq));
  const need = question.ans.length;
  $('quiz-hint').classList.toggle('hidden', need < 2 && !question.conflict);
  $('quiz-hint').textContent = hintText(question, 0);
  const box = $('quiz-options');
  box.innerHTML = '';
  Object.entries(question.opts).forEach(([key, text]) => {
    const btn = el('button', 'option');
    btn.type = 'button';
    btn.dataset.key = key;
    btn.append(el('span', 'key', key), el('span', 'body', text));
    btn.addEventListener('click', () => pick(key));
    box.append(btn);
  });
  $('quiz-feedback').classList.add('hidden');
  $('quiz-next').disabled = true;
  $('quiz-bar').style.width = `${(quiz.index / quiz.items.length) * 100}%`;
  $('deck-label').textContent = MODE_LABEL[quiz.kind];
}

const MODE_LABEL = { learn: 'Học câu đại diện', 'learn-all': 'Học câu gốc', redo: 'Làm lại câu sai', 'card-quiz': 'Trắc nghiệm theo thẻ', 'full-test': 'Kiểm tra câu gốc' };

/** Nhac so dap an can chon; bao truoc khi cac nguon chon dap an khac nhau cho cung de. */
function hintText(question, picked) {
  const parts = [];
  const need = question.ans.length;
  if (need > 1) parts.push(`Câu này chọn ${need} đáp án — đã chọn ${picked}/${need}`);
  if (question.conflict) parts.push('Lưu ý: đề này có bản khác chọn đáp án khác, kết quả chỉ để tham khảo');
  return parts.join(' · ');
}

function pick(key) {
  if (quiz.done) return;
  const { question } = quiz.items[quiz.index];
  const need = question.ans.length;
  if (quiz.picked.includes(key)) quiz.picked = quiz.picked.filter((k) => k !== key);
  else if (quiz.picked.length < need) quiz.picked = [...quiz.picked, key];
  document.querySelectorAll('#quiz-options .option').forEach((btn) => {
    btn.classList.toggle('chosen', quiz.picked.includes(btn.dataset.key));
  });
  $('quiz-hint').textContent = hintText(question, quiz.picked.length);
  if (quiz.picked.length === need) grade();
}

function grade() {
  const { question, card } = quiz.items[quiz.index];
  quiz.done = true;
  const ok = quiz.picked.length === question.ans.length
    && quiz.picked.every((k) => question.ans.includes(k));
  quiz.results.push({ question, card, ok, picked: [...quiz.picked] });
  if (!ok) markCard(card.id, false);
  markLearned(question, ok);
  $('quiz-left').textContent = leftText(quiz.kind);
  saveSession();

  const kw = keywordsOf(question);
  // Nhom mau thuan chua tu khoa cua ca 2 dap an -> chi giu tu khoa nam trong dap an cua cau nay
  const answerText = question.ans.split('').map((k) => question.opts[k].toLowerCase()).join(' ');
  const answerKeys = kw.ka.filter((k) => answerText.includes(k.toLowerCase()));
  document.querySelectorAll('#quiz-options .option').forEach((btn) => {
    const key = btn.dataset.key;
    btn.disabled = true;
    if (question.ans.includes(key)) {
      btn.classList.add('correct');
      // Chi in dam tu khoa dap an sau khi cham de khong lo dap an
      const body = btn.querySelector('.body');
      body.innerHTML = '';
      body.append(highlight(question.opts[key], answerKeys));
    } else if (quiz.picked.includes(key)) btn.classList.add('wrong');
  });

  const fb = $('quiz-feedback');
  fb.innerHTML = '';
  fb.append(el('div', `verdict ${ok ? 'ok' : 'bad'}`,
    ok ? 'Đúng' : `Sai — đáp án: ${question.ans.split('').join(', ')}`));
  if (question.conflict) fb.append(el('span', 'tag warn', 'Các nguồn chọn đáp án khác nhau cho câu này'));
  if (question.review) fb.append(el('span', 'tag warn', 'Câu cần đối chiếu'));
  if (answerKeys.length) {
    const line = el('p', 'small', 'Nhớ: ');
    kw.kq.filter((k) => question.q.toLowerCase().includes(k.toLowerCase()))
      .forEach((k) => line.append(el('strong', 'kw', k), ' '));
    line.append('→ ');
    answerKeys.forEach((k) => line.append(el('strong', 'kw ans', k), ' '));
    fb.append(line);
  }
  // Che do hoc cau goc se lan luot hoi tung cau trong nhom nen khong liet ke truoc
  const others = quiz.kind === 'learn-all' ? [] : otherOriginals(question);
  if (others.length) {
    const mixed = (groupById.get(question.g) || { reps: [] }).reps.length > 1;
    fb.append(el('div', 'section-label', mixed
      ? `${others.length} câu gốc khác trong nhóm (nhóm này các nguồn chọn đáp án khác nhau)`
      : `${others.length} câu gốc khác cùng đáp án — ôn luôn`));
    others.forEach((q) => fb.append(originItem(q)));
  }
  fb.append(el('h4', null, `Thẻ: ${card.topic}`));
  fb.append(el('div', 'core', card.core));
  if (question.exp) {
    fb.append(el('div', 'section-label', 'Giải thích'));
    fb.append(el('p', 'small', question.exp));
  }
  fb.classList.remove('hidden');
  $('quiz-next').disabled = false;
  $('quiz-bar').style.width = `${((quiz.index + 1) / quiz.items.length) * 100}%`;
}

/**
 * Cac cau goc khac trong cung nhom, bo cau dang hoi va ban trung khit.
 * Trung khit = cung de + cung bo phuong an (khong ke thu tu, dau cau, ngoac kep);
 * cau khac phuong an nhieu van hien vi do la cho de hay danh lua.
 */
function otherOriginals(question) {
  const group = groupById.get(question.g);
  if (!group) return [];
  const clean = (text) => fold(text).replace(/[^a-z0-9]/g, '');
  const key = (q) => [clean(q.q), ...Object.values(q.opts).map(clean).sort(),
    ...q.ans.split('').map((k) => clean(q.opts[k])).sort()].join('|');
  const seen = new Set([key(question)]);
  const result = [];
  group.qids.forEach((id) => {
    const q = questionById.get(id);
    if (!seen.has(key(q))) {
      seen.add(key(q));
      result.push(q);
    }
  });
  return result;
}

function nextQuestion() {
  if (quiz.index + 1 >= quiz.items.length) {
    finishQuiz();
    return;
  }
  quiz.index += 1;
  renderQuestion();
}

function finishQuiz() {
  state.session = null;
  persist();
  const total = quiz.results.length;
  const correct = quiz.results.filter((r) => r.ok).length;
  $('result-title').textContent = `Kết quả — ${MODE_LABEL[quiz.kind]}`;
  $('result-score').textContent = total ? `${correct}/${total} (${Math.round((correct / total) * 100)}%)` : '0/0';
  const wrong = quiz.results.filter((r) => !r.ok);
  const wrongCards = [...new Map(wrong.map((r) => [r.card.id, r.card])).values()];
  if (!total) $('result-note').textContent = 'Chưa làm câu nào.';
  else if (wrong.length) {
    $('result-note').textContent = `${wrong.length} câu sai thuộc ${wrongCards.length} thẻ — `
      + 'các thẻ này được bỏ đánh dấu "Đã thuộc" và tính vào "thẻ cần ôn lại".';
  } else $('result-note').textContent = 'Không sai câu nào.';
  $('result-review').classList.toggle('hidden', !wrongCards.length);
  $('result-review').onclick = () => startFlash(wrongCards);
  $('result-redo').classList.toggle('hidden', !wrong.length);
  $('result-redo').textContent = `Làm lại ${wrong.length} câu sai`;
  $('result-redo').onclick = () => startQuiz(shuffle(wrong.map((r) => ({ question: r.question, card: r.card }))), 'redo');

  const box = $('result-list');
  box.innerHTML = '';
  wrong.forEach((r) => {
    const row = el('div', 'result-item bad');
    const stem = el('b');
    stem.append(highlight(r.question.q, keywordsOf(r.question).kq));
    row.append(stem);
    row.append(el('p', 'small', `Bạn chọn: ${r.picked.join(', ') || '—'} · Đúng: ${r.question.ans.split('').join(', ')} — `
      + r.question.ans.split('').map((k) => r.question.opts[k]).join(' + ')));
    row.append(el('p', 'small muted', `Thẻ: ${r.card.topic}`));
    box.append(row);
  });
  $('deck-label').textContent = '';
  show('result');
}

// ---------- Doc nhanh ----------

function renderRead() {
  const query = fold($('read-search').value.trim());
  const scope = scopedCards();
  const matched = query
    ? scope.filter((c) => fold([c.topic, c.core, ...c.pairs.map((p) => p.a), ...c.prompts].join(' ')).includes(query))
    : scope;
  $('read-info').textContent = `${matched.length}/${scope.length} thẻ`;
  const box = $('read-list');
  box.innerHTML = '';
  let lastChapter = null;
  matched.forEach((card) => {
    if (card.ch !== lastChapter) {
      box.append(el('h2', 'ch-title', chapterName(card.ch)));
      lastChapter = card.ch;
    }
    const item = el('article', 'read-card');
    item.append(el('h3', null, card.topic));
    item.append(cardBody(card));
    item.append(flagTags(card));
    box.append(item);
  });
  $('deck-label').textContent = 'Đọc nhanh';
}

// ---------- Khoi dong ----------

function alertEmpty() {
  renderHome();
  $('scope-info').textContent = 'Không còn thẻ / câu nào trong phạm vi đang chọn (có thể bạn đã thuộc hết) — '
    + 'bỏ tích "Chỉ thẻ / câu chưa thuộc" để ôn lại, hoặc chọn chương khác.';
}

/**
 * Cau theo thu tu chuong -> the -> nhom (cau cung chu de nam canh nhau).
 * all = false: chi cau dai dien; all = true: moi cau goc (cau dai dien cua nhom dung truoc).
 * Cau chua lam dung len truoc, nen moi luot N cau la N cau tiep theo can hoc.
 */
function learnItems(all) {
  const ids = (g) => (all ? [...g.reps, ...g.qids.filter((id) => !g.reps.includes(id))] : g.reps);
  const items = groups
    .map((g) => ({ g, card: cardById.get(g.card) }))
    .filter(({ card }) => !settings.chapters.length || settings.chapters.includes(card.ch))
    .sort((a, b) => a.card.ch - b.card.ch || cardOrder.get(a.card.id) - cardOrder.get(b.card.id))
    .flatMap(({ g, card }) => ids(g).map((id) => ({ card, question: questionById.get(id) })));
  // Hoc tiep: chi cau chua lam dung; da xong het thi cho on lai toan bo
  const pending = items.filter((item) => !state.learned[item.question.id]);
  return pending.length ? pending : items;
}

function startMode(mode) {
  const scope = scopedCards();
  if (mode === 'redo') {
    const items = wrongItems();
    if (!items.length) {
      renderHome();
      $('scope-info').textContent = 'Không có câu sai nào trong phạm vi đang chọn — giỏi lắm!';
      return;
    }
    startQuiz(settings.count ? items.slice(0, settings.count) : items, 'redo');
  } else if (mode === 'learn' || mode === 'learn-all') {
    const items = learnItems(mode === 'learn-all');
    startQuiz(settings.count ? items.slice(0, settings.count) : items, mode);
  } else if (mode === 'flash') startFlash(scope);
  else if (mode === 'card-quiz') {
    startQuiz(shuffle(scope).map((card) => ({
      card, question: questionById.get(card.qids[Math.floor(Math.random() * card.qids.length)]),
    })), 'card-quiz');
  } else if (mode === 'full-test') {
    const all = shuffle(scope.flatMap((card) => card.qids.map((id) => ({ card, question: questionById.get(id) }))));
    startQuiz(settings.count ? all.slice(0, settings.count) : all, 'full-test');
  } else if (mode === 'read') {
    show('read');
    renderRead();
  }
}

function onKey(event) {
  // Bo qua Cmd/Ctrl/Alt (copy, chon het...) va phim giu lap de khong cham nham
  if (event.target.tagName === 'INPUT' || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (!$('screen-flash').classList.contains('hidden')) {
    if (event.key === ' ') { event.preventDefault(); flash.flipped = !flash.flipped; renderFlash(); }
    else if (event.key === 'ArrowRight') flashMove(1);
    else if (event.key === 'ArrowLeft') flashMove(-1);
    else if (event.key === '1') flashGrade(false);
    else if (event.key === '2') flashGrade(true);
  } else if (!$('screen-quiz').classList.contains('hidden')) {
    const key = event.key.toUpperCase();
    if (/^[A-F]$/.test(key) && document.querySelector(`#quiz-options [data-key="${key}"]`)) pick(key);
    else if ((event.key === 'Enter' || event.key === 'ArrowRight') && quiz.done) nextQuestion();
  }
}

function init() {
  if (!DATA) {
    $('summary').textContent = 'Chưa có data/hcm_master.js — chạy: python scraper/build_hcm_master.py build';
    return;
  }
  importFromHash();
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  $('theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    state.theme = next;
    persist();
  });
  if (COUNTS.includes(state.count)) settings.count = state.count;   // nho so cau moi luot da chon
  $('home-btn').addEventListener('click', renderHome);
  $('resume-btn').addEventListener('click', resumeSession);
  settings.onlyUnknown = $('only-unknown').checked;   // trinh duyet co the khoi phuc o da tich khi tai lai
  $('only-unknown').addEventListener('change', (event) => { settings.onlyUnknown = event.target.checked; renderHome(); });
  document.querySelectorAll('.mode-btn').forEach((btn) => btn.addEventListener('click', () => startMode(btn.dataset.mode)));
  $('reset-btn').addEventListener('click', () => {
    if (!window.confirm('Xoá toàn bộ tiến độ thẻ HCM202?')) return;
    state = { ...emptyState(), theme: state.theme };
    persist();
    renderHome();
  });
  $('flash-card').addEventListener('click', () => { flash.flipped = !flash.flipped; renderFlash(); });
  $('flash-prev').addEventListener('click', () => flashMove(-1));
  $('flash-next').addEventListener('click', () => flashMove(1));
  $('flash-again').addEventListener('click', () => flashGrade(false));
  $('flash-known').addEventListener('click', () => flashGrade(true));
  $('quiz-next').addEventListener('click', nextQuestion);
  $('quiz-quit').addEventListener('click', finishQuiz);
  $('result-home').addEventListener('click', renderHome);
  $('read-search').addEventListener('input', renderRead);
  document.addEventListener('keydown', onKey);
  renderHome();
  setupSync();
}

init();
}());
