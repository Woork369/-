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
            // ТВОЙ ОРИГИНАЛЬНЫЙ ЗАПРОС КОНТАКТОВ
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
            // ТВОЙ ОРИГИНАЛЬНЫЙ ЗАПРОС ГРУПП И КАНАЛОВ
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
    // --- ЛОГИКА ОТКРЫТИЯ ОКНА ТЕКУ ПЕРЕПИСКИ ---
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

    // ТВОЯ ОРИГИНАЛЬНАЯ ОТПРАВКА ТЕКСТА (БЕЗ ИЗМЕНЕНИЙ)
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
            // --- РАБОТА С МЕДИАФАЙЛАМИ И ГОЛОСОВЫМИ СООБЩЕНИЯМИ ---

    let mediaFileInput = document.getElementById('media-file-input');
    if (!mediaFileInput) {
        mediaFileInput = document.createElement('input');
        mediaFileInput.id = 'media-file-input';
        mediaFileInput.type = 'file';
        mediaFileInput.accept = 'image/*,application/pdf,video/*'; 
        mediaFileInput.style.display = 'none';
        document.body.appendChild(mediaFileInput);
    }

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // ГЛАВНЫЙ ФИКС: Полная изоляция строки ввода от ложных срабатываний медиа-функций
    if (mainMessageField) {
        mainMessageField.addEventListener('click', function(e) {
            e.stopPropagation(); // Запрещаем клику всплывать на кнопки скрепки/микрофона
        });
        mainMessageField.addEventListener('focus', function(e) {
            e.stopPropagation(); // Запрещаем фокусу активировать запись
        });
    }

    const containerZone = document.getElementById('input-zone');
    if (containerZone) {
        // Ищем иконку скрепки ТОЛЬКО внутри круглых кнопок, полностью игнорируя строку ввода
        const clipBtn = Array.from(containerZone.querySelectorAll('.icon-btn, .tool-btn, button')).find(el => el.textContent.includes('📎'));
        if (clipBtn) {
            clipBtn.style.cursor = 'pointer';
            clipBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation(); // Изолируем клик на кнопке скрепки
                if (!activeChatTarget) {
                    alert("Выберите чат для отправки файла");
                    return;
                }
                mediaFileInput.click();
            });
        }

        // Ищем иконку микрофона ТОЛЬКО внутри кругвых кнопок, полностью игнорируя строку ввода
        const micBtn = Array.from(containerZone.querySelectorAll('.icon-btn, .tool-btn, button')).find(el => el.textContent.includes('🎤') || el.textContent.includes('🛑'));
        if (micBtn) {
            micBtn.style.cursor = 'pointer';
            micBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation(); // Изолируем клик на кнопке микрофона
                if (!activeChatTarget) {
                    alert("Выберите чат для записи");
                    return;
                }

                if (!isRecording) {
                    navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(function(stream) {
                        mediaRecorder = new MediaRecorder(stream);
                        audioChunks = [];

                        mediaRecorder.addEventListener("dataavailable", function(event) {
                            audioChunks.push(event.data);
                        });

                        mediaRecorder.addEventListener("stop", function() {
                            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                            const audioFileName = "voice_" + Date.now() + ".webm";
                            
                            // Загрузка аудио строго на ваш сервер Supabase
                            const uploadUrl = MY_SUPABASE_URL + "/storage/v1/object/media/" + audioFileName;

                            fetch(uploadUrl, {
                                method: "POST",
                                headers: {
                                    "apikey": MY_SERVER_KEY,
                                    "Authorization": "Bearer " + MY_SERVER_KEY,
                                    "Content-Type": "audio/webm"
                                },
                                body: audioBlob
                            })
                            .then(function(res) {
                                if (!res.ok) throw new Error("Ошибка записи голосового.");
                                return res.json();
                            })
                            .then(function() {
                                const fullAudioUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + audioFileName;

                                // Сохранение сообщения строго через ваш сервер Supabase
                                return fetch(MY_SUPABASE_URL + "/rest/v1/messages", {
                                    method: "POST",
                                    headers: { 
                                        "apikey": MY_SERVER_KEY, 
                                        "Authorization": "Bearer " + MY_SERVER_KEY, 
                                        "Content-Type": "application/json" 
                                    },
                                    body: JSON.stringify({
                                        sender: currentActiveUser,
                                        receiver: activeChatTarget,
                                        text: fullAudioUrl,
                                        type: "voice",
                                        chat_type: currentChatType,
                                        created_at: new Date().toISOString()
                                    })
                                });
                            })
                            .then(function() {
                                lastMessagesCount = 0; 
                                loadMessages();
                            })
                            .catch(function(err) {
                                alert("Ошибка аудио: " + err.message);
                            });

                            stream.getTracks().forEach(track => track.stop());
                        });

                        mediaRecorder.start();
                        isRecording = true;
                        micBtn.style.color = "red"; 
                        micBtn.textContent = "🛑";  
                    })
                    .catch(function(err) {
                        alert("Доступ к микрофону закрыт: " + err.message);
                    });
                } else {
                    if (mediaRecorder) mediaRecorder.stop();
                    isRecording = false;
                    micBtn.style.color = "";
                    micBtn.textContent = "🎤"; 
                }
            });
        }
    }

    mediaFileInput.addEventListener('change', function() {
        if (this.files.length === 0) return;
        const file = this.files[0]; 
        
        const fileExt = file.name.split('.').pop();
        const fileName = "chat_" + Date.now() + "." + fileExt;
        
        // Загрузка медиа строго на ваш сервер Supabase
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
            if (!res.ok) throw new Error("Ошибка загрузки хранилища.");
            return res.json();
        })
        .then(function() {
            const fullFileUrl = MY_SUPABASE_URL + "/storage/v1/object/public/media/" + fileName;
            const isImage = file.type.startsWith('image/');
            const msgType = isImage ? "image" : "file";

            // Отправка записи строго через ваш сервер Supabase
            return fetch(MY_SUPABASE_URL + "/rest/v1/messages", {
                method: "POST",
                headers: { 
                    "apikey": MY_SERVER_KEY, 
                    "Authorization": "Bearer " + MY_SERVER_KEY, 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({
                    sender: currentActiveUser,
                    receiver: activeChatTarget,
                    text: fullFileUrl, 
                    type: msgType,
                    chat_type: currentChatType,
                    created_at: new Date().toISOString()
                })
            });
        })
        .then(function() {
            lastMessagesCount = 0; 
            loadMessages(); 
        })
        .catch(function(err) {
            alert("Ошибка медиа: " + err.message);
        });
        
        this.value = ""; 
    });

    // УМНОЕ ЧТЕНИЕ СООБЩЕНИЙ: Использует ваш MY_SUPABASE_URL, держит скролл и защищает плеер голосовых
    function loadMessages() {
        if (!activeChatTarget || !messagesScreen) return;
        
        let url = MY_SUPABASE_URL + "/rest/v1/messages?chat_type=eq." + currentChatType + "&order=created_at.asc";
        
        if (currentChatType === 'contact') {
            url += "&or=(and(sender.eq." + encodeURIComponent(currentActiveUser) + ",receiver.eq." + encodeURIComponent(activeChatTarget) + "),and(sender.eq." + encodeURIComponent(activeChatTarget) + ",receiver.eq." + encodeURIComponent(currentActiveUser) + "))";
        } else {
            url += "&receiver=eq." + encodeURIComponent(activeChatTarget);
        }

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
            if (!messages || !Array.isArray(messages)) return;

            // ФИКС ГОЛОСОВЫХ: Если количество сообщений не изменилось, не стираем плееры со страницы
            if (messages.length === lastMessagesCount) {
                return; 
            }

            lastMessagesCount = messages.length;

            // Вычисляем положение скролла ДО обновления разметки
            const isUserAtBottom = (messagesScreen.scrollHeight - messagesScreen.scrollTop - messagesScreen.clientHeight) < 50;

            // Удаляем старые сообщения перед выводом обновленного списка
            const existingBubbles = messagesScreen.querySelectorAll('.msg-bubble');
            existingBubbles.forEach(function(b) { b.remove(); });

            // Перебираем массив сообщений и строим пузыри в чате
            messages.forEach(function(msg) {
                const bubble = document.createElement('div');
                bubble.className = msg.sender === currentActiveUser ? 'msg-bubble outgoing' : 'msg-bubble incoming';
                
                let senderTag = '';
                if (currentChatType !== 'contact') {
                    senderTag = '<strong style="display:block;font-size:11px;color:var(--primary-color);margin-bottom:2px;">' + msg.sender + ':</strong>';
                }
                
                let contentHTML = '';
                if (msg.type === 'image') {
                    contentHTML = `<a href="${msg.text}" target="_blank"><img src="${msg.text}" style="max-width:100%; max-height:250px; border-radius:12px; display:block; margin-top:4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"></a>`;
                } else if (msg.type === 'voice') {
                    contentHTML = `<audio controls src="${msg.text}" style="max-width:100%; display:block; margin-top:4px; height:34px;"></audio>`;
                } else if (msg.type === 'file') {
                    contentHTML = `<a href="${msg.text}" target="_blank" style="color:var(--primary-color); font-weight:600; text-decoration:underline; font-size:14px; display:inline-block; padding:4px 0;">📂 Скачать файл</a>`;
                } else {
                    contentHTML = msg.text;
                }

                bubble.innerHTML = senderTag + contentHTML;
                messagesScreen.appendChild(bubble);
            });

            // ФИКС ОПУСКАНИЯ ВНИЗ: Скроллим только если вы читали нижние сообщения
            if (isUserAtBottom || existingBubbles.length === 0) {
                messagesScreen.scrollTop = messagesScreen.scrollHeight;
            }
        });
    }

    // Принудительный сброс памяти количества сообщений при ручной смене чата пользователем
    const originalOpenChatWorkspace = openChatWorkspace;
    openChatWorkspace = function(chatName) {
        lastMessagesCount = 0; 
        originalOpenChatWorkspace(chatName);
    };

    // Запуск приложения и первичная загрузка списков
    loadChats();

});
