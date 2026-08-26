document.addEventListener('DOMContentLoaded', function() {

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
            // Запрос истории личных сообщений
            const url = SUPABASE_MSG_URL + "?chat_type=eq.contact&or=(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + ")";
            
            fetch(url, {
                method: "GET",
                headers: {
                    "apikey": MY_SERVER_KEY,
                    "Authorization": "Bearer " + MY_SERVER_KEY
                }
            })
            .then(function(res) {
                if (!res.ok) {
                    throw new Error("Не удалось загрузить сообщения.");
                }
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
            // Запрос списка публичных Групп или Каналов
            const url = SUPABASE_ROOMS_URL + "?type=eq." + currentChatType + "&order=created_at.desc";
            
            fetch(url, {
                method: "GET",
                headers: {
                    "apikey": MY_SERVER_KEY,
                    "Authorization": "Bearer " + MY_SERVER_KEY
                }
            })
            .then(function(res) {
                if (!res.ok) {
                    throw new Error("Не удалось получить список комнат.");
                }
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

    // Генерация HTML-карточки диалога
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

        card.innerHTML = `
            <div class="user-avatar small" style="${avatarStyle}"></div>
            <div style="display: flex; flex-direction: column;">
                <span class="user-display-name" style="font-weight:600;">${name}</span>
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
            filterButtons.forEach(function(b) {
                b.classList.remove('active');
            });
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
    // --- ЛОГИКА НАЖАТИЯ НА ГЛАВНУЮ КНОПКУ ДЕЙСТВИЯ ---
    mainDynamicActionBtn.addEventListener('click', function() {
        if (currentChatType === 'contact') {
            const targetUsername = prompt("Введите точный юзернейм пользователя ЛЕТО:");
            if (!targetUsername) return;
            
            const trimmedName = targetUsername.trim().toLowerCase();
            if (trimmedName === currentActiveUser) {
                alert("Нельзя добавить самого себя.");
                return;
            }

            // Точный путь проверки пользователя на твоем сервере
            const checkUrl = MY_SUPABASE_URL + "/rest/v1/user?username=eq." + encodeURIComponent(trimmedName);
            
            fetch(checkUrl, {
                method: "GET",
                headers: {
                    "apikey": MY_SERVER_KEY,
                    "Authorization": "Bearer " + MY_SERVER_KEY
                }
            })
            .then(function(res) {
                if (!res.ok) {
                    throw new Error("Ошибка при проверке аккаунта.");
                }
                return res.json();
            })
            .then(function(users) {
                if (users.length === 0) { 
                    alert("Пользователь не найден в системе."); 
                    return; 
                }
                
                // Шлем стартовое сообщение-инициализатор диалога
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
            .catch(function(err) {
                alert("Ошибка: " + err.message);
            });

        } else {
            // Открываем модальное окно для групп и каналов
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

    // Обработка кнопки "Создать" во всплывающем окне
    modalSubmitBtn.addEventListener('click', function() {
        const roomName = modalRoomName.value.trim();
        const roomDesc = modalRoomDesc.value.trim();
        const avatarFiles = modalRoomAvatar.files;

        if (roomName.length === 0) return;

        if (avatarFiles && avatarFiles.length > 0) {
            const file = avatarFiles[0]; 
            const fileExt = file.name.split('.').pop();
            const fileName = "room_" + Date.now() + "." + fileExt;
            
            // Загрузка аватарки в твой личный бакет Storage
            const uploadUrl = MY_SUPABASE_URL + "/storage/v1/object/media/" + fileName;

            fetch(uploadUrl, {
                method: "POST",
                headers: {
                    "apikey": MY_SERVER_KEY,
                    "Authorization": "Bearer " + MY_SERVER_KEY,
                    "Content-Type": file.type
                },
                body: file
            })
            .then(function(res) {
                if (!res.ok) {
                    throw new Error("Не удалось загрузить файл.");
                }
                return res.json();
            })
            .then(function() {
                const fullAvatarUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
                saveNewRoom(roomName, roomDesc, fullAvatarUrl);
            })
            .catch(function(err) {
                alert("Ошибка загрузки аватарки: " + err.message);
            });
        } else {
            saveNewRoom(roomName, roomDesc, "");
        }
    });

    function saveNewRoom(name, desc, avatarUrl) {
        fetch(SUPABASE_ROOMS_URL, {
            method: "POST",
            headers: {
                "apikey": MY_SERVER_KEY,
                "Authorization": "Bearer " + MY_SERVER_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                description: desc,
                avatar_url: avatarUrl,
                type: currentChatType,
                creator: currentActiveUser
            })
        })
        .then(function(res) {
            if (!res.ok) {
                throw new Error("Это название уже занято!");
            }
            createRoomModal.style.display = 'none';
            loadChats(); 
            openChatWorkspace(name);
        })
        .catch(function(err) {
            alert(err.message);
        });
    }

    // --- ЛОГИКА ОТКРЫТИЯ ОКНА ТЕКУЩЕЙ ПЕРЕПИСКИ ---
    function openChatWorkspace(chatName) {
        activeChatTarget = chatName;

        if (fallbackNotice) fallbackNotice.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'flex';
        if (inputZone) inputZone.style.display = 'block';
        if (targetChatNameEl) targetChatNameEl.textContent = chatName;

        if (appContainer) appContainer.classList.add('show-chat');

        // Ограничение прав для обычных участников на каналах
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
        refreshInterval = setInterval(function() {
            loadMessages();
        }, 3000);
    }

    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', function() {
            if (appContainer) appContainer.classList.remove('show-chat');
            clearInterval(refreshInterval);
            activeChatTarget = null;
        });
    }

    // Чтение сообщений активного диалога
    function loadMessages() {
        if (!activeChatTarget || !messagesScreen) return;
        
        const url = SUPABASE_MSG_URL + "?chat_type=eq." + currentChatType + "&receiver=eq." + encodeURIComponent(activeChatTarget) + "&order=created_at.asc";

        fetch(url, {
            method: "GET",
            headers: {
                "apikey": MY_SERVER_KEY,
                "Authorization": "Bearer " + MY_SERVER_KEY
            }
        })
        .then(function(res) {
            return res.json();
        })
        .then(function(messages) {
            const existingBubbles = messagesScreen.querySelectorAll('.msg-bubble');
            existingBubbles.forEach(function(b) {
                b.remove();
            });

            if (messages && Array.isArray(messages)) {
                messages.forEach(function(msg) {
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

    // Отправка нового сообщения
    function handleSendMessage() {
        if (!mainMessageField || !activeChatTarget) return;
        
        const textMessage = mainMessageField.value.trim();
        if (textMessage.length === 0) return;

        fetch(SUPABASE_MSG_URL, {
            method: "POST",
            headers: { 
                "apikey": MY_SERVER_KEY, 
                "Authorization": "Bearer " + MY_SERVER_KEY, 
                "Content-Type": "application/json", 
                "Prefer": "return=minimal" 
            },
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

    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            handleSendMessage();
        });
    }
    
    if (mainMessageField) {
        mainMessageField.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                handleSendMessage();
            }
        });
    }

    // Старт при первой загрузке страницы
    loadChats();
});
