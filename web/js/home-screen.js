(function (App) {
'use strict';
  // Lay cac ham dung chung tu namespace (cac file truoc da nap xong)
  const { $, bank, chips, countMatching, el, settings, store } = App;

// Trang chu: thong ke tien do + cac lua chon truoc khi vao lam bai.

function statBox(value, label) {
  const box = el('div', 'stat');
  box.append(el('b', null, String(value)), el('span', null, label));
  return box;
}

function fillExamOptions() {
  if ($('exam-select').options.length > 1) return;
  bank.examSets.forEach((name) => {
    const option = el('option', null, name);
    option.value = name;
    $('exam-select').append(option);
  });
}

/** Nut "lam tiep bai dang do" chi hien khi that su co bai dang do. */
function refreshResume() {
  const saved = store.loadSession();
  const button = $('resume-btn');
  if (!saved) {
    button.classList.add('hidden');
    return;
  }
  const answered = saved.picked.filter(Boolean).length;
  button.classList.remove('hidden');
  button.textContent =
    `Làm tiếp: ${saved.title} — câu ${saved.index + 1}/${saved.ids.length}`
    + (answered ? ` (đã trả lời ${answered})` : '');
}

/** Vai bai gan nhat da nop, de biet minh hoc toi dau. */
function refreshHistory() {
  const rows = store.history();
  $('history').innerHTML = '';
  $('history-card').classList.toggle('hidden', rows.length === 0);
  rows.slice(0, 5).forEach((row) => {
    const when = new Date(row.at).toLocaleString('vi-VN',
      { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const percent = Math.round((row.correct / row.total) * 100);
    const item = el('div', 'history-row');
    item.append(el('span', null, `${when} · ${row.title}`),
                el('b', null, `${row.correct}/${row.total} (${percent}%)`));
    $('history').append(item);
  });
}

function refreshHome() {
  const { stats, seen } = store.data;
  const flagged = bank.questions.filter((q) => q.needs_review).length;
  const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;

  $('bank-summary').textContent =
    `${bank.questions.length} câu (đã lọc trùng) · ${bank.subjects.join(' + ')} · Kỳ 9`;
  $('stats').innerHTML = '';
  [
    [stats.total, 'lượt trả lời'],
    [`${accuracy}%`, 'tỉ lệ đúng'],
    [Object.keys(seen).length, 'câu đã gặp'],
    [store.wrongIds().length, 'câu đang sai'],
    [flagged, 'câu cần đối chiếu'],
  ].forEach(([value, label]) => $('stats').append(statBox(value, label)));

  $('wrong-count').textContent = store.wrongIds().length;
  $('marked-count').textContent = store.markedIds().length;
  $('flagged-count').textContent = flagged;

  chips($('subject-chips'), bank.subjects.map((s) => ({ value: s, label: s })),
    (v) => settings.subjects.includes(v),
    (v) => {
      const at = settings.subjects.indexOf(v);
      if (at >= 0) settings.subjects.splice(at, 1);
      else settings.subjects.push(v);
      refreshHome();
    });

  chips($('year-chips'), bank.years.map((y) => ({ value: y, label: String(y) })),
    (v) => settings.years.includes(v),
    (v) => {
      const at = settings.years.indexOf(v);
      if (at >= 0) settings.years.splice(at, 1);
      else settings.years.push(v);
      refreshHome();
    });

  chips($('count-chips'), [10, 20, 40, 60, 0].map((n) => ({ value: n, label: n ? `${n} câu` : 'Tất cả' })),
    (v) => settings.count === v,
    (v) => { settings.count = v; refreshHome(); });

  chips($('mode-chips'), [
    { value: 'practice', label: 'Luyện tập — xem đáp án ngay' },
    { value: 'exam', label: 'Thi thử — chấm cuối bài' },
  ], (v) => settings.mode === v, (v) => { settings.mode = v; refreshHome(); });

  fillExamOptions();
  const matching = countMatching(settings);
  $('filter-info').textContent = `${matching} câu khớp bộ lọc hiện tại`;
  $('start-btn').disabled = matching === 0;
  refreshResume();
  refreshHistory();
}

  App.refreshHome = refreshHome;
}(window.OnThi = window.OnThi || {}));
