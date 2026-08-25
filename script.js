document.addEventListener('DOMContentLoaded', () => {
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

    // ПРОВЕРКА АВТОРИЗАЦИИ: Используем надежный localStorage для всех вкладок
    if (localStorage.getItem('leto_active_user')) {
        window.location.href = "messenger.html";
    }

    // Переключение режимов по кнопке в углу экрана
    toggleBtn.addEventListener('click', () => {
        authMessage.className = "message-box";
        authMessage.textContent = "";

        if (currentMode === 'login') {
            currentMode = 'register';
            authTitle.textContent = "Регистрация в Лето";
            authSubtitle.textContent = "Создайте новый аккаунт в приватной сети";
            submitBtn.textContent = "Зарегистрироваться";
            toggleBtn.textContent = "Войти";
            
            // Подсказка для Google Chrome
            userPasswordInput.setAttribute('autocomplete', 'new-password');
        } else {
            currentMode = 'login';
            authTitle.textContent = "Войти в мессенджер";
            authSubtitle.textContent = "Введите ваши данные для входа в сеть Лето";
            submitBtn.textContent = "Войти";
            toggleBtn.textContent = "Зарегистрироваться";
            
            // Подсказка для Google Chrome
            userPasswordInput.setAttribute('autocomplete', 'current-password');
        }
    });

    // Обработка отправки формы
    authForm.addEventListener('submit', (e) => {
        e.preventDefault(); 
        
        authMessage.className = "message-box";
        authMessage.textContent = "";

        const username = usernameInput.value.trim().toLowerCase(); 
        const userPassword = userPasswordInput.value;
        const adminKey = adminKeyInput.value;

        // 1. Проверка секретного ключа администратора
        if (adminKey !== ADMIN_MASTER_KEY) {
            authMessage.classList.add('error');
            authMessage.textContent = "Ошибка доступа: неверный ключ администратора.";
            adminKeyInput.value = ""; 
            return;
        }

        // 2. Валидация длины полей ввода
        if (username.length < 3) {
            authMessage.classList.add('error');
            authMessage.textContent = "Имя должно содержать не менее 3 символов.";
            return;
        }

        if (userPassword.length < 6) {
            authMessage.classList.add('error');
            authMessage.textContent = "Пароль должен состоять из 6 или более символов.";
            return;
        }

        // 3. Проверка на простые пароли
        if (BAN_PASSWORD_LIST.includes(userPassword) || /^(\d)\1+$/.test(userPassword)) {
            authMessage.classList.add('error');
            authMessage.textContent = "Ошибка: этот пароль слишком простой и небезопасный.";
            return;
        }

        // Чтение базы пользователей
        let usersBase = {};
        try {
            const rawData = localStorage.getItem('leto_users_db');
            if (rawData) {
                usersBase = JSON.parse(rawData);
            }
        } catch (error) {
            usersBase = {};
            localStorage.removeItem('leto_users_db');
        }

        if (currentMode === 'register') {
            // ЛОГИКА РЕГИСТРАЦИИ
            if (usersBase[username]) {
                authMessage.classList.add('error');
                authMessage.textContent = "Ошибка: пользователь с таким именем уже существует.";
                return;
            }

            // Сохраняем нового пользователя в базу
            usersBase[username] = userPassword;
            localStorage.setItem('leto_users_db', JSON.stringify(usersBase));

            // Запоминаем активную сессию в localStorage
            localStorage.setItem('leto_active_user', username);
            
            authMessage.classList.add('success');
            authMessage.textContent = "Регистрация успешна. Выполняется переход...";

            setTimeout(() => {
                window.location.href = "messenger.html";
            }, 500);

        } else {
            // ЛОГИКА ВХОДА
            if (!usersBase[username]) {
                authMessage.classList.add('error');
                authMessage.textContent = "Ошибка: такого аккаунта не существует. Сначала зарегистрируйтесь.";
                return;
            }

            if (usersBase[username] !== userPassword) {
                authMessage.classList.add('error');
                authMessage.textContent = "Ошибка: неверный пароль учетной записи.";
                return;
            }

            // Запоминаем сессию в localStorage
            localStorage.setItem('leto_active_user', username);
            
            authMessage.classList.add('success');
            authMessage.textContent = "Вход выполнен. Выполняется переход...";

            setTimeout(() => {
                window.location.href = "messenger.html";
            }, 500);
        }
    });
});
