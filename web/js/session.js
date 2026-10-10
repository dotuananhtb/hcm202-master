(function (App) {
'use strict';
  // Lay cac ham dung chung tu namespace (cac file truoc da nap xong)
  const { $, bank, isAnswered, pickedAnswer, prepare, refreshHome, renderFeedback,
    renderHint, renderOptions, settings, show, store, summaryRow } = App;

// Phien lam bai: dieu huong giua cac cau, cham diem, tong ket, luu de lam tiep.

let session = null;

const hasSession = () => session !== null;
const currentQuestion = () =>
  (session ? session.items[session.index].view.question : null);

function makeItems(questions) {
  return questions.map((q) => ({
    view: prepare(q), picked: [], counted: false,
  }));
}

/** Cau da tra loi xong (da chon du so dap an can thiet). */
function answered(item) {
  return isAnswered(item.view, item.picked);
}

/** Ghi lai bai dang lam de mo lai van tiep duoc. */
function snapshot() {
  if (!session) return;
  store.saveSession({
    title: session.title,
    mode: session.mode,
    index: session.index,
    ids: session.items.map((i) => i.view.question.id),
    picked: session.items.map((i) => i.picked),
  });
}

function startSession(questions, title) {
  if (!questions.length) {
    alert('Không có câu nào phù hợp.');
    return;
  }
  session = {
    title,
    mode: settings.mode,
    index: 0,
    items: makeItems(questions),
  };
  $('deck-label').textContent = title;
  show('quiz');
  snapshot();
  render();
}

/** Mo lai bai dang lam do tu lan truoc. */
function resumeSession() {
  const saved = store.loadSession();
  if (!saved) return false;
  // Bai luu truoc khi bo xao tron: dap an da chon ung voi thu tu khac,
  // mo lai se map sai nen bo luon cho an toan.
  if (saved.shuffle) {
    store.clearSession();
    return false;
  }
  const questions = saved.ids.map((id) => bank.byId.get(id)).filter(Boolean);
  if (questions.length !== saved.ids.length) {
    store.clearSession();      // ngan hang da doi, bai cu khong con khop
    return false;
  }
  session = {
    title: saved.title,
    mode: saved.mode,
    index: Math.min(saved.index, questions.length - 1),
    items: makeItems(questions),
  };
  // Cac cau da tra loi truoc do: danh dau lai, nhung khong cong diem lan nua
  saved.picked.forEach((value, index) => {
    const item = session.items[index];
    if (!item || !value) return;
    // Ban luu cu ghi mot chu cai, ban moi ghi mang chu cai
    item.picked = Array.isArray(value) ? value : [value];
    item.counted = answered(item);
  });
  $('deck-label').textContent = saved.title;
  show('quiz');
  render();
  return true;
}

function onPick(label) {
  const item = session.items[session.index];
  const { required } = item.view;
  const at = item.picked.indexOf(label);

  if (at >= 0) {
    item.picked.splice(at, 1);            // bam lai o da chon -> bo chon
  } else {
    // Cau chon 1 dap an: o moi thay o cu. Cau nhieu dap an: cong don den khi du.
    if (required === 1) item.picked = [label];
    else if (item.picked.length < required) item.picked.push(label);
    else return;                          // da du, phai bo bot truoc khi doi
  }
  snapshot();

  if (!answered(item)) {                  // chua du so dap an -> chua cham
    render();
    return;
  }
  if (!item.counted) {
    store.record(item.view.question.id, pickedAnswer(item.picked) === item.view.correct);
    item.counted = true;
  }
  if (session.mode === 'practice') render();
  else if (session.index < session.items.length - 1) goNext();
  else finish();
}

function render() {
  const item = session.items[session.index];
  const { question } = item.view;
  const marked = store.isMarked(question.id);
  const last = session.index === session.items.length - 1;

  $('q-counter').textContent = `Câu ${session.index + 1}/${session.items.length}`;
  $('q-meta').textContent = [question.subject, question.term_label,
    question.exam_set, `câu ${question.number}`].filter(Boolean).join(' · ');
  // Che do anh goc: an chu da go lai, hien anh de va chi de lai cot chu cai
  const imageMode = store.data.imageMode;
  $('q-layout').classList.toggle('image-mode', imageMode);
  $('screen-quiz').classList.toggle('wide', imageMode);
  $('q-text').classList.toggle('hidden', imageMode);
  $('q-image-box').classList.toggle('hidden', !imageMode);
  $('q-text').textContent = question.question;
  if (imageMode) $('q-image').src = `../data/images/${question.id}.webp`;
  $('mark-btn').textContent = marked ? '★' : '☆';
  $('mark-btn').classList.toggle('on', marked);
  $('progress-bar').style.width =
    `${((session.index + 1) / session.items.length) * 100}%`;

  const reveal = session.mode === 'practice';
  renderHint($('q-hint'), item.view, item.picked);
  renderOptions($('q-options'), item.view, item.picked, onPick, reveal);
  $('q-feedback').classList.toggle('no-explain', store.data.hideExplain);
  if (reveal && answered(item)) renderFeedback($('q-feedback'), item.view, item.picked);
  else $('q-feedback').classList.add('hidden');

  $('next-btn').textContent = last ? 'Nộp bài' : 'Câu sau →';
  $('prev-btn').disabled = session.index === 0;
}

function goNext() {
  if (session.index < session.items.length - 1) {
    session.index += 1;
    snapshot();
    render();
  } else {
    finish();
  }
}

function goPrev() {
  if (session.index > 0) {
    session.index -= 1;
    snapshot();
    render();
  }
}

function toggleMarkCurrent() {
  store.toggleMark(currentQuestion().id);
  render();
}

function restartReview() {
  session.index = 0;
  show('quiz');
  render();
}

function finish() {
  const total = session.items.length;
  const correct = session.items
    .filter((i) => pickedAnswer(i.picked) === i.view.correct).length;
  $('result-score').textContent =
    `${correct}/${total} câu đúng (${Math.round((correct / total) * 100)}%)`;
  $('result-list').innerHTML = '';
  session.items.forEach((item, index) => {
    const chosen = pickedAnswer(item.picked);
    const ok = chosen === item.view.correct;
    const title = ok
      ? `Câu ${index + 1}: Đúng`
      : `Câu ${index + 1}: Sai — bạn chọn ${chosen || '(bỏ trống)'}, `
        + `đúng là ${item.view.correct}`;
    $('result-list').append(summaryRow(
      title, item.view.question.question, item.view.question.explanation,
      ok ? 'ok' : 'bad',
    ));
  });
  store.addHistory({ title: session.title, correct, total });
  store.clearSession();          // bai da nop thi khong con dang lam do
  show('result');
  refreshHome();
}

  App.hasSession = hasSession;
  App.currentQuestion = currentQuestion;
  App.startSession = startSession;
  App.resumeSession = resumeSession;
  App.render = render;
  App.goNext = goNext;
  App.goPrev = goPrev;
  App.toggleMarkCurrent = toggleMarkCurrent;
  App.restartReview = restartReview;
  App.finish = finish;
}(window.OnThi = window.OnThi || {}));
