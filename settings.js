// =======================================================
// ☀️ НАСТРОЙКИ МЕССЕНДЖЕРА «ЛЕТО»
// =======================================================

document.addEventListener('DOMContentLoaded', function() {

    const SUPABASE_URL = SUPABASE_CONFIG.url;
    const T = SUPABASE_CONFIG.tables;
    const USER_URL = SUPABASE_URL + "/rest/v1/" + T.user;
    const PROFILES_URL = SUPABASE_URL + "/rest/v1/" + T.profiles;
    const BACKUP_URL = SUPABASE_URL + "/rest/v1/" + T.backupKeys;
    const MESSAGES_URL = SUPABASE_URL + "/rest/v1/" + T.messages;
    const ROOMS_URL = SUPABASE_URL + "/rest/v1/" + T.rooms;
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
    let isEditingEmail = false;

    const CACHE_MESSAGES_KEY = 'leto_cache_messages';
    const CACHE_CHATS_KEY = 'leto_cache_chats';

    // =======================================================
    // ДИНАМИЧЕСКАЯ ИКОНКА ПРИЛОЖЕНИЯ (PWA)
    // =======================================================
    function updateAppIcon(iconPath) {
        // 1. Обновляем favicon в браузере
        let linkIcon = document.querySelector("link[rel~='icon']");
        if (!linkIcon) {
            linkIcon = document.createElement('link');
            linkIcon.rel = 'icon';
            document.head.appendChild(linkIcon);
        }
        linkIcon.href = iconPath;

        // 2. Обновляем PWA манифест (для установки ярлыка)
        const manifestLink = document.querySelector("link[rel='manifest']");
        if (manifestLink) {
            fetch('manifest.json')
                .then(res => res.json())
                .then(manifest => {
                    manifest.icons = [
                        { "src": iconPath, "sizes": "192x192", "type": "image/png" },
                        { "src": iconPath, "sizes": "512x512", "type": "image/png" }
                    ];
                    const stringManifest = JSON.stringify(manifest);
                    const blob = new Blob([stringManifest], { type: 'application/json' });
                    const manifestURL = URL.createObjectURL(blob);
                    manifestLink.setAttribute('href', manifestURL);
                })
                .catch(e => console.warn('Не удалось обновить манифест:', e));
        }

        // 3. Если мы в приложении (Median / WebView)
        if (window.median) {
            if (typeof window.median.setAppIcon === 'function') {
                try { window.median.setAppIcon(iconPath); } catch(e) {}
            }
        }
    }

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

    // Инициализируем иконку приложения при загрузке
    const savedIcon = LocalStore.get('app_icon', APP_CONFIG.defaultAppIcon);
    updateAppIcon(savedIcon);

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
                if (emailInput) {
                    emailInput.value = currentEmail;
                    emailInput.readOnly = true;
                }
                
                const editBtn = document.getElementById('email-edit-btn');
                if (editBtn && !isEditingEmail) editBtn.textContent = currentEmail ? 'Изменить' : 'Добавить';

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
        const verifyBtn = document.getElementById('email-verify-btn');
        const editBtn = document.getElementById('email-edit-btn');
        if (!block || !icon || !text) return;

        block.classList.remove('verified', 'unverified');

        if (!currentEmail) {
            icon.textContent = '○';
            text.textContent = 'Email не привязан';
            if (verifyBtn) verifyBtn.style.display = 'none';
            if (editBtn && !isEditingEmail) editBtn.textContent = 'Добавить';
        } else if (emailVerified) {
            block.classList.add('verified');
            icon.textContent = '✓';
            text.textContent = 'Email подтверждён';
            if (verifyBtn) verifyBtn.style.display = 'none';
            if (editBtn && !isEditingEmail) editBtn.textContent = 'Изменить';
        } else {
            block.classList.add('unverified');
            icon.textContent = '○';
            text.textContent = 'Не подтверждён — нажмите «Подтвердить»';
            if (verifyBtn) verifyBtn.style.display = 'inline-flex';
            if (editBtn && !isEditingEmail) editBtn.textContent = 'Изменить';
        }
    }

    // =======================================================
    // МОИ КОНТАКТЫ (АЛИАСЫ)
    // =======================================================
    async function loadContactAliases() {
        const listEl = document.getElementById('contacts-alias-list');
        if (!listEl) return;

        let aliases = {};
        try {
            aliases = JSON.parse(localStorage.getItem('leto_contact_aliases') || '{}');
        } catch (e) {}

        try {
            const res = await fetch(
                MESSAGES_URL + "?chat_type=eq.contact&or=(sender.eq." + encodeURIComponent(activeUser) + ",receiver.eq." + encodeURIComponent(activeUser) + ")&select=sender,receiver&limit=500&order=created_at.desc",
                { method: "GET", headers: HEADERS_GET }
            );
            const msgs = await res.json();

            const contacts = new Set();
            if (Array.isArray(msgs)) {
                msgs.forEach(msg => {
                    const other = msg.sender === activeUser ? msg.receiver : msg.sender;
                    if (other) contacts.add(other);
                });
            }

            if (contacts.size === 0) {
                listEl.innerHTML = '<div class="status-message">У вас пока нет контактов</div>';
                return;
            }

            listEl.innerHTML = '';
            Array.from(contacts).sort().forEach(contact => {
                const currentAlias = aliases[contact] || '';

                const item = document.createElement('div');
                item.className = 'alias-item';
                item.innerHTML = `
                    <div class="alias-item-info">
                        <span class="alias-item-real">@${contact}</span>
                        <input type="text" class="alias-item-input" placeholder="Имя для отображения" value="${currentAlias}" data-real="${contact}">
                    </div>
                `;

                const input = item.querySelector('.alias-item-input');
                
                let saveTimeout = null;
                input.addEventListener('input', function() {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        const val = this.value.trim();
                        let curAliases = {};
                        try { curAliases = JSON.parse(localStorage.getItem('leto_contact_aliases') || '{}'); } catch(e){}
                        
                        if (val) {
                            curAliases[contact] = val;
                        } else {
                            delete curAliases[contact];
                        }
                        localStorage.setItem('leto_contact_aliases', JSON.stringify(curAliases));
                    }, 500);
                });

                listEl.appendChild(item);
            });

        } catch (e) {
            listEl.innerHTML = '<div class="status-message">Ошибка загрузки контактов</div>';
        }
    }

    // =======================================================
    // ПРЕДПРОСМОТР — аватар
    // =======================================================
    function updatePreviewAvatar() {
        const el = document.getElementById('preview-chat-avatar');
        if (!el) return;
        const avatarUrl = LocalStore.get('avatar_url', '');
        
        if (avatarUrl) {
            el.style.backgroundImage = "url('" + avatarUrl + "')";
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.textContent = '';
        } else {
            el.style.backgroundImage = 'none';
            el.style.background = 'linear-gradient(135deg, #ffd66b, #ffb03a)';
            el.textContent = activeUser.charAt(0).toUpperCase();
            el.style.color = '#fff';
            el.style.fontWeight = 'bold';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
        }
    }

    // =======================================================
    // ЗАГРУЗКА НАСТРОЕК
    // =======================================================
    async function loadSettings() {
        document.getElementById('field-username').value = activeUser;
        renderAvatar();
        renderIconPicker();
        loadContactAliases();

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
        } else {
            preview.style.backgroundImage = 'none';
            preview.style.background = 'linear-gradient(135deg, #ffd66b, #ffb03a)';
            preview.textContent = activeUser.charAt(0).toUpperCase();
            preview.style.color = '#fff';
            preview.style.fontWeight = 'bold';
        }
        updatePreviewAvatar();
    }

    document.getElementById('profile-avatar-btn').addEventListener('click', function() {
        document.getElementById('profile-avatar-input').click();
    });

    document.getElementById('profile-avatar-reset').addEventListener('click', async function() {
        await patchProfile({ avatar_url: null });
        LocalStore.set('avatar_url', '');
        localStorage.removeItem('leto_avatar_cache'); // Сбрасываем кэш мессенджера
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
        
        // ВАЖНО: Сбрасываем кэш аватарок, чтобы мессенджер скачал новый
        localStorage.removeItem('leto_avatar_cache'); 
        
        renderAvatar();
        showToast('Аватар обновлён', 'success');
    });

    // =======================================================
    // ИКОНКИ ПРИЛОЖЕНИЯ
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
                
                updateAppIcon(icon.value);
                
                showToast('Иконка приложения обновлена', 'success');
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
            if (id === 'toggle-2fa') {
                if (this.checked && !emailVerified) {
                    this.checked = false;
                    LocalStore.set('two_factor_enabled', false);
                    patchProfile({ two_factor_enabled: false });
                    showToast('Сначала подтвердите email', 'error');
                    return;
                }
                LocalStore.set(key, this.checked);
                patchProfile({ two_factor_enabled: this.checked });
                if (this.checked) {
                    showToast('2FA включена', 'success');
                } else {
                    showToast('2FA выключена', 'success');
                }
                return;
            }
            LocalStore.set(key, this.checked);
        });
    });

    // =======================================================
    // EMAIL И СМЕНА EMAIL
    // =======================================================
    document.getElementById('toggle-notify-email').addEventListener('change', function() {
        if (this.checked && (!currentEmail || !emailVerified)) {
            this.checked = false;
            showToast('Сначала привяжите и подтвердите email', 'error');
            return;
        }
        LocalStore.set('notify_email_enabled', this.checked);
        patchProfile({ notify_email_enabled: this.checked });
    });

    document.getElementById('quiet-hours-from').addEventListener('change', function() {
        LocalStore.set('quiet_hours_from', this.value);
    });
    document.getElementById('quiet-hours-to').addEventListener('change', function() {
        LocalStore.set('quiet_hours_to', this.value);
    });

    // Обработчик кнопки Изменить/Сохранить Email
    document.getElementById('email-edit-btn').addEventListener('click', function() {
        if (isEditingEmail) {
            const newEmail = document.getElementById('field-email').value.trim();
            if (!newEmail) { showToast('Введите email', 'error'); return; }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) { showToast('Некорректный email', 'error'); return; }

            if (newEmail === currentEmail) {
                document.getElementById('field-email').readOnly = true;
                this.textContent = 'Изменить';
                isEditingEmail = false;
                updateEmailStatus();
                return;
            }

            currentEmail = newEmail;
            patchProfile({ notify_email: newEmail, email_verified: false, two_factor_enabled: false });
            
            LocalStore.set('two_factor_enabled', false);
            document.getElementById('toggle-2fa').checked = false;
            document.getElementById('toggle-notify-email').checked = false;
            
            emailVerified = false;
            document.getElementById('field-email').readOnly = true;
            document.getElementById('field-email').value = currentEmail;
            this.textContent = 'Изменить';
            isEditingEmail = false;
            updateEmailStatus();
            showToast('Email сохранён. Требуется подтверждение.', 'success');
        } else {
            document.getElementById('confirm-account-password').value = '';
            document.getElementById('password-confirm-status').textContent = '';
            document.getElementById('password-confirm-modal').classList.add('active');
            setTimeout(() => document.getElementById('confirm-account-password').focus(), 100);
        }
    });

    document.getElementById('password-confirm-cancel').addEventListener('click', function() {
        document.getElementById('password-confirm-modal').classList.remove('active');
    });

    document.getElementById('password-confirm-ok').addEventListener('click', async function() {
        const pass = document.getElementById('confirm-account-password').value;
        const statusEl = document.getElementById('password-confirm-status');
        
        if (!pass) {
            statusEl.textContent = 'Введите пароль';
            statusEl.className = 'modal-status error';
            return;
        }
        
        try {
            const res = await fetch(USER_URL + "?username=eq." + encodeURIComponent(activeUser), {
                method: "GET", headers: HEADERS_GET
            });
            const rows = await res.json();
            
            if (rows && rows[0] && rows[0].password === pass) {
                document.getElementById('password-confirm-modal').classList.remove('active');
                document.getElementById('field-email').readOnly = false;
                document.getElementById('field-email').focus();
                document.getElementById('email-edit-btn').textContent = 'Сохранить';
                document.getElementById('email-verify-btn').style.display = 'none';
                isEditingEmail = true;
            } else {
                statusEl.textContent = 'Неверный пароль';
                statusEl.className = 'modal-status error';
            }
        } catch (e) {
            statusEl.textContent = 'Ошибка сервера';
            statusEl.className = 'modal-status error';
        }
    });

    // =======================================================
    // СМЕНА НИКНЕЙМА
    // =======================================================
    document.getElementById('change-username-btn').addEventListener('click', function() {
        document.getElementById('username-change-password').value = '';
        document.getElementById('username-change-new').value = '';
        document.getElementById('username-change-status').textContent = '';
        document.getElementById('username-change-modal').classList.add('active');
        setTimeout(() => document.getElementById('username-change-password').focus(), 100);
    });

    document.getElementById('username-change-cancel').addEventListener('click', function() {
        document.getElementById('username-change-modal').classList.remove('active');
    });

    document.getElementById('username-change-ok').addEventListener('click', async function() {
        const pass = document.getElementById('username-change-password').value;
        const newNick = document.getElementById('username-change-new').value.trim().toLowerCase();
        const statusEl = document.getElementById('username-change-status');
        const btn = this;

        if (!pass) {
            statusEl.textContent = 'Введите пароль';
            statusEl.className = 'modal-status error';
            return;
        }
        if (newNick.length < 3) {
            statusEl.textContent = 'Никнейм должен быть не менее 3 символов';
            statusEl.className = 'modal-status error';
            return;
        }
        if (newNick === activeUser) {
            statusEl.textContent = 'Это ваш текущий никнейм';
            statusEl.className = 'modal-status error';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Проверка...';
        statusEl.textContent = '';

        try {
            const res = await fetch(USER_URL + "?username=eq." + encodeURIComponent(activeUser), {
                method: "GET", headers: HEADERS_GET
            });
            const rows = await res.json();

            if (!rows || !rows[0] || rows[0].password !== pass) {
                statusEl.textContent = 'Неверный пароль';
                statusEl.className = 'modal-status error';
                btn.disabled = false;
                btn.textContent = 'Изменить';
                return;
            }

            const checkRes = await fetch(USER_URL + "?username=eq." + encodeURIComponent(newNick), {
                method: "GET", headers: HEADERS_GET
            });
            const existing = await checkRes.json();
            if (existing && existing.length > 0) {
                statusEl.textContent = 'Этот никнейм уже занят';
                statusEl.className = 'modal-status error';
                btn.disabled = false;
                btn.textContent = 'Изменить';
                return;
            }

            document.getElementById('username-change-modal').classList.remove('active');
            confirmDialog(
                'Смена никнейма', 
                `Вы действительно хотите сменить никнейм с "${activeUser}" на "${newNick}"? Это изменит его во всех сообщениях и чатах.`, 
                async function() {
                    showToast('Обновление данных...', '');
                    
                    try {
                        const oldUser = activeUser;
                        
                        const userRes = await fetch(USER_URL + "?username=eq." + encodeURIComponent(oldUser), {
                            method: "PATCH", headers: HEADERS, body: JSON.stringify({ username: newNick })
                        });
                        if (!userRes.ok) throw new Error('Ошибка обновления users');

                        const profRes = await fetch(PROFILES_URL + "?username=eq." + encodeURIComponent(oldUser), {
                            method: "PATCH", headers: HEADERS, body: JSON.stringify({ username: newNick })
                        });
                        if (!profRes.ok) throw new Error('Ошибка обновления profiles');

                        const updates = [
                            fetch(BACKUP_URL + "?username=eq." + encodeURIComponent(oldUser), {
                                method: "PATCH", headers: HEADERS, body: JSON.stringify({ username: newNick })
                            }),
                            fetch(MESSAGES_URL + "?sender=eq." + encodeURIComponent(oldUser), {
                                method: "PATCH", headers: HEADERS, body: JSON.stringify({ sender: newNick })
                            }),
                            fetch(MESSAGES_URL + "?receiver=eq." + encodeURIComponent(oldUser), {
                                method: "PATCH", headers: HEADERS, body: JSON.stringify({ receiver: newNick })
                            }),
                            fetch(ROOMS_URL + "?creator=eq." + encodeURIComponent(oldUser), {
                                method: "PATCH", headers: HEADERS, body: JSON.stringify({ creator: newNick })
                            })
                        ];
                        await Promise.all(updates);

                        const roomsRes = await fetch(ROOMS_URL + "?select=id,members", { headers: HEADERS_GET });
                        const rooms = await roomsRes.json();
                        if (rooms && rooms.length > 0) {
                            const roomUpdates = [];
                            for (const room of rooms) {
                                if (room.members && Array.isArray(room.members) && room.members.includes(oldUser)) {
                                    const newMembers = room.members.map(m => m === oldUser ? newNick : m);
                                    roomUpdates.push(
                                        fetch(ROOMS_URL + "?id=eq." + room.id, {
                                            method: "PATCH", headers: HEADERS, body: JSON.stringify({ members: newMembers })
                                        })
                                    );
                                }
                            }
                            await Promise.all(roomUpdates);
                        }

                        localStorage.setItem('leto_active_user', newNick);
                        localStorage.removeItem('leto_avatar_cache');
                        
                        showToast('Никнейм успешно изменён!', 'success');
                        setTimeout(() => { location.reload(); }, 1500);

                    } catch (err) {
                        showToast('Ошибка при обновлении данных: ' + err.message, 'error');
                        btn.disabled = false;
                        btn.textContent = 'Изменить';
                    }
                }
            );
            
            btn.disabled = false;
            btn.textContent = 'Изменить';

        } catch (e) {
            statusEl.textContent = 'Ошибка сервера';
            statusEl.className = 'modal-status error';
            btn.disabled = false;
            btn.textContent = 'Изменить';
        }
    });

    // =======================================================
    // ЗВУКИ
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