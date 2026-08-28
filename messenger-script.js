document.addEventListener('DOMContentLoaded', function() {

    // =======================================================
    // ☀️ НАСТРОЙКИ СЕРВЕРА СИСТЕМЫ "ПОСЛАННИК-ЛЕТО"
    // =======================================================
    const MY_SUPABASE_URL = "https://rvmtghettsndnnhdeasx.supabase.co"; 
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 

    const SUPABASE_MSG_URL   = MY_SUPABASE_URL + "/rest/v1/messages";
    const SUPABASE_ROOMS_URL = MY_SUPABASE_URL + "/rest/v1/rooms";

    // Состояние мессенджера
    let currentChatType = 'contact';
    let activeChatTarget = null;
    let refreshInterval = null;
    let activeChatCreator = null; 
    let lastMessagesCount = 0; 
    let currentEditingMessageId = null; 

    // Лонг-тап таймер
    let touchTimer = null;

    // 🔥 ФИКС БЕСКОНЕЧНОЙ ЗАГРУЗКИ: Если localStorage пуст, подставляем дефолтного пользователя
    // вместо падения или null-запросов, обеспечивая автономность.
    let currentActiveUser = localStorage.getItem('leto_active_user');
    if (!currentActiveUser) {
        currentActiveUser = "алексей";
        localStorage.setItem('leto_active_user', 'алексей');
    }

    // Инициализация UI
    const activeUsernameEl     = document.getElementById('active-username');
    const chatsListTarget      = document.getElementById('chats-list-target');
    const filterButtons        = document.querySelectorAll('.tab-btn');
    const mainDynamicActionBtn = document.getElementById('main-dynamic-action-btn');
    
    const chatHeader           = document.getElementById('active-chat-header');
    const targetChatNameEl     = document.getElementById('target-chat-name');
    const targetChatStatusEl   = document.getElementById('target-chat-status');
    const messagesScreen       = document.getElementById('messages-screen');
    const fallbackNotice       = document.getElementById('fallback-notice');
    const privacyLockScreen    = document.getElementById('privacy-lock-screen');
    const inputZone            = document.getElementById('input-zone');
    const mainMessageField     = document.getElementById('main-message-field');
    const sendBtn              = document.getElementById('send-btn');
    const appContainer         = document.getElementById('app-container');
    const mobileBackBtn        = document.getElementById('mobile-back-btn');
    const gearBtn              = document.getElementById('gear-btn');

    // Настройки комнаты
    const roomSettingsPanel    = document.getElementById('leto-room-settings-panel');
    const closeSettingsBtn     = document.getElementById('close-settings-btn');
    const settingsRoomName     = document.getElementById('settings-room-name');
    const settingsRoomDesc     = document.getElementById('settings-room-desc');
    const settingsRoomAvatar   = document.getElementById('settings-room-avatar');
    const settingsSaveBtn      = document.getElementById('settings-save-btn');
    const settingsDeleteBtn    = document.getElementById('settings-delete-btn');
    const settingsAddUserZone  = document.getElementById('settings-add-user-zone');
    const settingsAddUsername  = document.getElementById('settings-add-username');
    const settingsAddUserBtn   = document.getElementById('settings-add-user-btn');

    // Модалка создания
    const createRoomModal      = document.getElementById('create-room-modal');
    const modalTitle           = document.getElementById('modal-title');
    const modalRoomName        = document.getElementById('modal-room-name');
    const modalRoomDesc        = document.getElementById('modal-room-desc');
    const modalRoomAvatar      = document.getElementById('modal-room-avatar');
    const modalCancelBtn       = document.getElementById('modal-cancel-btn');
    const modalSubmitBtn       = document.getElementById('modal-submit-btn');

    // Контекстное меню
    const contextMenu          = document.getElementById('leto-context-menu');
    const ctxEdit              = document.getElementById('ctx-edit');
    const ctxDelete            = document.getElementById('ctx-delete');
    const ctxDeleteAdmin       = document.getElementById('ctx-delete-admin');

    // Запрос пушей
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    // Синяя звезда верификации SVG
    const verifiedSvg = `<svg class="svg-verified" style="width:15px; height:15px; fill:var(--verified-color); margin-left:3px;" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

    if (activeUsernameEl) {
        activeUsernameEl.innerHTML = currentActiveUser + (checkVerified(currentActiveUser) ? verifiedSvg : "");
    }

    function checkVerified(username) {
        return username === "алексей" || username === currentActiveUser;
    }

    // Загрузка списков чатов
    function loadChats() {
        if (!chatsListTarget) return;

        if (currentChatType === 'contact') {
            const url = SUPABASE_MSG_URL + "?chat_type=eq.contact&or=(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + ")";
            fetch(url, { headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
            .then(res => {
                if(!res.ok) throw new Error("API Error");
                return res.json();
            })
            .then(messages => {
                chatsListTarget.innerHTML = "";
                if (!messages || messages.length === 0) {
                    chatsListTarget.innerHTML = '<div class="status-message">Список контактов пуст</div>';
                    return;
                }
                const uniqueChatNames = new Set();
                messages.forEach(msg => {
                    if (msg.sender === currentActiveUser) uniqueChatNames.add(msg.receiver);
                    else uniqueChatNames.add(msg.sender);
                });
                uniqueChatNames.forEach(chatName => {
                    let lastMsg = messages.filter(m => m.sender === chatName || m.receiver === chatName).pop();
                    renderChatCard(chatName, "Личный диалог", "", "", lastMsg ? lastMsg.created_at : null);
                });
            }).catch(() => { chatsListTarget.innerHTML = '<div class="status-message">Список контактов пуст или сервер недоступен</div>'; });
        } else {
            const url = SUPABASE_ROOMS_URL + "?type=eq." + currentChatType + "&order=created_at.desc";
            fetch(url, { headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
            .then(res => {
                if(!res.ok) throw new Error("API Error");
                return res.json();
            })
            .then(rooms => {
                chatsListTarget.innerHTML = "";
                if (!rooms || rooms.length === 0) {
                    chatsListTarget.innerHTML = '<div class="status-message">Ничего не найдено</div>';
                    return;
                }
                rooms.forEach(room => {
                    renderChatCard(room.name, room.description || "Нет описания", room.avatar_url, room.creator, null, room);
                });
            }).catch(() => { chatsListTarget.innerHTML = '<div class="status-message">Ошибка сети при получении комнат</div>'; });
        }
    }

    function renderChatCard(name, subtitle, avatarUrl, creatorName, lastTime, roomObj = null) {
        const card = document.createElement('div');
        card.className = 'chat-card';
        if (activeChatTarget === name) card.classList.add('active');

        let avatarStyle = avatarUrl ? `background-image: url('${avatarUrl}');` : '';
        let badge = checkVerified(name) ? verifiedSvg : "";

        card.innerHTML = `
            <div class="user-avatar small" style="${avatarStyle}"></div>
            <div style="display: flex; flex-direction: column; width: calc(100% - 50px);">
                <span class="user-display-name" style="font-weight:600;">${name}${badge}</span>
                <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${subtitle}</span>
            </div>
        `;

        card.addEventListener('click', function() {
            activeChatCreator = creatorName; 
            openChatWorkspace(name, roomObj, lastTime);
        });
        chatsListTarget.appendChild(card);
    }

    // Переключение разделов
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentChatType = e.target.getAttribute('data-type');

            if (currentChatType === 'contact') {
                mainDynamicActionBtn.textContent = "➕ Добавить новый контакт";
                mainDynamicActionBtn.style.background = "var(--primary-color)";
            } else if (currentChatType === 'group') {
                mainDynamicActionBtn.textContent = "👥 Создать новую группу";
                mainDynamicActionBtn.style.background = "#28a745";
            } else if (currentChatType === 'channel') {
                mainDynamicActionBtn.textContent = "📢 Создать новый канал";
                mainDynamicActionBtn.style.background = "#fd7e14";
            }
            loadChats();
        });
    });

    // Действие основной кнопки
    mainDynamicActionBtn.addEventListener('click', function() {
        if (currentChatType === 'contact') {
            const targetUsername = prompt("Введите точный юзернейм пользователя ЛЕТО:");
            if (!targetUsername) return;
            const trimmedName = targetUsername.trim().toLowerCase();
            if (trimmedName === currentActiveUser) { alert("Нельзя добавить самого себя."); return; }

            fetch(SUPABASE_MSG_URL, {
                method: "POST",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: currentActiveUser, receiver: trimmedName, text: "👋 Контакт добавлен в систему.",
                    type: "text", chat_type: "contact", created_at: new Date().toISOString()
                })
            })
            .then(() => { loadChats(); openChatWorkspace(trimmedName); });
        } else {
            modalTitle.textContent = currentChatType === 'group' ? "Создание новой группы" : "Создание нового канала";
            modalRoomName.value = ""; modalRoomDesc.value = ""; modalRoomAvatar.value = "";
            createRoomModal.style.display = 'flex';
        }
    });

    if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => createRoomModal.style.display = 'none');

    modalSubmitBtn.addEventListener('click', function() {
        const roomName = modalRoomName.value.trim();
        const roomDesc = modalRoomDesc.value.trim();
        if (!roomName) return;
        saveNewRoom(roomName, roomDesc, "");
    });

    function saveNewRoom(name, desc, avatarUrl) {
        fetch(SUPABASE_ROOMS_URL, {
            method: "POST",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ name: name, description: desc, avatar_url: avatarUrl, type: currentChatType, creator: currentActiveUser })
        })
        .then(res => {
            if (!res.ok) throw new Error("Это название уже занято!");
            createRoomModal.style.display = 'none';
            loadChats(); 
            openChatWorkspace(name);
        }).catch(err => alert(err.message));
    }

    // --- ЛОГИКА ОТКРЫТИЯ ОКНА ТЕКУЩЕЙ ПЕРЕПИСКИ ---
    let openChatWorkspace = function(chatName, roomObj = null, lastTime = null) {
        activeChatTarget = chatName;
        currentEditingMessageId = null;

        if (fallbackNotice) fallbackNotice.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'flex';
        if (inputZone) inputZone.style.display = 'block';
        if (targetChatNameEl) targetChatNameEl.textContent = chatName;

        if (currentChatType !== 'contact' && activeChatCreator === currentActiveUser) {
            gearBtn.style.display = 'block';
        } else {
            gearBtn.style.display = 'none';
        }

        const clipBtn = document.getElementById('clip-btn');
        const micBtn = document.getElementById('mic-btn');
        if (currentChatType === 'channel' && activeChatCreator !== currentActiveUser) {
            mainMessageField.disabled = true;
            mainMessageField.placeholder = "🔒 Только администраторы могут писать сюда";
            sendBtn.style.display = 'none';
            if (clipBtn) clipBtn.style.setProperty('display', 'none', 'important');
            if (micBtn) micBtn.style.setProperty('display', 'none', 'important');
        } else {
            mainMessageField.disabled = false;
            mainMessageField.placeholder = "Напишите сообщение...";
            sendBtn.style.display = 'block';
            if (clipBtn) clipBtn.style.display = 'flex';
            if (micBtn) micBtn.style.display = 'flex';
        }

        const verifiedGeo = document.getElementById('header-verified-geo');
        verifiedGeo.innerHTML = checkVerified(chatName) ? verifiedSvg : "";

        if (appContainer) appContainer.classList.add('show-chat');

        privacyLockScreen.style.display = 'none';
        if (currentChatType === 'contact') {
            calculateOnlineStatus(lastTime);
            loadMessages();
        } else {
            targetChatStatusEl.textContent = roomObj ? (roomObj.description || "Групповой чат") : "";
            fetch(SUPABASE_MSG_URL + "?receiver=eq." + encodeURIComponent(activeChatTarget), {
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
            })
            .then(res => res.json())
            .then(history => {
                let hasAccess = activeChatCreator === currentActiveUser || 
                                activeChatTarget === "Лето" || 
                                (history && history.some(m => m.sender === currentActiveUser)) || 
                                (history && history.some(m => m.text === `/add_member:${currentActiveUser}`));
                
                if (!hasAccess) {
                    privacyLockScreen.style.display = 'flex';
                    inputZone.style.display = 'none';
                } else {
                    loadMessages();
                }
            }).catch(() => { loadMessages(); });
        }
        
        clearInterval(refreshInterval);
        refreshInterval = setInterval(() => { if (!privacyLockScreen.style.display || privacyLockScreen.style.display === 'none') loadMessages(); }, 3000);
    };

    function calculateOnlineStatus(lastTime) {
        if (!lastTime) { targetChatStatusEl.textContent = "был(а) недавно"; return; }
        const diffMs = Date.now() - new Date(lastTime).getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 5) targetChatStatusEl.textContent = "• в сети";
        else if (diffMins < 60) targetChatStatusEl.textContent = "был(а) недавно";
        else {
            let date = new Date(lastTime);
            targetChatStatusEl.textContent = `был(а) в ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
        }
    }

    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', function() {
            if (appContainer) appContainer.classList.remove('show-chat');
            clearInterval(refreshInterval);
            activeChatTarget = null;
        });
    }

    gearBtn.addEventListener('click', () => {
        roomSettingsPanel.style.display = 'flex';
        settingsRoomName.value = activeChatTarget;
        if (currentChatType === 'channel') settingsAddUserZone.style.display = 'none';
        else settingsAddUserZone.style.display = 'block';
    });

    closeSettingsBtn.addEventListener('click', () => roomSettingsPanel.style.display = 'none');

    settingsDeleteBtn.addEventListener('click', function() {
        if (!confirm("Вы действительно хотите удалить эту комнату?")) return;
        fetch(SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(activeChatTarget), {
            method: "DELETE",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
        }).then(() => {
            roomSettingsPanel.style.display = 'none';
            chatHeader.style.display = 'none';
            inputZone.style.display = 'none';
            fallbackNotice.style.display = 'flex';
            loadChats();
        });
    });

    settingsAddUserBtn.addEventListener('click', function() {
        const uName = settingsAddUsername.value.trim().toLowerCase();
        if (!uName) return;
        fetch(SUPABASE_MSG_URL, {
            method: "POST",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ sender: currentActiveUser, receiver: activeChatTarget, text: `/add_member:${uName}`, type: "system", chat_type: currentChatType, created_at: new Date().toISOString() })
        }).then(() => { alert("Команда инвайта добавлена в историю."); settingsAddUsername.value = ""; });
    });

    function handleSendMessage() {
        if (!mainMessageField || !activeChatTarget) return;
        const textMessage = mainMessageField.value.trim();
        if (textMessage.length === 0) return;

        if (currentEditingMessageId) {
            fetch(SUPABASE_MSG_URL + "?id=eq." + currentEditingMessageId, {
                method: "PATCH",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ text: textMessage })
            }).then(() => {
                currentEditingMessageId = null;
                mainMessageField.value = "";
                loadMessages();
            });
        } else {
            fetch(SUPABASE_MSG_URL, {
                method: "POST",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ sender: currentActiveUser, receiver: activeChatTarget, text: textMessage, type: "text", chat_type: currentChatType, created_at: new Date().toISOString() })
            })
            .then(() => { mainMessageField.value = ""; loadMessages(); });
        }
    }

    sendBtn.addEventListener('click', handleSendMessage);
    mainMessageField.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSendMessage(); });

    function loadMessages() {
        if (!activeChatTarget || !messagesScreen) return;
        let url = SUPABASE_MSG_URL + "?chat_type=eq." + currentChatType + "&order=created_at.asc";
        if (currentChatType === 'contact') {
            url += "&or=(and(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(activeChatTarget) + "),and(sender.eq." + encodeURIComponent(activeChatTarget) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + "))";
        } else {
            url += "&receiver=eq." + encodeURIComponent(activeChatTarget);
        }

        fetch(url, { headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(messages => {
            if (!messages || !Array.isArray(messages)) return;

            if (messages.length > lastMessagesCount && lastMessagesCount !== 0) {
                let lastIncoming = messages[messages.length - 1];
                if (lastIncoming.sender !== currentActiveUser && document.hidden) {
                    if (Notification.permission === "granted") {
                        new Notification(`Лето Мессенджер: ${lastIncoming.sender}`, { body: lastIncoming.text });
                    }
                }
            }

            if (messages.length === lastMessagesCount) return;
            lastMessagesCount = messages.length;

            const isUserAtBottom = (messagesScreen.scrollHeight - messagesScreen.scrollTop - messagesScreen.clientHeight) < 50;

            const existingRows = messagesScreen.querySelectorAll('.msg-row');
            existingRows.forEach(r => r.remove());

            messages.forEach(msg => {
                if (msg.type === "system") return; 

                const row = document.createElement('div');
                const isMe = msg.sender === currentActiveUser;
                row.className = isMe ? 'msg-row outgoing' : 'msg-row';
                row.setAttribute('data-id', msg.id);
                row.setAttribute('data-sender', msg.sender);
                row.setAttribute('data-text', msg.text);

                const avatarPlaceholder = document.createElement('div');
                avatarPlaceholder.className = 'msg-avatar-placeholder';

                const bubble = document.createElement('div');
                bubble.className = isMe ? 'msg-bubble outgoing' : 'msg-bubble incoming';
                
                let senderTag = (currentChatType !== 'contact' && !isMe) ? `<strong style="display:block;font-size:11px;color:var(--primary-color);margin-bottom:2px;">${msg.sender}${checkVerified(msg.sender) ? verifiedSvg : ""}</strong>` : '';
                
                let contentHTML = '';
                if (msg.type === 'image') {
                    contentHTML = `<a href="${msg.text}" target="_blank"><img src="${msg.text}"></a>`;
                } else if (msg.type === 'voice') {
                    contentHTML = `<audio controls src="${msg.text}"></audio>`;
                } else if (msg.type === 'video' || (msg.text && msg.text.includes('.mp4'))) {
                    contentHTML = `<a href="${msg.text}" target="_blank" class="video-link-custom">🎥 Открыть videoфайл</a>`;
                } else if (msg.type === 'file') {
                    contentHTML = `<a href="${msg.text}" target="_blank" style="color:var(--primary-color); font-weight:600; text-decoration:underline;">📂 Скачать файл</a>`;
                } else {
                    contentHTML = msg.text;
                }

                let msgDate = new Date(msg.created_at || Date.now());
                let timeStr = `${String(msgDate.getHours()).padStart(2,'0')}:${String(msgDate.getMinutes()).padStart(2,'0')}`;
                
                let ticksSvg = isMe ? `
                    <svg class="svg-tick" viewBox="0 0 24 24">
                        <path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.58 21 7z"/>
                    </svg>
                ` : '';

                bubble.innerHTML = senderTag + contentHTML + `
                    <div class="msg-meta-zone">
                        <span>${timeStr}</span>
                        ${ticksSvg}
                    </div>
                `;

                row.appendChild(avatarPlaceholder);
                row.appendChild(bubble);

                row.addEventListener('contextmenu', (e) => { e.preventDefault(); openContextMenu(e, row); });
                row.addEventListener('touchstart', (e) => { touchTimer = setTimeout(() => openContextMenu(e, row), 600); });
                row.addEventListener('touchend', () => clearTimeout(touchTimer));

                messagesScreen.appendChild(row);
            });

            if (isUserAtBottom || existingRows.length === 0) {
                messagesScreen.scrollTop = messagesScreen.scrollHeight;
            }
        }).catch(() => {});
    }

    function openContextMenu(e, rowElement) {
        const msgId = rowElement.getAttribute('data-id');
        const sender = rowElement.getAttribute('data-sender');
        const text = rowElement.getAttribute('data-text');

        let posX = e.clientX || (e.touches ? e.touches[0].clientX : 100);
        let posY = e.clientY || (e.touches ? e.touches[0].clientY : 100);

        contextMenu.style.top = `${posY}px`;
        contextMenu.style.left = `${posX}px`;
        contextMenu.style.display = 'block';

        const isGroupAdmin = (currentChatType === 'group' || currentChatType === 'channel') && activeChatCreator === currentActiveUser;

        if (sender === currentActiveUser) {
            ctxEdit.style.display = 'block';
            ctxDelete.style.display = 'block';
            ctxDeleteAdmin.style.display = 'none';
        } else if (isGroupAdmin) {
            ctxEdit.style.display = 'none';
            ctxDelete.style.display = 'none';
            ctxDeleteAdmin.style.display = 'block'; 
        } else {
            contextMenu.style.display = 'none'; 
            return;
        }

        ctxEdit.onclick = () => {
            currentEditingMessageId = msgId;
            mainMessageField.value = text;
            mainMessageField.focus();
            contextMenu.style.display = 'none';
        };

        const deleteAction = () => {
            if (!confirm("Удалить сообщение?")) return;
            fetch(SUPABASE_MSG_URL + "?id=eq." + msgId, {
                method: "DELETE",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
            }).then(() => { contextMenu.style.display = 'none'; loadMessages(); });
        };

        ctxDelete.onclick = deleteAction;
        ctxDeleteAdmin.onclick = deleteAction;
    }

    document.addEventListener('click', () => contextMenu.style.display = 'none');

    const originalOpenChatWorkspace = openChatWorkspace;
    openChatWorkspace = function(chatName, roomObj, lastTime) {
        lastMessagesCount = 0; 
        originalOpenChatWorkspace(chatName, roomObj, lastTime);
    };

    loadChats();
});
