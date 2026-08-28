document.addEventListener('DOMContentLoaded', function() {

    // --- ЗАПРОС РАЗРЕШЕНИЯ НА СИСТЕМНЫЕ УВЕДОМЛЕНИЯ ---
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            Notification.requestPermission();
        }
    }

    // =======================================================
    // ☀️ НАСТРОЙКИ ТВОЕГО СЕРВЕРА "ПОСЛАННИК-ЛЕТО"
    // =======================================================
    const MY_SUPABASE_URL = "https://rvmtghettsndnnhdeasx.supabase.co"; 
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 

    // Сборка сетевых адресов через надежное сложение строк
    const SUPABASE_MSG_URL   = MY_SUPABASE_URL + "/rest/v1/messages";
    const SUPABASE_ROOMS_URL = MY_SUPABASE_URL + "/rest/v1/rooms";

    // Состояние приложения
    let currentChatType = 'contact';
    let activeChatTarget = null;
    let refreshInterval = null;
    let activeChatCreator = null; 
    let lastMessagesCount = 0;

    // Читаем текущего пользователя из хранилища
    const currentActiveUser = localStorage.getItem('leto_active_user');

    // Если пользователь не залогинен — принудительно возвращаем на вход
    if (!currentActiveUser) {
        window.location.href = "index.html";
        return;
    }

    // Элементы интерфейса страницы мессенджера
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

    // Элементы всплывающего окна создания группы/канала
    const createRoomModal      = document.getElementById('create-room-modal');
    const modalTitle           = document.getElementById('modal-title');
    const modalRoomName        = document.getElementById('modal-room-name');
    const modalRoomDesc        = document.getElementById('modal-room-desc');
    const modalRoomAvatar      = document.getElementById('modal-room-avatar');
    const modalCancelBtn       = document.getElementById('modal-cancel-btn');
    const modalSubmitBtn       = document.getElementById('modal-submit-btn');

    // Выводим имя текущего аккаунта
    if (activeUsernameEl) {
        activeUsernameEl.textContent = currentActiveUser;
    }

    // --- ЛОГИКА ЗАГРУЗКИ СПИСКОВ С СЕРВЕРА (FETCH) ---
    function loadChats() {
        if (!chatsListTarget) return;

        if (currentChatType === 'contact') {
            const url = SUPABASE_MSG_URL + "?chat_type=eq.contact&or=(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + ")";
            
            fetch(url, {
                method: "GET",
                headers: {
                    "apikey": MY_SERVER_KEY,
                    "Authorization": "Bearer " + MY_SERVER_KEY
                }
            })
            .then(function(res) {
                if (!res.ok) throw new Error("Не удалось загрузить сообщения.");
                return res.json();
            })
            .then(function(messages) {
                chatsListTarget.innerHTML = "";
                
                if (messages.length === 0) {
                    chatsListTarget.innerHTML = '<div class="status-message">Список контактов пуст</div>';
                    return;
                }
                
                const uniqueChatNames = new Set();
                messages.forEach(function(msg) {
                    if (msg.sender === currentActiveUser) {
                        uniqueChatNames.add(msg.receiver);
                    } else {
                        uniqueChatNames.add(msg.sender);
                    }
                });
                
                uniqueChatNames.forEach(function(chatName) {
                    renderChatCard(chatName, "Личный диалог", "", "");
                });
            })
            .catch(function() {
                chatsListTarget.innerHTML = '<div class="status-message">Список контактов пуст</div>';
            });

        } else {
            const url = SUPABASE_ROOMS_URL + "?type=eq." + currentChatType + "&order=created_at.desc";
            
            fetch(url, {
                method: "GET",
                headers: {
                    "apikey": MY_SERVER_KEY,
                    "Authorization": "Bearer " + MY_SERVER_KEY
                }
            })
            .then(function(res) {
                if (!res.ok) throw new Error("Не удалось получить список комнат.");
                return res.json();
            })
            .then(function(rooms) {
                chatsListTarget.innerHTML = "";
                
                if (rooms.length === 0) {
                    chatsListTarget.innerHTML = '<div class="status-message">Ничего не найдено</div>';
                    return;
                }
                
                rooms.forEach(function(room) {
                    renderChatCard(room.name, room.description || "Нет описания", room.avatar_url, room.creator);
                });
            })
            .catch(function() {
                chatsListTarget.innerHTML = '<div class="status-message">Список или ничего не найдено</div>';
            });
        }
    }

    // Генерация HTML-карточки диалога с галочкой верификации
    function renderChatCard(name, subtitle, avatarUrl, creatorName) {
        const card = document.createElement('div');
        card.className = 'chat-card';
        if (activeChatTarget === name) {
            card.classList.add('active');
        }

        let avatarStyle = '';
        if (avatarUrl) {
            avatarStyle = "background-image: url('" + avatarUrl + "'); background-size: cover; background-position: center;";
        }

        const isVerified = (name.toLowerCase() === 'алексей');
        const verifiedTag = isVerified ? '<span class="verified-badge" title="Подтвержденный аккаунт">☑️</span>' : '';

        card.innerHTML = `
            <div class="user-avatar small" style="${avatarStyle}"></div>
            <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
                <span class="user-display-name" style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${name}${verifiedTag}
                </span>
                <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">${subtitle}</span>
            </div>
        `;

        card.addEventListener('click', function() {
            activeChatCreator = creatorName; 
            openChatWorkspace(name);
        });
        
        chatsListTarget.appendChild(card);
    }

    // Переключение кнопок-вкладок (Фильтры)
    filterButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            filterButtons.forEach(function(b) { b.classList.remove('active'); });
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

    // ЛОГИКА НАЖАТИЯ НА ГЛАВНУЮ КНОПКУ ДЕЙСТВИЯ
    mainDynamicActionBtn.addEventListener('click', function() {
        if (currentChatType === 'contact') {
            const targetUsername = prompt("Введите точный юзернейм пользователя ЛЕТО:");
            if (!targetUsername) return;
            
            const trimmedName = targetUsername.trim().toLowerCase();
            if (trimmedName === currentActiveUser) {
                alert("Нельзя добавить самого себя.");
                return;
            }

            const checkUrl = MY_SUPABASE_URL + "/rest/v1/user?username=eq." + encodeURIComponent(trimmedName);
            
            fetch(checkUrl, {
                method: "GET",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
            })
            .then(function(res) {
                if (!res.ok) throw new Error("Ошибка при проверке аккаунта.");
                return res.json();
            })
            .then(function(users) {
                if (users.length === 0) { 
                    alert("Пользователь не найден в системе."); 
                    return; 
                }
                
                return fetch(SUPABASE_MSG_URL, {
                    method: "POST",
                    headers: {
                        "apikey": MY_SERVER_KEY,
                        "Authorization": "Bearer " + MY_SERVER_KEY,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        sender: currentActiveUser,
                        receiver: trimmedName,
                        text: "👋 Контакт добавлен в систему.",
                        type: "text",
                        chat_type: "contact",
                        created_at: new Date().toISOString()
                    })
                });
            })
            .then(function(res) { 
                if (res && res.ok) {
                    loadChats(); 
                    openChatWorkspace(trimmedName); 
                }
            })
            .catch(function(err) { alert("Ошибка: " + err.message); });

        } else {
            modalTitle.textContent = currentChatType === 'group' ? "Создание новой группы" : "Создание нового канала";
            modalRoomName.value = ""; 
            modalRoomDesc.value = ""; 
            modalRoomAvatar.value = "";
            createRoomModal.style.display = 'flex';
        }
    });

    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', function() {
            createRoomModal.style.display = 'none';
        });
    }

    modalSubmitBtn.addEventListener('click', function() {
        const roomName = modalRoomName.value.trim();
        const roomDesc = modalRoomDesc.value.trim();
        const avatarFiles = modalRoomAvatar.files;

        if (roomName.length === 0) return;

        if (avatarFiles && avatarFiles.length > 0) {
            const file = avatarFiles[0]; 
            const fileExt = file.name.split('.').pop();
            const fileName = "room_" + Date.now() + "." + fileExt;
            const uploadUrl = MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName;

            fetch(uploadUrl, {
                method: "POST",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": file.type },
                body: file
            })
            .then(function(res) {
                if (!res.ok) throw new Error("Не удалось загрузить файл.");
                return res.json();
            })
            .then(function() {
                const fullAvatarUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
                saveNewRoom(roomName, roomDesc, fullAvatarUrl);
            })
            .catch(function(err) { alert("Ошибка загрузки аватарки: " + err.message); });
        } else {
            saveNewRoom(roomName, roomDesc, "");
        }
    });

    function saveNewRoom(name, desc, avatarUrl) {
        fetch(SUPABASE_ROOMS_URL, {
            method: "POST",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name,
                description: desc,
                avatar_url: avatarUrl,
                type: currentChatType,
                creator: currentActiveUser
            })
        })
        .then(function(res) {
            if (!res.ok) throw new Error("Это название уже занято!");
            createRoomModal.style.display = 'none';
            loadChats(); 
            openChatWorkspace(name);
        })
        .catch(function(err) { alert(err.message); });
    }

    // ТЕЛЕГРАМ-ЛОГИКА: Открытие чата с защитой прав по сообщениям + Исключение для группы "Лето"
    function openChatWorkspace(chatName) {
        activeChatTarget = chatName;
        clearInterval(refreshInterval);

        // Старый статус стираем
        const oldStatus = chatHeader ? chatHeader.querySelector('.user-status-text') : null;
        if (oldStatus) oldStatus.remove();

        if (currentChatType === 'contact') {
            proceedOpeningWorkspace(chatName);
            renderOnlineStatus(chatName);
            return;
        }

        if (chatName.toLowerCase() === 'лето') {
            proceedOpeningWorkspace(chatName);
            return;
        }

        if (activeChatCreator === currentActiveUser) {
            proceedOpeningWorkspace(chatName);
            return;
        }

        const checkUrl = MY_SUPABASE_URL + "/rest/v1/messages?chat_type=eq." + currentChatType + "&receiver=eq." + encodeURIComponent(chatName) + "&order=created_at.asc";

        fetch(checkUrl, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(messages => {
            if (!messages || !Array.isArray(messages)) return;

            const expectedCommand = "/add_member:" + currentActiveUser.toLowerCase();
            const hasAccess = messages.some(msg => {
                const isInvited = (msg.sender === activeChatCreator && msg.text && msg.text.trim().toLowerCase() === expectedCommand);
                const alreadyHasMessages = (msg.sender === currentActiveUser);
                return isInvited || alreadyHasMessages;
            });

            if (!hasAccess) {
                if (fallbackNotice) {
                    fallbackNotice.textContent = "🔒 Вы не являетесь участником этой группы. Доступ запрещен, пока создатель не добавит вас.";
                    fallbackNotice.style.display = 'block';
                }
                if (chatHeader) chatHeader.style.display = 'none';
                if (inputZone) inputZone.style.display = 'none';
                if (messagesScreen) messagesScreen.innerHTML = ""; 
                return;
            }

            proceedOpeningWorkspace(chatName);
        })
        .catch(err => alert("Ошибка проверки прав: " + err.message));
    }

    function renderOnlineStatus(chatName) {
        if (!chatHeader) return;
        const statusEl = document.createElement('span');
        statusEl.className = 'user-status-text';
        statusEl.textContent = 'была недавно';
        chatHeader.querySelector('.active-chat-meta').appendChild(statusEl);

        const statusUrl = MY_SUPABASE_URL + "/rest/v1/messages?sender=eq." + encodeURIComponent(chatName) + "&order=created_at.desc&limit=1";
        fetch(statusUrl, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(lastMessages => {
            if (!lastMessages || lastMessages.length === 0) return;
            const lastSeenTime = new Date(lastMessages[0].created_at);
            const now = new Date();
            const diffMins = Math.floor((now - lastSeenTime) / 1000 / 60);

            if (diffMins < 5) {
                statusEl.textContent = '• в сети';
                statusEl.classList.add('online');
            } else if (diffMins < 60) {
                statusEl.textContent = 'была недавно';
            } else {
                statusEl.textContent = 'был(а) в сети в ' + lastSeenTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        });
    }

    function proceedOpeningWorkspace(chatName) {
        if (fallbackNotice) fallbackNotice.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'flex';
        if (inputZone) inputZone.style.display = 'block';
        
        if (targetChatNameEl) {
            if (chatName.toLowerCase() === 'алексей') {
                targetChatNameEl.innerHTML = `${chatName}<span class="verified-badge" title="Подтвержденный аккаунт">☑️</span>`;
            } else {
                targetChatNameEl.textContent = chatName;
            }
        }

        if (appContainer) appContainer.classList.add('show-chat');

        // БАГФИКС: Полная изоляция кнопок скрепки/микрофона на чужих каналах
        const containerZone = document.getElementById('input-zone');
        let clipBtn = containerZone ? Array.from(containerZone.querySelectorAll('.icon-btn, .tool-btn, button')).find(el => el.textContent.includes('📎')) : null;
        let micBtn = containerZone ? Array.from(containerZone.querySelectorAll('.icon-btn, .tool-btn, button')).find(el => el.textContent.includes('🎤') || el.textContent.includes('🛑')) : null;

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

        loadMessages();
        refreshInterval = setInterval(loadMessages, 3000);
    }

    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', function() {
            if (appContainer) appContainer.classList.remove('show-chat');
            clearInterval(refreshInterval);
            activeChatTarget = null;
        });
    }

    function handleSendMessage() {
        if (!mainMessageField || !activeChatTarget) return;
        
        const textMessage = mainMessageField.value.trim();
        if (textMessage.length === 0) return;

        fetch(SUPABASE_MSG_URL, {
            method: "POST",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
            body: JSON.stringify({
                sender: currentActiveUser,
                receiver: activeChatTarget,
                text: textMessage,
                type: "text",
                chat_type: currentChatType,
                created_at: new Date().toISOString()
            })
        })
        .then(function() {
            mainMessageField.value = ""; 
            loadMessages();
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
    if (mainMessageField) {
        mainMessageField.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') handleSendMessage();
        });
    }

    // МЕДИАФАЙЛЫ И ГОЛОС
    let mediaFileInput = document.getElementById('media-file-input') || document.createElement('input');
    if (!mediaFileInput.id) {
        mediaFileInput.id = 'media-file-input';
        mediaFileInput.type = 'file';
        mediaFileInput.accept = 'image/*,application/pdf,video/*'; 
        mediaFileInput.style.display = 'none';
        document.body.appendChild(mediaFileInput);
    }

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    if (mainMessageField) {
        mainMessageField.addEventListener('click', e => e.stopPropagation());
        mainMessageField.addEventListener('focus', e => e.stopPropagation());
    }

    const containerZone = document.getElementById('input-zone');
    if (containerZone) {
        const clipBtn = Array.from(containerZone.querySelectorAll('.icon-btn, .tool-btn, button')).find(el => el.textContent.includes('📎'));
        if (clipBtn) {
            clipBtn.style.cursor = 'pointer';
            clipBtn.addEventListener('click', function(e) {
                e.preventDefault(); e.stopPropagation();
                if (!activeChatTarget) { alert("Выберите чат для отправки файла"); return; }
                mediaFileInput.click();
            });
        }

        const micBtn = Array.from(containerZone.querySelectorAll('.icon-btn, .tool-btn, button')).find(el => el.textContent.includes('🎤') || el.textContent.includes('🛑'));
        if (micBtn) {
            micBtn.style.cursor = 'pointer';
            micBtn.addEventListener('click', function(e) {
                e.preventDefault(); e.stopPropagation();
                if (!activeChatTarget) { alert("Выберите чат для записи"); return; }

                if (!isRecording) {
                    navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(function(stream) {
                        mediaRecorder = new MediaRecorder(stream);
                        audioChunks = [];
                        mediaRecorder.addEventListener("dataavailable", e => audioChunks.push(e.data));
                        mediaRecorder.addEventListener("stop", function() {
                            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                            const audioFileName = "voice_" + Date.now() + ".webm";
                            const uploadUrl = MY_SUPABASE_URL + "/storage/v1/object/media/" + audioFileName;

                            fetch(uploadUrl, {
                                method: "POST",
                                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "audio/webm" },
                                body: audioBlob
                            })
                            .then(res => { if (!res.ok) throw new Error("Ошибка записи."); return res.json(); })
                            .then(() => {
                                const fullAudioUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + audioFileName;
                                return fetch(SUPABASE_MSG_URL, {
                                    method: "POST",
                                    headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        sender: currentActiveUser, receiver: activeChatTarget, text: fullAudioUrl, type: "voice", chat_type: currentChatType, created_at: new Date().toISOString()
                                    })
                                });
                            })
                            .then(() => { lastMessagesCount = 0; loadMessages(); })
                            .catch(err => alert(err.message));
                            stream.getTracks().forEach(track => track.stop());
                        });
                        mediaRecorder.start();
                        isRecording = true;
                        micBtn.style.color = "red"; micBtn.textContent = "🛑";  
                    });
                } else {
                    if (mediaRecorder) mediaRecorder.stop();
                    isRecording = false;
                    micBtn.style.color = ""; micBtn.textContent = "🎤"; 
                }
            });
        }
    }

    mediaFileInput.addEventListener('change', function() {
        if (this.files.length === 0) return;
        const file = this.files[0]; 
        const fileExt = file.name.split('.').pop();
        const fileName = "chat_" + Date.now() + "." + fileExt;
        const uploadUrl = MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName;

        fetch(uploadUrl, {
            method: "POST",
            headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": file.type },
            body: file
        })
        .then(res => { if (!res.ok) throw new Error("Ошибка загрузки."); return res.json(); })
        .then(() => {
            const fullFileUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
            const msgType = file.type.startsWith('image/') ? "image" : "file";
            return fetch(SUPABASE_MSG_URL, {
                method: "POST",
                headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: currentActiveUser, receiver: activeChatTarget, text: fullFileUrl, type: msgType, chat_type: currentChatType, created_at: new Date().toISOString()
                })
            });
        })
        .then(() => { lastMessagesCount = 0; loadMessages(); });
        this.value = ""; 
    });

    // УМНОЕ ЧТЕНИЕ С ГАЛОЧКАМИ И СИСТЕМНЫМИ ПУШАМИ
    function loadMessages() {
        if (!activeChatTarget || !messagesScreen) return;
        
        let url = MY_SUPABASE_URL + "/rest/v1/messages?chat_type=eq." + currentChatType + "&order=created_at.asc";
        if (currentChatType === 'contact') {
            url += "&or=(and(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(activeChatTarget) + "),and(sender.eq." + encodeURIComponent(activeChatTarget) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + "))";
        } else {
            url += "&receiver=eq." + encodeURIComponent(activeChatTarget);
        }

        let opponentLastActiveTime = new Date(0);
        const activeCheckUrl = MY_SUPABASE_URL + "/rest/v1/messages?sender=eq." + encodeURIComponent(activeChatTarget) + "&order=created_at.desc&limit=1";

        fetch(activeCheckUrl, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(lastAction => {
            if (lastAction && lastAction.length > 0) opponentLastActiveTime = new Date(lastAction[0].created_at);
            return fetch(url, { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } });
        })
        .then(res => res.json())
        .then(messages => {
            if (!messages || !Array.isArray(messages)) return;

            // СИСТЕМНЫЕ УВЕДОМЛЕНИЯ ПРИ СВЕРНУТОМ ОКНЕ
            if (messages.length > lastMessagesCount) {
                if (lastMessagesCount > 0) {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage.sender !== currentActiveUser && document.hidden && window.Notification && Notification.permission === "granted") {
                        let text = lastMessage.text;
                        if (lastMessage.type === 'image') text = "📷 Фото";
                        if (lastMessage.type === 'voice') text = "🎤 Голосовое";
                        if (lastMessage.type === 'file') text = "📂 Файл";
                        new Notification("Лето Мессенджер", { body: "@" + lastMessage.sender + ": " + text, tag: "leto_msg" });
                    }
                }
            }

            if (messages.length === lastMessagesCount) return; 
            lastMessagesCount = messages.length;

            const isUserAtBottom = (messagesScreen.scrollHeight - messagesScreen.scrollTop - messagesScreen.clientHeight) < 50;
            messagesScreen.querySelectorAll('.msg-bubble').forEach(b => b.remove());

            messages.forEach(msg => {
                if (msg.text && msg.text.startsWith('/add_member:')) return; 

                const bubble = document.createElement('div');
                const isMyMessage = msg.sender === currentActiveUser;
                bubble.className = isMyMessage ? 'msg-bubble outgoing' : 'msg-bubble incoming';
                
                let senderTag = '';
                if (currentChatType !== 'contact') {
                    senderTag = '<strong style="display:block;font-size:11px;color:var(--primary-color);margin-bottom:2px;">' + msg.sender + ':</strong>';
                }
                
                let msgDate = new Date(msg.created_at || Date.now());
                let timeString = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let ticksHTML = '';
                if (isMyMessage) {
                    if (currentChatType === 'contact' && opponentLastActiveTime > msgDate) {
                        ticksHTML = '<span class="read-ticks double" title="Прочитано">✓✓</span>';
                    } else {
                        ticksHTML = '<span class="read-ticks" title="Доставлено">✓</span>';
                    }
                }

                const statusContainerHTML = `<div class="msg-status-container"><span>${timeString}</span>${ticksHTML}</div>`;

                let contentHTML = '';
                if (msg.type === 'image') {
                    contentHTML = `<div class="msg-media-wrapper"><a href="${msg.text}" target="_blank"><img src="${msg.text}"></a>${statusContainerHTML}</div>`;
                } else if (msg.type === 'voice') {
                    contentHTML = `<div class="msg-text-wrapper" style="display:flex;align-items:flex-end;gap:8px;"><audio controls src="${msg.text}"></audio>${statusContainerHTML}</div>`;
                } else if (msg.type === 'file') {
                    contentHTML = `<div class="msg-text-wrapper"><a href="${msg.text}" target="_blank" style="color:var(--primary-color);font-weight:600;text-decoration:underline;">📂 Скачать файл</a>${statusContainerHTML}</div>`;
                } else {
                    contentHTML = `<div class="msg-text-wrapper">${statusContainerHTML}<span>${msg.text}</span></div>`;
                }

                bubble.innerHTML = senderTag + contentHTML;

                // СИСТЕМА МОДЕРАЦИИ И УДАЛЕНИЯ СООБЩЕНИЙ
                const iAmRoomCreator = (currentChatType !== 'contact' && activeChatCreator === currentActiveUser);
                if ((isMyMessage && msg.type === 'text') || iAmRoomCreator) {
                    const actionsMenu = document.createElement('div');
                    actionsMenu.className = 'msg-actions-menu';
                    let menuHTML = '';
                    if (isMyMessage && msg.type === 'text') menuHTML += `<span class="msg-action-link edit-trigger">Ред.</span>`;
                    if (isMyMessage || iAmRoomCreator) {
                        const deleteLabel = iAmRoomCreator && !isMyMessage ? "Уд. (Админ)" : "Уд.";
                        menuHTML += `<span class="msg-action-link delete delete-trigger">${deleteLabel}</span>`;
                    }
                    actionsMenu.innerHTML = menuHTML;

                    const editBtn = actionsMenu.querySelector('.edit-trigger');
                    if (editBtn) {
                        editBtn.addEventListener('click', e => {
                            e.stopPropagation();
                            const newText = prompt("Редактирование:", msg.text);
                            if (!newText || newText.trim() === msg.text) return;
                            fetch(MY_SUPABASE_URL + "/rest/v1/messages?id=eq." + msg.id, {
                                method: "PATCH", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
                                body: JSON.stringify({ text: newText.trim() })
                            }).then(() => { lastMessagesCount = 0; loadMessages(); });
                        });
                    }

                    const deleteBtn = actionsMenu.querySelector('.delete-trigger');
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', e => {
                            e.stopPropagation();
                            if (!confirm("Удалить сообщение?")) return;
                            fetch(MY_SUPABASE_URL + "/rest/v1/messages?id=eq." + msg.id, {
                                method: "DELETE", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY }
                            }).then(() => { lastMessagesCount = 0; loadMessages(); });
                        });
                    }
                    bubble.appendChild(actionsMenu);
                }

                messagesScreen.appendChild(bubble);
            });

            if (isUserAtBottom || existingBubbles.length === 0) {
                messagesScreen.scrollTop = messagesScreen.scrollHeight;
            }
        });
    }

    const originalOpenChatWorkspace = openChatWorkspace;
    openChatWorkspace = function(chatName) {
        lastMessagesCount = 0; 
        originalOpenChatWorkspace(chatName);
    };

    // ФУНКЦИЯ ДОБАВЛЕНИЯ ЧЛЕНОВ ДЛЯ СТРАНИЦЫ НАСТРОЕК
    window.letoAddUserToRoom = function(roomName, usernameToAdd) {
        if (activeChatCreator !== currentActiveUser) { alert("Только создатель может добавлять участников!"); return; }
        const trimmedUser = usernameToAdd.trim().toLowerCase();
        if (!trimmedUser) return;

        fetch(MY_SUPABASE_URL + "/rest/v1/user?username=eq." + encodeURIComponent(trimmedUser), { method: "GET", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY } })
        .then(res => res.json())
        .then(users => {
            if (!users || users.length === 0) throw new Error("Пользователь не найден.");
            return fetch(SUPABASE_MSG_URL, {
                method: "POST", headers: { "apikey": MY_SERVER_KEY, "Authorization": "Bearer " + MY_SERVER_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ sender: currentActiveUser, receiver: roomName, text: "/add_member:" + trimmedUser, type: "text", chat_type: currentChatType, created_at: new Date().toISOString() })
            });
        })
        .then(() => alert(`Пользователь @${trimmedUser} успешно добавлен!`))
        .catch(err => alert(err.message));
    };

    loadChats();
});