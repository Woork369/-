document.addEventListener('DOMContentLoaded', async function() {
    const activeUser = getActiveUser();
    const PROFILES_URL = SUPABASE_CONFIG.url + "/rest/v1/" + SUPABASE_CONFIG.tables.profiles;

    // Заполняем данные из конфига
    document.getElementById('app-size').textContent = APP_STORE_CONFIG.size;
    document.getElementById('app-desc').textContent = APP_STORE_CONFIG.description;
    document.getElementById('current-version').textContent = APP_STORE_CONFIG.latestVersion;

    // Загружаем настройки пользователя из БД
    if (activeUser) {
        try {
            const res = await fetch(PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser) + "&select=update_notifications", {
                method: "GET", headers: HEADERS_GET
            });
            const rows = await res.json();
            if (rows && rows[0]) {
                document.getElementById('notify-updates-toggle').checked = rows[0].update_notifications === true;
            }
        } catch (e) {}
    }

    // Обработка переключателя уведомлений
    document.getElementById('notify-updates-toggle').addEventListener('change', async function() {
        if (!activeUser) {
            showToast('Войдите в аккаунт, чтобы сохранить настройки', 'error');
            this.checked = !this.checked;
            return;
        }
        
        const val = this.checked;
        try {
            await fetch(PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser), {
                method: "PATCH", headers: HEADERS,
                body: JSON.stringify({ update_notifications: val })
            });
            showToast(val ? 'Уведомления включены' : 'Уведомления выключены', 'success');
        } catch (e) {
            showToast('Ошибка сохранения', 'error');
        }
    });

    // Обработка кнопки "Установить"
    document.getElementById('install-btn').addEventListener('click', async function() {
        const btn = this;
        
        btn.textContent = 'Скачивание...';
        btn.disabled = true;

        if (activeUser) {
            try {
                await fetch(PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser), {
                    method: "PATCH", headers: HEADERS,
                    body: JSON.stringify({ app_version: APP_STORE_CONFIG.latestVersion })
                });
                localStorage.setItem('leto_app_version', APP_STORE_CONFIG.latestVersion);
                showToast('Версия сохранена в профиле!', 'success');
            } catch (e) {
                console.warn('Не удалось сохранить версию в БД');
            }
        } else {
            localStorage.setItem('leto_app_version', APP_STORE_CONFIG.latestVersion);
        }

        setTimeout(() => {
            btn.textContent = 'Установлено ✓';
            btn.style.background = '#34c759';
            
            // В реальности здесь должен быть переход по ссылке:
            // window.location.href = APP_STORE_CONFIG.apkDownloadUrl;
            
            showToast('APK файл успешно скачан!', 'success');
        }, 1500);
    });

    // Кнопка назад
    document.getElementById('back-btn').addEventListener('click', function() {
        if (activeUser) {
            window.location.href = 'messenger.html';
        } else {
            window.location.href = 'index.html';
        }
    });

    // Функция для тостов
    function showToast(text, type) {
        const container = document.getElementById('leto-toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'leto-toast';
        const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span><span>${text}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('leto-toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});