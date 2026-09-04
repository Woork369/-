document.addEventListener('DOMContentLoaded', function() {

    // =======================================================
    // ☀️ НАСТРОЙКИ СЕРВЕРА
    // =======================================================
    const MY_SUPABASE_URL = "https://rvmtghettsndnnhdeasx.supabase.co"; 
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 

    const SUPABASE_MSG_URL   = MY_SUPABASE_URL + "/rest/v1/messages";
    const SUPABASE_ROOMS_URL = MY_SUPABASE_URL + "/rest/v1/rooms";

    // ГЛОБАЛЬНОЕ СОСТОЯНИЕ (ПОЛНЫЙ МОНОЛИТНЫЙ ФИКС)
    let currentChatType = 'contact';
    let activeChatTarget = null;
    let refreshInterval = null;
    let activeChatCreator = null; 
    let lastMessagesCount = 0; 
    let opponentLastActiveTime = new Date(0);
    let selectedMsgData = null; 
    let touchTimer = null; 

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // Читаем пользователя
    const currentActiveUser = localStorage.getItem('leto_active_user');
    if (!currentActiveUser) { window.location.href = "index.html"; return; }

    // Премиальная векторная SVG-графика Telegram
    const svgVerified = `<svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;margin-left:4px;display:inline-block;vertical-align:middle;"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#248bf2"/></svg>`;
    const svgTickSingle = `<svg viewBox="0 0 24 24" fill="none" style="width:13px;height:13px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#8c9197"/></svg>`;
    const svgTickDouble = `<svg viewBox="0 0 24 24" fill="none" style="width:13px;height:13px;"><path d="M18 7l-1.41-1.41L9 13.17 5.41 9.59 4 11l5 5 9-9zM22 7l-1.41-1.41L13 13.17l-1.59-1.59L10 13l3 3 9-9z" fill="#4bb34b"/></svg>`;
    const svgSettings = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;color:var(--text-muted);"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

    // Элементы интерфейса
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

    // Кнопка глобальных настроек рядом с профилем
    if (userBarInfoEl) {
        const globalSettingsBtn = document.createElement('button');
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
        
        // Вставляем кнопку после информации о пользователе в user-bar
        const userBar = document.querySelector('.user-bar');
        if (userBar) {
            userBar.appendChild(globalSettingsBtn);
        }
    }

    // Скрытый инпут для отправки файлов
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
        activeUsernameEl.innerHTML = currentActiveUser + (currentActiveUser.toLowerCase() === 'алексей' ? svgVerified : '');
    }

    if ("Notification" in window && Notification.permission === "default") { Notification.requestPermission(); }

    // --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯФОРМАТИРОВАНИЯ ДАТЫ ПЛАШЕК ---
    function formatStickyDate(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        
        if (targetDate.getTime() === today.getTime()) {
            return "Сегодня";
        } else if (targetDate.getTime() === yesterday.getTime()) {
            return "Вчера";
        } else {
            const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
            return `${d.getDate()} ${months[d.getMonth()]}`;
        }
    }

    // --- ЗАГРУЗКА СПИСКА ЧАТОВ ---
    function loadChats() {
        if (!chatsListTarget) return;
        const url = currentChatType === 'contact' 
            ? SUPABASE_MSG_URL + "?chat_type=eq.contact&or=(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + ")"
            : SUPABASE_ROOMS_URL + "?type=eq." + currentChatType + "&order=created_at.desc";
            
        fetch(url, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(data => {
            chatsListTarget.innerHTML = "";
            if (!data || data.length === 0) { chatsListTarget.innerHTML = '<div class="status-message">Пусто</div>'; return; }
            if (currentChatType === 'contact') {
                const unique = new Set();
                data.forEach(msg => unique.add(msg.sender === currentActiveUser ? msg.receiver : msg.sender));
                unique.forEach(name => renderChatCard(name, "Личный диалог", "", ""));
            } else {
                data.forEach(room => renderChatCard(room.name, room.description || "Нет описания", room.avatar_url, room.creator));
            }
        }).catch(() => { chatsListTarget.innerHTML = '<div class="status-message">Пусто</div>'; });
    }

    function renderChatCard(name, subtitle, avatarUrl, creatorName) {
        const card = document.createElement('div');
        card.className = 'chat-card' + (activeChatTarget === name ? ' active' : '');
        let avatarStyle = avatarUrl ? `background-image: url('${avatarUrl}'); background-size: cover;` : '';
        const isVer = (name.toLowerCase() === 'алексей');

        card.innerHTML = `
            <div class="user-avatar small" style="${avatarStyle}"></div>
            <div style="display: flex; flex-direction: column; flex:1; min-width:0;">
                <span class="user-display-name">${name}${isVer ? svgVerified : ''}</span>
                <span style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${subtitle}</span>
            </div>
        `;
        card.addEventListener('click', function() { activeChatCreator = creatorName; openChatWorkspace(name); });
        chatsListTarget.appendChild(card);
    }

    // --- ОТКРЫТИЕ ОКНА ПЕРЕПИСКИ И ТГ-ПРИВАТНОСТЬ ---
    function openChatWorkspace(chatName) {
        activeChatTarget = chatName;
        clearInterval(refreshInterval);
        if (settingsPanel) settingsPanel.style.display = 'none';

        if (currentChatType === 'contact' || currentChatType === 'channel' || chatName.toLowerCase() === 'лето' || activeChatCreator === currentActiveUser) {
            proceedOpeningWorkspace(chatName);
            return;
        }

        const checkUrl = SUPABASE_MSG_URL + "?chat_type=eq." + currentChatType + "&receiver=eq." + encodeURIComponent(chatName) + "&order=created_at.asc";
        fetch(checkUrl, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(messages => {
            const expectedCommand = "/add_member:" + currentActiveUser.toLowerCase();
            const hasAccess = messages && Array.isArray(messages) && messages.some(msg => 
                (msg.sender === activeChatCreator && msg.text && msg.text.trim().toLowerCase() === expectedCommand) || (msg.sender === currentActiveUser)
            );

            if (!hasAccess) {
                if (fallbackNotice) { fallbackNotice.textContent = "🔒 Вы не являетесь участником группы. Доступ запрещен."; fallbackNotice.style.display = 'block'; }
                chatHeader.style.display = 'none'; inputZone.style.display = 'none'; messagesScreen.innerHTML = "";
                return;
            }
            proceedOpeningWorkspace(chatName);
        }).catch(() => proceedOpeningWorkspace(chatName));
    }

    function proceedOpeningWorkspace(chatName) {
        if (fallbackNotice) fallbackNotice.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'flex';
        if (inputZone) inputZone.style.display = 'block';
        if (messagesScreen) messagesScreen.style.display = 'flex';
        
        const isVer = (chatName.toLowerCase() === 'алексей');
        if (targetChatNameEl) targetChatNameEl.innerHTML = chatName + (isVer ? svgVerified : '');
        if (appContainer) appContainer.classList.add('show-chat');

        if (currentChatType !== 'contact' && activeChatCreator === currentActiveUser) {
            if (roomSettingsBtn) roomSettingsBtn.style.display = 'flex';
        } else {
            if (roomSettingsBtn) roomSettingsBtn.style.display = 'none';
        }

        // Блокировка ввода подписчикам на чужих каналах
        const clipBtn = document.querySelector('.input-container-row .icon-btn:first-child');
        const micBtn = document.querySelector('.input-container-row .icon-btn:nth-child(3)');

        if (currentChatType === 'channel' && activeChatCreator && activeChatCreator !== currentActiveUser) {
            mainMessageField.disabled = true;
            mainMessageField.placeholder = "🔒 Только администраторы могут писать сюда";
            if (sendBtn) sendBtn.style.display = 'none';
            if (clipBtn) clipBtn.style.display = 'none';
            if (micBtn) micBtn.style.display = 'none';
        } else {
            mainMessageField.disabled = false;
            mainMessageField.placeholder = "Напишите сообщение...";
            if (sendBtn) sendBtn.style.display = 'block';
            if (clipBtn) clipBtn.style.display = 'flex';
            if (micBtn) micBtn.style.display = 'flex';
        }

        // Вывод статуса активности (Онлайн)
        if (currentChatType === 'contact' && statusTextEl) {
            statusTextEl.style.display = 'block';
            statusTextEl.textContent = 'загрузка статуса...';
            fetch(SUPABASE_MSG_URL + "?sender=eq." + encodeURIComponent(chatName) + "&order=created_at.desc&limit=1", {
                method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
            }).then(res => res.json()).then(lastMsg => {
                if (!lastMsg || lastMsg.length === 0) { statusTextEl.textContent = 'была недавно'; return; }
                
                let rawDate = new Date(lastMsg[0].created_at);
                if (isNaN(rawDate.getTime())) {
                    statusTextEl.textContent = 'была недавно';
                } else {
                    opponentLastActiveTime = rawDate;
                    const diffMins = Math.floor((new Date() - opponentLastActiveTime) / 1000 / 60);
                    if (diffMins < 5) { statusTextEl.textContent = '• в сети'; statusTextEl.classList.add('online'); }
                    else if (diffMins < 60) { statusTextEl.textContent = 'была недавно'; statusTextEl.classList.remove('online'); }
                    else { statusTextEl.textContent = 'был(а) в сети в ' + opponentLastActiveTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); statusTextEl.classList.remove('online'); }
                }
                lastMessagesCount = 0; loadMessages();
            }).catch(() => { statusTextEl.textContent = 'была недавно'; lastMessagesCount = 0; loadMessages(); });
        } else {
            if (statusTextEl) statusTextEl.style.display = 'none';
            lastMessagesCount = 0;
            loadMessages();
        }

        clearInterval(refreshInterval);
        refreshInterval = setInterval(loadMessages, 3000);
    }

    // --- ГЛАВНЫЙ СБОРЩИК И ВЫВОД СООБЩЕНИЙ В ЛЕНТУ ---
    function loadMessages() {
        if (!activeChatTarget || !messagesScreen || (settingsPanel && settingsPanel.style.display === 'flex')) return;
        
        let url = SUPABASE_MSG_URL + "?chat_type=eq." + currentChatType + "&order=created_at.asc";
        if (currentChatType === 'contact') {
            url += "&or=(and(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(activeChatTarget) + "),and(sender.eq." + encodeURIComponent(activeChatTarget) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + "))";
        } else {
            url += "&receiver=eq." + encodeURIComponent(activeChatTarget);
        }

        fetch(url, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(messages => {
            if (!messages || !Array.isArray(messages)) return;
            
            // Фоновые Пуши
            if (messages.length > lastMessagesCount && lastMessagesCount > 0) {
                const lm = messages[messages.length - 1];
                if (lm.sender !== currentActiveUser && document.hidden && window.Notification && Notification.permission === "granted") {
                    new Notification("Лето Мессенджер", { body: "@" + lm.sender + ": " + (lm.type==='text'?lm.text:'📎 Файл'), tag: "leto" });
                }
            }

            if (messages.length === lastMessagesCount) return;
            lastMessagesCount = messages.length;

            const isUserAtBottom = (messagesScreen.scrollHeight - messagesScreen.scrollTop - messagesScreen.clientHeight) < 70;
            messagesScreen.innerHTML = "";

            let lastRenderedDateStr = "";

            messages.forEach(msg => {
                if (msg.text && msg.text.startsWith('/add_member:')) return;

                // ДОБАВЛЕНИЕ ПЛАШКИ С ДАТОЙ (СЕГОДНЯ, ВЧЕРА, 28 АВГУСТА)
                if (msg.created_at) {
                    const msgDateFormatted = formatStickyDate(msg.created_at);
                    if (msgDateFormatted && msgDateFormatted !== lastRenderedDateStr) {
                        const dateBadge = document.createElement('div');
                        dateBadge.className = 'chat-date-badge';
                        dateBadge.innerHTML = `<span>${msgDateFormatted}</span>`;
                        messagesScreen.appendChild(dateBadge);
                        lastRenderedDateStr = msgDateFormatted;
                    }
                }

                const msgRow = document.createElement('div');
                const isMy = msg.sender === currentActiveUser;
                msgRow.className = 'msg-row ' + (isMy ? 'my-msg' : 'other-msg');

                const avatarCircle = document.createElement('div');
                avatarCircle.className = 'msg-user-avatar';
                
                let hash = 0;
                for (let i = 0; i < msg.sender.length; i++) { hash = msg.sender.charCodeAt(i) + ((hash << 5) - hash); }
                const c1 = `hsl(${hash % 360}, 65%, 75%)`;
                const c2 = `hsl(${(hash + 60) % 360}, 70%, 60%)`;
                avatarCircle.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
                msgRow.appendChild(avatarCircle);

                const bubble = document.createElement('div');
                bubble.className = 'msg-bubble';

                let senderTag = '';
                if (currentChatType !== 'contact' && !isMy) {
                    const isSenderVer = (msg.sender.toLowerCase() === 'алексей');
                    senderTag = `<strong style="display:block;font-size:11px;color:var(--primary-color);margin-bottom:2px;">${msg.sender}${isSenderVer ? svgVerified : ''}:</strong>`;
                }

                let timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                let ticks = isMy ? (currentChatType === 'contact' && opponentLastActiveTime > new Date(msg.created_at) ? svgTickDouble : svgTickSingle) : '';
                const metaHTML = `<div class="msg-meta-container"><span>${timeStr}</span>${ticks}</div>`;

                let contentHTML = '';
                if (msg.type === 'image') {
                    contentHTML = `<div class="msg-media-block"><a href="${msg.text}" target="_blank"><img src="${msg.text}" style="max-width:200px; max-height:200px; object-fit:cover; border-radius:12px;"></a>${metaHTML}</div>`;
                } else if (msg.type === 'voice') {
                    contentHTML = `<div style="display:flex;align-items:flex-end;gap:8px;"><audio controls src="${msg.text}" style="max-width:240px; height:34px;"></audio>${metaHTML}</div>`;
                } else if (msg.type === 'file' && (msg.text.endsWith('.mp4') || msg.text.endsWith('.mov') || msg.text.endsWith('.webm') || msg.text.includes('video'))) {
                    contentHTML = `<div><a href="${msg.text}" target="_blank" class="video-link-styled">🎥 Открыть видеофайл</a>${metaHTML}</div>`;
                } else if (msg.type === 'file') {
                    contentHTML = `<div><a href="${msg.text}" target="_blank" style="color:var(--primary-color); font-weight:600; text-decoration:underline;">📂 Скачать файл</a>${metaHTML}</div>`;
                } else {
                    contentHTML = `<div>${metaHTML}<span>${msg.text}</span></div>`;
                }

                bubble.innerHTML = senderTag + contentHTML;
                setupContextEvents(bubble, msg, isMy);

                msgRow.appendChild(bubble);
                messagesScreen.appendChild(msgRow);
            });

            if (isUserAtBottom || messagesScreen.children.length <= 1) { messagesScreen.scrollTop = messagesScreen.scrollHeight; }
        });
    }

    // --- СЛУШАТЕЛИ КНОПОК МЕДИА (МЕДИА-ФУНКЦИИ ИСПРАВЛЕНЫ) ---
    const clipBtnNode = document.querySelector('.input-container-row .icon-btn:first-child');
    if (clipBtnNode) {
        clipBtnNode.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (!activeChatTarget) return;
            mediaFileInput.click();
        });
    }

    mediaFileInput.addEventListener('change', function() {
        if (this.files.length === 0) return;
        const file = this.files[0];
        const fileName = "chat_" + Date.now() + "." + file.name.split('.').pop();

        fetch(MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName, {
            method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": file.type }, body: file
        })
        .then(res => res.json())
        .then(() => {
            const fullUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
            return fetch(SUPABASE_MSG_URL, {
                method: "POST",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: currentActiveUser, receiver: activeChatTarget, text: fullUrl,
                    type: file.type.startsWith('image/') ? "image" : "file", chat_type: currentChatType, created_at: new Date().toISOString()
                })
            });
        }).then(() => { lastMessagesCount = 0; loadMessages(); });
    });

    const micBtnNode = document.querySelector('.input-container-row .icon-btn:nth-child(3)');
    if (micBtnNode) {
        micBtnNode.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (!activeChatTarget) return;

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
                        }).then(res => res.json()).then(() => {
                            return fetch(SUPABASE_MSG_URL, {
                                method: "POST",
                                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    sender: currentActiveUser, receiver: activeChatTarget, text: MY_SUPABASE_URL + "/storage/v1/object/public/media/" + audioName,
                                    type: "voice", chat_type: currentChatType, created_at: new Date().toISOString()
                                })
                            });
                        }).then(() => { lastMessagesCount = 0; loadMessages(); });
                        stream.getTracks().forEach(t => t.stop());
                    });
                    mediaRecorder.start();
                    isRecording = true; micBtnNode.textContent = "🛑"; micBtnNode.style.color = "red";
                }).catch(err => alert("Ошибка доступа к микрофону: " + err.message));
            } else {
                if (mediaRecorder) mediaRecorder.stop();
                isRecording = false; micBtnNode.textContent = "🎤"; micBtnNode.style.color = "";
            }
        });
    }

    // --- КОНТЕКСТНОЕ МЕНЮ (ПРАВЫЙ КЛИК / ЛОНГ-ТАП) ---
    function setupContextEvents(element, msg, isMy) {
        const iAmCreator = (currentChatType !== 'contact' && activeChatCreator === currentActiveUser);
        if (!isMy && !iAmCreator) return;

        element.addEventListener('contextmenu', e => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, msg, isMy); });
        element.addEventListener('touchstart', e => {
            touchTimer = setTimeout(() => {
                window.navigator.vibrate && window.navigator.vibrate(50);
                openContextMenu(e.touches[0].clientX, e.touches[0].clientY, msg, isMy);
            }, 600);
        }, {passive: true});
        element.addEventListener('touchend', () => clearTimeout(touchTimer));
    }

    const ctxMenu = document.getElementById('leto-custom-context-menu');
    function openContextMenu(x, y, msg, isMy) {
        selectedMsgData = msg;
        if (!ctxMenu) return;
        ctxMenu.style.display = 'block'; ctxMenu.style.top = y + 'px'; ctxMenu.style.left = x + 'px';
        const editBtn = document.getElementById('ctx-edit-msg');
        if (editBtn) editBtn.style.display = (isMy && msg.type === 'text') ? 'block' : 'none';
    }

    document.addEventListener('click', () => { if (ctxMenu) ctxMenu.style.display = 'none'; });

    const ctxDeleteBtn = document.getElementById('ctx-delete-msg');
    if (ctxDeleteBtn) {
        ctxDeleteBtn.addEventListener('click', function() {
            if (!selectedMsgData || !confirm("Удалить сообщение?")) return;
            fetch(SUPABASE_MSG_URL + "?id=eq." + selectedMsgData.id, {
                method: "DELETE", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
            }).then(() => { lastMessagesCount = 0; loadMessages(); });
        });
    }

    const ctxEditBtn = document.getElementById('ctx-edit-msg');
    if (ctxEditBtn) {
        ctxEditBtn.addEventListener('click', function() {
            if (!selectedMsgData) return;
            const newText = prompt("Редактировать:", selectedMsgData.text);
            if (!newText || newText.trim() === selectedMsgData.text) return;
            fetch(SUPABASE_MSG_URL + "?id=eq." + selectedMsgData.id, {
                method: "PATCH", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ text: newText.trim() })
            }).then(() => { lastMessagesCount = 0; loadMessages(); });
        });
    }

    // --- СОЗДАНИЕ ГРУПП, КАНАЛОВ И КОНТАКТОВ ---
    const createRoomModal = document.getElementById('create-room-modal');
    if (mainDynamicActionBtn) {
        mainDynamicActionBtn.addEventListener('click', function() {
            if (currentChatType === 'contact') {
                const targetUsername = prompt("Введите юзернейм контакта:");
                if (!targetUsername || targetUsername.trim().toLowerCase() === currentActiveUser) return;
                
                fetch(MY_SUPABASE_URL + "/rest/v1/user?username=eq." + encodeURIComponent(targetUsername.trim().toLowerCase()), {
                    method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
                }).then(res => res.json()).then(users => {
                    if (!users || users.length === 0) { alert("Юзер не найден!"); return; }
                    return fetch(SUPABASE_MSG_URL, {
                        method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                        body: JSON.stringify({ sender: currentActiveUser, receiver: targetUsername.trim().toLowerCase(), text: "👋 Контакт добавлен.", type: "text", chat_type: "contact", created_at: new Date().toISOString() })
                    });
                }).then(() => { loadChats(); });
            } else {
                const modalTitleEl = document.getElementById('modal-title');
                if (modalTitleEl) modalTitleEl.textContent = currentChatType === 'group' ? "Создание группы" : "Создание канала";
                if (createRoomModal) createRoomModal.style.display = 'flex';
            }
        });
    }

    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', () => { if (createRoomModal) createRoomModal.style.display = 'none'; });
    }
    
    const modalSubmitBtn = document.getElementById('modal-submit-btn');
    if (modalSubmitBtn) {
        modalSubmitBtn.addEventListener('click', function() {
            const rNameEl = document.getElementById('modal-room-name');
            const rDescEl = document.getElementById('modal-room-desc');
            const rName = rNameEl ? rNameEl.value.trim() : "";
            const rDesc = rDescEl ? rDescEl.value.trim() : "";
            if (!rName) return;

            fetch(SUPABASE_ROOMS_URL, {
                method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ name: rName, description: rDesc, type: currentChatType, creator: currentActiveUser })
            }).then(() => { if (createRoomModal) createRoomModal.style.display = 'none'; loadChats(); openChatWorkspace(rName); });
        });
    }

    // --- УПРАВЛЕНИЕ СТАЦИОНАРНЫМИ НАСТРОЙКАМИ КОМНАТ ---
    if (roomSettingsBtn) {
        roomSettingsBtn.addEventListener('click', function() {
            const setRoomNameEl = document.getElementById('set-room-name');
            if (setRoomNameEl) setRoomNameEl.value = activeChatTarget;
            const groupAddUsersSec = document.getElementById('group-add-users-section');
            if (groupAddUsersSec) groupAddUsersSec.style.display = currentChatType === 'group' ? 'flex' : 'none';
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
            fetch(SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(activeChatTarget), {
                method: "DELETE", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
            }).then(() => { location.reload(); });
        });
    }

    const submitAddMemberBtn = document.getElementById('submit-add-member-btn');
    if (submitAddMemberBtn) {
        submitAddMemberBtn.addEventListener('click', function() {
            const addMemberUserEl = document.getElementById('add-member-username');
            const user = addMemberUserEl ? addMemberUserEl.value.trim().toLowerCase() : "";
            if (!user) return;
            fetch(SUPABASE_MSG_URL, {
                method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ sender: currentActiveUser, receiver: activeChatTarget, text: "/add_member:" + user, type: "text", chat_type: currentChatType, created_at: new Date().toISOString() })
            }).then(() => { alert("Добавлен!"); if (addMemberUserEl) addMemberUserEl.value = ""; });
        });
    }

    // Отправка текста
    function handleSendMessage() {
        if (!mainMessageField) return;
        const text = mainMessageField.value.trim();
        if (!text || !activeChatTarget) return;
        fetch(SUPABASE_MSG_URL, {
            method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ sender: currentActiveUser, receiver: activeChatTarget, text: text, type: "text", chat_type: currentChatType, created_at: new Date().toISOString() })
        }).then(() => { mainMessageField.value = ""; lastMessagesCount = 0; loadMessages(); });
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
    if (mainMessageField) mainMessageField.addEventListener('keydown', e => { if (e.key === 'Enter') handleSendMessage(); });

    // Переключение вкладок сайдбара
    filterButtons.forEach(btn => {
        btn.addEventListener('click', e => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentChatType = e.target.getAttribute('data-type');
            if (mainDynamicActionBtn) {
                mainDynamicActionBtn.textContent = currentChatType === 'contact' ? "➕ Добавить новый контакт" : (currentChatType === 'group' ? "👥 Создать группу" : "📢 Создать канал");
            }
            loadChats();
        });
    });

    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', () => { if (appContainer) appContainer.classList.remove('show-chat'); activeChatTarget = null; });
    }

    loadChats();
    // ... здесь заканчивается ваш текущий код мессенджера ...

    // =======================================================
    // ⚙️ СИНХРОНИЗАЦИЯ НАСТРОЕК (ТЕМА, ШРИФТ И АВАТАРКА)
    // =======================================================
    try {
        const activeUser = localStorage.getItem('leto_active_user') || 'default';
        const savedType = localStorage.getItem(activeUser + '_storage_type');
        const storage = savedType === 'sessionstorage' ? sessionStorage : localStorage;

        let savedTheme = storage.getItem(activeUser + '_theme') || 'default';
        savedTheme = savedTheme.replace(/"/g, '');
        
        const THEMES = {
          default: { '--bg-main': '#f4f6f9', '--bg-white': '#ffffff', '--border-color': '#e1e4e8', '--text-primary': '#1f2328', '--text-muted': '#656d76', '--primary-color': '#007aff', '--bubble-me': '#e1f3ff', '--bubble-other': '#ffffff' },
          dark: { '--bg-main': '#121212', '--bg-white': '#1c1c1e', '--border-color': '#2c2c2e', '--text-primary': '#f5f5f7', '--text-muted': '#8e8e93', '--primary-color': '#0a84ff', '--bubble-me': '#3a3a3c', '--bubble-other': '#2c2c2e' },
          ocean: { '--bg-main': '#0f172a', '--bg-white': '#1e293b', '--border-color': '#334155', '--text-primary': '#f8fafc', '--text-muted': '#94a3b8', '--primary-color': '#38bdf8', '--bubble-me': '#0369a1', '--bubble-other': '#1e293b' },
          mint: { '--bg-main': '#f0f4f1', '--bg-white': '#ffffff', '--border-color': '#d1ded4', '--text-primary': '#2e3b32', '--text-muted': '#6b7c70', '--primary-color': '#2e7d32', '--bubble-me': '#e8f5e9', '--bubble-other': '#ffffff' }
        };
        
        const currentTheme = THEMES[savedTheme] || THEMES.default;
        Object.keys(currentTheme).forEach(key => {
            document.documentElement.style.setProperty(key, currentTheme[key]);
        });

        let savedFontSize = storage.getItem(activeUser + '_font_size') || '15px';
        savedFontSize = savedFontSize.replace(/"/g, '');
        document.documentElement.style.setProperty('--chat-msg-font-size', savedFontSize);

        let savedAvatar = storage.getItem(activeUser + '_avatar_url');
        if (savedAvatar) {
            savedAvatar = savedAvatar.replace(/"/g, '');
            const mainAvatarEl = document.querySelector('.user-bar .user-avatar');
            if (mainAvatarEl) {
                mainAvatarEl.style.backgroundImage = `url('${savedAvatar}')`;
                mainAvatarEl.style.backgroundSize = 'cover';
                mainAvatarEl.style.backgroundPosition = 'center';
            }
        }
    } catch (e) {}
    // =======================================================

}); // <-- ЭТО САМАЯ ПОСЛЕДНЯЯ СТРОЧКА ВАШЕГО ФАЙЛА
