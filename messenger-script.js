document.addEventListener('DOMContentLoaded', () => {
    // 1. ИНИЦИАЛИЗАЦИЯ ОФИЦИАЛЬНОГО КЛИЕНТА SUPABASE
    const supabaseClient = supabase.createClient(
        "https://rvmtghettsndnnhdeasx.supabase.co", 
        "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"
    );

    const activeUser = localStorage.getItem('leto_active_user');
    if (!activeUser) { window.location.href = "./index.html"; return; }
    const CURRENT_USER = activeUser.startsWith("@") ? activeUser : "@" + activeUser; 

    let state = { chats: [], messages: {}, activeChatId: null, selectedFile: null };
    let mediaRecorder, audioChunks = [], isRecording = false;

    // DOM Элементы интерфейса
    const currentDisplay = document.getElementById("current-user-display");
    const chatsListContainer = document.getElementById("chats-list");
    const chatPanel = document.getElementById("chat-panel");
    const chatMessagesContainer = document.getElementById("chat-messages");
    const chatCurrentName = document.getElementById("chat-current-name");
    const chatCurrentStatus = document.getElementById("chat-current-status");
    const globalSearchInput = document.getElementById("global-search");
    const e2eeBadge = document.getElementById("e2ee-badge");
    const channelSettingsBtn = document.getElementById("channel-settings-btn");
    const backToListBtn = document.getElementById("back-to-list-btn");
    const chatInputForm = document.getElementById("chat-input-form");
    const messageTextInput = document.getElementById("message-text");
    const fileAttachmentsInput = document.getElementById("file-attachments");
    const attachBtn = document.getElementById("attach-btn");
    const sendMessageBtn = document.getElementById("send-message-btn");

    let voiceBtn = document.getElementById("voice-btn");
    if (!voiceBtn && chatInputForm) {
        voiceBtn = document.createElement("button");
        voiceBtn.id = "voice-btn"; voiceBtn.type = "button"; voiceBtn.innerHTML = "🎤";
        voiceBtn.style = "background:none; border:none; font-size:20px; cursor:pointer; padding:5px;";
        chatInputForm.insertBefore(voiceBtn, sendMessageBtn);
    }

    const customModal = document.getElementById("custom-modal");
    const modalTitle = document.getElementById("modal-title");
    const modalDescription = document.getElementById("modal-description");
    const modalInput = document.getElementById("modal-input");
    const modalError = document.getElementById("modal-error");
    const modalConfirmBtn = document.getElementById("modal-confirm-btn");
    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    let currentModalType = ""; 

    const fileModal = document.getElementById("file-modal");
    const fileModalInfo = document.getElementById("file-modal-info");
    const filePreviewZone = document.getElementById("file-preview-zone");
    const fileCaptionInput = document.getElementById("file-caption-input");
    const fileCancelBtn = document.getElementById("file-cancel-btn");
    const fileSendBtn = document.getElementById("file-send-btn");
    const mediaModal = document.getElementById("media-viewer-modal");
    const viewerContent = document.getElementById("viewer-content");
    const closeViewerBtn = document.getElementById("close-viewer-btn");

    function initApp() {
        if (currentDisplay) currentDisplay.textContent = CURRENT_USER;
        setupEventListeners(); syncWithServer(); setInterval(syncWithServer, 2000);
    }

    // 2. СИНХРОНИЗАЦИЯ ЧЕРЕЗ ОФИЦИАЛЬНЫЙ МЕТОД С САЙТА: .from().select()
    async function syncWithServer() {
        try {
            const { data: dbChats, error: chatsError } = await supabaseClient.from('chats').select('*');
            if (!chatsError && dbChats) state.chats = dbChats;

            const { data: dbMessages, error: msgsError } = await supabaseClient.from('messages').select('*').order('created_at', { ascending: true });
            if (!msgsError && dbMessages) {
                state.messages = {};
                dbMessages.forEach(msg => {
                    if (!state.messages[msg.chat_id]) state.messages[msg.chat_id] = [];
                    let parsedFile = null;
                    if (msg.file_data) {
                        try { parsedFile = typeof msg.file_data === 'string' ? JSON.parse(msg.file_data) : msg.file_data; } catch(e) {}
                    }
                    const msgTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    state.messages[msg.chat_id].push({ sender: msg.sender, text: msg.text, time: msgTime, file: parsedFile });
                });
            }
            renderChatsList(globalSearchInput ? globalSearchInput.value : "");
            if (state.activeChatId) renderMessages(state.activeChatId);
        } catch (error) { console.error("Ошибка синхронизации:", error); }
    }

    // 3. ОТРИСОВКА ИНТЕРФЕЙСА (RENDER)
    function renderChatsList(filterQuery = "") {
        if (!chatsListContainer) return; chatsListContainer.innerHTML = "";
        const filteredChats = state.chats.filter(chat => chat.name.toLowerCase().includes(filterQuery.toLowerCase()));
        if (filteredChats.length === 0) {
            chatsListContainer.innerHTML = `<div style="padding:20px; text-align:center; color:#888;">Чаты не найдены</div>`; return;
        }
        filteredChats.forEach(chat => {
            const chatItem = document.createElement("div");
            chatItem.className = `chat-item ${state.activeChatId === chat.id ? "active" : ""}`;
            const msgs = state.messages[chat.id] || [];
            let lastMsgText = "Сообщений нет";
            if (msgs.length > 0) {
                const lastMsg = msgs[msgs.length - 1];
                lastMsgText = lastMsg.text ? lastMsg.text : (lastMsg.file.type.startsWith("audio/") ? "🎤 Голосовое сообщение" : "📁 Файл");
            }
            let icon = chat.type === "group" ? "👥" : (chat.type === "channel" ? "📢" : "👤");
            chatItem.innerHTML = `<div class="chat-item-avatar">${icon}</div><div class="chat-item-info"><div class="chat-item-name">${chat.name}</div><div class="chat-item-last-msg">${lastMsgText}</div></div>`;
            chatItem.addEventListener("click", () => selectChat(chat.id));
            chatsListContainer.appendChild(chatItem);
        });
    }

    function selectChat(chatId) {
        state.activeChatId = chatId; const chat = state.chats.find(c => c.id === chatId); if (!chat) return;
        messageTextInput.removeAttribute("disabled"); attachBtn.removeAttribute("disabled"); sendMessageBtn.removeAttribute("disabled"); voiceBtn.removeAttribute("disabled");
        messageTextInput.placeholder = "Напишите сообщение...";
        if (chat.type === "channel" && chat.creator !== CURRENT_USER) {
            messageTextInput.setAttribute("disabled", "true"); sendMessageBtn.setAttribute("disabled", "true"); attachBtn.setAttribute("disabled", "true"); voiceBtn.setAttribute("disabled", "true");
            messageTextInput.placeholder = "Только администраторы могут писать";
        }
        if (chatPanel) chatPanel.classList.remove("hidden-mobile");
        if (chatCurrentName) chatCurrentName.textContent = chat.name;
        if (chatCurrentStatus) chatCurrentStatus.textContent = chat.status;
        renderMessages(chatId);
    }

    function renderMessages(chatId) {
        if (!chatMessagesContainer) return; chatMessagesContainer.innerHTML = "";
        const msgs = state.messages[chatId] || []; const chat = state.chats.find(c => c.id === chatId);
        msgs.forEach(msg => {
            const messageWrapper = document.createElement("div"); const isMyMessage = msg.sender === CURRENT_USER;
            messageWrapper.className = `message-wrapper ${isMyMessage ? "outgoing" : "incoming"}`;
            let mediaHTML = "";
            if (msg.file) {
                if (msg.file.type.startsWith("image/")) mediaHTML = `<div class="msg-media-container"><img src="${msg.file.url}" class="viewable-media"></div>`;
                else if (msg.file.type.startsWith("video/")) mediaHTML = `<div class="msg-media-container"><video src="${msg.file.url}" class="viewable-media" controls></video></div>`;
                else if (msg.file.type.startsWith("audio/")) mediaHTML = `<div class="msg-media-container" style="padding:5px 0;"><audio src="${msg.file.url}" controls style="max-width:240px;"></audio></div>`;
                else mediaHTML = `<div class="msg-media-file"><a href="${msg.file.url}" download="${msg.file.name}">📄 ${msg.file.name}</a></div>`;
            }
            messageWrapper.innerHTML = `<div class="message-bubble">${!isMyMessage && chat && chat.type !== "contact" ? `<span class="message-author" style="display:block; font-size:12px; font-weight:bold; color:#f57c00; margin-bottom:4px;">${msg.sender}</span>` : ""}${mediaHTML}${msg.text ? `<p class="message-text" style="margin:0; font-size:16px;">${msg.text}</p>` : ""}<div class="message-meta" style="display:flex; justify-content:flex-end; margin-top:4px;"><span class="message-time" style="font-size:10px; color:#888;">${msg.time}</span></div></div>`;
            chatMessagesContainer.appendChild(messageWrapper);
        });
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
    // 4. ДОБАВЛЕНИЕ ДАННЫХ В ОБЛАКО ЧЕРЕЗ ОФИЦИАЛЬНЫЙ МЕТОД: .from().insert()
    function setupEventListeners() {
        if (chatInputForm) {
            chatInputForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const text = messageTextInput.value.trim();
                if (!text || !state.activeChatId) return;
                messageTextInput.value = "";
                
                await supabaseClient
                    .from('messages')
                    .insert([{ chat_id: state.activeChatId, sender: CURRENT_USER, text: text }]);
                
                syncWithServer();
            });
        }

        if (voiceBtn) {
            voiceBtn.addEventListener("click", async () => {
                if (!state.activeChatId) return;
                if (!isRecording) {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        mediaRecorder = new MediaRecorder(stream); audioChunks = [];
                        mediaRecorder.ondataavailable = (e) => { audioChunks.push(e.data); };
                        mediaRecorder.onstop = async () => {
                            const audioBlob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
                            const reader = new FileReader(); reader.readAsDataURL(audioBlob);
                            reader.onloadend = async () => {
                                await supabaseClient.from('messages').insert([{
                                    chat_id: state.activeChatId, sender: CURRENT_USER, text: "",
                                    file_data: { name: "Голосовое сообщение.ogg", type: "audio/ogg", url: reader.result }
                                }]);
                                syncWithServer();
                            };
                        };
                        mediaRecorder.start(); isRecording = true;
                        voiceBtn.innerHTML = "🛑"; voiceBtn.style.color = "red";
                    } catch (err) { alert("Микрофон недоступен: " + err.message); }
                } else {
                    mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(track => track.stop());
                    isRecording = false; voiceBtn.innerHTML = "🎤"; voiceBtn.style.color = "black";
                }
            });
        }

        if (globalSearchInput) globalSearchInput.addEventListener("input", (e) => renderChatsList(e.target.value));
        if (backToListBtn) backToListBtn.addEventListener("click", () => chatPanel.classList.add("hidden-mobile"));
        if (attachBtn) attachBtn.addEventListener("click", () => fileAttachmentsInput.click());
        if (fileAttachmentsInput) fileAttachmentsInput.addEventListener("change", handleFileSelection);
        if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeEntityModal);
        if (modalConfirmBtn) modalConfirmBtn.addEventListener("click", submitEntityModal);
        if (fileCancelBtn) fileCancelBtn.addEventListener("click", closeFileModal);
        if (fileSendBtn) fileSendBtn.addEventListener("click", submitFileModal);
        
        if (chatMessagesContainer) {
            chatMessagesContainer.addEventListener("click", (e) => {
                if (e.target.classList.contains("viewable-media")) {
                    viewerContent.innerHTML = ""; 
                    if (e.target.tagName === "IMG") {
                        const fullImg = document.createElement("img"); fullImg.src = e.target.src;
                        fullImg.style.maxWidth = "100%"; fullImg.style.maxHeight = "100%"; fullImg.style.objectFit = "contain";
                        viewerContent.appendChild(fullImg);
                    } else if (e.target.tagName === "VIDEO") {
                        const fullVideo = document.createElement("video"); fullVideo.src = e.target.src;
                        fullVideo.controls = true; fullVideo.autoplay = true;
                        fullVideo.style.maxWidth = "100%"; fullVideo.style.maxHeight = "100%";
                        viewerContent.appendChild(fullVideo);
                    }
                    if (mediaModal) mediaModal.classList.remove("hidden");
                }
            });
        }
        if (closeViewerBtn) closeViewerBtn.addEventListener("click", closeMediaViewer);
        if (mediaModal) mediaModal.addEventListener("click", (e) => { if (e.target === mediaModal) closeMediaViewer(); });
    }

    function closeMediaViewer() { if (mediaModal) mediaModal.classList.add("hidden"); if (viewerContent) viewerContent.innerHTML = ""; }
    function openEntityModal(type, title, desc) {
        currentModalType = type; modalTitle.textContent = title; modalDescription.textContent = desc;
        modalInput.value = ""; modalError.classList.add("hidden"); customModal.classList.remove("hidden"); modalInput.focus();
    }
    function closeEntityModal() { customModal.classList.add("hidden"); }

    async function submitEntityModal() {
        const value = modalInput.value.trim().toLowerCase(); if (!value) return;
        if (currentModalType === "contact") {
            const cleanName = value.replace("@", "");
            modalError.textContent = "Поиск в приватной сети Лето..."; modalError.classList.remove("hidden");
            const { data: users } = await supabaseClient.from('user').select('*').eq('username', cleanName);
            if (!users || users.length === 0) { modalError.textContent = "Ошибка: этот пользователь не зарегистрирован!"; return; }
        }
        const entityId = "id_" + crypto.randomUUID();
        const newChat = { id: entityId, name: value, type: currentModalType, status: currentModalType === "contact" ? "в сети" : "1 участник", creator: CURRENT_USER };
        await supabaseClient.from('chats').insert([newChat]);
        closeEntityModal(); syncWithServer();
    }

    function handleFileSelection(e) {
        const file = e.target.files[0]; if (!file) return;
        state.selectedFile = file; fileModalInfo.textContent = `Файл: ${file.name}`; fileModal.classList.remove("hidden");
    }
    function closeFileModal() { fileModal.classList.add("hidden"); state.selectedFile = null; }

    async function submitFileModal() {
        if (!state.selectedFile || !state.activeChatId) return;
        const caption = fileCaptionInput.value.trim();
        const reader = new FileReader(); reader.readAsDataURL(state.selectedFile);
        reader.onloadend = async () => {
            await supabaseClient.from('messages').insert([{
                chat_id: state.activeChatId, sender: CURRENT_USER, text: caption,
                file_data: { name: state.selectedFile.name, type: state.selectedFile.type, url: reader.result }
            }]);
            closeFileModal(); syncWithServer();
        };
    }

    initApp();
});
