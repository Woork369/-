/**
 * ЛЕТО — МЕССЕНДЖЕР (Ядро логики интерфейса)
 */

// --- 1. ЗАЩИТА И ПРОВЕРКА АВТОРИЗАЦИИ ---
const activeUser = localStorage.getItem('leto_active_user');

// Если пользователь не авторизован — отправляем его на страницу входа
if (!activeUser) {
    window.location.href = "index.html"; // Укажи имя файла входа, если оно другое
}

// Форматируем никнейм для отображения в мессенджере
const CURRENT_USER = activeUser.startsWith("@") ? activeUser : "@" + activeUser; 

// --- 2. ГЛОБАЛЬНОЕ СОСТОЯНИЕ (STATE) ---
let state = {
    chats: [],         // Список сущностей: { id, name, type, status, creator }
    messages: {},      // История сообщений: { chatId: [ { sender, text, time, file: { name, type, url } } ] }
    activeChatId: null, // ID открытого в данный момент чата
    selectedFile: null  // Временный буфер для прикрепляемого файла
};

// --- 3. DOM ЭЛЕМЕНТЫ ---
const currentDisplay = document.getElementById("current-user-display");
const chatsListContainer = document.getElementById("chats-list");
const chatPanel = document.getElementById("chat-panel");
const chatMessagesContainer = document.getElementById("chat-messages");
const chatCurrentName = document.getElementById("chat-current-name");
const chatCurrentStatus = document.getElementById("chat-current-status");
const globalSearchInput = document.getElementById("global-search");

// Контролы шапки чата
const e2eeBadge = document.getElementById("e2ee-badge");
const channelSettingsBtn = document.getElementById("channel-settings-btn");
const backToListBtn = document.getElementById("back-to-list-btn");

// Форма ввода сообщений
const chatInputForm = document.getElementById("chat-input-form");
const messageTextInput = document.getElementById("message-text");
const fileAttachmentsInput = document.getElementById("file-attachments");
const attachBtn = document.getElementById("attach-btn");
const sendMessageBtn = document.getElementById("send-message-btn");

// Модальное окно №1 (Создание каналов/групп/контактов)
const customModal = document.getElementById("custom-modal");
const modalTitle = document.getElementById("modal-title");
const modalDescription = document.getElementById("modal-description");
const modalInput = document.getElementById("modal-input");
const modalError = document.getElementById("modal-error");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
let currentModalType = ""; 

// Модальное окно №2 (Предпросмотр файлов перед отправкой)
const fileModal = document.getElementById("file-modal");
const fileModalInfo = document.getElementById("file-modal-info");
const filePreviewZone = document.getElementById("file-preview-zone");
const fileCaptionInput = document.getElementById("file-caption-input");
const fileCancelBtn = document.getElementById("file-cancel-btn");
const fileSendBtn = document.getElementById("file-send-btn");

// Модальное окно №3 (Полноэкранный медиа-вьювер)
const mediaModal = document.getElementById("media-viewer-modal");
const viewerContent = document.getElementById("viewer-content");
const closeViewerBtn = document.getElementById("close-viewer-btn");


// --- 4. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ---
function initApp() {
    currentDisplay.textContent = CURRENT_USER;
    renderChatsList();
    setupEventListeners();
}


// --- 5. ОТРИСОВКА ИНТЕРФЕЙСА (RENDER) ---

