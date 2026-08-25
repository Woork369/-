document.addEventListener('DOMContentLoaded', () => {

    // =======================================================
    // ☀️ НАСТРОЙКИ ТВОЕГО СЕРВЕРА "ПОСЛАННИК-ЛЕТО"
    // Вставь сюда свои данные между кавычек:
    // =======================================================
    const MY_SUPABASE_URL = "https://rvmtghettsndnnhdeasx.supabase.co"; 
    const MY_SERVER_KEY   = "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"; 
    // =======================================================

    // Автоматическая сборка правильных путей для таблиц
    const SUPABASE_USERS_URL = `${MY_SUPABASE_URL}/rest/v1/user`;

    // Мастер-ключ администратора для проверки доступа
    const ADMIN_MASTER_KEY = "LETO_SECURE_2026";

    // Список запрещенных простых паролей
    const BAN_PASSWORD_LIST = ["123456", "12345678", "123456789", "qwerty", "password", "111111", "000000"];

    // Режим по умолчанию: 'login' (вход) или 'register' (регистрация)
    let currentMode = 'login';

    // Элементы интерфейса
    const authForm = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-auth-mode');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('submit-btn');
    const authMessage = document.getElementById('auth-message');

    const usernameInput = document.getElementById('username');
    const userPasswordInput = document.getElementById('user-password');
    const adminKeyInput = document.getElementById('admin-key');

    // Переключение режимов по кнопке (Вход / Регистрация)
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!authMessage || !authTitle || !authSubtitle || !submitBtn || !userPasswordInput) return;
            authMessage.className = "message-box";
            authMessage.textContent = "";

            if (currentMode === 'login') {
                currentMode = 'register';
                authTitle.textContent = "Регистрация в Лето";
                authSubtitle.textContent = "Создайте новый аккаунт в приватной сети";
                submitBtn.textContent = "Зарегистрироваться";
                toggleBtn.textContent = "Войти";
                userPasswordInput.setAttribute('autocomplete', 'new-password');
            } else {
                currentMode = 'login';
                authTitle.textContent = "Войти в мессенджер";
                authSubtitle.textContent = "Введите ваши данные для входа в сеть Лето";
                submitBtn.textContent = "Войти";
                toggleBtn.textContent = "Зарегистрироваться";
                userPasswordInput.setAttribute('autocomplete', 'current-password');
            }
        });
    }

    // Обработка отправки формы
    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            
            if (!authMessage || !usernameInput || !userPasswordInput || !adminKeyInput) return;
            authMessage.className = "message-box";
            authMessage.textContent = "";

            const username = usernameInput.value.trim().toLowerCase(); 
            const userPassword = userPasswordInput.value;
            const adminKey = adminKeyInput.value;

            // 1. Проверка секретного ключа администратора
            if (adminKey !== ADMIN_MASTER_KEY) {
                authMessage.className = "message-box error";
                authMessage.textContent = "Ошибка доступа: неверный ключ администратора.";
                adminKeyInput.value = ""; 
                return;
            }

            // 2. Валидация длины полей ввода
            if (username.length < 3) {
                authMessage.className = "message-box error";
                authMessage.textContent = "Имя должно содержать не менее 3 символов.";
                return;
            }

            if (userPassword.length < 6) {
                authMessage.className = "message-box error";
                authMessage.textContent = "Пароль должен состоять из 6 или более символов.";
                return;
            }

            // 3. Проверка на простые пароли
            if (BAN_PASSWORD_LIST.includes(userPassword) || /^(\d)\1+$/.test(userPassword)) {
                authMessage.className = "message-box error";
                authMessage.textContent = "Ошибка: этот пароль слишком простой и небезопасный.";
                return;
            }

            if (currentMode === 'register') {
                // --- ЛОГИКА РЕГИСТРАЦИИ НА СЕРВЕРЕ ---
                authMessage.className = "message-box success";
                authMessage.textContent = "Проверка имени на сервере...";

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
                        throw new Error("Пользователь с таким именем уже существует.");
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
                    if (!response.ok) throw new Error("Не удалось сохранить данные на сервере.");

                    localStorage.setItem('leto_active_user', username);
                    authMessage.className = "message-box success";
                    authMessage.textContent = "Регистрация успешна! Добро пожаловать в Лето...";

                    setTimeout(() => {
                        window.location.href = "messenger.html";
                    }, 1500);
                })
                .catch(error => {
                    authMessage.className = "message-box error";
                    authMessage.textContent = "Ошибка: " + error.message;
                });

            } else {
                // --- ЛОГИКА ВХОДА ЧЕРЕЗ СЕРВЕР ---
                authMessage.className = "message-box success";
                authMessage.textContent = "Проверка учетных данных...";

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
                        throw new Error("Такого аккаунта не существует. Сначала зарегистрируйтесь.");
                    }

                    // Читаем данные пользователя из полученного массива безопасности
                    const dbUser = users[0];

                    if (dbUser.password !== userPassword) {
                        throw new Error("Неверный пароль учетной записи.");
                    }

                    localStorage.setItem('leto_active_user', username);
                    authMessage.className = "message-box success";
                    authMessage.textContent = "Вход выполнен успешно! Переход в сеть...";

                    setTimeout(() => {
                        window.location.href = "messenger.html";
                    }, 1500);
                })
                .catch(error => {
                    authMessage.className = "message-box error";
                    authMessage.textContent = "Ошибка: " + error.message;
                });
            }
        });
    }
});
