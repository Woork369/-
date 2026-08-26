document.addEventListener('DOMContentLoaded', () => {

    // =======================================================
    // ☀️ НАСТРОЙКИ СИНХРОНИЗАЦИИ ТВОЕГО СЕРВЕРА "ПОСЛАННИК-ЛЕТО"
    // =======================================================
    const MY_SUPABASE_URL = "https://supabase.co"; 
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 

    // Сборка сетевых адресов через надежное сложение
    const SUPABASE_MSG_URL   = MY_SUPABASE_URL + "/rest/v1/messages";
    const SUPABASE_ROOMS_URL = MY_SUPABASE_URL + "/rest/v1/rooms";

    let currentChatType = 'contact';
    let activeChatTarget = null;
    let refreshInterval = null;
    let activeChatCreator = null; 

    const currentActiveUser = localStorage.getItem('leto_active_user');

    if (!currentActiveUser) {
        window.location.href = "index.html";
        return;
    }

    // ЭЛЕМЕНТЫ ИНТЕРФЕЙСА
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

    // ЭЛЕМЕНТЫ МОДАЛЬНОГО ОКНА
    const createRoomModal      = document.getElementById('create-room-modal');
    const modalTitle           = document.getElementById('modal-title');
    const modalRoomName        = document.getElementById('modal-room-name');
    const modalRoomDesc        = document.getElementById('modal-room-desc');
    const modalRoomAvatar      = document.getElementById('modal-room-avatar');
    const modalCancelBtn       = document.getElementById('modal-cancel-btn');
    const modalSubmitBtn       = document.getElementById('modal-submit-btn');

    if (activeUsernameEl) activeUsernameEl.textContent = currentActiveUser;

    function loadChats() {
        if (!chatsListTarget) return;

        if (currentChatType === 'contact') {
            const url = SUPABASE_MSG_URL + "?chat_type=eq.contact&or=(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + ")";
            fetch(url, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
            .then(res => res.json())
            .then(messages => {
                chatsListTarget.innerHTML = "";
                if (!messages || messages.length === 0) {
                    chatsListTarget.innerHTML = '<div class="status-message">Список контактов пуст</div>';
                    return;
                }
                const uniqueChatNames = new Set();
                messages.forEach(msg => uniqueChatNames.add(msg.sender === currentActiveUser ? msg.receiver : msg.sender));
                
                uniqueChatNames.forEach(chatName => renderChatCard(chatName, "Личный диалог", "", ""));
            })
            .catch(() => chatsListTarget.innerHTML = '<div class="status-message">Список контактов пуст</div>');
        } else {
            const url = SUPABASE_ROOMS_URL + "?type=eq." + currentChatType + "&order=created_at.desc";
            fetch(url, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
            .then(res => res.json())
            .then(rooms => {
                chatsListTarget.innerHTML = "";
                if (!rooms || rooms.length === 0) {
                    chatsListTarget.innerHTML = '<div class="status-message">Ничего не найдено</div>';
                    return;
                }
                rooms.forEach(room => renderChatCard(room.name, room.description || "Нет описания", room.avatar_url, room.creator));
            })
            .catch(() => chatsListTarget.innerHTML = '<div class="status-message">Список или ничего не найдено</div>');
        }
    }

    function renderChatCard(name, subtitle, avatarUrl, creatorName) {
        const card = document.createElement('div');
        card.className = 'chat-card';
        if (activeChatTarget === name) card.classList.add('active');

        let avatarStyle = '';
        if (avatarUrl) { avatarStyle = "background-image: url('" + avatarUrl + "'); background-size: cover; background-position: center;"; }

        card.innerHTML = `
            <div class="user-avatar small" style="${avatarStyle}"></div>
            <div style="display: flex; flex-direction: column;">
                <span class="user-display-name" style="font-weight:600;">${name}</span>
                <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">${subtitle}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            activeChatCreator = creatorName; 
            openChatWorkspace(name);
        });
        chatsListTarget.appendChild(card);
    }

    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
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
    mainDynamicActionBtn.addEventListener('click', () => {
        if (currentChatType === 'contact') {
            const targetUsername = prompt("Введите точный юзернейм пользователя ЛЕТО:");
            if (!targetUsername) return;
            const trimmedName = targetUsername.trim();
            if (trimmedName === currentActiveUser) return;

            const checkUrl = MY_SUPABASE_URL + "/rest/v1/user?username=eq." + encodeURIComponent(trimmedName);
            
            fetch(checkUrl, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
            .then(res => {
                if (!res.ok) throw new Error("Ошибка сервера.");
                return res.json();
            })
            .then(users => {
                if (!users || users.length === 0) { alert("Пользователь не найден в системе."); return; }
                return fetch(SUPABASE_MSG_URL, {
                    method: "POST",
                    headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                    body: JSON.stringify({ sender: currentActiveUser, receiver: trimmedName, text: "👋 Контакт добавлен.", type: "text", chat_type: "contact", created_at: new Date().toISOString() })
                });
            })
            .then((res) => { 
                if (res && res.ok) { loadChats(); openChatWorkspace(trimmedName); }
            })
            .catch(err => console.error(err));
        } else {
            modalTitle.textContent = currentChatType === 'group' ? "Создание новой группы" : "Создание нового канала";
            modalRoomName.value = ""; modalRoomDesc.value = ""; modalRoomAvatar.value = "";
            createRoomModal.style.display = 'flex';
        }
    });

    if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => createRoomModal.style.display = 'none');

    modalSubmitBtn.addEventListener('click', () => {
        const roomName = modalRoomName.value.trim();
        const roomDesc = modalRoomDesc.value.trim();
        const avatarFiles = modalRoomAvatar.files;

        if (!roomName) return;

        if (avatarFiles && avatarFiles.length > 0) {
            const file = avatarFiles[0];
            const fileExt = file.name.split('.').pop();
            const fileName = "room_" + Date.now() + "." + fileExt;
            const uploadUrl = MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName;

            fetch(uploadUrl, { method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": file.type }, body: file })
            .then(() => {
                const fullAvatarUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
                saveNewRoom(roomName, roomDesc, fullAvatarUrl);
            });
        } else {
            saveNewRoom(roomName, roomDesc, "");
        }
    });

    function saveNewRoom(name, desc, avatarUrl) {
        fetch(SUPABASE_ROOMS_URL, {
            method: "POST",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ name: name, description: desc, avatar_url: avatarUrl, type: currentChatType, creator: currentActiveUser })
        })
        .then(res => {
            if (!res.ok) throw new Error("Имя уже занято!");
            createRoomModal.style.display = 'none';
            loadChats(); openChatWorkspace(name);
        })
        .catch(err => alert(err.message));
    }

    function openChatWorkspace(chatName) {
        activeChatTarget = chatName;

        if (fallbackNotice) fallbackNotice.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'flex';
        if (inputZone) inputZone.style.display = 'block';
        if (targetChatNameEl) targetChatNameEl.textContent = chatName;

        if (appContainer) appContainer.classList.add('show-chat');

        if (currentChatType === 'channel' && activeChatCreator && activeChatCreator !== currentActiveUser) {
            mainMessageField.disabled = true;
            mainMessageField.placeholder = "🔒 Только администраторы могут писать сюда";
            sendBtn.style.display = 'none';
        } else {
            mainMessageField.disabled = false;
            mainMessageField.placeholder = "Напишите сообщение...";
            sendBtn.style.display = 'block';
        }

        loadMessages();
        clearInterval(refreshInterval);
        refreshInterval = setInterval(loadMessages, 3000);
    }

    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', () => {
            if (appContainer) appContainer.classList.remove('show-chat');
            clearInterval(refreshInterval);
            activeChatTarget = null;
        });
    }

    function loadMessages() {
        if (!activeChatTarget || !messagesScreen) return;
        const url = SUPABASE_MSG_URL + "?chat_type=eq." + currentChatType + "&receiver=eq." + encodeURIComponent(activeChatTarget) + "&order=created_at.asc";

        fetch(url, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(messages => {
            const existingBubbles = messagesScreen.querySelectorAll('.msg-bubble');
            existingBubbles.forEach(b => b.remove());

            if (messages && Array.isArray(messages)) {
                messages.forEach(msg => {
                    const bubble = document.createElement('div');
                    bubble.className = msg.sender === currentActiveUser ? 'msg-bubble outgoing' : 'msg-bubble incoming';
                    
                    let senderTag = '';
                    if (currentChatType !== 'contact') {
                        senderTag = '<strong style="display:block;font-size:11px;color:var(--primary-color);margin-bottom:2px;">' + msg.sender + ':</strong>';
                    }
                    bubble.innerHTML = senderTag + msg.text;
                    messagesScreen.appendChild(bubble);
                });
            }
            messagesScreen.scrollTop = messagesScreen.scrollHeight;
        });
    }

    function handleSendMessage() {
        if (!mainMessageField || !activeChatTarget) return;
        const textMessage = mainMessageField.value.trim();
        if (textMessage.length === 0) return;

        fetch(SUPABASE_MSG_URL, {
            method: "POST",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
            body: JSON.stringify({ sender: currentActiveUser, receiver: activeChatTarget, text: textMessage, type: "text", chat_type: currentChatType, created_at: new Date().toISOString() })
        })
        .then(() => { mainMessageField.value = ""; loadMessages(); });
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
    if (mainMessageField) mainMessageField.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSendMessage(); });

    loadChats();
});
