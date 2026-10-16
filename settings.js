// =======================================================
// ☀️ НАСТРОЙКИ МЕССЕНДЖЕРА «ЛЕТО»
// Email хранится ТОЛЬКО на сервере
// Звуки в корне проекта (без папки sounds/)
// Чёрный список УДАЛЁН
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

    let pendingCode = null;
    let resendTimer = null;
    let resendSeconds = 0;
    let confirmCallback = null;

    let currentEmail = '';
    let emailVerified = false;

    const CACHE_MESSAGES_KEY = 'leto_cache_messages';
    const CACHE_CHATS_KEY = 'leto_cache_chats';

    // =======================================================
    // TOAST
    // =======================================================
    function showToast(text, type) {
        const container = document.getElementById('leto-toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'leto-toast';
        const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
        toast.innerHTML = '<span>' + icon + '</span><span>' + text + '</span>';
        container.appendChild(toast);
        setTimeout(function() {
            toast.classList.add('leto-toast-hide');
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
        while (container.children.length > 3) container.firstChild.remove();
    }

    // =======================================================
    // CONFIRM DIALOG
    // =======================================================
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
    document.getElementById('confirm-modal-ok').addEventListener('click', function() {
        if (confirmCallback) confirmCallback();
        closeConfirm();
    });

    // =======================================================
    // ТЕМА / АКЦЕНТ / ШРИФТ
    // =======================================================
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

    function applyFontSize(size) {
        document.querySelectorAll('.preview-bubble').forEach(function(b) {
            b.style.fontSize = size + 'px';
        });
    }

    applyTheme(LocalStore.get('theme', 'light'));
    applyAccent(LocalStore.get('accent_color', '#007aff'));
    applyFontSize(LocalStore.get('font_size', 15));

    // =======================================================
    // ПРОФИЛЬ
    // =======================================================
    async function patchProfile(fields) {
        try {
            const checkRes = await fetch(
                PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser),
                { method: "GET", headers: HEADERS_GET }
            );
            const rows = await checkRes.json();
            if (rows && rows[0]) {
                await fetch(PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser), {
                    method: "PATCH", headers: HEADERS,
                    body: JSON.stringify(fields)
                });
            } else {
                await fetch(PROFILES_URL, {
                    method: "POST", headers: HEADERS,
                    body: JSON.stringify(Object.assign({ username: activeUser }, fields))
                });
            }
        } catch (e) {
            console.warn('patchProfile error:', e);
        }
    }

    // =======================================================
    // EMAIL С СЕРВЕРА
    // =======================================================
    async function loadEmailFromServer() {
        try {
            const res = await fetch(
                PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser) +
                "&select=notify_email,email_verified,notify_email_enabled",
                { method: "GET", headers: HEADERS_GET }
            );
            const rows = await res.json();
            if (rows && rows[0]) {
                currentEmail = rows[0].notify_email || '';
                emailVerified = rows[0].email_verified === true;
                const emailInput = document.getElementById('field-email');
                if (emailInput) emailInput.value = currentEmail;
                const toggleNotifyEmail = document.getElementById('toggle-notify-email');
                if (toggleNotifyEmail) toggleNotifyEmail.checked = rows[0].notify_email_enabled === true;
                updateEmailStatus();
            }
        } catch (e) {
            console.warn('loadEmail error:', e);
        }
    }

    // =======================================================
    // СТАТУС EMAIL
    // =======================================================
    function updateEmailStatus() {
        const block = document.getElementById('email-block');
        const icon = document.getElementById('email-status-icon');
        const text = document.getElementById('email-status-text');
        if (!block || !icon || !text) return;

        block.classList.remove('verified', 'unverified');

        if (!currentEmail) {
            icon.textContent = '○';
            text.textContent = 'Email не привязан';
        } else if (emailVerified) {
            block.classList.add('verified');
            icon.textContent = '✓';
            text.textContent = 'Email подтверждён';
        } else {
            block.classList.add('unverified');
            icon.textContent = '○';
            text.textContent = 'Не подтверждён — нажмите «Подтвердить»';
        }
    }

    // =======================================================
    // ПРЕДПРОСМОТР — аватар
    // =======================================================
    function updatePreviewAvatar() {
        const el = document.getElementById('preview-chat-avatar');
        if (!el) return;
        const avatarUrl = LocalStore.get('avatar_url', '');
        const iconValue = LocalStore.get('app_icon', 'logo.png');
        if (avatarUrl) {
            el.style.backgroundImage = "url('" + avatarUrl + "')";
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.textContent = '';
        } else if (iconValue && (iconValue.indexOf('.') !== -1 || iconValue.indexOf('/') !== -1)) {
            el.style.backgroundImage = "url('" + iconValue + "')";
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.textContent = '';
        } else {
            el.style.backgroundImage = 'none';
            el.style.background = 'linear-gradient(135deg, #ffd66b, #ffb03a)';
            el.textContent = iconValue || '☀️';
        }
    }

    // =======================================================
    // ЗАГРУЗКА НАСТРОЕК
    // =======================================================
    async function loadSettings() {
        document.getElementById('field-username').value = activeUser;
        renderAvatar();
        renderIconPicker();

        await loadEmailFromServer();

        document.getElementById('field-status').value = LocalStore.get('status', '') || '';

        const theme = LocalStore.get('theme', 'light');
        document.querySelectorAll('.theme-option').forEach(function(b) {
            b.classList.toggle('selected', b.getAttribute('data-theme') === theme);
        });
        renderAccentPicker();

        const fs = LocalStore.get('font_size', 15);
        document.getElementById('font-size-range').value = fs;
        document.getElementById('font-size-value').textContent = fs + 'px';

        document.getElementById('toggle-2fa').checked = LocalStore.get('two_factor_enabled', false);
        document.getElementById('toggle-incognito').checked = LocalStore.get('incognito', false);
        document.getElementById('toggle-hide-last-seen').checked = LocalStore.get('hide_last_seen', true);

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

        document.getElementById('toggle-sound-message').checked = LocalStore.get('sound_message', true);
        document.getElementById('toggle-sound-sent').checked = LocalStore.get('sound_sent', true);

        const inApp = isMedianApp();
        document.getElementById('app-status-indicator').innerHTML = inApp
            ? '📱 Вы в приложении'
            : '🌐 Вы на сайте';
        document.getElementById('download-apk-btn').style.display = inApp ? 'none' : 'block';
        document.getElementById('check-updates-btn').style.display = inApp ? 'block' : 'none';

        document.getElementById('about-version').textContent = APP_CONFIG.version;
        document.getElementById('about-developer').textContent = APP_CONFIG.developer;

        updatePreviewAvatar();
        updateCacheStats();
    }

    function updateCacheStats() {
        try {
            const msgs = JSON.parse(localStorage.getItem(CACHE_MESSAGES_KEY) || '[]');
            const chats = JSON.parse(localStorage.getItem(CACHE_CHATS_KEY) || '{}');
            document.getElementById('cache-messages-count').textContent = msgs.length || 0;
            document.getElementById('cache-chats-count').textContent = Object.keys(chats).length || 0;
        } catch (e) {
            document.getElementById('cache-messages-count').textContent = '0';
            document.getElementById('cache-chats-count').textContent = '0';
        }
    }

    // =======================================================
    // АВАТАР
    // =======================================================
    async function renderAvatar() {
        const preview = document.getElementById('profile-avatar-preview');
        if (!preview) return;
        const iconValue = LocalStore.get('app_icon', 'logo.png');

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

        if (!url) url = LocalStore.get('avatar_url', '');

        if (url) {
            preview.style.backgroundImage = "url('" + url + "')";
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.textContent = '';
        } else if (iconValue && (iconValue.indexOf('.') !== -1 || iconValue.indexOf('/') !== -1)) {
            preview.style.backgroundImage = "url('" + iconValue + "')";
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.textContent = '';
        } else {
            preview.style.backgroundImage = 'none';
            preview.style.background = 'linear-gradient(135deg, #ffd66b, #ffb03a)';
            preview.textContent = iconValue || '☀️';
        }
        updatePreviewAvatar();
    }

    document.getElementById('profile-avatar-btn').addEventListener('click', function() {
        document.getElementById('profile-avatar-input').click();
    });

    document.getElementById('profile-avatar-reset').addEventListener('click', async function() {
        await patchProfile({ avatar_url: null });
        LocalStore.set('avatar_url', '');
        renderAvatar();
        showToast('Аватар сброшен', 'success');
    });

    document.getElementById('profile-avatar-input').addEventListener('change', async function() {
        const file = this.files[0];
        this.value = '';
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { showToast('Файл больше 5 МБ', 'error'); return; }
        if (!file.type.startsWith('image/')) { showToast('Только изображения', 'error'); return; }

        const safeUser = String(activeUser).replace(/[^a-zA-Z0-9_-]/g, '_');
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const fileName = "avatar_" + safeUser + "_" + Date.now() + "." + ext;

        showToast('Загрузка...', '');

        let uploadRes;
        try {
            uploadRes = await fetch(STORAGE_UPLOAD_URL + fileName, {
                method: "POST",
                headers: {
                    "apikey": SUPABASE_CONFIG.key,
                    "Authorization": "Bearer " + SUPABASE_CONFIG.key,
                    "Content-Type": file.type,
                    "x-upsert": "true"
                },
                body: file
            });
        } catch (e) { showToast('Сеть: ' + e.message, 'error'); return; }

        if (!uploadRes.ok) { showToast('Storage ' + uploadRes.status, 'error'); return; }

        const publicUrl = STORAGE_PUBLIC_URL + fileName;
        await patchProfile({ avatar_url: publicUrl });
        LocalStore.set('avatar_url', publicUrl);
        renderAvatar();
        showToast('Аватар обновлён', 'success');
    });

    // =======================================================
    // ИКОНКИ
    // =======================================================
    function renderIconPicker() {
        const picker = document.getElementById('app-icon-picker');
        if (!picker) return;
        picker.innerHTML = '';
        const current = LocalStore.get('app_icon', APP_CONFIG.defaultAppIcon);
        APP_ICONS.forEach(function(icon) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'icon-option' + (current === icon.value ? ' selected' : '');
            if (icon.type === 'image') {
                btn.style.backgroundImage = "url('" + icon.value + "')";
                btn.textContent = '';
            } else {
                btn.textContent = icon.value;
            }
            btn.addEventListener('click', function() {
                document.querySelectorAll('.icon-option').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                LocalStore.set('app_icon', icon.value);
                renderAvatar();
                showToast('Иконка обновлена', 'success');
            });
            picker.appendChild(btn);
        });
    }

    // =======================================================
    // АКЦЕНТ
    // =======================================================
    function renderAccentPicker() {
        const picker = document.getElementById('accent-picker');
        if (!picker) return;
        picker.innerHTML = '';
        const current = LocalStore.get('accent_color', APP_CONFIG.defaultAccent);
        ACCENT_COLORS.forEach(function(c) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'accent-option' + (current === c.value ? ' selected' : '');
            btn.style.background = c.value;
            btn.title = c.name;
            btn.addEventListener('click', function() {
                document.querySelectorAll('.accent-option').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                LocalStore.set('accent_color', c.value);
                applyAccent(c.value);
                showToast('Цвет обновлён', 'success');
            });
            picker.appendChild(btn);
        });
    }

    // =======================================================
    // ТЕМА
    // =======================================================
    document.querySelectorAll('.theme-option').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const theme = btn.getAttribute('data-theme');
            document.querySelectorAll('.theme-option').forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            LocalStore.set('theme', theme);
            applyTheme(theme);
            showToast('Тема: ' + btn.textContent, 'success');
        });
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        if (LocalStore.get('theme', 'light') === 'system') applyTheme('system');
    });

    // =======================================================
    // РАЗМЕР ШРИФТА
    // =======================================================
    document.getElementById('font-size-range').addEventListener('input', function() {
        const v = parseInt(this.value);
        document.getElementById('font-size-value').textContent = v + 'px';
        LocalStore.set('font_size', v);
        applyFontSize(v);
    });

    // =======================================================
    // ЛОКАЛЬНЫЕ ПЕРЕКЛЮЧАТЕЛИ
    // =======================================================
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
        ['toggle-sound-message', 'sound_message'],
        ['toggle-sound-sent', 'sound_sent']
    ];

    localToggles.forEach(function(pair) {
        const id = pair[0], key = pair[1];
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function() {
            LocalStore.set(key, this.checked);
            if (id === 'toggle-2fa') {
                patchProfile({ two_factor_enabled: this.checked });
                if (this.checked) {
                    if (!currentEmail) {
                        this.checked = false;
                        LocalStore.set('two_factor_enabled', false);
                        patchProfile({ two_factor_enabled: false });
                        showToast('Сначала привяжите email', 'error');
                        return;
                    }
                    showToast('2FA включена', 'success');
                } else {
                    showToast('2FA выключена', 'success');
                }
            }
        });
    });

    // =======================================================
    // EMAIL
    // =======================================================
    document.getElementById('toggle-notify-email').addEventListener('change', function() {
        LocalStore.set('notify_email_enabled', this.checked);
        patchProfile({ notify_email_enabled: this.checked });
    });

    document.getElementById('quiet-hours-from').addEventListener('change', function() {
        LocalStore.set('quiet_hours_from', this.value);
    });
    document.getElementById('quiet-hours-to').addEventListener('change', function() {
        LocalStore.set('quiet_hours_to', this.value);
    });

    document.getElementById('field-email').addEventListener('change', async function() {
        const email = this.value.trim();
        currentEmail = email;
        await patchProfile({ notify_email: email, email_verified: false });
        emailVerified = false;
        updateEmailStatus();
        showToast('Email сохранён на сервере', 'success');
    });

    // =======================================================
    // ЗВУКИ — БЕЗ ПАПКИ!
    // =======================================================
    document.getElementById('test-message-sound').addEventListener('click', function() {
        const a = new Audio('message.mp3');
        a.play().catch(function() { showToast('Файл message.mp3 не найден', 'error'); });
    });
    document.getElementById('test-sent-sound').addEventListener('click', function() {
        const a = new Audio('sent.mp3');
        a.play().catch(function() { showToast('Файл sent.mp3 не найден', 'error'); });
    });

    // =======================================================
    // СТАТУС
    // =======================================================
    document.getElementById('save-status-btn').addEventListener('click', async function() {
        const status = document.getElementById('field-status').value.trim();
        LocalStore.set('status', status);
        await patchProfile({ bio: status });
        showToast('Статус сохранён', 'success');
    });

    // =======================================================
    // СМЕНА ПАРОЛЯ
    // =======================================================
    document.getElementById('change-password-btn').addEventListener('click', async function() {
        const oldP = document.getElementById('old-password').value;
        const newP = document.getElementById('new-password').value;
        const confP = document.getElementById('confirm-password').value;

        if (!oldP || !newP || !confP) { showToast('Заполните все поля', 'error'); return; }
        if (newP.length < 6) { showToast('Пароль минимум 6 символов', 'error'); return; }
        if (BAN_PASSWORD_LIST.indexOf(newP) !== -1 || /^(\d)\1+$/.test(newP)) {
            showToast('Пароль слишком простой', 'error'); return;
        }
        if (newP !== confP) { showToast('Пароли не совпадают', 'error'); return; }
        if (newP === oldP) { showToast('Совпадает со старым', 'error'); return; }

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
            showToast('Пароль изменён', 'success');
        } catch (e) {
            showToast('Ошибка сервера', 'error');
        }
    });

    // =======================================================
    // ВЕРИФИКАЦИЯ EMAIL
    // =======================================================
    document.getElementById('email-verify-btn').addEventListener('click', async function() {
        const email = document.getElementById('field-email').value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) { showToast('Некорректный email', 'error'); return; }

        currentEmail = email;
        await patchProfile({ notify_email: email, email_verified: false });
        emailVerified = false;
        updateEmailStatus();

        pendingCode = String(Math.floor(1000 + Math.random() * 9000));
        sessionStorage.setItem('leto_pending_code_email', JSON.stringify({
            code: pendingCode, target: email, timestamp: Date.now()
        }));

        openCodeModal(email);
        setModalStatus('Отправка...', '');

        try {
            const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: EMAILJS_CONFIG.serviceId,
                    template_id: EMAILJS_CONFIG.templateId,
                    user_id: EMAILJS_CONFIG.publicKey,
                    template_params: {
                        to_email: email,
                        name: 'Пользователь Лето',
                        auth_code: pendingCode,
                        verification_code: pendingCode
                    }
                })
            });
            if (res.ok) { setModalStatus('Код отправлен на ' + email, 'success'); startResendTimer(); }
            else { setModalStatus('Ошибка отправки', 'error'); }
        } catch (e) { setModalStatus('Сетевая ошибка', 'error'); }
    });

    // =======================================================
    // МОДАЛКА КОДА
    // =======================================================
    function openCodeModal(target) {
        const modal = document.getElementById('code-modal');
        document.getElementById('modal-description').textContent = 'Мы отправили код на ' + target;
        document.querySelectorAll('.code-digit').forEach(function(d) { d.value = ''; });
        setModalStatus('', '');
        modal.classList.add('active');
        setTimeout(function() {
            const first = document.querySelector('.code-digit[data-index="0"]');
            if (first) first.focus();
        }, 100);
    }

    function closeCodeModal() {
        document.getElementById('code-modal').classList.remove('active');
        stopResendTimer();
        pendingCode = null;
    }

    document.getElementById('code-modal-cancel').addEventListener('click', closeCodeModal);

    function setModalStatus(text, type) {
        const el = document.getElementById('modal-status');
        el.textContent = text;
        el.className = 'modal-status ' + (type || '');
    }

    document.querySelectorAll('.code-digit').forEach(function(digit, idx) {
        const arr = document.querySelectorAll('.code-digit');
        digit.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value && idx < arr.length - 1) arr[idx + 1].focus();
            if (idx === arr.length - 1 && this.value) {
                const allFilled = Array.from(arr).every(function(d) { return d.value; });
                if (allFilled) setTimeout(verifyCode, 300);
            }
        });
        digit.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && idx > 0) arr[idx - 1].focus();
            if (e.key === 'Enter') verifyCode();
        });
    });

    document.getElementById('code-modal-confirm').addEventListener('click', verifyCode);

    async function verifyCode() {
        const digits = document.querySelectorAll('.code-digit');
        const userCode = Array.from(digits).map(function(d) { return d.value; }).join('');
        if (userCode.length < 4) { setModalStatus('Введите все 4 цифры', 'error'); return; }

        const stored = JSON.parse(sessionStorage.getItem('leto_pending_code_email') || 'null');
        if (!stored) { setModalStatus('Код истёк', 'error'); return; }
        if (Date.now() - stored.timestamp > 5 * 60 * 1000) {
            setModalStatus('Код истёк', 'error');
            sessionStorage.removeItem('leto_pending_code_email');
            return;
        }
        if (userCode === stored.code) {
            sessionStorage.removeItem('leto_pending_code_email');
            emailVerified = true;
            await patchProfile({ email_verified: true });
            setModalStatus('Email подтверждён!', 'success');
            setTimeout(function() { closeCodeModal(); updateEmailStatus(); }, 1200);
        } else {
            setModalStatus('Неверный код', 'error');
            digits.forEach(function(d) { d.value = ''; });
            digits[0].focus();
        }
    }

    document.getElementById('resend-link').addEventListener('click', function(e) {
        e.preventDefault();
        if (resendSeconds > 0) return;
        if (currentEmail) document.getElementById('email-verify-btn').click();
    });

    function startResendTimer() {
        stopResendTimer();
        resendSeconds = 30;
        updateResendLink();
        resendTimer = setInterval(function() {
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
    // КЭШ
    // =======================================================
    document.getElementById('clear-chat-cache-btn').addEventListener('click', function() {
        confirmDialog('Очистить кэш чатов?', 'Все сохранённые сообщения и чаты будут удалены с устройства.', function() {
            localStorage.removeItem(CACHE_MESSAGES_KEY);
            localStorage.removeItem(CACHE_CHATS_KEY);
            updateCacheStats();
            showToast('Кэш чатов очищен', 'success');
        });
    });

    // =======================================================
    // БЭКАП
    // =======================================================
    function generateBackupKey() {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let key = '';
        const arr = new Uint8Array(20);
        (window.crypto || window.msCrypto).getRandomValues(arr);
        for (let i = 0; i < 20; i++) key += alphabet[arr[i] % alphabet.length];
        return key;
    }

    document.getElementById('export-backup-btn').addEventListener('click', async function() {
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

        const keys = [generateBackupKey(), generateBackupKey(), generateBackupKey(), generateBackupKey()];

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
                    body: JSON.stringify(Object.assign({ username: activeUser }, payload))
                });
            }
        } catch (e) {
            showToast('Ошибка сохранения ключей', 'error');
            return;
        }

        const localSettings = {};
        Object.keys(localStorage).forEach(function(k) {
            if (k.indexOf('leto_') === 0 && k !== 'leto_active_user' && k !== 'leto_notify_email') {
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

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const pad = function(n) { return String(n).padStart(2, '0'); };
        a.href = objectUrl;
        a.download = 'leto_backup_' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '_' + pad(now.getHours()) + '-' + pad(now.getMinutes()) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { window.URL.revokeObjectURL(objectUrl); }, 1000);
        showToast('Резервная копия создана', 'success');
    });

    document.getElementById('import-backup-btn').addEventListener('click', function() {
        document.getElementById('import-backup-input').click();
    });

    document.getElementById('import-backup-input').addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.local_settings) {
                Object.entries(data.local_settings).forEach(function(entry) {
                    const k = entry[0], v = entry[1];
                    if (k !== 'leto_notify_email') localStorage.setItem(k, v);
                });
            }
            showToast('Данные восстановлены', 'success');
            setTimeout(function() { location.reload(); }, 1200);
        } catch (e) {
            showToast('Файл повреждён', 'error');
        }
        this.value = '';
    });

    document.getElementById('clear-cache-btn').addEventListener('click', function() {
        confirmDialog('Очистить весь кэш?', 'Все локальные настройки будут удалены. Аккаунт сохранится.', async function() {
            const user = localStorage.getItem('leto_active_user');
            localStorage.clear();
            sessionStorage.clear();
            if (user) localStorage.setItem('leto_active_user', user);
            if ('caches' in window) {
                try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(function(k) { return caches.delete(k); }));
                } catch (e) {}
            }
            showToast('Кэш очищен', 'success');
            setTimeout(function() { location.reload(); }, 1200);
        });
    });

    // =======================================================
    // ПРИЛОЖЕНИЕ
    // =======================================================
    document.getElementById('download-apk-btn').addEventListener('click', function() {
        const url = APP_CONFIG.apkDownloadUrl;
        if (window.median && window.median.openUrl) window.median.openUrl(url);
        else window.open(url, '_blank');
    });

    document.getElementById('check-updates-btn').addEventListener('click', function() {
        showToast('Версия ' + APP_CONFIG.version + ' — актуальна', 'success');
    });

    // =======================================================
    // СЕКЦИИ
    // =======================================================
    document.querySelectorAll('.section-header').forEach(function(header) {
        header.addEventListener('click', function() {
            const section = header.closest('.settings-section');
            section.classList.toggle('open');
        });
    });

    const first = document.querySelector('.settings-section');
    if (first) first.classList.add('open');

    document.getElementById('back-btn').addEventListener('click', function() {
        window.location.href = 'messenger.html';
    });
    document.getElementById('back-to-messenger-btn').addEventListener('click', function() {
        window.location.href = 'messenger.html';
    });

    // =======================================================
    // СТАРТ
    // =======================================================
    loadSettings();
});