// =======================================================
// ☀️ НАСТРОЙКИ МЕССЕНДЖЕРА «ЛЕТО» — Логика
// Аватар: Storage → profiles.avatar_url
// =======================================================

document.addEventListener('DOMContentLoaded', function() {

    const SUPABASE_URL = SUPABASE_CONFIG.url;
    const T = SUPABASE_CONFIG.tables;
    const USER_URL = SUPABASE_URL + "/rest/v1/" + T.user;
    const PROFILES_URL = SUPABASE_URL + "/rest/v1/" + T.profiles;
    const BACKUP_URL = SUPABASE_URL + "/rest/v1/" + T.backupKeys;
    const STORAGE_UPLOAD_URL = SUPABASE_URL + "/storage/v1/object/media/";
    const STORAGE_PUBLIC_URL = SUPABASE_URL + "/storage/v1/object/public/media/";

    const activeUser = getActiveUser();
    if (!activeUser) { window.location.href = "index.html"; return; }

    let currentVerifyType = null;
    let pendingCode = null;
    let resendTimer = null;
    let resendSeconds = 0;
    let confirmCallback = null;

    function showToast(text, type) {
        const container = document.getElementById('leto-toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'leto-toast';
        const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span><span>${text}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('leto-toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        while (container.children.length > 3) container.firstChild.remove();
    }

    function confirmDialog(title, text, onOk) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-text').textContent = text;
        confirmCallback = onOk;
        modal.classList.add('active');
    }

    function closeConfirm() {
        document.getElementById('confirm-modal').classList.remove('active');
        confirmCallback = null;
    }

    document.getElementById('confirm-modal-cancel').addEventListener('click', closeConfirm);
    document.getElementById('confirm-modal-ok').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeConfirm();
    });

    function applyTheme(theme) {
        let actual = theme;
        if (theme === 'system') {
            actual = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', actual === 'dark' ? 'dark' : 'light');
    }

    function applyAccent(color) {
        document.documentElement.style.setProperty('--primary-color', color);
    }

    applyTheme(LocalStore.get('theme', 'light'));
    applyAccent(LocalStore.get('accent_color', '#007aff'));

    function loadSettings() {
        document.getElementById('field-username').value = activeUser;
        renderAvatar();
        renderIconPicker();
        document.getElementById('field-email').value = LocalStore.get('notify_email', '') || '';
        updateEmailBadge();
        document.getElementById('field-phone').value = LocalStore.get('user_phone', '') || '';
        updatePhoneBadge();
        document.getElementById('field-status').value = LocalStore.get('status', '') || '';

        const theme = LocalStore.get('theme', 'light');
        document.querySelectorAll('.theme-option').forEach(b => {
            b.classList.toggle('selected', b.getAttribute('data-theme') === theme);
        });
        renderAccentPicker();

        const fs = LocalStore.get('font_size', 15);
        document.getElementById('font-size-range').value = fs;
        document.getElementById('font-size-value').textContent = fs + 'px';

        const lang = LocalStore.get('language', 'ru');
        document.querySelectorAll('.lang-option').forEach(b => {
            b.classList.toggle('selected', b.getAttribute('data-lang') === lang);
        });

        document.getElementById('toggle-2fa').checked = LocalStore.get('two_factor_enabled', false);
        document.getElementById('toggle-incognito').checked = LocalStore.get('incognito', false);
        document.getElementById('toggle-hide-last-seen').checked = LocalStore.get('hide_last_seen', true);
        renderBlockedUsers();

        document.getElementById('toggle-notifications-enabled').checked = LocalStore.get('notifications_enabled', true);
        document.getElementById('toggle-notifications-sound').checked = LocalStore.get('notifications_sound', true);
        document.getElementById('toggle-notifications-vibrate').checked = LocalStore.get('notifications_vibrate', true);
        document.getElementById('toggle-notifications-badge').checked = LocalStore.get('notifications_badge', true);
        document.getElementById('toggle-notify-personal').checked = LocalStore.get('notify_personal', true);
        document.getElementById('toggle-notify-groups').checked = LocalStore.get('notify_groups', true);
        document.getElementById('toggle-notify-channels').checked = LocalStore.get('notify_channels', true);
        document.getElementById('toggle-notify-mentions').checked = LocalStore.get('notify_mentions', true);
        document.getElementById('toggle-quiet-hours').checked = LocalStore.get('quiet_hours_enabled', false);
        document.getElementById('quiet-hours-from').value = LocalStore.get('quiet_hours_from', '23:00');
        document.getElementById('quiet-hours-to').value = LocalStore.get('quiet_hours_to', '08:00');
        document.getElementById('notify-email-input').value = LocalStore.get('notify_email', '') || '';
        document.getElementById('toggle-notify-email').checked = LocalStore.get('notify_email_enabled', false);

        document.getElementById('toggle-sound-message').checked = LocalStore.get('sound_message', true);
        document.getElementById('toggle-sound-sent').checked = LocalStore.get('sound_sent', true);

        const inApp = isMedianApp();
        document.getElementById('app-status-indicator').innerHTML = inApp
            ? `<span>${t('app_status_in_app')}</span>`
            : `<span>${t('app_status_in_browser')}</span>`;
        document.getElementById('download-apk-btn').style.display = inApp ? 'none' : 'block';
        document.getElementById('check-updates-btn').style.display = inApp ? 'block' : 'none';

        document.getElementById('about-version').textContent = APP_CONFIG.version;
        document.getElementById('about-developer').textContent = APP_CONFIG.developer;
    }

    // =======================================================
    // ОТОБРАЖЕНИЕ АВАТАРА — сначала из profiles, потом localStorage
    // =======================================================
    async function renderAvatar() {
        const preview = document.getElementById('profile-avatar-preview');
        const icon = LocalStore.get('app_icon', '☀️');

        // 1. Пытаемся взять из таблицы profiles
        let url = '';
        try {
            const res = await fetch(
                PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser) + "&select=avatar_url",
                { method: "GET", headers: HEADERS_GET }
            );
            const rows = await res.json();
            if (rows && rows[0] && rows[0].avatar_url) {
                url = rows[0].avatar_url;
                LocalStore.set('avatar_url', url);
            }
        } catch (e) {}

        // 2. Если из базы не пришло — берём из localStorage
        if (!url) url = LocalStore.get('avatar_url', '');

        if (url) {
            preview.style.backgroundImage = `url('${url}')`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.textContent = '';
        } else {
            preview.style.backgroundImage = 'none';
            preview.textContent = icon;
        }
    }

    document.getElementById('profile-avatar-btn').addEventListener('click', () => {
        document.getElementById('profile-avatar-input').click();
    });

    document.getElementById('profile-avatar-reset').addEventListener('click', async () => {
        // Убираем из таблицы
        try {
            await fetch(PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser), {
                method: "PATCH", headers: HEADERS,
                body: JSON.stringify({ avatar_url: null })
            });
        } catch (e) {}
        // Убираем из localStorage
        LocalStore.set('avatar_url', '');
        renderAvatar();
        showToast('Аватар сброшен', 'success');
    });

    // =======================================================
    // ЗАГРУЗКА АВАТАРА — Storage → profiles.avatar_url
    // =======================================================
    document.getElementById('profile-avatar-input').addEventListener('change', async function() {
        const file = this.files[0];
        this.value = '';
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast('Файл больше 5 МБ', 'error');
            return;
        }
        if (!file.type.startsWith('image/')) {
            showToast('Только изображения', 'error');
            return;
        }

        const safeUser = String(activeUser).replace(/[^a-zA-Z0-9_-]/g, '_');
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const fileName = "avatar_" + safeUser + "_" + Date.now() + "." + ext;
        const contentType = file.type || 'image/png';

        showToast('Загрузка...', '');

        console.log('=== АВАТАР: старт ===');
        console.log('Файл:', fileName, '| тип:', contentType, '| размер:', file.size);

        // ШАГ 1 — загрузка в Supabase Storage
        let uploadRes;
        try {
            uploadRes = await fetch(STORAGE_UPLOAD_URL + fileName, {
                method: "POST",
                headers: {
                    "apikey": SUPABASE_CONFIG.key,
                    "Authorization": "Bearer " + SUPABASE_CONFIG.key,
                    "Content-Type": contentType,
                    "x-upsert": "true"
                },
                body: file
            });
        } catch (e) {
            console.error('Storage сеть:', e);
            showToast('Сеть: ' + e.message, 'error');
            return;
        }

        console.log('Storage status:', uploadRes.status);
        if (!uploadRes.ok) {
            const txt = await uploadRes.text();
            console.error('Storage ошибка:', txt);
            showToast('Storage ' + uploadRes.status, 'error');
            return;
        }

        const publicUrl = STORAGE_PUBLIC_URL + fileName;
        console.log('Public URL:', publicUrl);

        // ШАГ 2 — запись ссылки в profiles.avatar_url
        let saveRes;
        try {
            const checkRes = await fetch(
                PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser),
                { method: "GET", headers: HEADERS_GET }
            );
            const rows = await checkRes.json();
            console.log('profiles есть строка:', !!(rows && rows[0]));

            if (rows && rows[0]) {
                saveRes = await fetch(
                    PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser),
                    {
                        method: "PATCH", headers: HEADERS,
                        body: JSON.stringify({ avatar_url: publicUrl })
                    }
                );
            } else {
                saveRes = await fetch(PROFILES_URL, {
                    method: "POST", headers: HEADERS,
                    body: JSON.stringify({ username: activeUser, avatar_url: publicUrl })
                });
            }
        } catch (e) {
            console.error('profiles сеть:', e);
            showToast('Сеть profiles: ' + e.message, 'error');
            return;
        }

        console.log('profiles status:', saveRes.status);
        if (!saveRes.ok) {
            const txt = await saveRes.text();
            console.error('profiles ошибка:', txt);
            showToast('profiles ' + saveRes.status, 'error');
            return;
        }

        // ШАГ 3 — сохраняем локально для мгновенного отображения
        LocalStore.set('avatar_url', publicUrl);
        renderAvatar();
        showToast('Аватар обновлён', 'success');
        console.log('=== АВАТАР: готово ===', publicUrl);
    });

    function renderIconPicker() {
        const picker = document.getElementById('app-icon-picker');
        picker.innerHTML = '';
        const current = LocalStore.get('app_icon', APP_CONFIG.defaultAppIcon);
        APP_ICONS.forEach(icon => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'icon-option' + (current === icon ? ' selected' : '');
            btn.textContent = icon;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                LocalStore.set('app_icon', icon);
                renderAvatar();
                showToast('Иконка обновлена', 'success');
            });
            picker.appendChild(btn);
        });
    }

    function updateEmailBadge() {
        const badge = document.getElementById('email-badge');
        const verified = LocalStore.get('email_verified', false);
        const email = LocalStore.get('notify_email', '') || '';
        if (email && verified) {
            badge.textContent = "Подтверждён";
            badge.className = "badge badge-verified";
        } else if (email) {
            badge.textContent = "Не подтверждён";
            badge.className = "badge badge-unverified";
        } else {
            badge.textContent = "Не привязан";
            badge.className = "badge badge-unverified";
        }
    }

    function updatePhoneBadge() {
        const badge = document.getElementById('phone-badge');
        const verified = LocalStore.get('phone_verified', false);
        const phone = LocalStore.get('user_phone', '') || '';
        if (phone && verified) {
            badge.textContent = "Подтверждён";
            badge.className = "badge badge-verified";
        } else if (phone) {
            badge.textContent = "Не подтверждён";
            badge.className = "badge badge-unverified";
        } else {
            badge.textContent = "Не привязан";
            badge.className = "badge badge-unverified";
        }
    }

    function renderAccentPicker() {
        const picker = document.getElementById('accent-picker');
        picker.innerHTML = '';
        const current = LocalStore.get('accent_color', APP_CONFIG.defaultAccent);
        ACCENT_COLORS.forEach(c => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'accent-option' + (current === c.value ? ' selected' : '');
            btn.style.background = c.value;
            btn.title = c.name;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.accent-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                LocalStore.set('accent_color', c.value);
                applyAccent(c.value);
                showToast('Цвет обновлён', 'success');
            });
            picker.appendChild(btn);
        });
    }

    function renderBlockedUsers() {
        const list = document.getElementById('blocked-users-list');
        const blocked = LocalStore.get('blocked_users', []);
        const arr = Array.isArray(blocked) ? blocked : [];
        list.innerHTML = '';
        if (arr.length === 0) {
            list.innerHTML = '<p class="hint">Список пуст</p>';
            return;
        }
        arr.forEach(u => {
            const item = document.createElement('div');
            item.className = 'blocked-user-item';
            item.innerHTML = `<span>@${u}</span>`;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-mini';
            btn.textContent = 'Разблокировать';
            btn.addEventListener('click', () => {
                const newList = arr.filter(x => x !== u);
                LocalStore.set('blocked_users', newList);
                renderBlockedUsers();
                showToast(t('toast_unblocked'), 'success');
            });
            item.appendChild(btn);
            list.appendChild(item);
        });
    }

    document.getElementById('block-user-btn').addEventListener('click', () => {
        const input = document.getElementById('block-username-input');
        const u = input.value.trim().toLowerCase();
        if (!u) return;
        const blocked = LocalStore.get('blocked_users', []);
        const arr = Array.isArray(blocked) ? blocked : [];
        if (arr.includes(u)) { showToast('Уже в списке', 'error'); return; }
        LocalStore.set('blocked_users', [...arr, u]);
        renderBlockedUsers();
        input.value = '';
        showToast(t('toast_blocked'), 'success');
    });

    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            LocalStore.set('theme', theme);
            applyTheme(theme);
            showToast('Тема: ' + btn.textContent, 'success');
        });
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (LocalStore.get('theme', 'light') === 'system') applyTheme('system');
    });

    function applyLanguage(lang) {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = TRANSLATIONS[lang] && TRANSLATIONS[lang][key];
            if (text) el.textContent = text;
        });
    }

    document.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            document.querySelectorAll('.lang-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            LocalStore.set('language', lang);
            applyLanguage(lang);
            showToast(lang === 'ru' ? 'Язык: Русский' : 'Language: English', 'success');
        });
    });

    document.getElementById('font-size-range').addEventListener('input', function() {
        const v = parseInt(this.value);
        document.getElementById('font-size-value').textContent = v + 'px';
        LocalStore.set('font_size', v);
    });

    const localToggles = [
        ['toggle-2fa', 'two_factor_enabled'],
        ['toggle-incognito', 'incognito'],
        ['toggle-hide-last-seen', 'hide_last_seen'],
        ['toggle-notifications-enabled', 'notifications_enabled'],
        ['toggle-notifications-sound', 'notifications_sound'],
        ['toggle-notifications-vibrate', 'notifications_vibrate'],
        ['toggle-notifications-badge', 'notifications_badge'],
        ['toggle-notify-personal', 'notify_personal'],
        ['toggle-notify-groups', 'notify_groups'],
        ['toggle-notify-channels', 'notify_channels'],
        ['toggle-notify-mentions', 'notify_mentions'],
        ['toggle-quiet-hours', 'quiet_hours_enabled'],
        ['toggle-notify-email', 'notify_email_enabled'],
        ['toggle-sound-message', 'sound_message'],
        ['toggle-sound-sent', 'sound_sent']
    ];

    localToggles.forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function() {
            LocalStore.set(key, this.checked);
            if (id === 'toggle-2fa') {
                if (this.checked) {
                    const email = LocalStore.get('notify_email', '');
                    if (!email) {
                        this.checked = false;
                        LocalStore.set('two_factor_enabled', false);
                        showToast('Сначала привяжите email', 'error');
                        return;
                    }
                    showToast(t('toast_2fa_enabled'), 'success');
                } else {
                    showToast(t('toast_2fa_disabled'), 'success');
                }
            }
        });
    });

    document.getElementById('quiet-hours-from').addEventListener('change', function() {
        LocalStore.set('quiet_hours_from', this.value);
    });
    document.getElementById('quiet-hours-to').addEventListener('change', function() {
        LocalStore.set('quiet_hours_to', this.value);
    });
    document.getElementById('notify-email-input').addEventListener('change', function() {
        LocalStore.set('notify_email', this.value.trim());
    });

    document.getElementById('test-message-sound').addEventListener('click', () => {
        const a = new Audio('sounds/message.mp3');
        a.play().catch(() => showToast('Файл sounds/message.mp3 не найден', 'error'));
    });
    document.getElementById('test-sent-sound').addEventListener('click', () => {
        const a = new Audio('sounds/sent.mp3');
        a.play().catch(() => showToast('Файл sounds/sent.mp3 не найден', 'error'));
    });

    document.getElementById('save-status-btn').addEventListener('click', async () => {
        const status = document.getElementById('field-status').value.trim();
        LocalStore.set('status', status);

        try {
            const checkRes = await fetch(
                PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser),
                { method: "GET", headers: HEADERS_GET }
            );
            const rows = await checkRes.json();

            if (rows && rows[0]) {
                await fetch(PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser), {
                    method: "PATCH", headers: HEADERS,
                    body: JSON.stringify({ bio: status })
                });
            } else {
                await fetch(PROFILES_URL, {
                    method: "POST", headers: HEADERS,
                    body: JSON.stringify({ username: activeUser, bio: status })
                });
            }
        } catch (e) {}

        showToast('Статус сохранён', 'success');
    });

    document.getElementById('change-password-btn').addEventListener('click', async () => {
        const oldP = document.getElementById('old-password').value;
        const newP = document.getElementById('new-password').value;
        const confP = document.getElementById('confirm-password').value;

        if (!oldP || !newP || !confP) { showToast('Заполните все поля', 'error'); return; }
        if (newP.length < 6) { showToast('Пароль минимум 6 символов', 'error'); return; }
        if (BAN_PASSWORD_LIST.includes(newP) || /^(\d)\1+$/.test(newP)) {
            showToast('Пароль слишком простой', 'error'); return;
        }
        if (newP !== confP) { showToast('Пароли не совпадают', 'error'); return; }
        if (newP === oldP) { showToast('Новый пароль совпадает со старым', 'error'); return; }

        try {
            const res = await fetch(USER_URL + "?username=eq." + encodeURIComponent(activeUser), {
                method: "GET", headers: HEADERS_GET
            });
            const rows = await res.json();
            if (!rows || rows.length === 0) { showToast('Аккаунт не найден', 'error'); return; }
            if (rows[0].password !== oldP) { showToast('Неверный старый пароль', 'error'); return; }

            await fetch(USER_URL + "?username=eq." + encodeURIComponent(activeUser), {
                method: "PATCH", headers: HEADERS,
                body: JSON.stringify({ password: newP })
            });

            document.getElementById('old-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            showToast(t('toast_password_changed'), 'success');
        } catch (e) {
            showToast('Ошибка сервера', 'error');
        }
    });

    document.getElementById('email-verify-btn').addEventListener('click', async () => {
        const email = document.getElementById('field-email').value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) { showToast('Некорректный email', 'error'); return; }
        LocalStore.set('notify_email', email);
        currentVerifyType = 'email';
        await sendCode('email', email);
    });

    document.getElementById('phone-verify-btn').addEventListener('click', async () => {
        const phone = document.getElementById('field-phone').value.trim();
        const phoneRegex = /^\+?\d{10,15}$/;
        if (!phoneRegex.test(phone.replace(/[\s\-()]/g, ''))) {
            showToast('Некорректный номер', 'error'); return;
        }
        LocalStore.set('user_phone', phone);
        currentVerifyType = 'phone';
        await sendCode('phone', phone);
    });

    async function sendCode(type, target) {
        pendingCode = String(Math.floor(1000 + Math.random() * 9000));
        localStorage.setItem('leto_pending_code_' + type, JSON.stringify({
            code: pendingCode, target: target, timestamp: Date.now()
        }));
        if (type === 'email') {
            await sendEmailCode(target, pendingCode);
        } else {
            console.log('[DEV] SMS-код: ' + pendingCode);
            openCodeModal('phone', target);
            setModalStatus('Код отправлен (dev: консоль)', 'success');
            startResendTimer();
        }
    }

    async function sendEmailCode(email, code) {
        openCodeModal('email', email);
        setModalStatus('Отправка...', '');
        try {
            const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: EMAILJS_CONFIG.serviceId,
                    template_id: EMAILJS_CONFIG.templateId,
                    user_id: EMAILJS_CONFIG.publicKey,
                    template_params: { to_email: email, name: 'Пользователь Лето', verification_code: code }
                })
            });
            if (res.ok) { setModalStatus('Код отправлен на ' + email, 'success'); startResendTimer(); }
            else { setModalStatus('Ошибка отправки', 'error'); }
        } catch (e) { setModalStatus('Сетевая ошибка', 'error'); }
    }

    function openCodeModal(type, target) {
        const modal = document.getElementById('code-modal');
        document.getElementById('modal-description').textContent =
            type === 'email' ? 'Мы отправили код на ' + target : 'Мы отправили SMS на ' + target;
        document.querySelectorAll('.code-digit').forEach(d => d.value = '');
        setModalStatus('', '');
        modal.classList.add('active');
        setTimeout(() => {
            const first = document.querySelector('.code-digit[data-index="0"]');
            if (first) first.focus();
        }, 100);
    }

    function closeCodeModal() {
        document.getElementById('code-modal').classList.remove('active');
        stopResendTimer();
        currentVerifyType = null;
        pendingCode = null;
    }

    document.getElementById('code-modal-cancel').addEventListener('click', closeCodeModal);

    function setModalStatus(text, type) {
        const el = document.getElementById('modal-status');
        el.textContent = text;
        el.className = 'modal-status ' + (type || '');
    }

    document.querySelectorAll('.code-digit').forEach((digit, idx, arr) => {
        digit.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value && idx < arr.length - 1) arr[idx + 1].focus();
            if (idx === arr.length - 1 && this.value) {
                const allFilled = Array.from(arr).every(d => d.value);
                if (allFilled) setTimeout(verifyCode, 300);
            }
        });
        digit.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && idx > 0) arr[idx - 1].focus();
            if (e.key === 'Enter') verifyCode();
        });
    });

    document.getElementById('code-modal-confirm').addEventListener('click', verifyCode);

    function verifyCode() {
        const digits = document.querySelectorAll('.code-digit');
        const userCode = Array.from(digits).map(d => d.value).join('');
        if (userCode.length < 4) { setModalStatus('Введите все 4 цифры', 'error'); return; }
        const stored = JSON.parse(localStorage.getItem('leto_pending_code_' + currentVerifyType) || 'null');
        if (!stored) { setModalStatus('Код истёк', 'error'); return; }
        if (Date.now() - stored.timestamp > 5 * 60 * 1000) {
            setModalStatus('Код истёк', 'error');
            localStorage.removeItem('leto_pending_code_' + currentVerifyType);
            return;
        }
        if (userCode === stored.code) {
            localStorage.removeItem('leto_pending_code_' + currentVerifyType);
            if (currentVerifyType === 'email') {
                LocalStore.set('email_verified', true);
                setModalStatus('Email подтверждён!', 'success');
                setTimeout(() => { closeCodeModal(); updateEmailBadge(); }, 1200);
            } else {
                LocalStore.set('phone_verified', true);
                setModalStatus('Телефон подтверждён!', 'success');
                setTimeout(() => { closeCodeModal(); updatePhoneBadge(); }, 1200);
            }
        } else {
            setModalStatus('Неверный код', 'error');
            digits.forEach(d => d.value = '');
            digits[0].focus();
        }
    }

    document.getElementById('resend-link').addEventListener('click', function(e) {
        e.preventDefault();
        if (resendSeconds > 0) return;
        const target = currentVerifyType === 'email'
            ? LocalStore.get('notify_email', '')
            : LocalStore.get('user_phone', '');
        if (target) sendCode(currentVerifyType, target);
    });

    function startResendTimer() {
        stopResendTimer();
        resendSeconds = 30;
        updateResendLink();
        resendTimer = setInterval(() => {
            resendSeconds--;
            if (resendSeconds <= 0) stopResendTimer();
            else updateResendLink();
        }, 1000);
    }

    function stopResendTimer() {
        if (resendTimer) clearInterval(resendTimer);
        resendTimer = null;
        resendSeconds = 0;
        updateResendLink();
    }

    function updateResendLink() {
        const link = document.getElementById('resend-link');
        if (resendSeconds > 0) {
            link.textContent = 'Отправить повторно через ' + resendSeconds + ' сек';
            link.classList.add('disabled');
        } else {
            link.textContent = 'Отправить код повторно';
            link.classList.remove('disabled');
        }
    }

    // =======================================================
    // ЭКСПОРТ БЭКАПА
    // =======================================================
    function generateBackupKey() {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let key = '';
        const arr = new Uint8Array(20);
        (window.crypto || window.msCrypto).getRandomValues(arr);
        for (let i = 0; i < 20; i++) key += alphabet[arr[i] % alphabet.length];
        return key;
    }

    document.getElementById('export-backup-btn').addEventListener('click', async () => {
        try {
            const check = await fetch(BACKUP_URL + "?username=eq." + encodeURIComponent(activeUser), {
                method: "GET", headers: HEADERS_GET
            });
            const existing = await check.json();
            if (existing && existing.length > 0 && existing[0].key1) {
                showToast('У вас уже есть активная копия.', 'error');
                return;
            }
        } catch (e) {}

        const keys = [
            generateBackupKey(),
            generateBackupKey(),
            generateBackupKey(),
            generateBackupKey()
        ];

        try {
            const check2 = await fetch(BACKUP_URL + "?username=eq." + encodeURIComponent(activeUser), {
                method: "GET", headers: HEADERS_GET
            });
            const rows = await check2.json();

            const payload = {
                key1: keys[0], key2: keys[1], key3: keys[2], key4: keys[3],
                created_at: new Date().toISOString()
            };

            if (rows && rows[0]) {
                await fetch(BACKUP_URL + "?username=eq." + encodeURIComponent(activeUser), {
                    method: "PATCH", headers: HEADERS,
                    body: JSON.stringify(payload)
                });
            } else {
                await fetch(BACKUP_URL, {
                    method: "POST", headers: HEADERS,
                    body: JSON.stringify({ username: activeUser, ...payload })
                });
            }
        } catch (e) {
            showToast('Ошибка сохранения ключей на сервере', 'error');
            return;
        }

        const localSettings = {};
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith('leto_') && k !== 'leto_active_user') {
                localSettings[k] = localStorage.getItem(k);
            }
        });

        const backup = {
            version: APP_CONFIG.version,
            created_at: new Date().toISOString(),
            username: activeUser,
            keys: keys,
            local_settings: localSettings
        };

        try {
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const objectUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            a.href = objectUrl;
            a.download = `leto_backup_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);

            showToast(t('data_backup_success'), 'success');
        } catch (e) {
            console.error('[backup] error:', e);
            showToast('Ошибка создания файла: ' + e.message, 'error');
        }
    });

    document.getElementById('import-backup-btn').addEventListener('click', () => {
        document.getElementById('import-backup-input').click();
    });

    document.getElementById('import-backup-input').addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.local_settings) {
                Object.entries(data.local_settings).forEach(([k, v]) => {
                    localStorage.setItem(k, v);
                });
            }
            showToast(t('data_import_success'), 'success');
            setTimeout(() => location.reload(), 1200);
        } catch (e) {
            showToast(t('data_import_error'), 'error');
        }
        this.value = '';
    });

    document.getElementById('clear-cache-btn').addEventListener('click', () => {
        confirmDialog('Очистить кэш?', 'Все локальные настройки будут удалены. Аккаунт сохранится.', async () => {
            const user = localStorage.getItem('leto_active_user');
            localStorage.clear();
            sessionStorage.clear();
            if (user) localStorage.setItem('leto_active_user', user);
            if ('caches' in window) {
                try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                } catch (e) {}
            }
            showToast(t('data_cache_cleared'), 'success');
            setTimeout(() => location.reload(), 1200);
        });
    });

    document.getElementById('download-apk-btn').addEventListener('click', () => {
        const url = APP_CONFIG.apkDownloadUrl;
        if (window.median && window.median.openUrl) window.median.openUrl(url);
        else window.open(url, '_blank');
    });

    document.getElementById('check-updates-btn').addEventListener('click', () => {
        showToast('Версия ' + APP_CONFIG.version + ' — актуальна', 'success');
    });

    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.settings-section');
            section.classList.toggle('open');
        });
    });

    const first = document.querySelector('.settings-section');
    if (first) first.classList.add('open');

    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = 'messenger.html';
    });
    document.getElementById('back-to-messenger-btn').addEventListener('click', () => {
        window.location.href = 'messenger.html';
    });

    loadSettings();
    applyLanguage(LocalStore.get('language', 'ru'));
});