(function (App) {
'use strict';

// Tien ich dung chung cho cac man hinh + lua chon nguoi dung dang dat.
const $ = (id) => document.getElementById(id);

const SCREENS = ['home', 'quiz', 'result', 'browse'];

/** Lua chon hien tai o trang chu. */
const settings = {
  subjects: [],
  years: [],
  examSet: '',
  count: 20,
  mode: 'practice',   // 'practice' | 'exam'
  unseen: false,
};

function show(name) {
  SCREENS.forEach((key) => $(`screen-${key}`).classList.toggle('hidden', key !== name));
  window.scrollTo(0, 0);
}

/** Tao mot the con (dung textContent nen an toan voi noi dung tieng Viet bat ky). */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Ve mot hang nut chon; isOn(value) quyet dinh nut nao dang bat. */
function chips(container, items, isOn, onPick) {
  container.innerHTML = '';
  items.forEach(({ value, label }) => {
    const chip = el('button', 'chip', label);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(isOn(value)));
    chip.addEventListener('click', () => onPick(value));
    container.append(chip);
  });
}

/** Mot dong ket qua / ket qua tim kiem. */
function summaryRow(title, question, note, tone) {
  const row = el('div', `result-item${tone ? ` ${tone}` : ''}`);
  row.append(el('b', null, title),
             el('p', 'small', question),
             el('p', 'small muted', note || ''));
  return row;
}

  App.$ = $;
  App.settings = settings;
  App.show = show;
  App.el = el;
  App.chips = chips;
  App.summaryRow = summaryRow;
}(window.OnThi = window.OnThi || {}));
