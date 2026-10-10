(function (App) {
'use strict';

// Nap ngan hang cau hoi va cac tien ich loc / tron cau.
const bank = {
  questions: [], byId: new Map(), subjects: [], examSets: [], years: [],
};

/**
 * Nap du lieu theo 2 duong:
 *  - data/questions.js gan san vao window  -> chay duoc ca khi mo bang file://
 *  - fetch data/questions.json             -> du phong khi chay qua may chu
 * Trinh duyet chan fetch tren file:// nen ban .js la duong chinh.
 */
async function readBank() {
  if (window.__QUESTION_BANK__) return window.__QUESTION_BANK__;
  const response = await fetch('../data/questions.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Không đọc được data/questions.json');
  return response.json();
}

async function loadBank() {
  const payload = await readBank();
  bank.questions = payload.questions || payload;
  bank.byId = new Map(bank.questions.map((q) => [q.id, q]));
  bank.subjects = [...new Set(bank.questions.map((q) => q.subject))].sort();
  bank.examSets = [...new Set(bank.questions.map((q) => q.exam_set))].sort();
  bank.years = [...new Set(bank.questions.map((q) => q.year).filter(Boolean))]
    .sort((a, b) => b - a);
  bank.generated = payload.generated_at || null;
  return bank;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Loc cau theo mon / nam / bo de / da lam chua. */
function pickQuestions({
  subjects, years, examSet, count, onlyUnseen, isSeen,
}) {
  let pool = bank.questions;
  if (subjects?.length) pool = pool.filter((q) => subjects.includes(q.subject));
  if (years?.length) pool = pool.filter((q) => years.includes(q.year));
  if (examSet) pool = pool.filter((q) => q.exam_set === examSet);
  if (onlyUnseen) {
    const fresh = pool.filter((q) => !isSeen(q.id));
    if (fresh.length) pool = fresh;
  }
  const ordered = examSet ? [...pool].sort((a, b) => a.number - b.number) : shuffle(pool);
  return count > 0 ? ordered.slice(0, count) : ordered;
}

/** So cau khop bo loc hien tai, de hien ngay tren nut Bat dau. */
function countMatching({ subjects, years, examSet }) {
  return bank.questions.filter((q) => (
    (!subjects?.length || subjects.includes(q.subject))
    && (!years?.length || years.includes(q.year))
    && (!examSet || q.exam_set === examSet)
  )).length;
}

  App.bank = bank;
  App.loadBank = loadBank;
  App.shuffle = shuffle;
  App.pickQuestions = pickQuestions;
  App.countMatching = countMatching;
}(window.OnThi = window.OnThi || {}));
