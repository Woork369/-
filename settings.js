// ===== Конфигурация Сервера, Базы Данных и EmailJS =====
const MY_SUPABASE_URL = "https://supabase.co"; 
const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 

const EMAILJS_CONFIG = {
  publicKey:  'S1NP5cFz0W79QnOiK',
  serviceId:  'service_v9f6zor',
  templateId: 'template_bcb0yly',
};

// Конфигурация тем оформления для динамического превью переменных CSS
const THEMES = {
  default: {
    '--bg-main': '#f4f6f9', '--bg-white': '#ffffff', '--border-color': '#e1e4e8',
    '--text-primary': '#1f2328', '--text-muted': '#656d76', '--primary-color': '#007aff',
    '--bubble-me': '#e1f3ff', '--bubble-other': '#ffffff'
  },
  dark: {
    '--bg-main': '#121212', '--bg-white': '#1c1c1e', '--border-color': '#2c2c2e',
    '--text-primary': '#f5f5f7', '--text-muted': '#8e8e93', '--primary-color': '#0a84ff',
    '--bubble-me': '#3a3a3c', '--bubble-other': '#2c2c2e'
  },
  ocean: {
    '--bg-main': '#0f172a', '--bg-white': '#1e293b', '--border-color': '#334155',
    '--text-primary': '#f8fafc', '--text-muted': '#94a3b8', '--primary-color': '#38bdf8',
    '--bubble-me': '#0369a1', '--bubble-other': '#1e293b'
  },
  mint: {
    '--bg-main': '#f0f4f1', '--bg-white': '#ffffff', '--border-color': '#d1ded4',
    '--text-primary': '#2e3b32', '--text-muted': '#6b7c70', '--primary-color': '#2e7d32',
    '--bubble-me': '#e8f5e9', '--bubble-other': '#ffffff'
  }
};

