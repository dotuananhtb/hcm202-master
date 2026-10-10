// Dong bo tien do trang HCM202 co dong len Firebase Realtime Database (project mln131-4f80d).
// Dang nhap Google; moi nguoi chi doc/ghi nhanh hcmMaster/{uid} (xem database.rules.json cua tinh-luot).
// Chi nap khi mo qua http(s); ban file:// do hcm-master.js xu ly (Firebase Auth khong chay tren file://).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, get, onValue, ref, serverTimestamp, set,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

// Cau hinh web Firebase cong khai theo thiet ke; quyen truy cap do database rules kiem soat.
const firebaseConfig = {
  apiKey: 'AIzaSyBmQ1QPk7jvERaumRIVmr5XZsSOuNbpT-M',
  authDomain: 'mln131-4f80d.firebaseapp.com',
  databaseURL: 'https://mln131-4f80d-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'mln131-4f80d',
  appId: '1:759881238401:web:708ce5cf6908923f93ca80',
};

const SAVE_DELAY_MS = 1200;
// Cac email dung chung 1 ngan tien do (rules: nhanh hcmShared/<ma> chi cho dung cac email nay)
const SHARED_BY_EMAIL = {
  'dotuananhofficial@gmail.com': 'dotuananh',
  'tuananhx939@gmail.com': 'dotuananh',
};
const box = document.getElementById('sync-box');
const master = window.HcmMaster;

/** Moi trinh duyet 1 ma rieng de bo qua ban ghi do chinh minh vua day len. */
function deviceId() {
  try {
    let id = localStorage.getItem('hcm-master-device');
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      localStorage.setItem('hcm-master-device', id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

function button(label, onClick, className = 'ghost') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${className} sync-btn`;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function status(text, tone = '') {
  const span = document.createElement('span');
  span.className = `sync-status ${tone}`;
  span.textContent = text;
  return span;
}

function startSync() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const me = deviceId();
  let stopListen = () => {};
  let saveTimer = null;
  let lastSent = '';
  let user = null;
  let currentNode = null;

  const showSignedOut = (note) => {
    box.replaceChildren(
      ...(note ? [status(note, 'warn')] : [status('Chưa đăng nhập — tiến độ chỉ lưu trên trình duyệt này')]),
      button('Đăng nhập Google để lưu tiến độ', () => signInWithPopup(auth, new GoogleAuthProvider())
        .catch((error) => showSignedOut(`Đăng nhập lỗi: ${error.code || error.message}`)), 'secondary'),
    );
  };

  const showSignedIn = (text, tone = 'ok') => {
    box.replaceChildren(
      status(`${user.email}${SHARED_BY_EMAIL[(user.email || '').toLowerCase()] ? ' (tiến độ chung 2 tài khoản)' : ''} · ${text}`, tone),
      button('Đăng xuất', () => signOut(auth)),
    );
  };

  const push = () => {
    if (!user || !currentNode) return;
    const data = JSON.stringify(master.snapshot());
    if (data === lastSent) return;
    lastSent = data;
    set(currentNode, { data, t: serverTimestamp(), device: me })
      .then(() => showSignedIn(`đã lưu lên mây ${new Date().toLocaleTimeString('vi-VN')}`))
      .catch((error) => showSignedIn(`chưa lưu được (${error.code || error.message})`, 'warn'));
  };

  master.onSave(() => {
    if (!user) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(push, SAVE_DELAY_MS);
  });

  onAuthStateChanged(auth, async (signedIn) => {
    stopListen();
    user = signedIn;
    currentNode = null;
    if (!user) {
      showSignedOut();
      return;
    }
    showSignedIn('đang tải tiến độ…', '');
    const shared = SHARED_BY_EMAIL[(user.email || '').toLowerCase()];
    const own = ref(db, `hcmMaster/${user.uid}`);
    const node = shared ? ref(db, `hcmShared/${shared}`) : own;
    currentNode = node;
    try {
      // Lan dau dang nhap tren may nay: gop tien do may + may (khong mat cau da hoc o dau ca)
      const snap = await get(node);
      if (snap.exists()) master.merge(JSON.parse(snap.val().data));
      // Email dung ngan chung: gop ca tien do cu da luu o ngan rieng truoc day
      if (shared) {
        const legacy = await get(own);
        if (legacy.exists()) master.merge(JSON.parse(legacy.val().data));
      }
      push();
      // Thay doi tu thiet bi khac (vd. dien thoai) -> lay ve thay the
      stopListen = onValue(node, (live) => {
        const value = live.val();
        if (!value || value.device === me || value.data === lastSent) return;
        lastSent = value.data;
        master.replace(JSON.parse(value.data));
        showSignedIn(`đã nhận tiến độ từ thiết bị khác ${new Date().toLocaleTimeString('vi-VN')}`);
      });
    } catch (error) {
      showSignedIn(`không đọc được tiến độ trên mây (${error.code || error.message})`, 'warn');
    }
  });
}

if (master && box) startSync();
