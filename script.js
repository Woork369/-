// =======================================================
// ☀️ АВТОРИЗАЦИЯ «ЛЕТО»
// Обычный вход + регистрация + 3 альтернативных способа
// =======================================================

document.addEventListener('DOMContentLoaded', () => {

    // =======================================================
    // КОНСТАНТЫ
    // =======================================================
    const MY_SUPABASE_URL = "https://rvmtghettsndnnhdeasx.supabase.co";
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q";

    const USERS_URL    = `${MY_SUPABASE_URL}/rest/v1/user`;
    const PROFILES_URL = `${MY_SUPABASE_URL}/rest/v1/profiles`;
    const BACKUP_URL   = `${MY_SUPABASE_URL}/rest/v1/backup_keys`;

    const HEADERS_GET = {
        "apikey": MY_SERVER_KEY,
        "Authorization": `Bearer ${MY_SERVER_KEY}`
    };
    const HEADERS_POST = {
        "apikey": MY_SERVER_KEY,
        "Authorization": `Bearer ${MY_SERVER_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };

    const ADMIN_MASTER_KEY = "LETO_SECURE_2026";
    const BAN_PASSWORD_LIST = ["123456", "12345678", "123456789", "qwerty", "password", "111111", "000000"];

    let currentMode = 'login';

    // =======================================================
    // ЭКРАНЫ
    // =======================================================
    const screenMain = document.getElementById('screen-main');
    const screenEmail = document.getElementById('screen-email');
    const screenDevice = document.getElementById('screen-device');
    const screenBackup = document.getElementById('screen-backup');
    const methodPicker = document.getElementById('method-picker');

    const screens = {
        main: screenMain,
        email: screenEmail,
        device: screenDevice,
        backup: screenBackup
    };

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[name]) screens[name].classList.add('active');
    }

    // =======================================================
    // ОСНОВНОЙ ЭКРАН
    // =======================================================
    const authForm = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-auth-mode');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('submit-btn');
    const authMessage = document.getElementById('auth-message');
    const usernameInput = document.getElementById('username');
    const userPasswordInput = document.getElementById('user-password');
    const adminKeyInput = document.getElementById('admin-key');

    toggleBtn.addEventListener('click', () => {
        authMessage.className = "message-box";
        authMessage.textContent = "";

        if (currentMode === 'login') {
            currentMode = 'register';
            authTitle.textContent = "Регистрация в Лето";
            authSubtitle.textContent = "Создайте новый аккаунт в приватной сети";
            submitBtn.textContent = "Зарегистрироваться";
            toggleBtn.textContent = "Войти";
            userPasswordInput.setAttribute('autocomplete', 'new-password');
        } else {
            currentMode = 'login';
            authTitle.textContent = "Войти в мессенджер";
            authSubtitle.textContent = "Введите ваши данные для входа в сеть Лето";
            submitBtn.textContent = "Войти";
            toggleBtn.textContent = "Зарегистрироваться";
            userPasswordInput.setAttribute('autocomplete', 'current-password');
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authMessage.className = "message-box";
        authMessage.textContent = "";

        const username = usernameInput.value.trim().toLowerCase();
        const userPassword = userPasswordInput.value;
        const adminKey = adminKeyInput.value;

        if (adminKey !== ADMIN_MASTER_KEY) {
            authMessage.className = "message-box error";
            authMessage.textContent = "Ошибка доступа: неверный ключ администратора.";
            adminKeyInput.value = "";
            return;
        }
        if (username.length < 3) {
            authMessage.className = "message-box error";
            authMessage.textContent = "Имя должно содержать не менее 3 символов.";
            return;
        }
        if (userPassword.length < 6) {
            authMessage.className = "message-box error";
            authMessage.textContent = "Пароль должен состоять из 6 или более символов.";
            return;
        }
        if (BAN_PASSWORD_LIST.includes(userPassword) || /^(\d)\1+$/.test(userPassword)) {
            authMessage.className = "message-box error";
            authMessage.textContent = "Ошибка: этот пароль слишком простой и небезопасный.";
            return;
        }

        if (currentMode === 'register') {
            await doRegister(username, userPassword);
        } else {
            await doLogin(username, userPassword);
        }
    });

    async function doRegister(username, password) {
        authMessage.className = "message-box success";
        authMessage.textContent = "Проверка имени на сервере...";

        try {
            const check = await fetch(`${USERS_URL}?username=eq.${username}`, {
                method: "GET", headers: HEADERS_GET
            });
            const users = await check.json();
            if (users.length > 0) {
                authMessage.className = "message-box error";
                authMessage.textContent = "Пользователь с таким именем уже существует.";
                return;
            }

            const res = await fetch(USERS_URL, {
                method: "POST", headers: HEADERS_POST,
                body: JSON.stringify({
                    username: username,
                    password: password,
                    created_at: new Date().toISOString()
                })
            });

            if (!res.ok) throw new Error("Не удалось сохранить данные на сервере.");

            localStorage.setItem('leto_active_user', username);
            authMessage.className = "message-box success";
            authMessage.textContent = "Регистрация успешна! Переход...";
            setTimeout(() => { window.location.href = "messenger.html"; }, 1200);
        } catch (err) {
            authMessage.className = "message-box error";
            authMessage.textContent = "Ошибка: " + err.message;
        }
    }

    async function doLogin(username, password) {
        authMessage.className = "message-box success";
        authMessage.textContent = "Проверка учетных данных...";

        try {
            const res = await fetch(`${USERS_URL}?username=eq.${username}`, {
                method: "GET", headers: HEADERS_GET
            });
            const users = await res.json();

            if (users.length === 0) {
                authMessage.className = "message-box error";
                authMessage.textContent = "Такого аккаунта не существует.";
                return;
            }
            if (users[0].password !== password) {
                authMessage.className = "message-box error";
                authMessage.textContent = "Неверный пароль учетной записи.";
                return;
            }

            localStorage.setItem('leto_active_user', username);
            sessionStorage.removeItem('leto_2fa_passed');

            const twoFAEnabled = await is2FAEnabled(username);
            if (twoFAEnabled) {
                const email = await getUserEmail(username);
                if (!email) {
                    authMessage.className = "message-box error";
                    authMessage.textContent = "2FA включена, но почта не привязана.";
                    return;
                }
                authMessage.className = "message-box success";
                authMessage.textContent = "Введите код из письма...";
                setTimeout(() => { window.location.href = "2fa.html"; }, 900);
            } else {
                authMessage.className = "message-box success";
                authMessage.textContent = "Вход выполнен! Переход...";
                setTimeout(() => { window.location.href = "messenger.html"; }, 1200);
            }
        } catch (err) {
            authMessage.className = "message-box error";
            authMessage.textContent = "Ошибка: " + err.message;
        }
    }

    async function is2FAEnabled(username) {
        try {
            const res = await fetch(`${PROFILES_URL}?username=eq.${username}`, {
                method: "GET", headers: HEADERS_GET
            });
            const rows = await res.json();
            if (rows && rows[0]) return rows[0].two_factor_enabled === true;
        } catch (e) {}
        return false;
    }

    async function getUserEmail(username) {
        try {
            const res = await fetch(`${PROFILES_URL}?username=eq.${username}`, {
                method: "GET", headers: HEADERS_GET
            });
            const rows = await res.json();
            if (rows && rows[0]) return rows[0].notify_email || '';
        } catch (e) {}
        return '';
    }

    // =======================================================
    // МОДАЛКА ВЫБОРА СПОСОБА
    // =======================================================
    document.getElementById('open-other-methods-btn').addEventListener('click', () => {
        methodPicker.classList.add('active');
    });

    document.getElementById('method-picker-cancel').addEventListener('click', () => {
        methodPicker.classList.remove('active');
    });

    methodPicker.addEventListener('click', (e) => {
        if (e.target === methodPicker) methodPicker.classList.remove('active');
    });

    document.querySelectorAll('.method-picker-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const m = opt.getAttribute('data-method');
            methodPicker.classList.remove('active');
            showScreen(m);
        });
    });

    document.querySelectorAll('[data-back]').forEach(btn => {
        btn.addEventListener('click', () => showScreen('main'));
    });

    // =======================================================
    // СПОСОБ 1 — ВХОД ПО EMAIL
    // =======================================================
    const emailNickname = document.getElementById('email-nickname');
    const emailSendBtn = document.getElementById('email-send-btn');
    const emailStatus = document.getElementById('email-status');
    const emailStep1 = document.getElementById('email-step-1');
    const emailStep2 = document.getElementById('email-step-2');
    const emailHint = document.getElementById('email-hint');
    const emailCodeStatus = document.getElementById('email-code-status');
    const emailConfirmBtn = document.getElementById('email-confirm-btn');
    const emailResend = document.getElementById('email-resend');

    let emailResendTimer = null;
    let emailResendSec = 0;

    emailSendBtn.addEventListener('click', async () => {
        const u = emailNickname.value.trim().toLowerCase();
        if (!u) { setEmailStatus('Введите ник', 'error'); return; }

        setEmailStatus('Проверка ника...', '');

        try {
            const ures = await fetch(`${USERS_URL}?username=eq.${u}`, {
                method: "GET", headers: HEADERS_GET
            });
            const users = await ures.json();
            if (!users || users.length === 0) {
                setEmailStatus('Пользователь не найден', 'error');
                return;
            }

            const email = await getUserEmail(u);
            if (!email) {
                setEmailStatus('К этому аккаунту не привязана почта. Привяжите её в настройках.', 'error');
                return;
            }

            const code = String(Math.floor(1000 + Math.random() * 9000));
            localStorage.setItem('leto_pending_code_2fa', JSON.stringify({
                code: code, target: email, timestamp: Date.now(), username: u
            }));

            const eres = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: "service_v9f6zor",
                    template_id: "template_bcb0yly",
                    user_id: "S1NP5cFz0W79QnOiK",
                    template_params: {
                        to_email: email,
                        name: 'Пользователь Лето',
                        verification_code: code
                    }
                })
            });

            if (!eres.ok) {
                setEmailStatus('Ошибка отправки письма', 'error');
                return;
            }

            setEmailStatus('Код отправлен на ' + email, 'success');
            emailHint.textContent = 'Код отправлен на ' + email;
            emailStep1.style.display = 'none';
            emailStep2.style.display = 'block';
            startEmailResendTimer();
        } catch (e) {
            setEmailStatus('Ошибка: ' + e.message, 'error');
        }
    });

    function setEmailStatus(text, type) {
        emailStatus.textContent = text;
        emailStatus.className = 'message-box ' + (type || '');
    }
    function setEmailCodeStatus(text, type) {
        emailCodeStatus.textContent = text;
        emailCodeStatus.className = 'message-box ' + (type || '');
    }

    function startEmailResendTimer() {
        stopEmailResendTimer();
        emailResendSec = 30;
        updateEmailResend();
        emailResendTimer = setInterval(() => {
            emailResendSec--;
            if (emailResendSec <= 0) stopEmailResendTimer();
            else updateEmailResend();
        }, 1000);
    }
    function stopEmailResendTimer() {
        if (emailResendTimer) clearInterval(emailResendTimer);
        emailResendTimer = null;
        emailResendSec = 0;
        updateEmailResend();
    }
    function updateEmailResend() {
        if (emailResendSec > 0) {
            emailResend.textContent = 'Повторно через ' + emailResendSec + ' сек';
            emailResend.classList.add('disabled');
        } else {
            emailResend.textContent = 'Отправить код повторно';
            emailResend.classList.remove('disabled');
        }
    }

    emailResend.addEventListener('click', (e) => {
        e.preventDefault();
        if (emailResendSec > 0) return;
        emailSendBtn.click();
    });

    bindDigits('.email-digit', () => emailConfirmBtn.click());
    emailConfirmBtn.addEventListener('click', verifyEmailCode);

    function verifyEmailCode() {
        const digits = document.querySelectorAll('.email-digit');
        const code = Array.from(digits).map(d => d.value).join('');
        if (code.length < 4) { setEmailCodeStatus('Введите все 4 цифры', 'error'); return; }
        const stored = JSON.parse(localStorage.getItem('leto_pending_code_2fa') || 'null');
        if (!stored) { setEmailCodeStatus('Код истёк', 'error'); return; }
        if (Date.now() - stored.timestamp > 5 * 60 * 1000) {
            setEmailCodeStatus('Код истёк', 'error');
            localStorage.removeItem('leto_pending_code_2fa');
            return;
        }
        if (code === stored.code) {
            localStorage.removeItem('leto_pending_code_2fa');
            localStorage.setItem('leto_active_user', stored.username);
            sessionStorage.setItem('leto_2fa_passed', 'true');
            setEmailCodeStatus('Успех! Переход...', 'success');
            setTimeout(() => { window.location.href = 'messenger.html'; }, 900);
        } else {
            setEmailCodeStatus('Неверный код', 'error');
            digits.forEach(d => d.value = '');
            digits[0].focus();
        }
    }

    // =======================================================
    // СПОСОБ 2 — ВХОД ПО ДРУГОМУ УСТРОЙСТВУ
    // =======================================================
    const deviceNickname = document.getElementById('device-nickname');
    const deviceSendBtn = document.getElementById('device-send-btn');
    const deviceStatus = document.getElementById('device-status');
    const deviceStep1 = document.getElementById('device-step-1');
    const deviceStep2 = document.getElementById('device-step-2');
    const deviceCodeStatus = document.getElementById('device-code-status');

    function setDeviceStatus(text, type) {
        deviceStatus.textContent = text;
        deviceStatus.className = 'message-box ' + (type || '');
    }
    function setDeviceCodeStatus(text, type) {
        deviceCodeStatus.textContent = text;
        deviceCodeStatus.className = 'message-box ' + (type || '');
    }

    deviceSendBtn.addEventListener('click', async () => {
        const u = deviceNickname.value.trim().toLowerCase();
        if (!u) { setDeviceStatus('Введите ник', 'error'); return; }

        setDeviceStatus('Проверка ника...', '');

        try {
            const ures = await fetch(`${USERS_URL}?username=eq.${u}`, {
                method: "GET", headers: HEADERS_GET
            });
            const users = await ures.json();
            if (!users || users.length === 0) {
                setDeviceStatus('Пользователь не найден', 'error');
                return;
            }

            const code = String(Math.floor(1000 + Math.random() * 9000));
            for (let i = 0; i < 4; i++) {
                document.getElementById('device-digit-' + i).textContent = code[i];
            }

            setDeviceStatus('Запрос отправлен на доверенное устройство', 'success');
            deviceStep1.style.display = 'none';
            deviceStep2.style.display = 'block';
            setDeviceCodeStatus('Ожидание подтверждения...', '');

            await DeviceApproval.sendApprovalRequest(u, code);

            const result = await DeviceApproval.waitForResponse(u);

            if (result.timeout) {
                setDeviceCodeStatus('Время ожидания истекло. Попробуйте снова.', 'error');
                return;
            }
            if (result.approved) {
                localStorage.setItem('leto_active_user', u);
                sessionStorage.setItem('leto_2fa_passed', 'true');
                setDeviceCodeStatus('Подтверждено! Переход...', 'success');
                setTimeout(() => { window.location.href = 'messenger.html'; }, 900);
            } else {
                setDeviceCodeStatus('Вход отклонён', 'error');
            }
        } catch (e) {
            setDeviceStatus('Ошибка: ' + e.message, 'error');
        }
    });

    // =======================================================
    // СПОСОБ 3 — ВХОД ПО БЭКАПУ
    // =======================================================
    const backupNickname = document.getElementById('backup-nickname');
    const backupFileInput = document.getElementById('backup-file-input');
    const backupFileBtn = document.getElementById('backup-file-btn');
    const backupFileName = document.getElementById('backup-file-name');
    const backupStatus = document.getElementById('backup-status');
    const backupConfirmBtn = document.getElementById('backup-confirm-btn');

    let backupData = null;

    backupFileBtn.addEventListener('click', () => backupFileInput.click());

    backupFileInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;
        backupFileName.style.display = 'block';
        backupFileName.textContent = '📄 ' + file.name;
        setBackupStatus('Чтение файла...', '');

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.keys || !Array.isArray(data.keys) || data.keys.length !== 4) {
                setBackupStatus('Файл повреждён', 'error');
                return;
            }
            backupData = data;
            setBackupStatus('Файл загружен', 'success');
            backupConfirmBtn.disabled = false;
        } catch (e) {
            setBackupStatus('Ошибка чтения файла', 'error');
        }
    });

    function setBackupStatus(text, type) {
        backupStatus.textContent = text;
        backupStatus.className = 'message-box ' + (type || '');
    }

    backupConfirmBtn.addEventListener('click', async () => {
        const u = backupNickname.value.trim().toLowerCase();
        if (!u) { setBackupStatus('Введите ник', 'error'); return; }
        if (!backupData) { setBackupStatus('Загрузите файл', 'error'); return; }

        setBackupStatus('Сверка ключей...', '');

        try {
            const res = await fetch(`${BACKUP_URL}?username=eq.${u}`, {
                method: "GET", headers: HEADERS_GET
            });
            const rows = await res.json();
            if (!rows || rows.length === 0) {
                setBackupStatus('На сервере нет активной копии', 'error');
                return;
            }
            const db = rows[0];
            const ok = backupData.keys[0] === db.key1 &&
                       backupData.keys[1] === db.key2 &&
                       backupData.keys[2] === db.key3 &&
                       backupData.keys[3] === db.key4;
            if (!ok) {
                setBackupStatus('Бэкап повреждён или устарел', 'error');
                return;
            }

            await fetch(`${BACKUP_URL}?username=eq.${u}`, {
                method: "DELETE", headers: HEADERS_GET
            });

            localStorage.setItem('leto_active_user', u);
            sessionStorage.setItem('leto_2fa_passed', 'true');
            setBackupStatus('Бэкап подтверждён! Переход...', 'success');
            setTimeout(() => { window.location.href = 'messenger.html'; }, 900);
        } catch (e) {
            setBackupStatus('Ошибка: ' + e.message, 'error');
        }
    });

    // =======================================================
    // ОБЩЕЕ — автопереход между цифрами
    // =======================================================
    function bindDigits(selector, onComplete) {
        const digits = document.querySelectorAll(selector);
        digits.forEach((d, i) => {
            d.addEventListener('input', function() {
                this.value = this.value.replace(/\D/g, '');
                if (this.value && i < digits.length - 1) digits[i + 1].focus();
                if (i === digits.length - 1 && this.value) {
                    const all = Array.from(digits).every(x => x.value);
                    if (all) setTimeout(onComplete, 300);
                }
            });
            d.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace' && !this.value && i > 0) digits[i - 1].focus();
                if (e.key === 'Enter') onComplete();
            });
        });
    }

    // =======================================================
    // СТАРТ
    // =======================================================
    showScreen('main');
});