// ===== Умный Драйвер Хранилища =====
const Store = {
  getTargetStorage() {
    const activeUser = localStorage.getItem('leto_active_user') || 'default';
    const savedType = localStorage.getItem(activeUser + '_storage_type');
    return savedType === 'sessionstorage' ? sessionStorage : localStorage;
  },
  get(key, fallback = null) {
    let v = this.getTargetStorage().getItem(key);
    if (v === null) v = localStorage.getItem(key);
    if (v === null) v = sessionStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  },
  set(key, val) {
    this.getTargetStorage().setItem(key, JSON.stringify(val));
  },
  remove(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

const currentActiveUser = localStorage.getItem('leto_active_user') || 'Гость';

// ===== Состояние верификации =====
let currentVerifyType = null;
let pendingCode = null;
let resendTimer = null;
let resendSeconds = 0;

// ===== Инициализация при загрузке =====
function initSettings() {
  const usernameEl = document.getElementById('settings-username');
  if (usernameEl) usernameEl.textContent = currentActiveUser;

  updateEmailUI();
  updatePhoneUI();
  loadAllConfigs();
}

// ===== UI: Email =====
function updateEmailUI() {
  const email = Store.get(currentActiveUser + '_email');
  const verified = Store.get(currentActiveUser + '_email_verified', false);

  const statusEl = document.getElementById('email-status');
  const badgeEl  = document.getElementById('email-badge');
  const btnEl    = document.getElementById('email-action-btn');

  if (!statusEl || !badgeEl || !btnEl) return;

  if (email && verified) {
    statusEl.textContent = email;
    statusEl.className = 'field-value verified';
    badgeEl.textContent = 'Подтверждён';
    badgeEl.className = 'badge badge-verified';
    btnEl.textContent = 'Изменить';
    btnEl.className = 'btn btn-secondary';
  } else if (email && !verified) {
    statusEl.textContent = email + ' — ожидает подтверждения';
    statusEl.className = 'field-value unverified';
    badgeEl.textContent = 'Не подтверждён';
    badgeEl.className = 'badge badge-unverified';
    btnEl.textContent = 'Подтвердить';
    btnEl.className = 'btn btn-primary';
  } else {
    statusEl.textContent = 'Не привязан';
    statusEl.className = 'field-value unverified';
    badgeEl.textContent = 'Не подтверждён';
    badgeEl.className = 'badge badge-unverified';
    btnEl.textContent = 'Привязать';
    btnEl.className = 'btn btn-primary';
  }
}

// ===== UI: Телефон =====
function updatePhoneUI() {
  const phone = Store.get(currentActiveUser + '_phone');
  const verified = Store.get(currentActiveUser + '_phone_verified', false);

  const statusEl = document.getElementById('phone-status');
  const badgeEl  = document.getElementById('phone-badge');
  const btnEl    = document.getElementById('phone-action-btn');

  if (!statusEl || !badgeEl || !btnEl) return;

  if (phone && verified) {
    statusEl.textContent = formatPhone(phone);
    statusEl.className = 'field-value verified';
    badgeEl.textContent = 'Подтверждён';
    badgeEl.className = 'badge badge-verified';
    btnEl.textContent = 'Изменить';
    btnEl.className = 'btn btn-secondary';
  } else if (phone && !verified) {
    statusEl.textContent = formatPhone(phone) + ' — ожидает подтверждения';
    statusEl.className = 'field-value unverified';
    badgeEl.textContent = 'Не подтверждён';
    badgeEl.className = 'badge badge-unverified';
    btnEl.textContent = 'Подтвердить';
    btnEl.className = 'btn btn-primary';
  } else {
    statusEl.textContent = 'Не привязан';
    statusEl.className = 'field-value unverified';
    badgeEl.textContent = 'Не подтверждён';
    badgeEl.className = 'badge badge-unverified';
    btnEl.textContent = 'Привязать';
    btnEl.className = 'btn btn-primary';
  }
}

// ===== Применение темы оформления =====
function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.default;
  const root = document.documentElement;
  Object.keys(theme).forEach(key => { root.style.setProperty(key, theme[key]); });
}

// ===== Экспорт бэкапа данных в файл =====
function downloadUserDataFile() {
  const backupData = {
    username: currentActiveUser,
    email: Store.get(currentActiveUser + '_email', 'Не указан'),
    email_verified: Store.get(currentActiveUser + '_email_verified', false),
    phone: Store.get(currentActiveUser + '_phone', 'Не указан'),
    phone_verified: Store.get(currentActiveUser + '_phone_verified', false),
    avatar_url: Store.get(currentActiveUser + '_avatar_url', ''),
    theme: Store.get(currentActiveUser + '_theme', 'default'),
    font_size: Store.get(currentActiveUser + '_font_size', '15px'),
    sound_enabled: Store.get(currentActiveUser + '_sound', true),
    online_visible: Store.get(currentActiveUser + '_online', true),
    storage_type: localStorage.getItem(currentActiveUser + '_storage_type') || 'localstorage',
    exported_at: new Date().toLocaleString('ru-RU')
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `leto_config_${currentActiveUser.toLowerCase()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// ===== Импорт бэкапа данных из файла =====
function uploadUserDataFile(event) {
  const file = event.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.username) {
        const user = data.username;
        if (data.email) Store.set(user + '_email', data.email);
        if (data.email_verified !== undefined) Store.set(user + '_email_verified', data.email_verified);
        if (data.phone) Store.set(user + '_phone', data.phone);
        if (data.phone_verified !== undefined) Store.set(user + '_phone_verified', data.phone_verified);
        if (data.avatar_url) Store.set(user + '_avatar_url', data.avatar_url);
        if (data.theme) Store.set(user + '_theme', data.theme);
        if (data.font_size) Store.set(user + '_font_size', data.font_size);
        if (data.sound_enabled !== undefined) Store.set(user + '_sound', data.sound_enabled);
        if (data.online_visible !== undefined) Store.set(user + '_online', data.online_visible);
        if (data.storage_type) localStorage.setItem(user + '_storage_type', data.storage_type);
        initSettings();
      }
    } catch (err) {}
  };
  reader.readAsText(file);
}

// ===== Сохранение подтвержденной почты в Supabase =====
async function saveEmailToSupabase(emailValue) {
  const modifiedUsername = currentActiveUser + " (почта)";
  try {
    await fetch(MY_SUPABASE_URL + "/rest/v1/user", {
      method: "POST",
      headers: { 
        "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY,
        "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({ 
        username: currentActiveUser.toLowerCase(), display_name: modifiedUsername,
        linked_email: emailValue, verified_at: new Date().toISOString()
      })
    });
  } catch (err) {}
}

// ===== Запуск верификации Email =====
async function startEmailVerification() {
  const existingEmail = Store.get(currentActiveUser + '_email', '');
  const newEmail = prompt('Введите ваш email:', existingEmail);

  if (!newEmail || !newEmail.trim()) return;
  const email = newEmail.trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Некорректный email.');
    return;
  }

  Store.set(currentActiveUser + '_email', email);
  Store.set(currentActiveUser + '_email_verified', false);

  currentVerifyType = 'email';
  await sendCode('email', email);
}

// ===== Запуск верификации Телефона =====
async function startPhoneVerification() {
  const existingPhone = Store.get(currentActiveUser + '_phone', '');
  const newPhone = prompt('Введите номер телефона (+7...):', existingPhone);

  if (!newPhone || !newPhone.trim()) return;
  const phone = newPhone.trim();

  const phoneRegex = /^\+?\d{10,15}$/;
  if (!phoneRegex.test(phone.replace(/[\s\-()]/g, ''))) {
    alert('Некорректный номер телефона.');
    return;
  }

  Store.set(currentActiveUser + '_phone', phone);
  Store.set(currentActiveUser + '_phone_verified', false);

  currentVerifyType = 'phone';
  await sendCode('phone', phone);
}

// ===== Отправка кода =====
async function sendCode(type, target) {
  pendingCode = generateCode();

  Store.set('pending_code_' + type, {
    code: pendingCode,
    target: target,
    timestamp: Date.now(),
  });

  if (type === 'email') {
    await sendEmailCode(target, pendingCode);
  } else {
    await sendPhoneCode(target, pendingCode);
  }
}

// ===== Отправка через EmailJS =====
async function sendEmailCode(email, code) {
  openCodeModal('email', email);

  const payload = {
    service_id:      EMAILJS_CONFIG.serviceId,
    template_id:     EMAILJS_CONFIG.templateId,
    user_id:         EMAILJS_CONFIG.publicKey,
    template_params: {
      to_email:          email,
      name:              currentActiveUser,
      verification_code: code,
    },
  };

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (res.ok) {
      setModalStatus('Код отправлен на ' + email, 'success');
      startResendTimer();
    } else {
      const err = await res.json().catch(() => ({}));
      setModalStatus('Ошибка: ' + (err.message || res.statusText), 'error');
    }
  } catch (err) {
    setModalStatus('Сетевая ошибка: ' + (err.message || err), 'error');
  }
}

// ===== Отправка SMS (заглушка) =====
async function sendPhoneCode(phone, code) {
  openCodeModal('phone', phone);

  console.log('[DEV] Код для ' + phone + ': ' + code);
  await new Promise(r => setTimeout(r, 500));

  setModalStatus('Код отправлен на ' + formatPhone(phone), 'success');
  startResendTimer();
}

// ===== Модалка ввода кода =====
function openCodeModal(type, target) {
  const modal = document.getElementById('code-modal');
  const title = document.getElementById('modal-title');
  const desc  = document.getElementById('modal-description');

  if (title) title.textContent = 'Введите код';
  if (desc) {
    desc.textContent  = type === 'email'
      ? 'Мы отправили код на ' + target
      : 'Мы отправили SMS на ' + formatPhone(target);
  }

  clearCodeInputs();
  setModalStatus('', '');
  if (modal) modal.classList.add('active');

  setTimeout(() => {
    const first = document.querySelector('.code-digit[data-index="0"]');
    if (first) first.focus();
  }, 100);
}

function closeModal() {
  const modal = document.getElementById('code-modal');
  if (modal) modal.classList.remove('active');
  stopResendTimer();
  currentVerifyType = null;
  pendingCode = null;
}

// ===== Проверка кода из модалки =====
async function verifyCodeFromModal() {
  const digits = document.querySelectorAll('.code-digit');
  const userCode = Array.from(digits).map(d => d.value).join('');

  if (userCode.length < 4) {
    setModalStatus('Введите все 4 цифры.', 'error');
    return;
  }

  const stored = Store.get('pending_code_' + currentVerifyType);
  if (!stored) {
    setModalStatus('Код истёк. Запросите новый.', 'error');
    return;
  }

  const ageMs = Date.now() - stored.timestamp;
  if (ageMs > 5 * 60 * 1000) {
    setModalStatus('Код истёк. Запросите новый.', 'error');
    Store.remove('pending_code_' + currentVerifyType);
    return;
  }

  if (userCode === stored.code) {
    Store.remove('pending_code_' + currentVerifyType);

    if (currentVerifyType === 'email') {
      Store.set(currentActiveUser + '_email_verified', true);
      setModalStatus('Email подтверждён!', 'success');
      await saveEmailToSupabase(stored.target);
      setTimeout(() => {
        closeModal();
        updateEmailUI();
      }, 1200);
    } else {
      Store.set(currentActiveUser + '_phone_verified', true);
      setModalStatus('Телефон подтверждён!', 'success');
      setTimeout(() => {
        closeModal();
        updatePhoneUI();
      }, 1200);
    }
  } else {
    setModalStatus('Неверный код. Попробуйте ещё раз.', 'error');
    clearCodeInputs();
    const first = document.querySelector('.code-digit[data-index="0"]');
    if (first) first.focus();
  }
}

// ===== Повторная отправка =====
function resendCode() {
  if (resendSeconds > 0) return;

  const type = currentVerifyType;
  const target = type === 'email'
    ? Store.get(currentActiveUser + '_email')
    : Store.get(currentActiveUser + '_phone');

  if (!target) return;

  sendCode(type, target);
}

function startResendTimer() {
  stopResendTimer();
  resendSeconds = 30;
  updateResendLink();

  resendTimer = setInterval(() => {
    resendSeconds--;
    if (resendSeconds <= 0) {
      stopResendTimer();
    } else {
      updateResendLink();
    }
  }, 1000);
}

function stopResendTimer() {
  if (resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
  resendSeconds = 0;
  updateResendLink();
}

function updateResendLink() {
  const link = document.getElementById('resend-link');
  if (!link) return;

  if (resendSeconds > 0) {
    link.textContent = 'Отправить повторно через ' + resendSeconds + ' сек';
    link.classList.add('disabled');
  } else {
    link.textContent = 'Отправить код повторно';
    link.classList.remove('disabled');
  }
}

// ===== Вспомогательные функции =====
function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return '+' + digits + ' ' + digits.slice(1, 4) + ' ' +
           digits.slice(4, 7) + '-' + digits.slice(7, 9) + '-' + digits.slice(9);
  }
  return phone;
}

function setModalStatus(text, type) {
  const el = document.getElementById('modal-status');
  if (el) {
    el.textContent = text;
    el.className = 'modal-status ' + (type || '');
  }
}

function clearCodeInputs() {
  document.querySelectorAll('.code-digit').forEach(d => d.value = '');
}

function loadAllConfigs() {
  const savedAv = Store.get(currentActiveUser + '_avatar_url');
  if (savedAv) document.getElementById('avatar-preview').style.backgroundImage = `url('${savedAv}')`;
  
  const th = Store.get(currentActiveUser + '_theme', 'default');
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) themeSelect.value = th;
  applyTheme(th);

  const fontSizeSelect = document.getElementById('font-size-select');
  if (fontSizeSelect) fontSizeSelect.value = Store.get(currentActiveUser + '_font_size', '15px');

  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) soundToggle.checked = Store.get(currentActiveUser + '_sound', true);

  const onlineToggle = document.getElementById('online-status-toggle');
  if (onlineToggle) onlineToggle.checked = Store.get(currentActiveUser + '_online', true);

  const storageSelect = document.getElementById('storage-type-select');
  if (storageSelect) storageSelect.value = localStorage.getItem(currentActiveUser + '_storage_type') || 'localstorage';
}

// ===== Автопереход между цифрами кода и слушатели событий =====
document.addEventListener('DOMContentLoaded', () => {
  initSettings();

  const digits = document.querySelectorAll('.code-digit');
  digits.forEach((digit, idx) => {
    digit.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
      if (e.target.value && idx < digits.length - 1) {
        digits[idx + 1].focus();
      }
      if (idx === digits.length - 1 && e.target.value) {
        const allFilled = Array.from(digits).every(d => d.value);
        if (allFilled) {
          setTimeout(verifyCodeFromModal, 300);
        }
      }
    });

    digit.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        digits[idx - 1].focus();
      }
      if (e.key === 'Enter') {
        verifyCodeFromModal();
      }
    });
  });

  const modalObj = document.getElementById('code-modal');
  if (modalObj) {
    modalObj.addEventListener('click', (e) => {
      if (e.target.id === 'code-modal') {
        closeModal();
      }
    });
  }

  // Настройка обработчиков элементов интерфейса
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => { 
      Store.set(currentActiveUser + '_theme', e.target.value); 
      applyTheme(e.target.value); 
    });
  }

  const fontSizeSelect = document.getElementById('font-size-select');
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', (e) => { 
      Store.set(currentActiveUser + '_font_size', e.target.value); 
    });
  }

  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    soundToggle.addEventListener('change', (e) => { 
      Store.set(currentActiveUser + '_sound', e.target.checked); 
    });
  }

  const onlineToggle = document.getElementById('online-status-toggle');
  if (onlineToggle) {
    onlineToggle.addEventListener('change', (e) => { 
      Store.set(currentActiveUser + '_online', e.target.checked); 
    });
  }

  const storageSelect = document.getElementById('storage-type-select');
  if (storageSelect) {
    storageSelect.addEventListener('change', (e) => { 
      localStorage.setItem(currentActiveUser + '_storage_type', e.target.value); 
      initSettings(); 
    });
  }

  const importFile = document.getElementById('import-backup-file');
  if (importFile) importFile.addEventListener('change', uploadUserDataFile);

  // Загрузка аватарок в базу данных Supabase
  const avatarFile = document.getElementById('avatar-file');
  if (avatarFile) {
    avatarFile.addEventListener('change', function() {
      if (this.files.length === 0) return;
      const file = this.files;
      const fileName = "avatar_" + currentActiveUser.toLowerCase() + "_" + Date.now() + "." + file.name.split('.').pop();
      
      fetch(MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName, {
        method: "POST",
        headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": file.type },
        body: file
      })
      .then(res => res.json())
      .then(() => {
        const fullUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
        Store.set(currentActiveUser + '_avatar_url', fullUrl);
        const avatarPreview = document.getElementById('avatar-preview');
        if (avatarPreview) avatarPreview.style.backgroundImage = `url('${fullUrl}')`;
        
        return fetch(MY_SUPABASE_URL + "/rest/v1/user", {
          method: "POST",
          headers: { 
            "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, 
            "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" 
          },
          body: JSON.stringify({ username: currentActiveUser.toLowerCase(), avatar_url: fullUrl, avatar_updated_at: new Date().toISOString() })
        });
      });
    });
  }
});