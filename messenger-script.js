document.addEventListener('DOMContentLoaded', () => {

    // =======================================================
    // ☀️ НАСТРОЙКИ ТВОЕГО СЕРВЕРА "ПОСЛАННИК-ЛЕТО"
    // =======================================================
    const MY_SUPABASE_URL = "https://rvmtghettsndnnhdeasx.supabase.co"; 
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 
    // =======================================================

    // Сборка прямого пути для сообщений через встроенный fetch
    const SUPABASE_MSG_URL = `${MY_SUPABASE_URL}/rest/v1/messages`;

    let currentChatType = 'contact';
    let activeChatTarget = null;
    let refreshInterval = null;

    // Проверка авторизации пользователя
    const currentActiveUser = localStorage.getItem('leto_active_user');

    if (!currentActiveUser) {
        window.location.href = "index.html";
        return;
    }

    // Элементы интерфейса
    const activeUsernameEl = document.getElementById('active-username');
    const chatsListTarget  = document.getElementById('chats-list-target');
    const filterButtons    = document.querySelectorAll('.tab-btn');
    
    const chatHeader       = document.getElementById('active-chat-header');
    const targetChatNameEl = document.getElementById('target-chat-name');
    const messagesScreen   = document.getElementById('messages-screen');
    const fallbackNotice   = document.getElementById('fallback-notice');
    const inputZone        = document.getElementById('input-zone');
    
    const mainMessageField = document.getElementById('main-message-field');
    const sendBtn          = document.getElementById('send-btn');

    if (activeUsernameEl) {
        activeUsernameEl.textContent = currentActiveUser;
    }

    // --- ЛОГИКА ЗАГРУЗКИ СПИСКА ЧАТОВ ЧЕРЕЗ FETCH ---
    function loadChats() {
        if (!chatsListTarget) return;

        const url = `${SUPABASE_MSG_URL}?chat_type=eq.${currentChatType}&or=(sender.eq.${currentActiveUser},receiver.eq.${currentActiveUser})`;

        fetch(url, {
            method: "GET",
            headers: {
                "apikey": MY_SERVER_KEY,
                "Authorization": `Bearer ${MY_SERVER_KEY}`
            }
        })
        .then(res => {
            if (!res.ok) {
                throw new Error("Не удалось загрузить список чатов с сервера.");
            }
            return res.json();
        })
        .then(messages => {
            chatsListTarget.innerHTML = "";

            if (messages.length === 0) {
                chatsListTarget.innerHTML = `<div class="status-message">Список или ничего не найдено</div>`;
                return;
            }

            const uniqueChatNames = new Set();
            messages.forEach(msg => {
                if (msg.sender === currentActiveUser) {
                    uniqueChatNames.add(msg.receiver);
                } else {
                    uniqueChatNames.add(msg.sender);
                }
            });

            uniqueChatNames.forEach(chatName => {
                const card = document.createElement('div');
                card.className = 'chat-card';
                if (activeChatTarget === chatName) {
                    card.classList.add('active');
                }

                card.innerHTML = `
                    <div class="user-avatar small"></div>
                    <span class="user-display-name">${chatName}</span>
                `;

                card.addEventListener('click', () => {
                    openChatWorkspace(chatName);
                });

                chatsListTarget.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Ошибка сети Лето: " + error.message);
            chatsListTarget.innerHTML = `<div class="status-message">Список или ничего не найдено</div>`;
        });
    }

    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            currentChatType = e.target.getAttribute('data-type');
            loadChats();
        });
    });
    // --- ЛОГИКА АКТИВАЦИИ РАБОЧЕЙ ОБЛАСТИ ЧАТА ---
    function openChatWorkspace(chatName) {
        activeChatTarget = chatName;

        if (fallbackNotice) fallbackNotice.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'flex';
        if (inputZone) inputZone.style.display = 'block';
        if (targetChatNameEl) targetChatNameEl.textContent = chatName;

        document.querySelectorAll('.chat-card').forEach(card => {
            const nameSpan = card.querySelector('.user-display-name');
            if (nameSpan && nameSpan.textContent === chatName) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        loadMessages();

        clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            loadMessages();
        }, 3000);
    }

    // --- ЛОГИКА ЧТЕНИЯ СООБЩЕНИЙ С СЕРВЕРА ЧЕРЕЗ FETCH ---
    function loadMessages() {
        if (!activeChatTarget || !messagesScreen) return;

        const url = `${SUPABASE_MSG_URL}?chat_type=eq.${currentChatType}&or=(and(sender.eq.${currentActiveUser},receiver.eq.${activeChatTarget}),and(sender.eq.${activeChatTarget},receiver.eq.${currentActiveUser}))&order=created_at.asc`;

        fetch(url, {
            method: "GET",
            headers: {
                "apikey": MY_SERVER_KEY,
                "Authorization": `Bearer ${MY_SERVER_KEY}`
            }
        })
        .then(res => {
            if (!res.ok) {
                throw new Error("Не удалось получить сообщения с сервера.");
            }
            return res.json();
        })
        .then(messages => {
            const existingBubbles = messagesScreen.querySelectorAll('.msg-bubble');
            existingBubbles.forEach(b => b.remove());

            messages.forEach(msg => {
                const bubble = document.createElement('div');
                
                if (msg.sender === currentActiveUser) {
                    bubble.className = 'msg-bubble outgoing';
                } else {
                    bubble.className = 'msg-bubble incoming';
                }

                bubble.textContent = msg.text;
                messagesScreen.appendChild(bubble);
            });

            messagesScreen.scrollTop = messagesScreen.scrollHeight;
        })
        .catch(error => {
            console.error("Ошибка обновления истории: " + error.message);
        });
    }

    // --- ЛОГИКА ОТПРАВКИ СООБЩЕНИЯ НА СЕРВЕР ЧЕРЕЗ FETCH ---
    function handleSendMessage() {
        if (!mainMessageField || !activeChatTarget) return;

        const textMessage = mainMessageField.value.trim();
        if (textMessage.length === 0) return;

        fetch(SUPABASE_MSG_URL, {
            method: "POST",
            headers: {
                "apikey": MY_SERVER_KEY,
                "Authorization": `Bearer ${MY_SERVER_KEY}`,
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
        .then(response => {
            if (!response.ok) {
                throw new Error("Не удалось сохранить сообщение на сервере.");
            }

            mainMessageField.value = "";
            loadMessages();
            loadChats();
        })
        .catch(error => {
            console.error("Ошибка при отправке: " + error.message);
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            handleSendMessage();
        });
    }

    if (mainMessageField) {
        mainMessageField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSendMessage();
            }
        });
    }

    loadChats();

});
