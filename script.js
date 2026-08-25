document.addEventListener('DOMContentLoaded', () => {

    // =======================================================
    // ?? §¯§¡§³§´§²§°§«§¬§ª §´§£§°§¦§¤§° §³§¦§²§£§¦§²§¡ "§±§°§³§­§¡§¯§¯§ª§¬-§­§¦§´§°"
    // §£§ã§ä§Ñ§Ó§î §ã§ð§Õ§Ñ §ã§Ó§à§Ú §Õ§Ñ§ß§ß§í§Ö §Þ§Ö§Ø§Õ§å §Ü§Ñ§Ó§í§é§Ö§Ü:
    // =======================================================
    const MY_SUPABASE_URL = "https://rvmtghettsndnnhdeasx.supabase.co"; 
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 
    // =======================================================

    // §¡§Ó§ä§à§Þ§Ñ§ä§Ú§é§Ö§ã§Ü§Ñ§ñ §ã§Ò§à§â§Ü§Ñ §á§â§Ñ§Ó§Ú§Ý§î§ß§í§ç §á§å§ä§Ö§Û §Õ§Ý§ñ §ä§Ñ§Ò§Ý§Ú§è
    const SUPABASE_USERS_URL = `${MY_SUPABASE_URL}/rest/v1/user`;

    // §®§Ñ§ã§ä§Ö§â-§Ü§Ý§ð§é §Ñ§Õ§Þ§Ú§ß§Ú§ã§ä§â§Ñ§ä§à§â§Ñ §Õ§Ý§ñ §á§â§à§Ó§Ö§â§Ü§Ú §Õ§à§ã§ä§å§á§Ñ
    const ADMIN_MASTER_KEY = "LETO_SECURE_2026";

    // §³§á§Ú§ã§à§Ü §Ù§Ñ§á§â§Ö§ë§Ö§ß§ß§í§ç §á§â§à§ã§ä§í§ç §á§Ñ§â§à§Ý§Ö§Û
    const BAN_PASSWORD_LIST = ["123456", "12345678", "123456789", "qwerty", "password", "111111", "000000"];

    // §²§Ö§Ø§Ú§Þ §á§à §å§Þ§à§Ý§é§Ñ§ß§Ú§ð: 'login' (§Ó§ç§à§Õ) §Ú§Ý§Ú 'register' (§â§Ö§Ô§Ú§ã§ä§â§Ñ§è§Ú§ñ)
    let currentMode = 'login';

    // §¿§Ý§Ö§Þ§Ö§ß§ä§í §Ú§ß§ä§Ö§â§æ§Ö§Û§ã§Ñ
    const authForm = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-auth-mode');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('submit-btn');
    const authMessage = document.getElementById('auth-message');

    const usernameInput = document.getElementById('username');
    const userPasswordInput = document.getElementById('user-password');
    const adminKeyInput = document.getElementById('admin-key');

    // §±§Ö§â§Ö§Ü§Ý§ð§é§Ö§ß§Ú§Ö §â§Ö§Ø§Ú§Þ§à§Ó §á§à §Ü§ß§à§á§Ü§Ö (§£§ç§à§Õ / §²§Ö§Ô§Ú§ã§ä§â§Ñ§è§Ú§ñ)
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!authMessage || !authTitle || !authSubtitle || !submitBtn || !userPasswordInput) return;
            authMessage.className = "message-box";
            authMessage.textContent = "";

            if (currentMode === 'login') {
                currentMode = 'register';
                authTitle.textContent = "§²§Ö§Ô§Ú§ã§ä§â§Ñ§è§Ú§ñ §Ó §­§Ö§ä§à";
                authSubtitle.textContent = "§³§à§Ù§Õ§Ñ§Û§ä§Ö §ß§à§Ó§í§Û §Ñ§Ü§Ü§Ñ§å§ß§ä §Ó §á§â§Ú§Ó§Ñ§ä§ß§à§Û §ã§Ö§ä§Ú";
                submitBtn.textContent = "§©§Ñ§â§Ö§Ô§Ú§ã§ä§â§Ú§â§à§Ó§Ñ§ä§î§ã§ñ";
                toggleBtn.textContent = "§£§à§Û§ä§Ú";
                userPasswordInput.setAttribute('autocomplete', 'new-password');
            } else {
                currentMode = 'login';
                authTitle.textContent = "§£§à§Û§ä§Ú §Ó §Þ§Ö§ã§ã§Ö§ß§Õ§Ø§Ö§â";
                authSubtitle.textContent = "§£§Ó§Ö§Õ§Ú§ä§Ö §Ó§Ñ§ê§Ú §Õ§Ñ§ß§ß§í§Ö §Õ§Ý§ñ §Ó§ç§à§Õ§Ñ §Ó §ã§Ö§ä§î §­§Ö§ä§à";
                submitBtn.textContent = "§£§à§Û§ä§Ú";
                toggleBtn.textContent = "§©§Ñ§â§Ö§Ô§Ú§ã§ä§â§Ú§â§à§Ó§Ñ§ä§î§ã§ñ";
                userPasswordInput.setAttribute('autocomplete', 'current-password');
            }
        });
    }

    // §°§Ò§â§Ñ§Ò§à§ä§Ü§Ñ §à§ä§á§â§Ñ§Ó§Ü§Ú §æ§à§â§Þ§í
    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            
            if (!authMessage || !usernameInput || !userPasswordInput || !adminKeyInput) return;
            authMessage.className = "message-box";
            authMessage.textContent = "";

            const username = usernameInput.value.trim().toLowerCase(); 
            const userPassword = userPasswordInput.value;
            const adminKey = adminKeyInput.value;

            // 1. §±§â§à§Ó§Ö§â§Ü§Ñ §ã§Ö§Ü§â§Ö§ä§ß§à§Ô§à §Ü§Ý§ð§é§Ñ §Ñ§Õ§Þ§Ú§ß§Ú§ã§ä§â§Ñ§ä§à§â§Ñ
            if (adminKey !== ADMIN_MASTER_KEY) {
                authMessage.className = "message-box error";
                authMessage.textContent = "§°§ê§Ú§Ò§Ü§Ñ §Õ§à§ã§ä§å§á§Ñ: §ß§Ö§Ó§Ö§â§ß§í§Û §Ü§Ý§ð§é §Ñ§Õ§Þ§Ú§ß§Ú§ã§ä§â§Ñ§ä§à§â§Ñ.";
                adminKeyInput.value = ""; 
                return;
            }

            // 2. §£§Ñ§Ý§Ú§Õ§Ñ§è§Ú§ñ §Õ§Ý§Ú§ß§í §á§à§Ý§Ö§Û §Ó§Ó§à§Õ§Ñ
            if (username.length < 3) {
                authMessage.className = "message-box error";
                authMessage.textContent = "§ª§Þ§ñ §Õ§à§Ý§Ø§ß§à §ã§à§Õ§Ö§â§Ø§Ñ§ä§î §ß§Ö §Þ§Ö§ß§Ö§Ö 3 §ã§Ú§Þ§Ó§à§Ý§à§Ó.";
                return;
            }

            if (userPassword.length < 6) {
                authMessage.className = "message-box error";
                authMessage.textContent = "§±§Ñ§â§à§Ý§î §Õ§à§Ý§Ø§Ö§ß §ã§à§ã§ä§à§ñ§ä§î §Ú§Ù 6 §Ú§Ý§Ú §Ò§à§Ý§Ö§Ö §ã§Ú§Þ§Ó§à§Ý§à§Ó.";
                return;
            }

            // 3. §±§â§à§Ó§Ö§â§Ü§Ñ §ß§Ñ §á§â§à§ã§ä§í§Ö §á§Ñ§â§à§Ý§Ú
            if (BAN_PASSWORD_LIST.includes(userPassword) || /^(\d)\1+$/.test(userPassword)) {
                authMessage.className = "message-box error";
                authMessage.textContent = "§°§ê§Ú§Ò§Ü§Ñ: §ï§ä§à§ä §á§Ñ§â§à§Ý§î §ã§Ý§Ú§ê§Ü§à§Þ §á§â§à§ã§ä§à§Û §Ú §ß§Ö§Ò§Ö§Ù§à§á§Ñ§ã§ß§í§Û.";
                return;
            }

            if (currentMode === 'register') {
                // --- §­§°§¤§ª§¬§¡ §²§¦§¤§ª§³§´§²§¡§¸§ª§ª §¯§¡ §³§¦§²§£§¦§²§¦ ---
                authMessage.className = "message-box success";
                authMessage.textContent = "§±§â§à§Ó§Ö§â§Ü§Ñ §Ú§Þ§Ö§ß§Ú §ß§Ñ §ã§Ö§â§Ó§Ö§â§Ö...";

                fetch(`${SUPABASE_USERS_URL}?username=eq.${username}`, {
                    method: "GET",
                    headers: {
                        "apikey": MY_SERVER_KEY,
                        "Authorization": `Bearer ${MY_SERVER_KEY}`
                    }
                })
                .then(res => res.json())
                .then(users => {
                    if (users.length > 0) {
                        throw new Error("§±§à§Ý§î§Ù§à§Ó§Ñ§ä§Ö§Ý§î §ã §ä§Ñ§Ü§Ú§Þ §Ú§Þ§Ö§ß§Ö§Þ §å§Ø§Ö §ã§å§ë§Ö§ã§ä§Ó§å§Ö§ä.");
                    }

                    return fetch(SUPABASE_USERS_URL, {
                        method: "POST",
                        headers: {
                            "apikey": MY_SERVER_KEY,
                            "Authorization": `Bearer ${MY_SERVER_KEY}`,
                            "Content-Type": "application/json",
                            "Prefer": "return=minimal"
                        },
                        body: JSON.stringify({
                            username: username,
                            password: userPassword,
                            created_at: new Date().toISOString()
                        })
                    });
                })
                .then(response => {
                    if (!response.ok) throw new Error("§¯§Ö §å§Õ§Ñ§Ý§à§ã§î §ã§à§ç§â§Ñ§ß§Ú§ä§î §Õ§Ñ§ß§ß§í§Ö §ß§Ñ §ã§Ö§â§Ó§Ö§â§Ö.");

                    localStorage.setItem('leto_active_user', username);
                    authMessage.className = "message-box success";
                    authMessage.textContent = "§²§Ö§Ô§Ú§ã§ä§â§Ñ§è§Ú§ñ §å§ã§á§Ö§ê§ß§Ñ! §¥§à§Ò§â§à §á§à§Ø§Ñ§Ý§à§Ó§Ñ§ä§î §Ó §­§Ö§ä§à...";

                    setTimeout(() => {
                        window.location.href = "messenger.html";
                    }, 1500);
                })
                .catch(error => {
                    authMessage.className = "message-box error";
                    authMessage.textContent = "§°§ê§Ú§Ò§Ü§Ñ: " + error.message;
                });

            } else {
                // --- §­§°§¤§ª§¬§¡ §£§·§°§¥§¡ §¹§¦§²§¦§© §³§¦§²§£§¦§² ---
                authMessage.className = "message-box success";
                authMessage.textContent = "§±§â§à§Ó§Ö§â§Ü§Ñ §å§é§Ö§ä§ß§í§ç §Õ§Ñ§ß§ß§í§ç...";

                fetch(`${SUPABASE_USERS_URL}?username=eq.${username}`, {
                    method: "GET",
                    headers: {
                        "apikey": MY_SERVER_KEY,
                        "Authorization": `Bearer ${MY_SERVER_KEY}`
                    }
                })
                .then(res => res.json())
                .then(users => {
                    if (users.length === 0) {
                        throw new Error("§´§Ñ§Ü§à§Ô§à §Ñ§Ü§Ü§Ñ§å§ß§ä§Ñ §ß§Ö §ã§å§ë§Ö§ã§ä§Ó§å§Ö§ä. §³§ß§Ñ§é§Ñ§Ý§Ñ §Ù§Ñ§â§Ö§Ô§Ú§ã§ä§â§Ú§â§å§Û§ä§Ö§ã§î.");
                    }

                    // §¹§Ú§ä§Ñ§Ö§Þ §Õ§Ñ§ß§ß§í§Ö §á§à§Ý§î§Ù§à§Ó§Ñ§ä§Ö§Ý§ñ §Ú§Ù §á§à§Ý§å§é§Ö§ß§ß§à§Ô§à §Þ§Ñ§ã§ã§Ú§Ó§Ñ §Ò§Ö§Ù§à§á§Ñ§ã§ß§à§ã§ä§Ú
                    const dbUser = users[0];

                    if (dbUser.password !== userPassword) {
                        throw new Error("§¯§Ö§Ó§Ö§â§ß§í§Û §á§Ñ§â§à§Ý§î §å§é§Ö§ä§ß§à§Û §Ù§Ñ§á§Ú§ã§Ú.");
                    }

                    localStorage.setItem('leto_active_user', username);
                    authMessage.className = "message-box success";
                    authMessage.textContent = "§£§ç§à§Õ §Ó§í§á§à§Ý§ß§Ö§ß §å§ã§á§Ö§ê§ß§à! §±§Ö§â§Ö§ç§à§Õ §Ó §ã§Ö§ä§î...";

                    setTimeout(() => {
                        window.location.href = "messenger.html";
                    }, 1500);
                })
                .catch(error => {
                    authMessage.className = "message-box error";
                    authMessage.textContent = "§°§ê§Ú§Ò§Ü§Ñ: " + error.message;
                });
            }
        });
    }
});

