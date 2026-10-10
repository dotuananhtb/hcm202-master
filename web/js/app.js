(function (App) {
'use strict';
  // Lay cac ham dung chung tu namespace (cac file truoc da nap xong)
  const { $, bank, countMatching, currentQuestion, goNext, goPrev, hasSession, loadBank, pickQuestions, refreshHome, render, restartReview, resumeSession, settings, show, startSession, store, summaryRow, toggleMarkCurrent } = App;

// Gan su kien va khoi dong trang on thi.

function deckOf(ids) {
  return ids.map((id) => bank.byId.get(id)).filter(Boolean);
}

function browse() {
  show('browse');
  const render = () => {
    const term = $('search-input').value.trim().toLowerCase();
    const hits = term
      ? bank.questions.filter((q) => `${q.question} ${Object.values(q.options).join(' ')}`
        .toLowerCase().includes(term))
      : bank.questions;
    $('search-info').textContent = term
      ? `${hits.length} câu khớp`
      : `Ngân hàng có ${hits.length} câu — gõ từ khoá để tìm`;
    $('search-results').innerHTML = '';
    hits.slice(0, 100).forEach((q) => $('search-results').append(summaryRow(
      `${q.subject} · ${q.exam_set} · câu ${q.number} — đáp án ${q.answer}`,
      q.question, q.explanation,
    )));
  };
  $('search-input').oninput = render;
  render();
}

function startFromHome() {
  const picked = pickQuestions({
    subjects: settings.subjects,
    years: settings.years,
    examSet: settings.examSet,
    count: settings.count,
    onlyUnseen: settings.unseen,
    isSeen: (id) => store.isSeen(id),
  });
  const title = settings.examSet
    || [settings.subjects.join(' + ') || 'Tất cả môn',
        settings.years.length ? settings.years.join(', ') : null,
        `${settings.count || 'tất cả'} câu`].filter(Boolean).join(' · ');
  startSession(picked, title);
}

function goHome() {
  show('home');
  refreshHome();
}

function wireHome() {
  $('home-btn').addEventListener('click', goHome);
  $('back-home-btn').addEventListener('click', goHome);
  $('start-btn').addEventListener('click', startFromHome);
  $('resume-btn').addEventListener('click', () => {
    if (!resumeSession()) {
      alert('Bài đang làm dở không còn khớp với ngân hàng câu hỏi.');
      refreshHome();
    }
  });
  $('browse-btn').addEventListener('click', browse);
  $('only-unseen').addEventListener('change', (e) => { settings.unseen = e.target.checked; });
  $('exam-select').addEventListener('change', (e) => { settings.examSet = e.target.value; });

  const wrong = () => startSession(deckOf(store.wrongIds()), 'Làm lại câu sai');
  $('wrong-btn').addEventListener('click', wrong);
  $('retry-wrong-btn').addEventListener('click', wrong);
  $('marked-btn').addEventListener('click',
    () => startSession(deckOf(store.markedIds()), 'Câu đã đánh dấu'));
  $('review-flagged-btn').addEventListener('click',
    () => startSession(bank.questions.filter((q) => q.needs_review),
                       'Câu cần đối chiếu giáo trình'));
  $('review-btn').addEventListener('click', restartReview);
  $('reset-btn').addEventListener('click', () => {
    if (confirm('Xoá toàn bộ tiến độ, câu sai, câu đánh dấu và lịch sử làm bài?')) {
      store.reset();
      refreshHome();
    }
  });
}

/** Mo anh de goc co kich thuoc day du. */
function openFullImage() {
  const question = currentQuestion();
  if (!question) return;
  $('modal-img').src = `../data/images/${question.id}.webp`;
  $('image-modal').classList.remove('hidden');
}

/** Cho nut giai thich biet dang bat hay tat. */
function syncExplainButton() {
  const on = !store.data.hideExplain;
  $('explain-btn').classList.toggle('on', on);
  $('explain-btn').title = on
    ? 'Đang hiện giải thích — bấm để ẩn, tự nghĩ trước khi xem'
    : 'Đang ẩn giải thích — bấm để hiện';
}

/** Cho nut biet dang o che do nao. */
function syncImageModeButton() {
  const on = store.data.imageMode;
  $('image-mode-btn').classList.toggle('on', on);
  $('image-mode-btn').textContent = on ? 'Ảnh gốc' : 'Chữ';
  $('image-mode-btn').title = on
    ? 'Đang xem ảnh đề gốc — bấm để quay lại chữ đã gõ lại'
    : 'Đang xem chữ đã gõ lại — bấm để xem ảnh đề gốc';
}

function wireQuiz() {
  $('next-btn').addEventListener('click', goNext);
  $('prev-btn').addEventListener('click', goPrev);
  $('mark-btn').addEventListener('click', toggleMarkCurrent);
  $('explain-btn').addEventListener('click', () => {
    store.toggleExplain();
    syncExplainButton();
    if (hasSession()) render();
  });
  $('image-mode-btn').addEventListener('click', () => {
    store.toggleImageMode();
    syncImageModeButton();
    if (hasSession()) render();
  });
  $('q-image-box').addEventListener('click', openFullImage);
  $('img-btn').addEventListener('click', openFullImage);
  $('modal-close').addEventListener('click', () => $('image-modal').classList.add('hidden'));
  $('image-modal').addEventListener('click', (e) => {
    if (e.target.id === 'image-modal') $('image-modal').classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    if ($('screen-quiz').classList.contains('hidden') || !hasSession()) return;
    if (e.key === 'Escape') $('image-modal').classList.add('hidden');
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft') goPrev();
    const index = 'abcdef'.indexOf(e.key.toLowerCase());
    if (index >= 0) document.querySelectorAll('.option')[index]?.click();
  });
}

function wireTheme() {
  $('theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.setTheme(next);
  });
}

(async function main() {
  if (store.data.theme) document.documentElement.dataset.theme = store.data.theme;
  wireTheme();
  wireHome();
  wireQuiz();
  syncImageModeButton();
  syncExplainButton();
  try {
    await loadBank();
    refreshHome();
  } catch (error) {
    $('bank-summary').textContent =
      `Lỗi: ${error.message}. Hãy chạy start-web.ps1 để mở trang qua máy chủ cục bộ.`;
  }
})();

}(window.OnThi = window.OnThi || {}));
