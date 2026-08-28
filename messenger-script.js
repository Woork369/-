document.addEventListener('DOMContentLoaded', function() {

    const MY_SUPABASE_URL = "https://rvmtghettsndnnhdeasx.supabase.co"; 
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 

    const SUPABASE_MSG_URL   = MY_SUPABASE_URL + "/rest/v1/messages";
    const SUPABASE_ROOMS_URL = MY_SUPABASE_URL + "/rest/v1/rooms";

    let currentChatType = 'contact';
    let activeChatTarget = null;
    let refreshInterval = null;
    let activeChatCreator = null; 
    let lastMessagesCount = 0;
    let opponentLastActiveTime = new Date(0);
    let selectedMsgData = null; 
    let touchTimer = null; 

    const currentActiveUser = localStorage.getItem('leto_active_user');
    if (!currentActiveUser) { window.location.href = "index.html"; return; }

    // SVG векторные элементы
    const svgVerified = `<svg class="verified-badge" viewBox="0 0 24 24" fill="none" style="width:15px;height:15px;margin-left:4px;display:inline-block;vertical-align:middle;"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#248bf2"/></svg>`;
    const svgTickSingle = `<svg viewBox="0 0 24 24" fill="none"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#8c9197"/></svg>`;
    const svgTickDouble = `<svg viewBox="0 0 24 24" fill="none"><path d="M18 7l-1.41-1.41L9 13.17 5.41 9.59 4 11l5 5 9-9zM22 7l-1.41-1.41L13 13.17l-1.59-1.59L10 13l3 3 9-9z" fill="#4bb34b"/></svg>`;

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

    if (activeUsernameEl) {
        activeUsernameEl.innerHTML = currentActiveUser + (currentActiveUser.toLowerCase() === 'алексей' ? svgVerified : '');
    }

    if ("Notification" in window && Notification.permission === "default") { Notification.requestPermission(); }

    function loadChats() {
        if (!chatsListTarget) return;
        const url = currentChatType === 'contact' 
            ? SUPABASE_MSG_URL + "?chat_type=eq.contact&or=(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + ")"
            : SUPABASE_ROOMS_URL + "?type=eq." + currentChatType + "&order=created_at.desc";
            
        fetch(url, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(data => {
            chatsListTarget.innerHTML = "";
            if (data.length === 0) { chatsListTarget.innerHTML = '<div class="status-message">Список пуст</div>'; return; }
            if (currentChatType === 'contact') {
                const unique = new Set();
                data.forEach(msg => unique.add(msg.sender === currentActiveUser ? msg.receiver : msg.sender));
                unique.forEach(name => renderChatCard(name, "Личный диалог", "", ""));
            } else {
                data.forEach(room => renderChatCard(room.name, room.description || "Нет описания", room.avatar_url, room.creator));
            }
        }).catch(() => { chatsListTarget.innerHTML = '<div class="status-message">Список пуст</div>'; });
    }

    function renderChatCard(name, subtitle, avatarUrl, creatorName) {
        const card = document.createElement('div');
        card.className = 'chat-card' + (activeChatTarget === name ? ' active' : '');
        let avatarStyle = avatarUrl ? `background-image: url('${avatarUrl}'); background-size: cover; background-position: center;` : '';
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

    function openChatWorkspace(chatName) {
        activeChatTarget = chatName;
        clearInterval(refreshInterval);
        settingsPanel.style.display = 'none';

        if (currentChatType === 'contact' || currentChatType === 'channel' || chatName.toLowerCase() === 'лето' || activeChatCreator === currentActiveUser) {
            proceedOpeningWorkspace(chatName);
            return;
        }

        const checkUrl = SUPABASE_MSG_URL + "?chat_type=eq." + currentChatType + "&receiver=eq." + encodeURIComponent(chatName) + "&order=created_at.asc";
        fetch(checkUrl, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(messages => {
            const expectedCommand = "/add_member:" + currentActiveUser.toLowerCase();
            const hasAccess = messages.some(msg => 
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
        chatHeader.style.display = 'flex';
        inputZone.style.display = 'block';
        messagesScreen.style.display = 'flex';
        
        const isVer = (chatName.toLowerCase() === 'алексей');
        targetChatNameEl.innerHTML = chatName + (isVer ? svgVerified : '');
        if (appContainer) appContainer.classList.add('show-chat');

        if (currentChatType !== 'contact' && activeChatCreator === currentActiveUser) {
            roomSettingsBtn.style.display = 'flex';
        } else {
            roomSettingsBtn.style.display = 'none';
        }

        const containerZone = document.getElementById('input-zone');
        const clipBtn = containerZone.querySelector('.icon-btn:first-child');
        const micBtn = containerZone.querySelector('.icon-btn:nth-child(3)');

        if (currentChatType === 'channel' && activeChatCreator && activeChatCreator !== currentActiveUser) {
            mainMessageField.disabled = true;
            mainMessageField.placeholder = "🔒 Только администраторы могут писать сюда";
            sendBtn.style.display = 'none';
            if (clipBtn) clipBtn.style.display = 'none';
            if (micBtn) micBtn.style.display = 'none';
        } else {
            mainMessageField.disabled = false;
            mainMessageField.placeholder = "Напишите сообщение...";
            sendBtn.style.display = 'block';
            if (clipBtn) clipBtn.style.display = 'flex';
            if (micBtn) micBtn.style.display = 'flex';
        }

        if (currentChatType === 'contact') {
            statusTextEl.style.display = 'block';
            statusTextEl.textContent = 'загрузка статуса...';
            fetch(SUPABASE_MSG_URL + "?sender=eq." + encodeURIComponent(chatName) + "&order=created_at.desc&limit=1", {
                method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
            }).then(res => res.json()).then(lastMsg => {
                if (!lastMsg || lastMsg.length === 0) { statusTextEl.textContent = 'была недавно'; return; }
                opponentLastActiveTime = new Date(lastMsg[0].created_at);
                const diffMins = Math.floor((new Date() - opponentLastActiveTime) / 1000 / 60);
                if (diffMins < 5) { statusTextEl.textContent = '• в сети'; statusTextEl.classList.add('online'); }
                else if (diffMins < 60) { statusTextEl.textContent = 'была недавно'; statusTextEl.classList.remove('online'); }
                else { statusTextEl.textContent = 'был(а) в сети в ' + opponentLastActiveTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); statusTextEl.classList.remove('online'); }
                lastMessagesCount = 0; loadMessages();
            }).catch(() => { statusTextEl.textContent = 'была недавно'; lastMessagesCount = 0; loadMessages(); });
        } else {
            statusTextEl.style.display = 'none';
            lastMessagesCount = 0;
            loadMessages();
        }

        clearInterval(refreshInterval);
        refreshInterval = setInterval(loadMessages, 3000);
    }

    function loadMessages() {
        if (!activeChatTarget || !messagesScreen || settingsPanel.style.display === 'flex') return;
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
            
            if (messages.length > lastMessagesCount && lastMessagesCount > 0) {
                const lm = messages[messages.length - 1];
                if (lm.sender !== currentActiveUser && document.hidden && window.Notification && Notification.permission === "granted") {
                    new Notification("Лето Мессенджер", { body: "@" + lm.sender + ": " + (lm.type==='text'?lm.text:'📎 Файл'), tag: "leto" });
                }
            }

            if (messages.length === lastMessagesCount) return;
            lastMessagesCount = messages.length;

            const isUserAtBottom = (messagesScreen.scrollHeight - messagesScreen.scrollTop - messagesScreen.clientHeight) < 50;
            messagesScreen.innerHTML = "";

            messages.forEach(msg => {
                if (msg.text && msg.text.startsWith('/add_member:')) return;

                const msgRow = document.createElement('div');
                const isMy = msg.sender === currentActiveUser;
                msgRow.className = 'msg-row ' + (isMy ? 'my-msg' : 'other-msg');

                const avatarCircle = document.createElement('div');
                avatarCircle.className = 'msg-user-avatar';
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
                    contentHTML = `<div class="msg-media-block"><a href="${msg.text}" target="_blank"><img src="${msg.text}" style="max-width:100%; max-height:250px; border-radius:12px; display:block; margin-top:4px;"></a>${metaHTML}</div>`;
                } else if (msg.type === 'voice') {
                    contentHTML = `<div style="display:flex;align-items:flex-end;gap:8px;"><audio controls src="${msg.text}" style="height:34px; max-width:100%;"></audio>${metaHTML}</div>`;
                } else if (msg.type === 'file' && (msg.text.endsWith('.mp4') || msg.text.endsWith('.mov') || msg.text.endsWith('.webm'))) {
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

    function setupContextEvents(element, msg, isMy) {
        const iAmCreator = (currentChatType !== 'contact' && activeChatCreator === currentActiveUser);
        if (!isMy && !iAmCreator) return;

        element.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            openContextMenu(e.clientX, e.clientY, msg, isMy);
        });

        element.addEventListener('touchstart', function(e) {
            touchTimer = setTimeout(() => {
                if (window.navigator.vibrate) window.navigator.vibrate(50);
                const touch = e.touches[0];
                openContextMenu(touch.clientX, touch.clientY, msg, isMy);
            }, 600);
        }, {passive: true});

        element.addEventListener('touchend', function() { clearTimeout(touchTimer); });
        element.addEventListener('touchmove', function() { clearTimeout(touchTimer); });
    }

    const ctxMenu = document.getElementById('leto-custom-context-menu');
    function openContextMenu(x, y, msg, isMy) {
        selectedMsgData = msg;
        ctxMenu.style.display = 'block';
        ctxMenu.style.top = y + 'px';
        ctxMenu.style.left = x + 'px';

        const editBtn = document.getElementById('ctx-edit-msg');
        if (isMy && msg.type === 'text') { editBtn.style.display = 'block'; } 
        else { editBtn.style.display = 'none'; }
    }

    document.addEventListener('click', function() { if(ctxMenu) ctxMenu.style.display = 'none'; });

    document.getElementById('ctx-delete-msg').addEventListener('click', function() {
        if (!selectedMsgData || !confirm("Удалить сообщение для всех?")) return;
        fetch(MY_SUPABASE_URL + "/rest/v1/messages?id=eq." + selectedMsgData.id, {
            method: "DELETE", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
        }).then(() => { lastMessagesCount = 0; loadMessages(); });
    });

    document.getElementById('ctx-edit-msg').addEventListener('click', function() {
        if (!selectedMsgData) return;
        const newText = prompt("Редактировать сообщение:", selectedMsgData.text);
        if (!newText || newText.trim() === selectedMsgData.text) return;
        fetch(MY_SUPABASE_URL + "/rest/v1/messages?id=eq." + selectedMsgData.id, {
            method: "PATCH",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ text: newText.trim() })
        }).then(() => { lastMessagesCount = 0; loadMessages(); });
    });

    roomSettingsBtn.addEventListener('click', function() {
        document.getElementById('set-room-name').value = activeChatTarget;
        document.getElementById('set-room-desc').value = "";
        document.getElementById('add-member-username').value = "";
        
        const addSection = document.getElementById('group-add-users-section');
        addSection.style.display = currentChatType === 'group' ? 'flex' : 'none';

        messagesScreen.style.display = 'none';
        inputZone.style.display = 'none';
        settingsPanel.style.display = 'flex';
    });

    document.getElementById('close-room-settings-btn').addEventListener('click', function() {
        settingsPanel.style.display = 'none';
        messagesScreen.style.display = 'flex';
        inputZone.style.display = 'block';
    });

    document.getElementById('save-room-settings-btn').addEventListener('click', function() {
        const nName = document.getElementById('set-room-name').value.trim();
        const nDesc = document.getElementById('set-room-desc').value.trim();
        const fAvatar = document.getElementById('set-room-avatar').files;
        const updateUrl = SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(activeChatTarget);

        const executePatch = (payload) => {
            fetch(updateUrl, {
                method: "PATCH",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).then(() => { alert("Изменения внесены!"); loadChats(); openChatWorkspace(activeChatTarget); });
        };

        if (fAvatar && fAvatar.length > 0) {
            const file = fAvatar[0];
            const fileName = "room_upd_" + Date.now() + "." + file.name.split('.').pop();
            fetch(MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName, {
                method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": file.type }, body: file
            }).then(() => {
                executePatch({ description: nDesc, avatar_url: MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName });
            });
        } else {
            executePatch({ description: nDesc });
        }
    });

    document.getElementById('submit-add-member-btn').addEventListener('click', function() {
        const uToAdd = document.getElementById('add-member-username').value.trim().toLowerCase();
        if (!uToAdd) return;

        fetch(MY_SUPABASE_URL + "/rest/v1/user?username=eq." + encodeURIComponent(uToAdd), {
            method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
        }).then(res => res.json()).then(users => {
            if (users.length === 0) { alert("Пользователь не найден!"); return; }
            return fetch(SUPABASE_MSG_URL, {
                method: "POST",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: currentActiveUser, receiver: activeChatTarget, text: "/add_member:" + uToAdd,
                    type: "text", chat_type: currentChatType, created_at: new Date().toISOString()
                })
            });
        }).then(() => { alert("Участник добавлен!"); document.getElementById('add-member-username').value = ""; });
    });

    document.getElementById('delete-room-completely-btn').addEventListener('click', function() {
        if (!confirm("Вы действительно хотите НАВСЕГДА удалить эту комнату?")) return;
        fetch(SUPABASE_ROOMS_URL + "?name=eq." + encodeURIComponent(activeChatTarget), {
            method: "DELETE", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
        }).then(() => {
            alert("Комната удалена."); activeChatTarget = null; clearInterval(refreshInterval);
            settingsPanel.style.display = 'none'; fallbackNotice.style.display = 'block';
            chatHeader.style.display = 'none'; inputZone.style.display = 'none'; loadChats();
        });
    });

    function handleSendMessage() {
        const textMessage = mainMessageField.value.trim();
        if (textMessage.length === 0 || !activeChatTarget) return;

        fetch(SUPABASE_MSG_URL, {
            method: "POST",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
            body: JSON.stringify({
                sender: currentActiveUser, receiver: activeChatTarget, text: textMessage,
                type: "text", chat_type: currentChatType, created_at: new Date().toISOString()
            })
        }).then(function() { mainMessageField.value = ""; lastMessagesCount = 0; loadMessages(); });
    }

    sendBtn.addEventListener('click', handleSendMessage);
    mainMessageField.addEventListener('keydown', e => { if (e.key === 'Enter') handleSendMessage(); });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', e => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentChatType = e.target.getAttribute('data-type');
            mainDynamicActionBtn.textContent = currentChatType === 'contact' ? "➕ Добавить новый контакт" : (currentChatType === 'group' ? "👥 Создать новую группу" : "📢 Создать новый канал");
            loadChats();
        });
    });

    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', function() {
            if (appContainer) appContainer.classList.remove('show-chat');
            clearInterval(refreshInterval); activeChatTarget = null;
        });
    }

    loadChats();
});