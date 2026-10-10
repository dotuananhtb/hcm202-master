(function (App) {
'use strict';
  // Lay cac ham dung chung tu namespace (cac file truoc da nap xong)
  const { el } = App;

// Hien thi mot cau hoi + phan hoi sau khi tra loi.

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Chuan bi mot cau de hien thi, giu nguyen thu tu A/B/C/D nhu de goc. */
function prepare(question) {
  const order = Object.keys(question.options);
  const correct = question.answer || '';
  return {
    question,
    order,
    displayLabels: LABELS,
    correct,
    required: correct.length || 1,   // so dap an phai chon
    crowd: question.crowd_answer || '',
    textOf: (key) => question.options[key],
  };
}

/** Da chon du so dap an chua. */
function isAnswered(view, picked) {
  return picked.length === view.required;
}

/** Chuoi dap an nguoi dung chon, sap theo thu tu chu cai: ['C','A'] -> 'AC'. */
function pickedAnswer(picked) {
  return [...picked].sort().join('');
}

/** Dong nhac "cau nay chon may dap an", chi hien khi can chon tu 2 tro len. */
function renderHint(node, view, picked) {
  if (view.required < 2) {
    node.classList.add('hidden');
    return;
  }
  node.classList.remove('hidden');
  node.textContent = isAnswered(view, picked)
    ? `Câu này chọn ${view.required} đáp án — đã chọn đủ`
    : `Câu này chọn ${view.required} đáp án — đã chọn ${picked.length}/${view.required}`
      + ' (bấm lại để bỏ chọn)';
}

/**
 * Ve danh sach lua chon.
 * reveal = true  -> cham diem luon (to xanh dap an dung, do dap an sai)
 * reveal = false -> chi danh dau o da chon, van cho doi y (che do thi thu)
 */
function renderOptions(container, view, picked, onPick, reveal = true) {
  const graded = reveal && isAnswered(view, picked);
  container.innerHTML = '';
  view.order.forEach((key, index) => {
    const label = LABELS[index];
    const button = el('button', 'option');
    button.type = 'button';
    button.append(el('span', 'key', label), el('span', 'body', view.textOf(key)));
    if (graded) {
      button.disabled = true;
      if (view.correct.includes(label)) button.classList.add('correct');
      else if (picked.includes(label)) button.classList.add('wrong');
    } else {
      // Chua cham diem: cho bam de chon va bam lai de bo chon
      if (picked.includes(label)) button.classList.add('chosen');
      button.addEventListener('click', () => onPick(label));
    }
    container.append(button);
  });
}

/** Ve khoi giai thich sau khi tra loi. */
function renderFeedback(container, view, picked) {
  const { question } = view;
  const chosen = pickedAnswer(picked);
  const isCorrect = chosen === view.correct;
  container.innerHTML = '';
  container.classList.remove('hidden');

  const verdict = el('div', `verdict ${isCorrect ? 'ok' : 'bad'}`,
    isCorrect ? '✓ Chính xác'
      : `✗ Sai — bạn chọn ${chosen || '(bỏ trống)'}, đáp án đúng là ${view.correct}`);
  container.append(verdict);

  const tags = el('div');
  if (view.required > 1) {
    tags.append(el('span', 'tag', `Câu chọn ${view.required} đáp án`));
  }
  const confidence = { cao: 'ok', trung_binh: 'warn', thap: 'warn' }[question.confidence] || 'warn';
  tags.append(el('span', `tag ${confidence}`, `Claude tin cậy: ${
    { cao: 'cao', trung_binh: 'trung bình', thap: 'thấp' }[question.confidence] || '?'}`));

  if (question.crowd_split) {
    tags.append(el('span', 'tag warn',
      `Sinh viên không thống nhất (${view.crowd.split('').join(' / ')})`));
  } else if (view.crowd) {
    const agree = view.crowd === view.correct;
    tags.append(el('span', `tag ${agree ? 'ok' : 'warn'}`,
      agree ? `Sinh viên cũng chọn ${view.crowd}` : `Sinh viên chọn ${view.crowd} — Claude không đồng ý`));
  } else {
    tags.append(el('span', 'tag warn', 'Chưa có ai bình luận đáp án'));
  }
  if (question.textbook_answer) {
    tags.append(el('span', 'tag ok', 'Giáo trình xác nhận'));
  } else if (question.textbook_dissent) {
    tags.append(el('span', 'tag warn',
      `Đoạn giáo trình lại nghiêng về ${question.textbook_dissent} — tự đọc trích dẫn bên dưới rồi quyết`));
  } else if (question.settled) {
    tags.append(el('span', 'tag ok', 'Hai lần giải độc lập cho cùng đáp án'));
  }
  if (question.recovered_from) {
    tags.append(el('span', 'tag ok', 'Chữ lấy từ bản đầy đủ ở đề khác'));
  } else if (question.source_truncated) {
    tags.append(el('span', 'tag warn',
      'Ảnh gốc bị chụp thiếu mép phải — Claude đã bù phần thiếu, nên xem ảnh gốc đối chiếu'));
  }
  if (question.duplicates > 0) {
    tags.append(el('span', 'tag', `Xuất hiện lại ${question.duplicates} lần ở đề khác`));
  }
  container.append(tags);

  const explain = el('div', 'explain-block');
  explain.append(el('h4', null, 'Vì sao?'), el('p', null, question.explanation || '—'));
  container.append(explain);

  // Cau trich giao trinh la bang chung manh nhat -> hien rieng, de nhin
  if (question.textbook_quote) {
    const source = el('div', 'quote');
    source.append(el('h4', null, 'Giáo trình viết:'),
                  el('blockquote', null, question.textbook_quote));
    container.append(source);
  }

  if (question.needs_review) {
    container.append(el('p', 'muted small review-note',
      '⚠ Câu này nên kiểm tra lại với giáo trình: Claude và đáp án của sinh viên chưa thống nhất hoặc Claude không chắc chắn.'));
  }
}

  App.prepare = prepare;
  App.isAnswered = isAnswered;
  App.pickedAnswer = pickedAnswer;
  App.renderHint = renderHint;
  App.renderOptions = renderOptions;
  App.renderFeedback = renderFeedback;
}(window.OnThi = window.OnThi || {}));
