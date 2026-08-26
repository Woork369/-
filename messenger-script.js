document.addEventListener('DOMContentLoaded', () => {

    // =======================================================
    // ☀️ НАСТРОЙКИ СИНХРОНИЗАЦИИ ТВОЕГО СЕРВЕРА "ПОСЛАННИК-ЛЕТО"
    // =======================================================
    const MY_SUPABASE_URL = "https://supabase.co"; 
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 
    
    // Прямой URL-путь к твоей таблице сообщений
    const SUPABASE_MSG_URL = `${MY_SUPABASE_URL}/rest/v1/messages`;

    // СОСТОЯНИЕ ПРИЛОЖЕНИЯ (STATE)
    const currentActiveUser = localStorage.getItem('leto_active_user'); 
    let currentChatType = 'contact'; 
    let activeChatTarget = null;     
    let refreshInterval = null;      

    // Защита авторизации
    if (!currentActiveUser) {
        window.location.href = "index.html"; 
        return;
    }

    // ЭЛЕМЕНТЫ ИНТЕРФЕЙСА
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

    // Отображаем имя вошедшего пользователя
    activeUsernameEl.textContent = currentActiveUser;

    // ЗАГРУЗКА СПИСКА ЧАТОВ ЧЕРЕЗ ВСТРОЕННЫЙ FETCH
    function loadChats() {
        const url = `${SUPABASE_MSG_URL}?chat_type=eq.${currentChatType}&or=(sender.eq.${currentActiveUser},receiver.eq.${currentActiveUser})`;

        fetch(url, {
            method: "GET",
            headers: {
                "apikey": MY_SERVER_KEY,
                "Authorization": `Bearer ${MY_SERVER_KEY}`
            }
        })
        .then(res => {
            if (!res.ok) throw new Error("Ошибка сервера");
            return res.json();
        })
        .then(messages => {
            chatsListTarget.innerHTML = ""; 

            if (!messages || messages.length === 0) {
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
                if (activeChatTarget === chatName) card.classList.add('active');

                card.innerHTML = `
                    <div class="user-avatar small"></div>
                    <span class="user-display-name">${chatName}</span>
                `;

                card.addEventListener('click', () => openChatWorkspace(chatName));
                chatsListTarget.appendChild(card);
            });
        })
        .catch(err => {
            console.error("Ошибка при получении списка чатов:", err);
            chatsListTarget.innerHTML = `<div class="status-message">Ошибка соединения с Лето севером</div>`;
        });
    }

    // Переключение вкладок фильтров
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentChatType = e.target.getAttribute('data-type'); 
            loadChats(); 
        });
    });
    // ОТКРЫТИЕ РАБОЧЕЙ ОБЛАСТИ ЧАТА
    function openChatWorkspace(chatName) {
        activeChatTarget = chatName;

        if (fallbackNotice) fallbackNotice.style.display = 'none';
        chatHeader.style.display = 'flex';
        inputZone.style.display = 'block';
        targetChatNameEl.textContent = chatName;

        document.querySelectorAll('.chat-card').forEach(card => {
            if (card.querySelector('.user-display-name').textContent === chatName) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        loadMessages();

        // Поллинг обновлений сообщений раз в 3 секунды
        clearInterval(refreshInterval);
        refreshInterval = setInterval(loadMessages, 3000);
    }

    // ПОЛУЧЕНИЕ СООБЩЕНИЙ С СЕРВЕРА ЧЕРЕЗ FETCH
    function loadMessages() {
        if (!activeChatTarget) return;

        const url = `${SUPABASE_MSG_URL}?chat_type=eq.${currentChatType}&or=(and(sender.eq.${currentActiveUser},receiver.eq.${activeChatTarget}),and(sender.eq.${activeChatTarget},receiver.eq.${currentActiveUser}))&order=created_at.asc`;

        fetch(url, {
            method: "GET",
            headers: {
                "apikey": MY_SERVER_KEY,
                "Authorization": `Bearer ${MY_SERVER_KEY}`
            }
        })
        .then(res => res.json())
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
        .catch(err => console.error("Ошибка получения сообщений:", err));
    }

    // ОТПРАВКА НОВОГО СООБЩЕНИЯ ЧЕРЕЗ FETCH
    function handleSendMessage() {
        const text = mainMessageField.value.trim();
        if (!text || !activeChatTarget) return; 

        const payload = {
            sender: currentActiveUser,
            receiver: activeChatTarget,
            text: text,
            type: "text",
            chat_type: currentChatType,
            created_at: new Date().toISOString()
        };

        fetch(SUPABASE_MSG_URL, {
            method: "POST",
            headers: {
                "apikey": MY_SERVER_KEY,
                "Authorization": `Bearer ${MY_SERVER_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) throw new Error("Сервер отклонил сообщение");
            mainMessageField.value = ""; 
            loadMessages(); 
            loadChats();    
        })
        .catch(err => alert("Не удалось отправить: " + err.message));
    }

    // Слушатели интерактивных событий отправки
    sendBtn.addEventListener('click', handleSendMessage);
    mainMessageField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    // Автоматический старт при первом запуске
    loadChats(); 

});
