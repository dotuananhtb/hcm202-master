(function (App) {
'use strict';

// Luu tien do on tap vao localStorage cua trinh duyet.
const KEY = 'onthi-ky9-v1';

const EMPTY = {
  seen: {}, wrong: {}, marked: {}, stats: { correct: 0, total: 0 },
  theme: null, imageMode: false, hideExplain: false, session: null, history: [],
};

function read() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...EMPTY };
  }
}

let state = read();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* che do rieng tu hoac het dung luong - bo qua, khong lam hong bai hoc */
  }
}

const store = {
  get data() { return state; },

  /** Ghi nhan mot lan tra loi. */
  record(id, isCorrect) {
    state.seen[id] = (state.seen[id] || 0) + 1;
    state.stats.total += 1;
    if (isCorrect) {
      state.stats.correct += 1;
      delete state.wrong[id];
    } else {
      state.wrong[id] = (state.wrong[id] || 0) + 1;
    }
    persist();
  },

  toggleMark(id) {
    if (state.marked[id]) delete state.marked[id];
    else state.marked[id] = Date.now();
    persist();
    return Boolean(state.marked[id]);
  },

  isMarked(id) { return Boolean(state.marked[id]); },
  isSeen(id) { return Boolean(state.seen[id]); },
  wrongIds() { return Object.keys(state.wrong).map(Number); },
  markedIds() { return Object.keys(state.marked).map(Number); },

  setTheme(theme) { state.theme = theme; persist(); },

  /** Bat/tat phan giai thich (de tu kiem tra truoc khi doc loi giai). */
  toggleExplain() {
    state.hideExplain = !state.hideExplain;
    persist();
    return !state.hideExplain;
  },

  /** Bat/tat che do hien anh de goc thay cho chu da go lai. */
  toggleImageMode() {
    state.imageMode = !state.imageMode;
    persist();
    return state.imageMode;
  },

  /** Luu bai dang lam do de lan sau mo lai van tiep duoc. */
  saveSession(snapshot) {
    state.session = { ...snapshot, savedAt: Date.now() };
    persist();
  },

  loadSession() { return state.session; },

  clearSession() { state.session = null; persist(); },

  /** Ghi lai ket qua mot bai da nop, de xem lai lich su hoc. */
  addHistory(entry) {
    state.history = [{ ...entry, at: Date.now() }, ...(state.history || [])]
      .slice(0, 30);
    persist();
  },

  history() { return state.history || []; },

  reset() {
    state = { ...EMPTY, seen: {}, wrong: {}, marked: {}, history: [] };
    persist();
  },
};

  App.store = store;
}(window.OnThi = window.OnThi || {}));