// Вывод списка чатов в левую панель
function renderChatsList(filterQuery = "") {
    chatsListContainer.innerHTML = "";
    
    const filteredChats = state.chats.filter(chat => 
        chat.name.toLowerCase().includes(filterQuery.toLowerCase())
    );

    if (filteredChats.length === 0) {
        chatsListContainer.innerHTML = `<div class="empty-chats-notice" style="padding: 20px; text-align: center; color: #888;">Чаты не найдены</div>`;
        return;
    }
    
    filteredChats.forEach(chat => {
        const chatItem = document.createElement("div");
        chatItem.className = `chat-item ${state.activeChatId === chat.id ? "active" : ""}`;
        
        const msgs = state.messages[chat.id] || [];
        let lastMsgText = "Сообщений нет";
        if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            lastMsgText = lastMsg.text ? lastMsg.text : `📁 Файл: ${lastMsg.file.name}`;
        }

        let icon = "👤";
        if (chat.type === "group") icon = "👥";
        if (chat.type === "channel") icon = "📢";

        chatItem.innerHTML = `
            <div class="chat-item-avatar">${icon}</div>
            <div class="chat-item-info">
                <div class="chat-item-name">${chat.name}</div>
                <div class="chat-item-last-msg">${lastMsgText}</div>
            </div>
        `;

        chatItem.addEventListener("click", () => selectChat(chat.id));
        chatsListContainer.appendChild(chatItem);
    });
}

// Клик по чату и переключение окон
function selectChat(chatId) {
    state.activeChatId = chatId;
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    // Включаем инпуты по умолчанию
    messageTextInput.removeAttribute("disabled");
    attachBtn.removeAttribute("disabled");
    sendMessageBtn.removeAttribute("disabled");
    messageTextInput.placeholder = "Напишите сообщение...";
    
    // Если это чужой канал — запрещаем писать
    if (chat.type === "channel" && chat.creator !== CURRENT_USER) {
        messageTextInput.setAttribute("disabled", "true");
        sendMessageBtn.setAttribute("disabled", "true");
        attachBtn.setAttribute("disabled", "true");
        messageTextInput.placeholder = "Только администраторы могут писать";
    }

    // Мобильная адаптивность: открываем окно чата
    chatPanel.classList.remove("hidden-mobile");

    // Заполнение шапки чата
    chatCurrentName.textContent = chat.name;
    chatCurrentStatus.textContent = chat.status;

    // Показываем E2EE шифрование только для ЛС
    if (chat.type === "contact") {
        e2eeBadge.classList.remove("hidden");
    } else {
        e2eeBadge.classList.add("hidden");
    }

    // Показываем кнопку управления каналом только создателю
    if ((chat.type === "channel" || chat.type === "group") && chat.creator === CURRENT_USER) {
        channelSettingsBtn.classList.remove("hidden");
    } else {
        channelSettingsBtn.classList.add("hidden");
    }

    renderMessages(chatId);
    renderChatsList(globalSearchInput.value); 
}

// Отрисовка сообщений (Стиль Telegram)
function renderMessages(chatId) {
    chatMessagesContainer.innerHTML = "";
    const msgs = state.messages[chatId] || [];
    const chat = state.chats.find(c => c.id === chatId);

    if (msgs.length === 0) {
        chatMessagesContainer.innerHTML = `
            <div class="empty-chat-message" style="text-align: center; padding-top: 50px; color: #888;">
                <span style="font-size: 48px;">☀️</span>
                <p>Нет сообщений. Начните диалог первым.</p>
            </div>`;
        return;
    }

    msgs.forEach(msg => {
        const messageWrapper = document.createElement("div");
        const isMyMessage = msg.sender === CURRENT_USER;
        
        messageWrapper.className = `message-wrapper ${isMyMessage ? "outgoing" : "incoming"}`;
        
        // Логика медиавложений
        let mediaHTML = "";
        if (msg.file) {
            if (msg.file.type.startsWith("image/")) {
                mediaHTML = `<div class="msg-media-container"><img src="${msg.file.url}" class="viewable-media" alt="${msg.file.name}"></div>`;
            } else if (msg.file.type.startsWith("video/")) {
                mediaHTML = `<div class="msg-media-container"><video src="${msg.file.url}" class="viewable-media" muted></video></div>`;
            } else if (msg.file.type.startsWith("audio/")) {
                mediaHTML = `<div class="msg-media-container"><audio src="${msg.file.url}" controls></audio></div>`;
            } else {
                mediaHTML = `<div class="msg-media-file" style="margin-bottom: 5px;"><a href="${msg.file.url}" download="${msg.file.name}" style="color: #5288c1; text-decoration: none;">📄 ${msg.file.name}</a></div>`;
            }
        }

        messageWrapper.innerHTML = `
            <div class="message-bubble">
                ${!isMyMessage && chat && chat.type !== "contact" ? `<span class="message-author" style="display:block; font-size:13px; font-weight:bold; color:#5288c1; margin-bottom:4px;">${msg.sender}</span>` : ""}
                ${mediaHTML}
                ${msg.text ? `<p class="message-text" style="margin:0; font-size:15px; line-height:1.4;">${msg.text}</p>` : ""}
                <div class="message-meta" style="display:flex; justify-content:flex-end; margin-top:2px;">
                    <span class="message-time" style="font-size:11px; color:rgba(255,255,255,0.5);">${msg.time}</span>
                </div>
            </div>
        `;
        chatMessagesContainer.appendChild(messageWrapper);
    });

    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}


