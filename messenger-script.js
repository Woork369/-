document.addEventListener('DOMContentLoaded', function() {

    // =======================================================
    // ☀️ НАСТРОЙКИ СЕРВЕРА
    // =======================================================
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

    // =======================================================
    // ГЛОБАЛЬНОЕ СОСТОЯНИЕ
    // =======================================================
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

    const APK_LINK = "app-release.apk";


   // =======================================================
// 🎂 ПРАЗДНИЧНЫЙ ПЕРИОД (8 октября — 13 октября)
// =======================================================
const BIRTHDAY_START = new Date(2026, 9, 8, 0, 0, 0);      // 8 октября 2026, 00:00
const BIRTHDAY_END   = new Date(2026, 9, 13, 23, 59, 59);  // 13 октября 2026, 23:59

    // 🔁 РЕАЛЬНЫЕ ДАТЫ:
    // const BIRTHDAY_START = new Date(2026, 9, 8, 0, 0, 0);
    // const BIRTHDAY_END   = new Date(2026, 9, 13, 23, 59, 59);

    function isBirthdayThemeActive() {
        const now = new Date();
        return now >= BIRTHDAY_START && now <= BIRTHDAY_END;
    }

    // =======================================================
    // ВЕРИФИЦИРОВАННЫЕ ЮЗЕРЫ (всё с маленькой буквы)
    // =======================================================
    const VERIFIED_USERS = ['алексей', 'тестовый', 'поддержка'];
    function isVerifiedUser(name) {
        return !!name && VERIFIED_USERS.includes(name.toLowerCase());
    }

    // =======================================================
    // SVG
    // =======================================================
    const svgVerified = `<svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;margin-left:4px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#248bf2"/></svg>`;
    const svgTickSingle = `<svg viewBox="0 0 24 24" fill="none" style="width:13px;height:13px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#8c9197"/></svg>`;
    const svgTickDouble = `<svg viewBox="0 0 24 24" fill="none" style="width:13px;height:13px;"><path d="M18 7l-1.41-1.41L9 13.17 5.41 9.59 4 11l5 5 9-9zM22 7l-1.41-1.41L13 13.17l-1.59-1.59L10 13l3 3 9-9z" fill="#4bb34b"/></svg>`;
    const svgSettings = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;color:var(--text-muted);"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

    // =======================================================
    // ЭЛЕМЕНТЫ
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
    const postcardBtn          = document.getElementById('postcard-btn');
    const stickersBtn          = document.getElementById('stickers-btn');

    function setVisible(el, visible) {
        if (!el) return;
        if (visible) {
            el.classList.remove('hidden-force');
            el.style.removeProperty('display');
        } else {
            el.classList.add('hidden-force');
        }
    }

    // Кнопка настроек профиля
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

    // Скрытый input для файлов
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

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    // =======================================================
    // 🎂 ПРАЗДНИЧНАЯ ТЕМА (включается на период)
    // =======================================================
    if (isBirthdayThemeActive()) {
        document.body.classList.add('birthday-theme');

        const chatSection = document.querySelector('.chat-section');
        if (chatSection) {
            chatSection.style.backgroundImage = "url('bg-chat-birthday.jpg')";
            chatSection.style.backgroundSize = "cover";
            chatSection.style.backgroundPosition = "center";
            chatSection.style.backgroundRepeat = "no-repeat";
        }

        document.querySelectorAll('.user-avatar, .chat-header-avatar').forEach(av => {
            if (!av.style.backgroundImage) {
                av.style.background = 'linear-gradient(135deg, #ff4d6d, #ffb347)';
            }
        });
    }

    // =======================================================
    // 📱 МОДАЛЬНОЕ ОКНО СКАЧИВАНИЯ ПРИЛОЖЕНИЯ
    // =======================================================
    function openAppDownloadModal() {
        const existing = document.getElementById('app-download-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'app-download-modal';
        modal.className = 'app-download-overlay';
        modal.innerHTML = `
            <div class="app-download-card">
                <div class="app-download-close" id="app-download-close-btn">✕</div>
                <div class="app-download-logo">🌞</div>
                <h2 class="app-download-title">Лето</h2>
                <div class="app-download-verified">
                    <svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;">
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#248bf2"/>
                    </svg>
                    <span>Проверенный создатель: Лето</span>
                </div>
                <p class="app-download-desc">
                    Обновление приложения «Лето»<br>
                    Рекомендуем установить последнюю версию.
                </p>
                <a href="${APK_LINK}" download class="app-download-btn">⬇️ Скачать</a>
                <div class="app-download-note">Файл: app-release.apk</div>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById('app-download-close-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    // =======================================================
    // 🎨 РЕДАКТОР ОТКРЫТОК
    // =======================================================
    const POSTCARD_BACKGROUNDS = [
        { id: 'bg1',  css: 'linear-gradient(135deg, #ff9a9e, #fecfef)' },
        { id: 'bg2',  css: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)' },
        { id: 'bg3',  css: 'linear-gradient(135deg, #ffecd2, #fcb69f)' },
        { id: 'bg4',  css: 'linear-gradient(135deg, #ff6a88, #ff99ac)' },
        { id: 'bg5',  css: 'linear-gradient(135deg, #d4fc79, #96e6a1)' },
        { id: 'bg6',  css: 'linear-gradient(135deg, #fbc2eb, #a6c1ee)' },
        { id: 'bg7',  css: 'linear-gradient(135deg, #fddb92, #d1fdff)' },
        { id: 'bg8',  css: 'linear-gradient(135deg, #ff4d6d, #ffb347)' },
        { id: 'bg9',  css: 'linear-gradient(135deg, #667eea, #764ba2)' },
        { id: 'bg10', css: 'linear-gradient(135deg, #f6d365, #fda085)' },
        { id: 'bg11', css: 'linear-gradient(135deg, #84fab0, #8fd3f4)' },
        { id: 'bg12', css: 'linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb)' },
    ];

    const POSTCARD_STICKERS = ['🎂','🎉','🎁','🎈','🥳','🎊','🍰','🍾','💖','⭐','🌟','✨','🥂','🎵','🎶','🌈','💐','🧁','🍭','🎀','💝','🕯️','🎯','🏆'];

    let postcardState = {
        bg: POSTCARD_BACKGROUNDS[0].css,
        elements: [],
        selectedId: null
    };

    function openPostcardEditor() {
        if (!activeChatTarget) { alert('Сначала открой чат!'); return; }

        postcardState = {
            bg: POSTCARD_BACKGROUNDS[0].css,
            elements: [],
            selectedId: null
        };

        const existing = document.getElementById('postcard-editor');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'postcard-editor';
        overlay.className = 'postcard-overlay';
        overlay.innerHTML = `
            <div class="postcard-app">
                <header class="postcard-header">
                    <button class="pc-back-btn" id="pc-back-btn">← Назад</button>
                    <h1>🎂 Открытка</h1>
                    <button class="pc-download-btn" id="pc-download-btn" title="Скачать">⬇️</button>
                </header>

                <div class="postcard-workspace">
                    <div class="postcard-canvas" id="postcard-canvas">
                        <div class="pc-text-layer" id="pc-text-layer"></div>
                        <div class="pc-stickers-layer" id="pc-stickers-layer"></div>
                    </div>
                </div>

                <div class="postcard-toolbar">
                    <div class="pc-tabs">
                        <button class="pc-tab active" data-tab="bg">🎨 Фон</button>
                        <button class="pc-tab" data-tab="text">✏️ Текст</button>
                        <button class="pc-tab" data-tab="stickers">😀 Стикеры</button>
                    </div>

                    <div class="pc-tab-content active" data-content="bg">
                        <div class="pc-bg-grid" id="pc-bg-grid"></div>
                    </div>

                    <div class="pc-tab-content" data-content="text">
                        <input type="text" id="pc-text-input" class="pc-text-input" placeholder="Напиши поздравление..." maxlength="80">
                        <div class="pc-text-controls">
                            <label>Цвет:
                                <input type="color" id="pc-text-color" value="#ffffff">
                            </label>
                            <label>Размер:
                                <input type="range" id="pc-text-size" min="14" max="48" value="28">
                            </label>
                        </div>
                        <button class="pc-add-text-btn" id="pc-add-text-btn">➕ Добавить текст</button>
                    </div>

                    <div class="pc-tab-content" data-content="stickers">
                        <div class="pc-stickers-grid" id="pc-stickers-grid"></div>
                    </div>
                </div>

                <div class="postcard-footer">
                    <button class="pc-send-btn" id="pc-send-btn">📤 Отправить в чат</button>
                </div>
            </div>

            <canvas id="pc-export-canvas" style="display:none;"></canvas>
        `;

        document.body.appendChild(overlay);

        const bgGrid = document.getElementById('pc-bg-grid');
        POSTCARD_BACKGROUNDS.forEach((bg, i) => {
            const el = document.createElement('div');
            el.className = 'pc-bg-item' + (i === 0 ? ' active' : '');
            el.style.background = bg.css;
            el.addEventListener('click', () => {
                postcardState.bg = bg.css;
                document.getElementById('postcard-canvas').style.background = bg.css;
                document.querySelectorAll('.pc-bg-item').forEach(x => x.classList.remove('active'));
                el.classList.add('active');
            });
            bgGrid.appendChild(el);
        });

        const stickersGrid = document.getElementById('pc-stickers-grid');
        POSTCARD_STICKERS.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'pc-sticker-choice';
            btn.textContent = emoji;
            btn.addEventListener('click', () => addPostcardSticker(emoji));
            stickersGrid.appendChild(btn);
        });

        document.querySelectorAll('.pc-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.pc-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.pc-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.querySelector(`.pc-tab-content[data-content="${tab.dataset.tab}"]`).classList.add('active');
            });
        });

        document.getElementById('pc-add-text-btn').addEventListener('click', () => {
            const input = document.getElementById('pc-text-input');
            const text = input.value.trim();
            if (!text) { input.focus(); return; }

            const color = document.getElementById('pc-text-color').value;
            const size = document.getElementById('pc-text-size').value;

            addPostcardText(text, color, size);
            input.value = '';
        });

        document.getElementById('pc-back-btn').addEventListener('click', () => overlay.remove());

        document.getElementById('pc-download-btn').addEventListener('click', () => {
            exportPostcardToBlob().then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'открытка_' + Date.now() + '.png';
                a.click();
                URL.revokeObjectURL(url);
            });
        });

        document.getElementById('pc-send-btn').addEventListener('click', () => {
            const btn = document.getElementById('pc-send-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Отправка...';

            exportPostcardToBlob().then(blob => {
                const fileName = 'postcard_' + Date.now() + '.png';

                return fetch(MY_SUPABASE_URL + '/storage/v1/object/media/' + fileName, {
                    method: 'POST',
                    headers: {
                        'apikey': MY_SERVER_KEY,
                        'Authorization': 'Bearer ' + MY_SERVER_KEY,
                        'Content-Type': 'image/png'
                    },
                    body: blob
                }).then(() => {
                    const fullUrl = MY_SUPABASE_URL + '/storage/v1/object/public/media/' + fileName;
                    return fetch(SUPABASE_MSG_URL, {
                        method: 'POST', headers: HEADERS,
                        body: JSON.stringify({
                            sender: currentActiveUser,
                            receiver: activeChatTarget,
                            text: fullUrl,
                            type: 'image',
                            chat_type: currentChatType,
                            is_read: false,
                            created_at: new Date().toISOString()
                        })
                    });
                });
            }).then(() => {
                btn.textContent = '✅ Отправлено!';
                setTimeout(() => {
                    overlay.remove();
                    lastMessagesCount = -1;
                    loadMessages();
                }, 800);
            }).catch(() => {
                btn.disabled = false;
                btn.textContent = '📤 Отправить в чат';
                alert('Ошибка отправки');
            });
        });
    }

    function addPostcardSticker(emoji) {
        const layer = document.getElementById('pc-stickers-layer');
        const el = document.createElement('div');
        el.className = 'pc-sticker-item';
        el.textContent = emoji;
        el.style.left = '40%';
        el.style.top = '40%';
        el.style.fontSize = '48px';
        layer.appendChild(el);
        makeDraggable(el);
    }

    function addPostcardText(text, color, size) {
        const layer = document.getElementById('pc-text-layer');
        const el = document.createElement('div');
        el.className = 'pc-text-item';
        el.textContent = text;
        el.style.left = '10%';
        el.style.top = '40%';
        el.style.width = '80%';
        el.style.color = color;
        el.style.fontSize = size + 'px';
        layer.appendChild(el);
        makeDraggable(el);
    }

    function makeDraggable(el) {
        let dragging = false;
        let offsetX = 0, offsetY = 0;

        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            dragging = true;
            const rect = el.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            el.setPointerCapture(e.pointerId);
        });

        el.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const canvas = document.getElementById('postcard-canvas');
            const canvasRect = canvas.getBoundingClientRect();
            let x = e.clientX - canvasRect.left - offsetX;
            let y = e.clientY - canvasRect.top - offsetY;

            x = Math.max(0, Math.min(x, canvasRect.width - el.offsetWidth));
            y = Math.max(0, Math.min(y, canvasRect.height - el.offsetHeight));

            el.style.left = x + 'px';
            el.style.top = y + 'px';
        });

        el.addEventListener('pointerup', (e) => {
            dragging = false;
            el.releasePointerCapture(e.pointerId);
        });
    }

    function exportPostcardToBlob() {
        const canvas = document.getElementById('postcard-canvas');
        const rect = canvas.getBoundingClientRect();
        const exportCanvas = document.getElementById('pc-export-canvas');
        const width = rect.width * 2;
        const height = rect.height * 2;

        exportCanvas.width = width;
        exportCanvas.height = height;
        const ctx = exportCanvas.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, width, height);
        const colors = postcardState.bg.match(/#[0-9a-fA-F]{3,8}/g) || ['#ff9a9e', '#fecfef'];
        colors.forEach((c, i) => grad.addColorStop(i / Math.max(1, colors.length - 1), c));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        document.querySelectorAll('#pc-text-layer .pc-text-item').forEach(el => {
            const r = el.getBoundingClientRect();
            const x = (r.left - rect.left) * 2;
            const y = (r.top - rect.top) * 2;
            const w = r.width * 2;
            const h = r.height * 2;

            const fontSize = parseFloat(getComputedStyle(el).fontSize) * 2;
            const color = getComputedStyle(el).color;

            ctx.font = `800 ${fontSize}px -apple-system, sans-serif`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;

            const words = el.textContent.split(' ');
            const lines = [];
            let current = '';
            for (const word of words) {
                const test = current ? current + ' ' + word : word;
                if (ctx.measureText(test).width > w && current) {
                    lines.push(current);
                    current = word;
                } else {
                    current = test;
                }
            }
            if (current) lines.push(current);

            const lineHeight = fontSize * 1.25;
            const totalHeight = lines.length * lineHeight;
            const startY = y + h / 2 - totalHeight / 2 + lineHeight / 2;

            lines.forEach((line, i) => {
                ctx.fillText(line, x + w / 2, startY + i * lineHeight);
            });

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
        });

        document.querySelectorAll('#pc-stickers-layer .pc-sticker-item').forEach(el => {
            const r = el.getBoundingClientRect();
            const x = (r.left - rect.left) * 2;
            const y = (r.top - rect.top) * 2;
            const fontSize = parseFloat(getComputedStyle(el).fontSize) * 2;

            ctx.font = `${fontSize}px -apple-system, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(el.textContent, x, y);
        });

        return new Promise(resolve => {
            exportCanvas.toBlob(blob => resolve(blob), 'image/png', 0.95);
        });
    }

    if (postcardBtn) {
        postcardBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openPostcardEditor();
        });
    }

    // =======================================================
    // 🎁 СТИКЕРЫ (картинки, кодируем URL для Supabase)
    // =======================================================
    const GIFT_STICKERS = [
        { id: 'cake',      name: 'Торт',         emoji: '🎂' },
        { id: 'gift',      name: 'Подарок',      emoji: '🎁' },
        { id: 'balloon',   name: 'Шарик',        emoji: '🎈' },
        { id: 'confetti',  name: 'Хлопушка',     emoji: '🎉' },
        { id: 'heart',     name: 'Сердце',       emoji: '❤️' },
        { id: 'star',      name: 'Звезда',       emoji: '🌟' },
        { id: 'rose',      name: 'Роза',         emoji: '🌹' },
        { id: 'teddy',     name: 'Мишка',        emoji: '🧸' },
        { id: 'champagne', name: 'Шампанское',   emoji: '🍾' },
        { id: 'candy',     name: 'Конфета',      emoji: '🍬' },
        { id: 'chocolate', name: 'Шоколад',      emoji: '🍫' },
        { id: 'crown',     name: 'Корона',       emoji: '👑' },
    ];

    function openStickersPicker() {
        if (!activeChatTarget) { alert('Сначала открой чат!'); return; }

        const existing = document.getElementById('stickers-picker-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'stickers-picker-modal';
        modal.className = 'app-download-overlay';
        modal.innerHTML = `
            <div class="app-download-card" style="max-width: 420px;">
                <div class="app-download-close" id="stickers-picker-close">✕</div>
                <div class="app-download-logo">🎁</div>
                <h2 class="app-download-title">Стикеры</h2>
                <p class="app-download-desc">Выбери стикер и отправь в чат</p>
                <div class="stickers-picker-grid">
                    ${GIFT_STICKERS.map(g => `
                        <button class="sticker-picker-item" data-id="${g.id}" data-name="${g.name}" data-emoji="${g.emoji}">
                            <span class="sticker-picker-emoji">${g.emoji}</span>
                            <span class="sticker-picker-name">${g.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById('stickers-picker-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        document.querySelectorAll('.sticker-picker-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                const emoji = btn.dataset.emoji;
                sendSticker(id, emoji, name);
                modal.remove();
            });
        });
    }

    function sendSticker(id, emoji, name) {
        // Формат: /sticker:ID:EMOJI:NAME (всё короткое, без URL)
        const text = `/sticker:${id}:${emoji}:${name}`;

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
            lastMessagesCount = -1;
            loadMessages();
        }).catch((e) => {
            console.error('Ошибка отправки стикера:', e);
            alert('Ошибка отправки стикера');
        });
    }

    function renderStickerBubble(text) {
        // Формат: /sticker:ID:EMOJI:NAME
        const parts = text.split(':');
        if (parts.length < 4) return null;

        const id = parts[1];
        const emoji = parts[2];
        const name = parts[3] || '';

        // Ищем стикер в списке
        const sticker = GIFT_STICKERS.find(s => s.id === id);
        const displayEmoji = sticker ? sticker.emoji : emoji;

        return `
            <div class="sticker-bubble">
                <div class="sticker-bubble-emoji">${displayEmoji}</div>
                <div class="sticker-bubble-name">${name}</div>
            </div>
        `;
    }

    if (stickersBtn) {
        stickersBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openStickersPicker();
        });
    }

    // =======================================================
    // ФОРМАТ ДАТЫ
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

    // =======================================================
    // TOAST
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
    // PRESENCE
    // =======================================================
    function startPresenceLoop() {
        updateMyPresence();
        if (presenceInterval) clearInterval(presenceInterval);
        presenceInterval = setInterval(updateMyPresence, 30000);
    }

    function updateMyPresence() {
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
        })
        .catch(() => {});
    }

    function setMyStatus(newStatus) {
        fetch(SUPABASE_PROFILES_URL + "?username=eq." + encodeURIComponent(currentActiveUser), {
            method: "PATCH", headers: HEADERS,
            body: JSON.stringify({ status: newStatus })
        }).catch(() => {});
    }

    // =======================================================
    // СПИСОК ЧАТОВ
    // =======================================================
    function loadChats() {
        if (!chatsListTarget) return;
        const url = currentChatType === 'contact'
            ? SUPABASE_MSG_URL + "?chat_type=eq.contact&or=(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + ")&order=created_at.desc"
            : SUPABASE_ROOMS_URL + "?type=eq." + currentChatType + "&order=created_at.desc";

        fetch(url, { method: "GET", headers: HEADERS_GET })
        .then(res => res.json())
        .then(data => {
            chatsListTarget.innerHTML = "";
            if (!data || data.length === 0) {
                chatsListTarget.innerHTML = '<div class="status-message">Пусто</div>';
                return;
            }

            if (currentChatType === 'contact') {
                const byUser = {};
                data.forEach(msg => {
                    const other = msg.sender === currentActiveUser ? msg.receiver : msg.sender;
                    if (!byUser[other]) byUser[other] = { lastMsg: msg, unread: 0, lastDate: new Date(msg.created_at) };
                    const d = new Date(msg.created_at);
                    if (d > byUser[other].lastDate) { byUser[other].lastDate = d; byUser[other].lastMsg = msg; }
                    if (msg.receiver === currentActiveUser && msg.is_read === false) byUser[other].unread++;
                });
                const sorted = Object.entries(byUser).sort((a,b) => b[1].lastDate - a[1].lastDate);
                sorted.forEach(([name, info]) => {
                    const preview = (info.lastMsg.type === 'text') ? info.lastMsg.text : '📎 Вложение';
                    renderChatCard(name, preview, "", "", info.unread, false);
                });
            } else {
                data.forEach(room => {
                    const unread = unreadByChat[room.name] || 0;
                    const isVerified = room.verified === true;
                    renderChatCard(room.name, room.description || "Нет описания", room.avatar_url, room.creator, unread, isVerified);
                });
            }
        }).catch(() => {
            chatsListTarget.innerHTML = '<div class="status-message">Ошибка загрузки</div>';
        });
    }

    function renderChatCard(name, subtitle, avatarUrl, creatorName, unreadCount, isVerifiedRoom) {
        const card = document.createElement('div');
        card.className = 'chat-card' + (activeChatTarget === name ? ' active' : '');
        let avatarStyle = avatarUrl ? `background-image: url('${avatarUrl}'); background-size: cover; background-position: center;` : '';
        const isVerUser = isVerifiedUser(name);
        const verRoom = isVerifiedRoom ? svgVerified : '';
        const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';

        card.innerHTML = `
            <div class="user-avatar small" style="${avatarStyle}"></div>
            <div class="chat-card-body">
                <span class="user-display-name">${name}${isVerUser ? svgVerified : verRoom}</span>
                <span class="chat-preview">${subtitle || ''}</span>
            </div>
            ${unreadBadge}
        `;
        card.addEventListener('click', function() {
            activeChatTarget = name;
            activeChatCreator = creatorName;
            openChatWorkspace(name);
        });
        chatsListTarget.appendChild(card);
    }

    // =======================================================
    // ОТКРЫТИЕ ЧАТА
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

        if (mainMessageField) {
            mainMessageField.style.display = 'block';
            mainMessageField.disabled = true;
            mainMessageField.value = "";
            mainMessageField.placeholder = "🔒 Вы не участник группы";
        }
        setVisible(sendBtn, false);
        setVisible(clipBtn, false);
        setVisible(micBtn, false);
        setVisible(postcardBtn, false);
        setVisible(stickersBtn, false);

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

        if (currentChatType === 'contact') {
            const headerAvatarEl = document.querySelector('.chat-header-avatar');
            if (headerAvatarEl) {
                headerAvatarEl.style.backgroundImage = 'none';
                headerAvatarEl.style.backgroundColor = '#ccc';
            }
            mainMessageField.style.display = '';
            mainMessageField.disabled = false;
            mainMessageField.placeholder = "Напишите сообщение...";
            setVisible(sendBtn, true);
            setVisible(clipBtn, true);
            setVisible(micBtn, true);
            setVisible(postcardBtn, true);
            setVisible(stickersBtn, true);

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

            const headerAvatarEl = document.querySelector('.chat-header-avatar');
            if (headerAvatarEl) {
                if (room.avatar_url) {
                    headerAvatarEl.style.backgroundImage = `url('${room.avatar_url}')`;
                    headerAvatarEl.style.backgroundSize = 'cover';
                    headerAvatarEl.style.backgroundPosition = 'center';
                } else {
                    headerAvatarEl.style.backgroundImage = 'none';
                    headerAvatarEl.style.backgroundColor = '#ccc';
                }
            }

            let canWrite = false;
            if (isChannel) {
                canWrite = isOwnerLocal;
            } else {
                canWrite = isMember || isOwnerLocal;
            }

            if (canWrite) {
                mainMessageField.style.display = '';
                mainMessageField.disabled = false;
                mainMessageField.placeholder = "Напишите сообщение...";
                setVisible(sendBtn, true);
                setVisible(clipBtn, true);
                setVisible(micBtn, true);
                setVisible(postcardBtn, true);
                setVisible(stickersBtn, true);
            } else {
                mainMessageField.style.display = 'block';
                mainMessageField.disabled = true;
                mainMessageField.value = "";
                if (isChannel) {
                    mainMessageField.placeholder = "🔒 Только администраторы могут писать сюда";
                } else {
                    mainMessageField.placeholder = "🔒 Вы не участник группы";
                }
                setVisible(sendBtn, false);
                setVisible(clipBtn, false);
                setVisible(micBtn, false);
                setVisible(postcardBtn, false);
                setVisible(stickersBtn, false);
            }

            if (isChannel) {
                markChatAsRead(chatName);
            } else if (isMember || isOwnerLocal) {
                markChatAsRead(chatName);
            }

            if (statusTextEl) statusTextEl.style.display = 'none';

            loadMessages();
            clearInterval(refreshInterval);
            refreshInterval = setInterval(() => { loadMessages(); }, 3000);
        }).catch(() => {});
    }

    // =======================================================
    // СТАТУС КОНТАКТА
    // =======================================================
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

    // =======================================================
    // ПРОЧИТАНО
    // =======================================================
    function markChatAsRead(chatName) {
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
    // СООБЩЕНИЯ
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
                    if (document.hidden && window.Notification && Notification.permission === "granted") {
                        new Notification("Лето Messenger", { body: "@" + lm.sender + ": " + (lm.type === 'text' ? lm.text : '📎 Файл'), tag: "leto" });
                    }
                }
            }
            if (messages.length === lastMessagesCount) return;
            lastMessagesCount = messages.length;

            const isUserAtBottom = (messagesScreen.scrollHeight - messagesScreen.scrollTop - messagesScreen.clientHeight) < 90;
            messagesScreen.innerHTML = "";
            let lastRenderedDateStr = "";

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
                let hash = 0;
                for (let i = 0; i < msg.sender.length; i++) hash = msg.sender.charCodeAt(i) + ((hash << 5) - hash);
                av.style.background = `linear-gradient(135deg, hsl(${hash % 360},65%,75%), hsl(${(hash+60)%360},70%,60%))`;
                msgRow.appendChild(av);

                const bubble = document.createElement('div');
                bubble.className = 'msg-bubble';

                let senderTag = '';
                if (currentChatType !== 'contact' && !isMy) {
                    const senderVer = isVerifiedUser(msg.sender) ? svgVerified : '';
                    senderTag = `<strong class="msg-sender-tag">${msg.sender}${senderVer}:</strong>`;
                }

                let timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
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
                } else if (msg.text && msg.text.startsWith('/sticker:')) {
                    contentHTML = (renderStickerBubble(msg.text) || '') + metaHTML;
                } else {
                    contentHTML = `<div><span>${msg.text}</span>${metaHTML}</div>`;
                }

                bubble.innerHTML = senderTag + contentHTML;
                setupContextEvents(bubble, msg, isMy);
                msgRow.appendChild(bubble);
                messagesScreen.appendChild(msgRow);
            });

            if (isUserAtBottom || messagesScreen.children.length <= 1) messagesScreen.scrollTop = messagesScreen.scrollHeight;
        });
    }

    // =======================================================
    // ФАЙЛЫ
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
            method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": file.type }, body: file
        }).then(() => {
            const fullUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
            return fetch(SUPABASE_MSG_URL, {
                method: "POST", headers: HEADERS,
                body: JSON.stringify({
                    sender: currentActiveUser, receiver: activeChatTarget, text: fullUrl,
                    type: file.type.startsWith('image/') ? "image" : "file",
                    chat_type: currentChatType, is_read: false, created_at: new Date().toISOString()
                })
            });
        }).then(() => { lastMessagesCount = -1; loadMessages(); });
    });

    // =======================================================
    // ГОЛОС
    // =======================================================
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
                            method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "audio/webm" }, body: audioBlob
                        }).then(() => {
                            return fetch(SUPABASE_MSG_URL, {
                                method: "POST", headers: HEADERS,
                                body: JSON.stringify({
                                    sender: currentActiveUser, receiver: activeChatTarget,
                                    text: MY_SUPABASE_URL + "/storage/v1/object/public/media/" + audioName,
                                    type: "voice", chat_type: currentChatType, is_read: false, created_at: new Date().toISOString()
                                })
                            });
                        }).then(() => { lastMessagesCount = -1; loadMessages(); });
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
    // КОНТЕКСТНОЕ МЕНЮ
    // =======================================================
    function setupContextEvents(element, msg, isMy) {
        const iAmCreator = (currentChatType !== 'contact' && activeChatCreator === currentActiveUser);
        if (!isMy && !iAmCreator) return;
        element.addEventListener('contextmenu', e => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, msg, isMy); });
        element.addEventListener('touchstart', e => {
            touchTimer = setTimeout(() => { openContextMenu(e.touches[0].clientX, e.touches[0].clientY, msg, isMy); }, 600);
        }, {passive: true});
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
    // СОЗДАНИЕ КОМНАТ
    // =======================================================
    const createRoomModal     = document.getElementById('create-room-modal');
    const modalAvatarPreview  = document.getElementById('modal-room-avatar-preview');
    const modalAvatarInput    = document.getElementById('modal-room-avatar-input');
    const modalAvatarBtn      = document.getElementById('modal-room-avatar-btn');

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
                }
            })
            .catch(() => {
                alert('Не удалось загрузить аватар');
                if (modalAvatarPreview) { modalAvatarPreview.textContent = '📷'; modalAvatarPreview.style.backgroundImage = 'none'; }
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
                    body: JSON.stringify({ sender: currentActiveUser, receiver: targetUsername.trim().toLowerCase(), text: "👋 Диалог начат.", type: "text", chat_type: "contact", is_read: false, created_at: new Date().toISOString() })
                }).then(() => { loadChats(); });
            } else {
                const modalTitleEl = document.getElementById('create-room-modal-title');
                if (modalTitleEl) modalTitleEl.textContent = currentChatType === 'group' ? "Создание группы" : "Создание канала";
                pendingRoomAvatarUrl = null;
                if (modalAvatarPreview) { modalAvatarPreview.textContent = '📷'; modalAvatarPreview.style.backgroundImage = 'none'; }
                if (modalAvatarInput) modalAvatarInput.value = '';
                if (createRoomModal) createRoomModal.style.display = 'flex';
            }
        });
    }

    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => {
        if (createRoomModal) createRoomModal.style.display = 'none';
        pendingRoomAvatarUrl = null;
        if (modalAvatarPreview) { modalAvatarPreview.textContent = '📷'; modalAvatarPreview.style.backgroundImage = 'none'; }
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
                if (modalAvatarPreview) { modalAvatarPreview.textContent = '📷'; modalAvatarPreview.style.backgroundImage = 'none'; }
                loadChats();
                openChatWorkspace(rName);
            }).catch(() => alert('Не удалось создать комнату'));
        });
    }

    // =======================================================
    // НАСТРОЙКИ КОМНАТ — АВА
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

            if (settingsAvatarPreview) { settingsAvatarPreview.textContent = '⏳'; settingsAvatarPreview.style.backgroundImage = 'none'; }

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
                }
                const headerAvatarEl = document.querySelector('.chat-header-avatar');
                if (headerAvatarEl) {
                    headerAvatarEl.style.backgroundImage = `url('${newUrl}')`;
                    headerAvatarEl.style.backgroundSize = 'cover';
                    headerAvatarEl.style.backgroundPosition = 'center';
                }
                loadChats();
            })
            .catch(() => {
                alert('Не удалось обновить аватар');
                if (settingsAvatarPreview) { settingsAvatarPreview.textContent = '📷'; settingsAvatarPreview.style.backgroundImage = 'none'; }
            });
        });
    }

    // =======================================================
    // НАСТРОЙКИ КОМНАТ
    // =======================================================
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
                        body: JSON.stringify({ sender: currentActiveUser, receiver: activeChatTarget, text: "/add_member:" + user, type: "text", chat_type: currentChatType, is_read: false, created_at: new Date().toISOString() })
                    });
                }).then(() => {
                    alert("Добавлен!");
                    if (addMemberUserEl) addMemberUserEl.value = "";
                });
            });
        });
    }

    // =======================================================
    // ОТПРАВКА
    // =======================================================
    function handleSendMessage() {
        if (!mainMessageField) return;
        const text = mainMessageField.value.trim();
        if (!text || !activeChatTarget) return;
        if (mainMessageField.disabled) return;
        fetch(SUPABASE_MSG_URL, {
            method: "POST", headers: HEADERS,
            body: JSON.stringify({
                sender: currentActiveUser, receiver: activeChatTarget, text: text,
                type: "text", chat_type: currentChatType, is_read: false, created_at: new Date().toISOString()
            })
        }).then(() => {
            mainMessageField.value = "";
            lastMessagesCount = -1;
            loadMessages();
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
    // ТАБЫ
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
    // ГЛОБАЛЬНЫЙ ОПРОС
    // =======================================================
    function pollGlobalUnread() {
        if (currentChatType !== 'contact') return;
        fetch(SUPABASE_MSG_URL + "?chat_type=eq.contact&receiver=eq." + encodeURIComponent(currentActiveUser) + "&is_read=eq.false", { method: "GET", headers: HEADERS_GET })
        .then(res => res.json())
        .then(msgs => {
            const arr = msgs || [];
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
                        : `New message from @${last.sender}`, last.sender);
                }
            } else {
                lastToastKey = null;
            }
            if (currentChatType === 'contact') loadChats();
        }).catch(() => {});
    }

    globalUnreadInterval = setInterval(pollGlobalUnread, 15000);

    // =======================================================
    // ЗАПУСК
    // =======================================================
    startPresenceLoop();
    loadChats();

});