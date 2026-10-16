// =======================================================
// ☀️ МЕССЕНДЖЕР «ЛЕТО» — с кэшем, push, галочками
// 2FA проверяется только при входе (в script.js), не здесь
// =======================================================

document.addEventListener('DOMContentLoaded', function() {

    const MY_SUPABASE_URL = "https://rvmtghettsndnnhdeasx.supabase.co";
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q";

    const SUPABASE_MSG_URL      = MY_SUPABASE_URL + "/rest/v1/messages";
    const SUPABASE_ROOMS_URL    = MY_SUPABASE_URL + "/rest/v1/rooms";
    const SUPABASE_PROFILES_URL = MY_SUPABASE_URL + "/rest/v1/profiles";

    const HEADERS = {
        "apikey": MY_SERVER_KEY,
        "Authorization": "Bearer " + MY_SERVER_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };
    const HEADERS_GET = {
        "apikey": MY_SERVER_KEY,
        "Authorization": "Bearer " + MY_SERVER_KEY
    };

    const DEFAULT_AVATAR = 'logo.png';
    const CACHE_MESSAGES_KEY = 'leto_cache_messages';
    const CACHE_CHATS_KEY = 'leto_cache_chats';
    const AVATAR_CACHE_KEY = 'leto_avatar_cache';

    let currentChatType   = 'contact';
    let activeChatTarget  = null;
    let refreshInterval   = null;
    let activeChatCreator = null;
    let activeRoomData    = null;
    let lastMessagesCount = -1;
    let selectedMsgData   = null;
    let touchTimer        = null;
    let pendingRoomAvatarUrl = null;

    let presenceInterval = null;
    let typingTimeout    = null;
    let isTypingAnnounced = false;
    let unreadByChat = {};
    let globalUnreadInterval = null;
    let lastToastKey = null;

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    const currentActiveUser = localStorage.getItem('leto_active_user');
    if (!currentActiveUser) { window.location.href = "index.html"; return; }

    DeviceApproval.startPollingAsTrustedDevice(currentActiveUser, (payload) => {
        showDeviceApprovalScreen(payload);
    });

    function showDeviceApprovalScreen(payload) {
        if (document.getElementById('device-approval-overlay')) return;
        if (!payload || !payload.code) return;

        const overlay = document.createElement('div');
        overlay.id = 'device-approval-overlay';
        overlay.className = 'device-approval-overlay';
        overlay.innerHTML = `
            <div class="device-approval-card">
                <div class="device-approval-icon">🔐</div>
                <h3 class="device-approval-title">Подтвердите вход</h3>
                <p class="device-approval-text">
                    Кто-то пытается войти в ваш аккаунт «Лето».
                    Если это вы — нажмите на цифры в правильном порядке.
                </p>
                <div class="device-approval-digits" id="approval-digits">
                    ${String(payload.code).split('').map(d => `
                        <button class="approval-digit-btn" data-digit="${d}">${d}</button>
                    `).join('')}
                </div>
                <div class="device-approval-status" id="approval-status"></div>
                <div class="device-approval-actions">
                    <button class="btn-danger" id="approval-deny-btn">Это не я</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const digitsContainer = document.getElementById('approval-digits');
        const buttons = Array.from(digitsContainer.children);
        buttons.sort(() => Math.random() - 0.5);
        buttons.forEach(b => digitsContainer.appendChild(b));

        let entered = [];
        const correct = String(payload.code).split('');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                entered.push(btn.getAttribute('data-digit'));
                btn.classList.add('pressed');

                if (entered.length === correct.length) {
                    const ok = entered.every((d, i) => d === correct[i]);
                    if (ok) {
                        document.getElementById('approval-status').textContent = '✅ Подтверждено!';
                        document.getElementById('approval-status').className = 'device-approval-status success';
                        DeviceApproval.sendApprovalResponse(currentActiveUser, true);
                        setTimeout(() => overlay.remove(), 1500);
                    } else {
                        document.getElementById('approval-status').textContent = '❌ Неверный порядок';
                        document.getElementById('approval-status').className = 'device-approval-status error';
                        entered = [];
                        buttons.forEach(b => b.classList.remove('pressed'));
                    }
                }
            });
        });

        document.getElementById('approval-deny-btn').addEventListener('click', () => {
            DeviceApproval.sendApprovalResponse(currentActiveUser, false);
            overlay.remove();
        });
    }

    // =======================================================
    // === АВАТАРКИ ===
    // =======================================================
    const avatarCache = {};
    try {
        const saved = JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY) || '{}');
        Object.assign(avatarCache, saved);
    } catch (e) {}

    function saveAvatarCache() {
        try {
            localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(avatarCache));
        } catch (e) {}
    }

    async function fetchAvatarUrl(username) {
        if (!username) return '';
        if (avatarCache[username] !== undefined) return avatarCache[username];
        try {
            const res = await fetch(
                SUPABASE_PROFILES_URL + "?username=eq." + encodeURIComponent(username) + "&select=avatar_url",
                { method: "GET", headers: HEADERS_GET }
            );
            const rows = await res.json();
            const url = (rows && rows[0] && rows[0].avatar_url) ? rows[0].avatar_url : '';
            if (url || username !== currentActiveUser) {
                avatarCache[username] = url;
                saveAvatarCache();
            }
            return url;
        } catch (e) {
            return '';
        }
    }

    function setAvatarOnElement(el, url) {
        if (!el) return;
        if (url) {
            el.textContent = '';
            el.style.background = `url('${url}') center/cover no-repeat`;
        } else {
            el.textContent = '';
            el.style.background = `url('${DEFAULT_AVATAR}') center/cover no-repeat`;
        }
    }

    function applyAvatarFast(el, username) {
        if (!el) return;
        if (!username) { setAvatarOnElement(el, ''); return; }

        if (username === currentActiveUser) {
            const localUrl = LocalStore.get('avatar_url', '');
            if (localUrl) { setAvatarOnElement(el, localUrl); return; }
        }
        const cached = avatarCache[username];
        if (cached !== undefined && cached !== '') {
            setAvatarOnElement(el, cached);
        } else {
            setAvatarOnElement(el, '');
            fetchAvatarUrl(username).then(url => {
                if (url) setAvatarOnElement(el, url);
            });
        }
    }

    (async function preloadMyAvatar() {
        delete avatarCache[currentActiveUser];
        const localUrl = LocalStore.get('avatar_url', '');
        if (localUrl) avatarCache[currentActiveUser] = localUrl;
        const fresh = await fetchAvatarUrl(currentActiveUser);
        if (fresh) {
            LocalStore.set('avatar_url', fresh);
            avatarCache[currentActiveUser] = fresh;
        } else if (localUrl) {
            avatarCache[currentActiveUser] = localUrl;
        }
        applyUserAppearance();
    })();

    // =======================================================
    // === ВНЕШНИЙ ВИД ===
    // =======================================================
    function applyUserAppearance() {
        const theme = LocalStore.get('theme', 'light');
        let actual = theme;
        if (theme === 'system') {
            actual = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', actual);

        document.documentElement.style.setProperty('--primary-color', LocalStore.get('accent_color', '#007aff'));
        document.documentElement.style.setProperty('--message-font-size', LocalStore.get('font_size', 15) + 'px');

        const avatarEl = document.querySelector('.user-bar .user-avatar');
        if (avatarEl) {
            const stored = LocalStore.get('avatar_url', '');
            const cached = avatarCache[currentActiveUser];
            const url = stored || (cached !== undefined && cached ? cached : '');
            if (url) {
                setAvatarOnElement(avatarEl, url);
            } else {
                const icon = LocalStore.get('app_icon', '☀️');
                avatarEl.textContent = icon;
                avatarEl.style.background = 'linear-gradient(135deg, #ffd66b, #ffb03a)';
                avatarEl.style.display = 'flex';
                avatarEl.style.alignItems = 'center';
                avatarEl.style.justifyContent = 'center';
                avatarEl.style.fontSize = '22px';
            }
        }
    }

    applyUserAppearance();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (LocalStore.get('theme', 'light') === 'system') applyUserAppearance();
    });

    // =======================================================
    // === PUSH / MEDIAN ===
    // =======================================================
    const MedianBridge = {
        push(title, body, tag) {
            if (window.median && typeof window.median.push === 'function') {
                try { window.median.push({ title, body, tag }); return true; } catch (e) {}
            }
            if ("Notification" in window && Notification.permission === "granted") {
                try { new Notification(title, { body, tag, icon: 'logo.png' }); return true; } catch (e) {}
            }
            return false;
        },
        vibrate(ms) {
            if (window.median && typeof window.median.vibrate === 'function') {
                try { window.median.vibrate(ms); return; } catch (e) {}
            }
            if (navigator.vibrate) navigator.vibrate(ms);
        },
        setBadge(n) {
            if (window.median && typeof window.median.badge === 'function') {
                try { window.median.badge(n); } catch (e) {}
            }
        },
        subscribeToTopic(topic) {
            if (window.median && window.median.firebaseMessaging &&
                typeof window.median.firebaseMessaging.subscribeToTopic === 'function') {
                try { window.median.firebaseMessaging.subscribeToTopic({ topic }); } catch (e) {}
            }
        }
    };

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    setTimeout(() => {
        MedianBridge.subscribeToTopic('user_' + currentActiveUser);
    }, 2000);

    // =======================================================
    // === ЗВУКИ ===
    // =======================================================
    function playSound(type) {
        if (isQuietHours()) return;
        if (LocalStore.get('notifications_sound', true) === false) return;
        if (type === 'message' && LocalStore.get('sound_message', true) === false) return;
        if (type === 'sent' && LocalStore.get('sound_sent', true) === false) return;
        const file = type === 'sent' ? 'sent.mp3' : 'message.mp3';
        try { new Audio(file).play().catch(() => {}); } catch (e) {}
    }

    function isQuietHours() {
        if (!LocalStore.get('quiet_hours_enabled', false)) return false;
        const now = new Date();
        const cur = now.getHours() * 60 + now.getMinutes();
        const from = parseTime(LocalStore.get('quiet_hours_from', "23:00"));
        const to   = parseTime(LocalStore.get('quiet_hours_to', "08:00"));
        if (from <= to) return cur >= from && cur < to;
        return cur >= from || cur < to;
    }

    function parseTime(str) {
        const [h, m] = (str || "0:0").split(":").map(Number);
        return h * 60 + m;
    }

    // =======================================================
    // === EMAIL-УВЕДОМЛЕНИЯ ===
    // =======================================================
    async function sendEmailNotification(msg) {
        const recipient = msg.receiver;
        if (!recipient) return;
        let profile = null;
        try {
            const res = await fetch(
                SUPABASE_PROFILES_URL + "?username=eq." + encodeURIComponent(recipient) +
                "&select=notify_email,notify_email_enabled",
                { method: "GET", headers: HEADERS_GET }
            );
            const rows = await res.json();
            if (rows && rows[0]) profile = rows[0];
        } catch (e) { return; }

        if (!profile) return;
        if (profile.notify_email_enabled !== true) return;
        if (!profile.notify_email) return;

        try {
            await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: "service_v9f6zor",
                    template_id: "template_bpfaocd",
                    user_id: "S1NP5cFz0W79QnOiK",
                    template_params: {
                        to_email: profile.notify_email,
                        from_name: msg.sender,
                        message_text: msg.type === 'text' ? msg.text : '📎 Вложение',
                        chat_type: msg.chat_type,
                        chat_link: window.location.origin + '/messenger.html'
                    }
                })
            });
        } catch (e) {}
    }

    // =======================================================
    // === SVG ===
    // =======================================================
    const VERIFIED_USERS = ['алексей', 'тестовый', 'поддержка'];
    function isVerifiedUser(name) {
        return !!name && VERIFIED_USERS.includes(name.toLowerCase());
    }

    const svgVerified = `<svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;margin-left:4px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#248bf2"/></svg>`;
    const svgTickSingle = `<svg viewBox="0 0 24 24" fill="none" style="width:13px;height:13px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#8c9197"/></svg>`;
    const svgTickDouble = `<svg viewBox="0 0 24 24" fill="none" style="width:13px;height:13px;"><path d="M18 7l-1.41-1.41L9 13.17 5.41 9.59 4 11l5 5 9-9zM22 7l-1.41-1.41L13 13.17l-1.59-1.59L10 13l3 3 9-9z" fill="#4bb34b"/></svg>`;
    const svgSettings = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;color:var(--text-muted);"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

    // =======================================================
    // === ЭЛЕМЕНТЫ ===
    // =======================================================
    const activeUsernameEl     = document.getElementById('active-username');
    const chatsListTarget      = document.getElementById('chats-list-target');
    const filterButtons        = document.querySelectorAll('.tab-btn');
    const mainDynamicActionBtn = document.getElementById('main-dynamic-action-btn');
    const chatHeader           = document.getElementById('active-chat-header');
    const targetChatNameEl     = document.getElementById('target-chat-name');
    const messagesScreen       = document.getElementById('messages-screen');
    const fallbackNotice       = document.getElementById('fallback-notice');
    const inputZone            = document.getElementById('input-zone');
    const mainMessageField     = document.getElementById('main-message-field');
    const sendBtn              = document.getElementById('send-btn');
    const appContainer         = document.getElementById('app-container');
    const mobileBackBtn        = document.getElementById('mobile-back-btn');
    const statusTextEl         = document.getElementById('active-user-status');
    const roomSettingsBtn      = document.getElementById('room-settings-toggle-btn');
    const settingsPanel        = document.getElementById('leto-room-settings-panel');
    const userBarInfoEl        = document.querySelector('.user-bar .user-info');
    const clipBtn              = document.getElementById('chat-clip-file-btn');
    const micBtn               = document.getElementById('mic-record-btn');

    function setVisible(el, visible) {
        if (!el) return;
        if (visible) {
            el.classList.remove('hidden-force');
            el.style.removeProperty('display');
        } else {
            el.classList.add('hidden-force');
        }
    }

    if (userBarInfoEl) {
        let globalSettingsBtn = document.getElementById('global-settings-btn');
        if (!globalSettingsBtn) {
            globalSettingsBtn = document.createElement('button');
            globalSettingsBtn.id = 'global-settings-btn';
            globalSettingsBtn.className = 'icon-btn';
            globalSettingsBtn.style.marginLeft = 'auto';
            globalSettingsBtn.style.padding = '8px';
            globalSettingsBtn.innerHTML = svgSettings;
            globalSettingsBtn.title = 'Настройки профиля';
            globalSettingsBtn.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = "settings.html";
            });
            const userBar = document.querySelector('.user-bar');
            if (userBar) userBar.appendChild(globalSettingsBtn);
        }
    }

    let mediaFileInput = document.getElementById('media-file-input');
    if (!mediaFileInput) {
        mediaFileInput = document.createElement('input');
        mediaFileInput.id = 'media-file-input';
        mediaFileInput.type = 'file';
        mediaFileInput.accept = 'image/*,application/pdf,video/*';
        mediaFileInput.style.display = 'none';
        document.body.appendChild(mediaFileInput);
    }

    if (activeUsernameEl) {
        activeUsernameEl.innerHTML = currentActiveUser + (isVerifiedUser(currentActiveUser) ? svgVerified : '');
    }

    // =======================================================
    // === КЭШ ===
    // =======================================================
    function readCacheMessages() {
        try { return JSON.parse(localStorage.getItem(CACHE_MESSAGES_KEY) || '[]'); }
        catch (e) { return []; }
    }
    function writeCacheMessages(arr) {
        try { localStorage.setItem(CACHE_MESSAGES_KEY, JSON.stringify(arr.slice(-2000))); } catch (e) {}
    }
    function readCacheChats() {
        try { return JSON.parse(localStorage.getItem(CACHE_CHATS_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function writeCacheChats(obj) {
        try { localStorage.setItem(CACHE_CHATS_KEY, JSON.stringify(obj)); } catch (e) {}
    }

    function cacheKey(chatType, target) {
        return chatType + ':' + target;
    }

    function saveMessagesToCache(chatType, target, messages) {
        if (!Array.isArray(messages)) return;
        const cache = readCacheMessages();
        const key = cacheKey(chatType, target);

        const filtered = cache.filter(m => m.__cacheKey !== key);
        messages.forEach(m => {
            filtered.push({ ...m, __cacheKey: key });
        });
        writeCacheMessages(filtered);
    }

    function getMessagesFromCache(chatType, target) {
        const cache = readCacheMessages();
        const key = cacheKey(chatType, target);
        return cache.filter(m => m.__cacheKey === key);
    }

    function saveChatsToCache(chatType, chats) {
        const cache = readCacheChats();
        cache[chatType] = chats;
        writeCacheChats(cache);
    }

    function getChatsFromCache(chatType) {
        const cache = readCacheChats();
        return cache[chatType] || [];
    }

    // =======================================================
    // === ФОРМАТ ДАТЫ ===
    // =======================================================
    function formatStickyDate(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (target.getTime() === today.getTime()) return "Сегодня";
        if (target.getTime() === yesterday.getTime()) return "Вчера";
        const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
        return `${d.getDate()} ${months[d.getMonth()]}`;
    }

    function formatMessageTime(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // =======================================================
    // === TOAST ===
    // =======================================================
    function showToast(text, chatName) {
        const container = document.getElementById('leto-toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'leto-toast';
        toast.innerHTML = `<div class="leto-toast-icon">💬</div><div class="leto-toast-text">${text}</div>`;
        toast.addEventListener('click', () => {
            if (chatName) {
                if (currentChatType !== 'contact') {
                    currentChatType = 'contact';
                    filterButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-type') === 'contact'));
                    loadChats();
                }
                openChatWorkspace(chatName);
            }
            toast.remove();
        });
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('leto-toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
        while (container.children.length > 3) container.firstChild.remove();
    }

    // =======================================================
    // === PRESENCE ===
    // =======================================================
    function startPresenceLoop() {
        updateMyPresence();
        if (presenceInterval) clearInterval(presenceInterval);
        presenceInterval = setInterval(updateMyPresence, 30000);
    }

    function updateMyPresence() {
        if (LocalStore.get('incognito', false) === true) return;
        fetch(SUPABASE_PROFILES_URL + "?username=eq." + encodeURIComponent(currentActiveUser), {
            method: "PATCH", headers: HEADERS,
            body: JSON.stringify({ last_active: new Date().toISOString() })
        })
        .then(res => res.json())
        .then(rows => {
            if (!rows || rows.length === 0) {
                return fetch(SUPABASE_PROFILES_URL, {
                    method: "POST", headers: HEADERS,
                    body: JSON.stringify({
                        username: currentActiveUser,
                        last_active: new Date().toISOString(),
                        status: null
                    })
                });
            }
        }).catch(() => {});
    }

    function setMyStatus(newStatus) {
        if (LocalStore.get('incognito', false) === true) return;
        fetch(SUPABASE_PROFILES_URL + "?username=eq." + encodeURIComponent(currentActiveUser), {
            method: "PATCH", headers: HEADERS,
            body: JSON.stringify({ status: newStatus })
        }).catch(() => {});
    }

    // =======================================================
    // === СПИСОК ЧАТОВ ===
    // =======================================================
    function loadChats() {
        if (!chatsListTarget) return;

        const url = currentChatType === 'contact'
            ? SUPABASE_MSG_URL + "?chat_type=eq.contact&or=(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + ")&order=created_at.desc"
            : SUPABASE_ROOMS_URL + "?type=eq." + currentChatType + "&order=created_at.desc";

        fetch(url, { method: "GET", headers: HEADERS_GET })
        .then(res => res.json())
        .then(data => {
            if (!data || data.length === 0) {
                const cached = getChatsFromCache(currentChatType);
                if (cached.length > 0) {
                    renderChatsList(cached);
                } else {
                    chatsListTarget.innerHTML = '<div class="status-message">Пусто</div>';
                }
                return;
            }

            let renderData = [];
            if (currentChatType === 'contact') {
                const blocked = LocalStore.get('blocked_users', []);
                const blockArr = Array.isArray(blocked) ? blocked : [];
                const byUser = {};
                data.forEach(msg => {
                    const other = msg.sender === currentActiveUser ? msg.receiver : msg.sender;
                    if (blockArr.includes(other)) return;
                    if (!byUser[other]) byUser[other] = { lastMsg: msg, unread: 0, lastDate: new Date(msg.created_at) };
                    const d = new Date(msg.created_at);
                    if (d > byUser[other].lastDate) { byUser[other].lastDate = d; byUser[other].lastMsg = msg; }
                    if (msg.receiver === currentActiveUser && msg.is_read === false) byUser[other].unread++;
                });
                const sorted = Object.entries(byUser).sort((a,b) => b[1].lastDate - a[1].lastDate);
                sorted.forEach(([name]) => { fetchAvatarUrl(name); });
                renderData = sorted.map(([name, info]) => ({
                    name: name,
                    subtitle: (info.lastMsg.type === 'text') ? info.lastMsg.text : '📎 Вложение',
                    avatar: '',
                    creator: '',
                    unread: info.unread,
                    verified: false,
                    type: 'contact'
                }));
            } else {
                renderData = data.map(room => ({
                    name: room.name,
                    subtitle: room.description || "Нет описания",
                    avatar: room.avatar_url || '',
                    creator: room.creator,
                    unread: unreadByChat[room.name] || 0,
                    verified: room.verified === true,
                    type: currentChatType
                }));
            }

            saveChatsToCache(currentChatType, renderData);
            renderChatsList(renderData);
        }).catch(() => {
            const cached = getChatsFromCache(currentChatType);
            if (cached.length > 0) renderChatsList(cached);
            else chatsListTarget.innerHTML = '<div class="status-message">Ошибка загрузки</div>';
        });
    }

    function renderChatsList(renderData) {
        chatsListTarget.innerHTML = '';
        if (!renderData || renderData.length === 0) {
            chatsListTarget.innerHTML = '<div class="status-message">Пусто</div>';
            return;
        }
        renderData.forEach(item => {
            renderChatCard(item.name, item.subtitle, item.avatar, item.creator, item.unread, item.verified);
        });
    }

    function renderChatCard(name, subtitle, avatarUrl, creatorName, unreadCount, isVerifiedRoom) {
        const card = document.createElement('div');
        card.className = 'chat-card' + (activeChatTarget === name ? ' active' : '');
        const isVerUser = isVerifiedUser(name);
        const verRoom = isVerifiedRoom ? svgVerified : '';
        const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';

        card.innerHTML = `
            <div class="user-avatar small chat-card-avatar"></div>
            <div class="chat-card-body">
                <span class="user-display-name">${name}${isVerUser ? svgVerified : verRoom}</span>
                <span class="chat-preview">${subtitle || ''}</span>
            </div>
            ${unreadBadge}
        `;

        const avatarEl = card.querySelector('.chat-card-avatar');
        if (currentChatType === 'contact') {
            applyAvatarFast(avatarEl, name);
        } else {
            if (avatarUrl) {
                setAvatarOnElement(avatarEl, avatarUrl);
            } else {
                setAvatarOnElement(avatarEl, '');
            }
        }

        card.addEventListener('click', function() {
            activeChatTarget = name;
            activeChatCreator = creatorName;
            openChatWorkspace(name);
        });
        chatsListTarget.appendChild(card);
    }

    // =======================================================
    // === ОТКРЫТИЕ ЧАТА ===
    // =======================================================
    function openChatWorkspace(chatName) {
        activeChatTarget = chatName;
        lastMessagesCount = -1;
        clearInterval(refreshInterval);
        if (settingsPanel) settingsPanel.style.display = 'none';

        if (currentChatType === 'contact') {
            activeChatCreator = null;
            activeRoomData = null;
            proceedOpeningWorkspace(chatName);
            return;
        }

        fetch(SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(chatName), { method: "GET", headers: HEADERS_GET })
        .then(res => res.json())
        .then(rooms => {
            if (!rooms || !rooms[0]) {
                activeChatCreator = null;
                activeRoomData = null;
                proceedOpeningWorkspace(chatName);
                return;
            }
            const room = rooms[0];
            activeChatCreator = room.creator;
            activeRoomData = room;

            const isChannel = (currentChatType === 'channel');
            const isOwner = (room.creator === currentActiveUser);
            const members = room.members || [];
            const isMember = members.includes(currentActiveUser);
            const canRead = isChannel ? true : (isMember || isOwner);

            if (!canRead) {
                showGroupDenied(chatName);
                return;
            }
            proceedOpeningWorkspace(chatName);
        })
        .catch(() => proceedOpeningWorkspace(chatName));
    }

    function showGroupDenied(chatName) {
        if (fallbackNotice) fallbackNotice.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'flex';
        if (inputZone) inputZone.style.display = 'block';
        if (messagesScreen) {
            messagesScreen.style.display = 'flex';
            messagesScreen.innerHTML = '<div class="status-message">🔒 Это закрытая группа. Вы не участник.</div>';
        }
        const isVerUser = isVerifiedUser(chatName);
        if (targetChatNameEl) targetChatNameEl.innerHTML = chatName + (isVerUser ? svgVerified : '');
        if (appContainer) appContainer.classList.add('show-chat');

        if (roomSettingsBtn) roomSettingsBtn.style.display = 'none';
        if (statusTextEl) statusTextEl.style.display = 'none';

        const headerAvatarEl = document.querySelector('.chat-header-avatar');
        if (headerAvatarEl) applyAvatarFast(headerAvatarEl, chatName);

        if (mainMessageField) {
            mainMessageField.style.display = 'block';
            mainMessageField.disabled = true;
            mainMessageField.value = "";
            mainMessageField.placeholder = "🔒 Вы не участник группы";
        }
        setVisible(sendBtn, false);
        setVisible(clipBtn, false);
        setVisible(micBtn, false);

        lastMessagesCount = -1;
        clearInterval(refreshInterval);
    }

    function proceedOpeningWorkspace(chatName) {
        if (fallbackNotice) fallbackNotice.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'flex';
        if (inputZone) inputZone.style.display = 'block';
        if (messagesScreen) messagesScreen.style.display = 'flex';

        const isVerUser = isVerifiedUser(chatName);
        if (targetChatNameEl) targetChatNameEl.innerHTML = chatName + (isVerUser ? svgVerified : '');
        if (appContainer) appContainer.classList.add('show-chat');

        const isOwner = (currentChatType !== 'contact' && activeChatCreator === currentActiveUser);

        if (roomSettingsBtn) {
            if (isOwner && (currentChatType === 'group' || currentChatType === 'channel')) {
                roomSettingsBtn.style.display = 'flex';
            } else {
                roomSettingsBtn.style.display = 'none';
            }
        }

        const headerAvatarEl = document.querySelector('.chat-header-avatar');

        if (currentChatType === 'contact') {
            if (headerAvatarEl) applyAvatarFast(headerAvatarEl, chatName);

            mainMessageField.style.display = '';
            mainMessageField.disabled = false;
            mainMessageField.placeholder = "Напишите сообщение...";
            setVisible(sendBtn, true);
            setVisible(clipBtn, true);
            setVisible(micBtn, true);

            markChatAsRead(chatName);
            if (statusTextEl) {
                statusTextEl.style.display = 'block';
                statusTextEl.textContent = 'загрузка...';
                refreshContactStatus(chatName);
            }

            clearInterval(refreshInterval);
            loadMessages();
            refreshInterval = setInterval(() => {
                loadMessages();
                refreshContactStatus(chatName);
            }, 3000);
            return;
        }

        fetch(SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(chatName), { method: "GET", headers: HEADERS_GET })
        .then(r => r.json())
        .then(rooms => {
            if (!rooms || !rooms[0]) return;
            const room = rooms[0];
            activeRoomData = room;
            activeChatCreator = room.creator;

            const members = room.members || [];
            const isMember = members.includes(currentActiveUser);
            const isChannel = (currentChatType === 'channel');
            const isOwnerLocal = (room.creator === currentActiveUser);

            const verRoom = room.verified ? svgVerified : '';
            if (isChannel) {
                targetChatNameEl.innerHTML = `${chatName}${verRoom}`;
            } else {
                targetChatNameEl.innerHTML = `${chatName}${verRoom} <span class="chat-header-count">· ${members.length} участников</span>`;
            }

            if (headerAvatarEl) {
                if (room.avatar_url) {
                    setAvatarOnElement(headerAvatarEl, room.avatar_url);
                } else {
                    setAvatarOnElement(headerAvatarEl, '');
                }
            }

            let canWrite = false;
            if (isChannel) canWrite = isOwnerLocal;
            else canWrite = isMember || isOwnerLocal;

            if (canWrite) {
                mainMessageField.style.display = '';
                mainMessageField.disabled = false;
                mainMessageField.placeholder = "Напишите сообщение...";
                setVisible(sendBtn, true);
                setVisible(clipBtn, true);
                setVisible(micBtn, true);
            } else {
                mainMessageField.style.display = 'block';
                mainMessageField.disabled = true;
                mainMessageField.value = "";
                if (isChannel) mainMessageField.placeholder = "🔒 Только администраторы могут писать сюда";
                else mainMessageField.placeholder = "🔒 Вы не участник группы";
                setVisible(sendBtn, false);
                setVisible(clipBtn, false);
                setVisible(micBtn, false);
            }

            if (isChannel || isMember || isOwnerLocal) markChatAsRead(chatName);
            if (statusTextEl) statusTextEl.style.display = 'none';

            loadMessages();
            clearInterval(refreshInterval);
            refreshInterval = setInterval(() => { loadMessages(); }, 3000);
        }).catch(() => {});
    }

    function refreshContactStatus(chatName) {
        if (!statusTextEl) return;
        fetch(SUPABASE_PROFILES_URL + "?username=eq." + encodeURIComponent(chatName), { method: "GET", headers: HEADERS_GET })
        .then(res => res.json())
        .then(profiles => {
            if (!profiles || profiles.length === 0) {
                statusTextEl.textContent = 'была недавно';
                statusTextEl.classList.remove('online');
                return;
            }
            const p = profiles[0];
            const la = p.last_active ? new Date(p.last_active) : new Date(0);
            const diffSec = (new Date() - la) / 1000;

            if (p.status === 'typing') {
                statusTextEl.textContent = 'печатает...';
                statusTextEl.classList.add('online');
            } else if (p.status === 'recording') {
                statusTextEl.textContent = 'записывает голосовое...';
                statusTextEl.classList.add('online');
            } else if (diffSec < 40) {
                statusTextEl.textContent = '• в сети';
                statusTextEl.classList.add('online');
            } else if (diffSec < 300) {
                statusTextEl.textContent = 'был(а) недавно';
                statusTextEl.classList.remove('online');
            } else {
                statusTextEl.textContent = 'был(а) в сети в ' + la.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                statusTextEl.classList.remove('online');
            }
        }).catch(() => {
            statusTextEl.textContent = 'была недавно';
        });
    }

    function markChatAsRead(chatName) {
        if (LocalStore.get('incognito', false) === true) return;

        if (currentChatType === 'contact') {
            fetch(SUPABASE_MSG_URL + "?chat_type=eq.contact&receiver=eq." + encodeURIComponent(currentActiveUser) + "&sender=eq." + encodeURIComponent(chatName) + "&is_read=eq.false", {
                method: "PATCH", headers: HEADERS,
                body: JSON.stringify({ is_read: true })
            }).then(() => {
                unreadByChat[chatName] = 0;
                document.querySelectorAll('.chat-card').forEach(c => {
                    const nameEl = c.querySelector('.user-display-name');
                    if (nameEl && nameEl.textContent.trim().startsWith(chatName)) {
                        const b = c.querySelector('.unread-badge');
                        if (b) b.remove();
                    }
                });
            }).catch(() => {});
        } else {
            fetch(SUPABASE_MSG_URL + "?chat_type=eq." + currentChatType + "&receiver=eq." + encodeURIComponent(chatName) + "&is_read=eq.false", {
                method: "PATCH", headers: HEADERS,
                body: JSON.stringify({ is_read: true })
            }).then(() => { unreadByChat[chatName] = 0; }).catch(() => {});
        }
    }

    // =======================================================
    // === ЗАГРУЗКА СООБЩЕНИЙ ===
    // =======================================================
    function loadMessages() {
        if (!activeChatTarget || !messagesScreen) return;
        if (settingsPanel && settingsPanel.style.display === 'flex') return;

        if (currentChatType === 'group') {
            const room = activeRoomData;
            if (room) {
                const members = room.members || [];
                const isMember = members.includes(currentActiveUser);
                const isOwner = room.creator === currentActiveUser;
                if (!isMember && !isOwner) return;
            }
        }

        let url = SUPABASE_MSG_URL + "?chat_type=eq." + currentChatType + "&order=created_at.asc";
        if (currentChatType === 'contact') {
            url += "&or=(and(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(activeChatTarget) + "),and(sender.eq." + encodeURIComponent(activeChatTarget) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + "))";
        } else {
            url += "&receiver=eq." + encodeURIComponent(activeChatTarget);
        }

        fetch(url, { method: "GET", headers: HEADERS_GET })
        .then(res => res.json())
        .then(messages => {
            if (!messages || !Array.isArray(messages)) return;

            const blocked = LocalStore.get('blocked_users', []);
            const blockArr = Array.isArray(blocked) ? blocked : [];
            messages = messages.filter(m => !blockArr.includes(m.sender));

            saveMessagesToCache(currentChatType, activeChatTarget, messages);

            if (messages.length > lastMessagesCount && lastMessagesCount > 0) {
                const lm = messages[messages.length - 1];
                if (lm.sender !== currentActiveUser) {
                    const chatOpen = !document.hidden && activeChatTarget === lm.receiver;
                    if (!chatOpen) {
                        const label = currentChatType === 'contact'
                            ? `Новое сообщение от @${lm.sender}`
                            : `Новое сообщение в «${activeChatTarget}»`;
                        showToast(label, lm.sender);
                    }
                    handleIncomingNotification(lm);
                }
            }
            if (messages.length === lastMessagesCount) return;
            lastMessagesCount = messages.length;
            renderMessages(messages);
        })
        .catch(() => {
            const cached = getMessagesFromCache(currentChatType, activeChatTarget);
            if (cached.length > 0) {
                messagesScreen.innerHTML = '<div class="status-message">📦 Показан кэш (нет сети)</div>';
                renderMessages(cached, true);
            } else {
                if (messagesScreen) messagesScreen.innerHTML = '<div class="status-message">Ошибка загрузки сообщений</div>';
            }
        });
    }

    function renderMessages(messages, isCache) {
        const isUserAtBottom = (messagesScreen.scrollHeight - messagesScreen.scrollTop - messagesScreen.clientHeight) < 90;
        messagesScreen.innerHTML = "";
        let lastRenderedDateStr = "";

        const uniqueSenders = new Set();
        messages.forEach(msg => uniqueSenders.add(msg.sender));
        uniqueSenders.forEach(s => fetchAvatarUrl(s));

        messages.forEach(msg => {
            if (msg.text && msg.text.startsWith('/add_member:')) return;

            if (msg.created_at) {
                const dF = formatStickyDate(msg.created_at);
                if (dF && dF !== lastRenderedDateStr) {
                    const b = document.createElement('div');
                    b.className = 'chat-date-badge';
                    b.innerHTML = `<span>${dF}</span>`;
                    messagesScreen.appendChild(b);
                    lastRenderedDateStr = dF;
                }
            }

            const msgRow = document.createElement('div');
            const isMy = msg.sender === currentActiveUser;
            msgRow.className = 'msg-row ' + (isMy ? 'my-msg' : 'other-msg');

            const av = document.createElement('div');
            av.className = 'msg-user-avatar';
            applyAvatarFast(av, msg.sender);
            msgRow.appendChild(av);

            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble';

            let senderTag = '';
            if (currentChatType !== 'contact' && !isMy) {
                const senderVer = isVerifiedUser(msg.sender) ? svgVerified : '';
                senderTag = `<strong class="msg-sender-tag">${msg.sender}${senderVer}:</strong>`;
            }

            let timeStr = formatMessageTime(msg.created_at);
            let ticks = isMy ? (msg.is_read ? svgTickDouble : svgTickSingle) : '';
            const metaHTML = `<div class="msg-meta-container"><span>${timeStr}</span>${ticks}</div>`;

            let contentHTML = '';
            if (msg.type === 'image') {
                contentHTML = `<div class="msg-media-block"><a href="${msg.text}" target="_blank"><img src="${msg.text}" class="msg-media-img"></a>${metaHTML}</div>`;
            } else if (msg.type === 'voice') {
                contentHTML = `<div class="msg-voice-block"><audio controls src="${msg.text}"></audio>${metaHTML}</div>`;
            } else if (msg.type === 'file' && (msg.text.endsWith('.mp4') || msg.text.endsWith('.mov') || msg.text.includes('video'))) {
                contentHTML = `<div><a href="${msg.text}" target="_blank" class="video-link-styled">🎥 Открыть видео</a>${metaHTML}</div>`;
            } else if (msg.type === 'file') {
                contentHTML = `<div><a href="${msg.text}" target="_blank" class="file-link-styled">📂 Скачать файл</a>${metaHTML}</div>`;
            } else {
                contentHTML = `<div><span>${msg.text}</span>${metaHTML}</div>`;
            }

            bubble.innerHTML = senderTag + contentHTML;
            setupContextEvents(bubble, msg, isMy);
            msgRow.appendChild(bubble);
            messagesScreen.appendChild(msgRow);
        });

        if (isUserAtBottom || messagesScreen.children.length <= 1) {
            messagesScreen.scrollTop = messagesScreen.scrollHeight;
        }
    }

    function handleIncomingNotification(msg) {
        const blocked = LocalStore.get('blocked_users', []);
        const blockArr = Array.isArray(blocked) ? blocked : [];
        if (blockArr.includes(msg.sender)) return;

        const chatOpen = !document.hidden && activeChatTarget === msg.receiver;
        if (chatOpen) { playSound('message'); return; }
        if (isQuietHours()) return;
        if (LocalStore.get('notifications_enabled', true) === false) return;

        const type = msg.chat_type === 'contact' ? 'personal'
                   : msg.chat_type === 'group' ? 'groups'
                   : 'channels';
        if (type === 'personal' && LocalStore.get('notify_personal', true) === false) return;
        if (type === 'groups' && LocalStore.get('notify_groups', true) === false) return;
        if (type === 'channels' && LocalStore.get('notify_channels', true) === false) return;

        const title = 'Лето Мессенджер';
        const body = `@${msg.sender}: ${msg.type === 'text' ? msg.text : '📎 Вложение'}`;
        MedianBridge.push(title, body, 'leto-' + msg.receiver);

        if (LocalStore.get('notifications_sound', true) !== false) playSound('message');
        if (LocalStore.get('notifications_vibrate', true) !== false) MedianBridge.vibrate(200);

        if (LocalStore.get('notifications_badge', true) !== false) {
            const total = Object.values(unreadByChat).reduce((a, b) => a + b, 0);
            MedianBridge.setBadge(total);
        }

        sendEmailNotification(msg);
    }

    // =======================================================
    // === ФАЙЛЫ / ГОЛОС ===
    // =======================================================
    if (clipBtn) {
        clipBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (!activeChatTarget) return;
            if (clipBtn.classList.contains('hidden-force')) return;
            mediaFileInput.click();
        });
    }

    mediaFileInput.addEventListener('change', function() {
        if (this.files.length === 0) return;
        const file = this.files[0];
        const fileName = "chat_" + Date.now() + "." + file.name.split('.').pop();

        fetch(MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName, {
            method: "POST",
            headers: {
                "apikey": MY_SERVER_KEY,
                "Authorization": "Bearer " + MY_SERVER_KEY,
                "Content-Type": file.type
            },
            body: file
        }).then(() => {
            const fullUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
            return fetch(SUPABASE_MSG_URL, {
                method: "POST", headers: HEADERS,
                body: JSON.stringify({
                    sender: currentActiveUser,
                    receiver: activeChatTarget,
                    text: fullUrl,
                    type: file.type.startsWith('image/') ? "image" : "file",
                    chat_type: currentChatType,
                    is_read: false,
                    created_at: new Date().toISOString()
                })
            });
        }).then(() => { lastMessagesCount = -1; loadMessages(); playSound('sent'); });
    });

    if (micBtn) {
        micBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (!activeChatTarget) return;
            if (micBtn.classList.contains('hidden-force')) return;

            if (!isRecording) {
                navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    mediaRecorder.addEventListener("dataavailable", ev => audioChunks.push(ev.data));
                    mediaRecorder.addEventListener("stop", () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const audioName = "voice_" + Date.now() + ".webm";
                        fetch(MY_SUPABASE_URL + "/storage/v1/object/media/" + audioName, {
                            method: "POST",
                            headers: {
                                "apikey": MY_SERVER_KEY,
                                "Authorization": "Bearer " + MY_SERVER_KEY,
                                "Content-Type": "audio/webm"
                            },
                            body: audioBlob
                        }).then(() => {
                            return fetch(SUPABASE_MSG_URL, {
                                method: "POST", headers: HEADERS,
                                body: JSON.stringify({
                                    sender: currentActiveUser,
                                    receiver: activeChatTarget,
                                    text: MY_SUPABASE_URL + "/storage/v1/object/public/media/" + audioName,
                                    type: "voice",
                                    chat_type: currentChatType,
                                    is_read: false,
                                    created_at: new Date().toISOString()
                                })
                            });
                        }).then(() => { lastMessagesCount = -1; loadMessages(); playSound('sent'); });
                        stream.getTracks().forEach(t => t.stop());
                        micBtn.classList.remove('recording');
                        setMyStatus(null);
                    });
                    mediaRecorder.start();
                    isRecording = true;
                    micBtn.classList.add('recording');
                    setMyStatus('recording');
                }).catch(err => alert("Ошибка микрофона: " + err.message));
            } else {
                if (mediaRecorder) mediaRecorder.stop();
                isRecording = false;
                micBtn.classList.remove('recording');
                setMyStatus(null);
            }
        });
    }

    // =======================================================
    // === КОНТЕКСТНОЕ МЕНЮ ===
    // =======================================================
    function setupContextEvents(element, msg, isMy) {
        const iAmCreator = (currentChatType !== 'contact' && activeChatCreator === currentActiveUser);
        if (!isMy && !iAmCreator) return;
        element.addEventListener('contextmenu', e => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, msg, isMy); });
        element.addEventListener('touchstart', e => {
            touchTimer = setTimeout(() => { openContextMenu(e.touches[0].clientX, e.touches[0].clientY, msg, isMy); }, 600);
        }, { passive: true });
        element.addEventListener('touchend', () => clearTimeout(touchTimer));
    }

    const ctxMenu = document.getElementById('leto-custom-context-menu');
    function openContextMenu(x, y, msg, isMy) {
        selectedMsgData = msg;
        if (!ctxMenu) return;
        ctxMenu.style.display = 'block';
        ctxMenu.style.top = y + 'px';
        ctxMenu.style.left = x + 'px';
        const editBtn = document.getElementById('ctx-edit-msg');
        if (editBtn) editBtn.style.display = (isMy && msg.type === 'text') ? 'block' : 'none';
    }

    document.addEventListener('click', () => { if (ctxMenu) ctxMenu.style.display = 'none'; });

    const ctxDeleteBtn = document.getElementById('ctx-delete-msg');
    if (ctxDeleteBtn) {
        ctxDeleteBtn.addEventListener('click', function() {
            if (!selectedMsgData || !confirm("Удалить сообщение?")) return;
            fetch(SUPABASE_MSG_URL + "?id=eq." + selectedMsgData.id, { method: "DELETE", headers: HEADERS_GET })
            .then(() => { lastMessagesCount = -1; loadMessages(); });
        });
    }

    const ctxEditBtn = document.getElementById('ctx-edit-msg');
    if (ctxEditBtn) {
        ctxEditBtn.addEventListener('click', function() {
            if (!selectedMsgData) return;
            const newText = prompt("Редактировать:", selectedMsgData.text);
            if (!newText || newText.trim() === selectedMsgData.text) return;
            fetch(SUPABASE_MSG_URL + "?id=eq." + selectedMsgData.id, {
                method: "PATCH", headers: HEADERS,
                body: JSON.stringify({ text: newText.trim() })
            }).then(() => { lastMessagesCount = -1; loadMessages(); });
        });
    }

    // =======================================================
    // === СОЗДАНИЕ КОМНАТ ===
    // =======================================================
    const createRoomModal    = document.getElementById('create-room-modal');
    const modalAvatarPreview = document.getElementById('modal-room-avatar-preview');
    const modalAvatarInput   = document.getElementById('modal-room-avatar-input');
    const modalAvatarBtn     = document.getElementById('modal-room-avatar-btn');

    if (modalAvatarBtn)     modalAvatarBtn.addEventListener('click', () => modalAvatarInput.click());
    if (modalAvatarPreview) modalAvatarPreview.addEventListener('click', () => modalAvatarInput.click());

    if (modalAvatarInput) {
        modalAvatarInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            const ext = file.name.split('.').pop();
            const fileName = "room_avatar_" + Date.now() + "." + ext;

            if (modalAvatarPreview) {
                modalAvatarPreview.textContent = '⏳';
                modalAvatarPreview.style.backgroundImage = 'none';
            }

            fetch(MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName, {
                method: "POST",
                headers: {
                    "apikey": MY_SERVER_KEY,
                    "Authorization": "Bearer " + MY_SERVER_KEY,
                    "Content-Type": file.type
                },
                body: file
            })
            .then(res => {
                if (!res.ok) throw new Error('Ошибка загрузки');
                pendingRoomAvatarUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
                if (modalAvatarPreview) {
                    modalAvatarPreview.textContent = '';
                    modalAvatarPreview.style.backgroundImage = `url('${pendingRoomAvatarUrl}')`;
                    modalAvatarPreview.style.backgroundSize = 'cover';
                    modalAvatarPreview.style.backgroundPosition = 'center';
                }
            })
            .catch(() => {
                alert('Не удалось загрузить аватар');
                if (modalAvatarPreview) {
                    modalAvatarPreview.textContent = '📷';
                    modalAvatarPreview.style.backgroundImage = 'none';
                }
                pendingRoomAvatarUrl = null;
            });
        });
    }

    if (mainDynamicActionBtn) {
        mainDynamicActionBtn.addEventListener('click', function() {
            if (currentChatType === 'contact') {
                const targetUsername = prompt("Введите юзернейм контакта:");
                if (!targetUsername || targetUsername.trim().toLowerCase() === currentActiveUser) return;
                fetch(SUPABASE_MSG_URL, {
                    method: "POST", headers: HEADERS,
                    body: JSON.stringify({
                        sender: currentActiveUser,
                        receiver: targetUsername.trim().toLowerCase(),
                        text: "👋 Диалог начат.",
                        type: "text",
                        chat_type: "contact",
                        is_read: false,
                        created_at: new Date().toISOString()
                    })
                }).then(() => { loadChats(); });
            } else {
                const modalTitleEl = document.getElementById('create-room-modal-title');
                if (modalTitleEl) modalTitleEl.textContent = currentChatType === 'group' ? "Создание группы" : "Создание канала";
                pendingRoomAvatarUrl = null;
                if (modalAvatarPreview) {
                    modalAvatarPreview.textContent = '📷';
                    modalAvatarPreview.style.backgroundImage = 'none';
                }
                if (modalAvatarInput) modalAvatarInput.value = '';
                if (createRoomModal) createRoomModal.style.display = 'flex';
            }
        });
    }

    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => {
        if (createRoomModal) createRoomModal.style.display = 'none';
        pendingRoomAvatarUrl = null;
        if (modalAvatarPreview) {
            modalAvatarPreview.textContent = '📷';
            modalAvatarPreview.style.backgroundImage = 'none';
        }
        if (modalAvatarInput) modalAvatarInput.value = '';
    });

    const modalSubmitBtn = document.getElementById('modal-submit-btn');
    if (modalSubmitBtn) {
        modalSubmitBtn.addEventListener('click', function() {
            const rNameEl = document.getElementById('modal-room-name');
            const rDescEl = document.getElementById('modal-room-desc');
            const rName = rNameEl ? rNameEl.value.trim() : "";
            const rDesc = rDescEl ? rDescEl.value.trim() : "";
            if (!rName) { alert('Введите название'); return; }

            fetch(SUPABASE_ROOMS_URL, {
                method: "POST", headers: HEADERS,
                body: JSON.stringify({
                    name: rName,
                    description: rDesc,
                    type: currentChatType,
                    creator: currentActiveUser,
                    members: [currentActiveUser],
                    avatar_url: pendingRoomAvatarUrl || null,
                    last_active: new Date().toISOString(),
                    verified: false
                })
            }).then(() => {
                if (createRoomModal) createRoomModal.style.display = 'none';
                if (rNameEl) rNameEl.value = "";
                if (rDescEl) rDescEl.value = "";
                pendingRoomAvatarUrl = null;
                if (modalAvatarPreview) {
                    modalAvatarPreview.textContent = '📷';
                    modalAvatarPreview.style.backgroundImage = 'none';
                }
                loadChats();
                openChatWorkspace(rName);
            }).catch(() => alert('Не удалось создать комнату'));
        });
    }

    // =======================================================
    // === НАСТРОЙКИ КОМНАТЫ (аватар) ===
    // =======================================================
    const settingsAvatarPreview = document.getElementById('settings-room-avatar-preview');
    const settingsAvatarInput   = document.getElementById('settings-room-avatar-input');
    const settingsAvatarBtn     = document.getElementById('settings-room-avatar-btn');

    if (settingsAvatarBtn)     settingsAvatarBtn.addEventListener('click', () => settingsAvatarInput.click());
    if (settingsAvatarPreview) settingsAvatarPreview.addEventListener('click', () => settingsAvatarInput.click());

    if (settingsAvatarInput) {
        settingsAvatarInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file || !activeChatTarget) return;

            const ext = file.name.split('.').pop();
            const fileName = "room_avatar_" + Date.now() + "." + ext;

            if (settingsAvatarPreview) {
                settingsAvatarPreview.textContent = '⏳';
                settingsAvatarPreview.style.backgroundImage = 'none';
            }

            fetch(MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName, {
                method: "POST",
                headers: {
                    "apikey": MY_SERVER_KEY,
                    "Authorization": "Bearer " + MY_SERVER_KEY,
                    "Content-Type": file.type
                },
                body: file
            })
            .then(res => {
                if (!res.ok) throw new Error('Ошибка загрузки');
                const newUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
                return fetch(SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(activeChatTarget), {
                    method: "PATCH", headers: HEADERS,
                    body: JSON.stringify({ avatar_url: newUrl })
                }).then(() => newUrl);
            })
            .then(newUrl => {
                if (settingsAvatarPreview) {
                    settingsAvatarPreview.textContent = '';
                    settingsAvatarPreview.style.backgroundImage = `url('${newUrl}')`;
                    settingsAvatarPreview.style.backgroundSize = 'cover';
                    settingsAvatarPreview.style.backgroundPosition = 'center';
                }
                const headerAvatarEl = document.querySelector('.chat-header-avatar');
                if (headerAvatarEl) setAvatarOnElement(headerAvatarEl, newUrl);
                loadChats();
            })
            .catch(() => {
                alert('Не удалось обновить аватар');
                if (settingsAvatarPreview) {
                    settingsAvatarPreview.textContent = '📷';
                    settingsAvatarPreview.style.backgroundImage = 'none';
                }
            });
        });
    }

    if (roomSettingsBtn) {
        roomSettingsBtn.addEventListener('click', function() {
            const setRoomNameEl = document.getElementById('set-room-name');
            if (setRoomNameEl) setRoomNameEl.value = activeChatTarget;
            const groupAddUsersSec = document.getElementById('group-add-users-section');
            if (groupAddUsersSec) groupAddUsersSec.style.display = currentChatType === 'group' ? 'flex' : 'none';

            fetch(SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(activeChatTarget), { method: "GET", headers: HEADERS_GET })
            .then(r => r.json())
            .then(rooms => {
                if (rooms && rooms[0]) {
                    const av = rooms[0].avatar_url;
                    if (settingsAvatarPreview) {
                        if (av) {
                            settingsAvatarPreview.textContent = '';
                            settingsAvatarPreview.style.backgroundImage = `url('${av}')`;
                            settingsAvatarPreview.style.backgroundSize = 'cover';
                            settingsAvatarPreview.style.backgroundPosition = 'center';
                        } else {
                            settingsAvatarPreview.textContent = '📷';
                            settingsAvatarPreview.style.backgroundImage = 'none';
                        }
                    }
                    const membersInfo = document.getElementById('members-info');
                    if (membersInfo) {
                        const m = rooms[0].members || [];
                        if (currentChatType === 'channel') {
                            membersInfo.innerHTML = "";
                        } else {
                            membersInfo.innerHTML = `<strong>Участников:</strong> ${m.length}<br>${m.join(', ')}`;
                        }
                    }
                }
            });

            if (messagesScreen) messagesScreen.style.display = 'none';
            if (inputZone) inputZone.style.display = 'none';
            if (settingsPanel) settingsPanel.style.display = 'flex';
        });
    }

    const closeRoomSettingsBtn = document.getElementById('close-room-settings-btn');
    if (closeRoomSettingsBtn) {
        closeRoomSettingsBtn.addEventListener('click', function() {
            if (settingsPanel) settingsPanel.style.display = 'none';
            if (messagesScreen) messagesScreen.style.display = 'flex';
            if (inputZone) inputZone.style.display = 'block';
        });
    }

    const deleteRoomCompletelyBtn = document.getElementById('delete-room-completely-btn');
    if (deleteRoomCompletelyBtn) {
        deleteRoomCompletelyBtn.addEventListener('click', function() {
            if (!confirm("Удалить комнату навсегда?")) return;
            fetch(SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(activeChatTarget), { method: "DELETE", headers: HEADERS_GET })
            .then(() => { location.reload(); });
        });
    }

    const submitAddMemberBtn = document.getElementById('submit-add-member-btn');
    if (submitAddMemberBtn) {
        submitAddMemberBtn.addEventListener('click', function() {
            const addMemberUserEl = document.getElementById('add-member-username');
            const user = addMemberUserEl ? addMemberUserEl.value.trim().toLowerCase() : "";
            if (!user) return;

            fetch(SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(activeChatTarget), { method: "GET", headers: HEADERS_GET })
            .then(res => res.json())
            .then(rooms => {
                if (!rooms || !rooms[0]) return;
                const room = rooms[0];
                const members = room.members || [];
                if (!members.includes(user)) members.push(user);
                const wasVerified = room.verified === true;
                const newVerified = members.length > 5 ? true : wasVerified;

                fetch(SUPABASE_ROOMS_URL + "?id=eq." + room.id, {
                    method: "PATCH", headers: HEADERS,
                    body: JSON.stringify({ members: members, verified: newVerified, last_active: new Date().toISOString() })
                }).then(() => {
                    if (newVerified && !wasVerified && room.creator === currentActiveUser) {
                        alert("🎉 Ваш канал набрал 5+ подписчиков и получил верификацию! ☀️");
                    }
                    return fetch(SUPABASE_MSG_URL, {
                        method: "POST", headers: HEADERS,
                        body: JSON.stringify({
                            sender: currentActiveUser,
                            receiver: activeChatTarget,
                            text: "/add_member:" + user,
                            type: "text",
                            chat_type: currentChatType,
                            is_read: false,
                            created_at: new Date().toISOString()
                        })
                    });
                }).then(() => {
                    alert("Добавлен!");
                    if (addMemberUserEl) addMemberUserEl.value = "";
                });
            });
        });
    }

    // =======================================================
    // === ОТПРАВКА ===
    // =======================================================
    function handleSendMessage() {
        if (!mainMessageField) return;
        const text = mainMessageField.value.trim();
        if (!text || !activeChatTarget) return;
        if (mainMessageField.disabled) return;

        fetch(SUPABASE_MSG_URL, {
            method: "POST", headers: HEADERS,
            body: JSON.stringify({
                sender: currentActiveUser,
                receiver: activeChatTarget,
                text: text,
                type: "text",
                chat_type: currentChatType,
                is_read: false,
                created_at: new Date().toISOString()
            })
        }).then(() => {
            mainMessageField.value = "";
            lastMessagesCount = -1;
            loadMessages();
            playSound('sent');
            clearTimeout(typingTimeout);
            isTypingAnnounced = false;
            setMyStatus(null);
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
    if (mainMessageField) mainMessageField.addEventListener('keydown', e => { if (e.key === 'Enter') handleSendMessage(); });

    if (mainMessageField) {
        mainMessageField.addEventListener('input', function() {
            if (!activeChatTarget) return;
            if (currentChatType !== 'contact') return;
            if (!isTypingAnnounced) {
                isTypingAnnounced = true;
                setMyStatus('typing');
            }
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                isTypingAnnounced = false;
                setMyStatus(null);
            }, 2000);
        });
    }

    // =======================================================
    // === ТАБЫ ===
    // =======================================================
    filterButtons.forEach(btn => {
        btn.addEventListener('click', e => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentChatType = e.currentTarget.getAttribute('data-type');
            loadChats();
        });
    });

    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', () => {
            if (appContainer) appContainer.classList.remove('show-chat');
            activeChatTarget = null;
        });
    }

    // =======================================================
    // === ГЛОБАЛЬНЫЙ ОПРОС ===
    // =======================================================
    function pollGlobalUnread() {
        if (currentChatType !== 'contact') return;
        fetch(SUPABASE_MSG_URL + "?chat_type=eq.contact&receiver=eq." + encodeURIComponent(currentActiveUser) + "&is_read=eq.false", { method: "GET", headers: HEADERS_GET })
        .then(res => res.json())
        .then(msgs => {
            const blocked = LocalStore.get('blocked_users', []);
            const blockArr = Array.isArray(blocked) ? blocked : [];
            const arr = (msgs || []).filter(m => !blockArr.includes(m.sender));
            unreadByChat = {};
            arr.forEach(m => { unreadByChat[m.sender] = (unreadByChat[m.sender] || 0) + 1; });

            if (arr.length > 0) {
                const last = arr[arr.length - 1];
                const cnt = unreadByChat[last.sender] || 0;
                const chatOpen = !document.hidden && activeChatTarget === last.sender;
                const key = 'unread:' + last.sender + ':' + cnt;
                if (!chatOpen && key !== lastToastKey) {
                    lastToastKey = key;
                    showToast(cnt > 1
                        ? `${cnt} новых сообщений от @${last.sender}`
                        : `Новое сообщение от @${last.sender}`, last.sender);
                }
                if (LocalStore.get('notifications_badge', true) !== false) {
                    MedianBridge.setBadge(arr.length);
                }
            } else {
                lastToastKey = null;
                if (LocalStore.get('notifications_badge', true) !== false) MedianBridge.setBadge(0);
            }
            if (currentChatType === 'contact') loadChats();
        }).catch(() => {});
    }

    globalUnreadInterval = setInterval(pollGlobalUnread, 15000);

    // =======================================================
    // === ЗАПУСК ===
    // =======================================================
    startPresenceLoop();
    loadChats();
});