// --- 6. ОБРАБОТЧИКИ СОБЫТИЙ (EVENT LISTENERS) ---
function setupEventListeners() {
    
    // Текстовая отправка формы
    chatInputForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = messageTextInput.value.trim();
        if (!text || !state.activeChatId) return;

        pushMessageToState(state.activeChatId, {
            sender: CURRENT_USER,
            text: text,
            time: getCurrentTime()
        });

        messageTextInput.value = "";
    });

    // Живой поиск
    globalSearchInput.addEventListener("input", (e) => {
        renderChatsList(e.target.value);
    });

    // Кнопка назад на мобилках
    backToListBtn.addEventListener("click", () => {
        chatPanel.classList.add("hidden-mobile");
    });

    // Триггеры работы с вложениями
    attachBtn.addEventListener("click", () => fileAttachmentsInput.click());
    fileAttachmentsInput.addEventListener("change", handleFileSelection);

    // Модалка №1: Создание сущностей
    document.getElementById("open-contact-modal").addEventListener("click", () => openEntityModal("contact", "Добавить контакт", "Укажите никнейм пользователя (@username):"));
    document.getElementById("open-group-modal").addEventListener("click", () => openEntityModal("group", "Создать группу", "Укажите название группы:"));
    document.getElementById("open-channel-modal").addEventListener("click", () => openEntityModal("channel", "Создать канал", "Укажите название канала:"));
    
    modalCancelBtn.addEventListener("click", closeEntityModal);
    modalConfirmBtn.addEventListener("click", submitEntityModal);

    // Модалка №2: Кнопки файлов
    fileCancelBtn.addEventListener("click", closeFileModal);
    fileSendBtn.addEventListener("click", submitFileModal);

    // Модалка №3: КЛИК ПО ФОТО/ВИДЕО — РАЗВЕРНУТЬ НА ВЕСЬ ЭКРАН (КАК В ТГ)
    chatMessagesContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("viewable-media")) {
            viewerContent.innerHTML = ""; // Сброс старого контента
            
            if (e.target.tagName === "IMG") {
                const fullImg = document.createElement("img");
                fullImg.src = e.target.src;
                fullImg.style.maxWidth = "100%";
                fullImg.style.maxHeight = "100%";
                fullImg.style.objectFit = "contain";
                viewerContent.appendChild(fullImg);
            } else if (e.target.tagName === "VIDEO") {
                const fullVideo = document.createElement("video");
                fullVideo.src = e.target.src;
                fullVideo.controls = true;
                fullVideo.autoplay = true; // Сразу запускаем
                fullVideo.style.maxWidth = "100%";
                fullVideo.style.maxHeight = "100%";
                viewerContent.appendChild(fullVideo);
            }
            
            mediaModal.classList.remove("hidden");
        }
    });

    // Закрытие полноэкранного просмотра
    closeViewerBtn.addEventListener("click", closeMediaViewer);
    mediaModal.addEventListener("click", (e) => {
        if (e.target === mediaModal) closeMediaViewer();
    });
}

// --- 7. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ЛОГИКИ ---

function pushMessageToState(chatId, messageObj) {
    if (!state.messages[chatId]) state.messages[chatId] = [];
    state.messages[chatId].push(messageObj);
    
    if (state.activeChatId === chatId) {
        renderMessages(chatId);
    }
    renderChatsList(globalSearchInput.value);
}

function getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function closeMediaViewer() {
    mediaModal.classList.add("hidden");
    viewerContent.innerHTML = ""; // Глушит видео при закрытии, чтобы звук не шел дальше
}

// --- 8. ЛОГИКА ОКНА СОЗДАНИЯ (Entity) ---
function openEntityModal(type, title, desc) {
    currentModalType = type;
    modalTitle.textContent = title;
    modalDescription.textContent = desc;
    modalInput.value = "";
    modalError.classList.add("hidden");
    customModal.classList.remove("hidden");
    modalInput.focus();
}

function closeEntityModal() {
    customModal.classList.add("hidden");
}

function submitEntityModal() {
    const value = modalInput.value.trim();
    if (!value) {
        modalError.textContent = "Поле не может быть пустым";
        modalError.classList.remove("hidden");
        return;
    }

    if (currentModalType === "contact" && !value.startsWith("@")) {
        modalError.textContent = "Никнейм должен начинаться с @";
        modalError.classList.remove("hidden");
        return;
    }

    const entityId = "id_" + crypto.randomUUID();
    const newChat = {
        id: entityId,
        name: value,
        type: currentModalType,
        status: currentModalType === "contact" ? "не в сети" : "1 участник",
        creator: CURRENT_USER
    };

    state.chats.push(newChat);
    state.messages[entityId] = [];

    closeEntityModal();
    renderChatsList(globalSearchInput.value);
    selectChat(entityId);
}

// --- 9. ЛОГИКА ВЛОЖЕНИЙ (ФАЙЛОВ) ---
function handleFileSelection(e) {
    const file = e.target.files[0]; // Исправлено: берём первый файл из списка
    if (!file) return;

    state.selectedFile = file;
    fileModalInfo.textContent = `Файл: ${file.name} (${(file.size / 1024).toFixed(1)} КБ)`;
    filePreviewZone.innerHTML = "";

    const fileURL = URL.createObjectURL(file);

    if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = fileURL;
        img.style.maxWidth = "100%";
        img.style.maxHeight = "200px";
        img.style.borderRadius = "6px";
        filePreviewZone.appendChild(img);
    } else if (file.type.startsWith("video/")) {
        const vid = document.createElement("video");
        vid.src = fileURL;
        vid.style.maxWidth = "100%";
        vid.style.maxHeight = "200px";
        vid.style.borderRadius = "6px";
        vid.controls = true;
        filePreviewZone.appendChild(vid);
    } else {
        filePreviewZone.innerHTML = `<div style="font-size:40px; text-align:center;">📄</div>`;
    }

    fileCaptionInput.value = "";
    fileModal.classList.remove("hidden");
}

function closeFileModal() {
    fileModal.classList.add("hidden");
    fileAttachmentsInput.value = "";
    state.selectedFile = null;
}

function submitFileModal() {
    if (!state.selectedFile || !state.activeChatId) return;

    const fileURL = URL.createObjectURL(state.selectedFile);
    const caption = fileCaptionInput.value.trim();

    pushMessageToState(state.activeChatId, {
        sender: CURRENT_USER,
        text: caption,
        file: {
            name: state.selectedFile.name,
            type: state.selectedFile.type,
            url: fileURL
        },
        time: getCurrentTime()
    });

    closeFileModal();
}

// Запуск приложения
initApp();