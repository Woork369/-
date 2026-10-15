// =======================================================
// ☀️ НАСТРОЙКИ МЕССЕНДЖЕРА «ЛЕТО» — Конфигурация
// =======================================================

const SUPABASE_CONFIG = {
    url: "https://rvmtghettsndnnhdeasx.supabase.co",
    key: "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q",
    tables: {
        user: "user",
        profiles: "profiles",
        messages: "messages",
        rooms: "rooms",
        backupKeys: "backup_keys"
    }
};

const HEADERS = {
    "apikey": SUPABASE_CONFIG.key,
    "Authorization": "Bearer " + SUPABASE_CONFIG.key,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};

const HEADERS_GET = {
    "apikey": SUPABASE_CONFIG.key,
    "Authorization": "Bearer " + SUPABASE_CONFIG.key
};

const EMAILJS_CONFIG = {
    publicKey: "S1NP5cFz0W79QnOiK",
    serviceId: "service_v9f6zor",
    templateId: "template_bcb0yly"
};

const BAN_PASSWORD_LIST = [
    "123456", "12345678", "123456789",
    "qwerty", "password", "111111", "000000"
];

const APP_CONFIG = {
    version: "1.0.0",
    developer: "Лето Team",
    apkDownloadUrl: "https://example.com/leto.apk",
    defaultTheme: "light",
    defaultAccent: "#007aff",
    defaultFontSize: 15,
    defaultLanguage: "ru",
    defaultAppIcon: "☀️"
};

const THEMES = ["light", "dark", "system"];

const ACCENT_COLORS = [
    { id: "blue",   name: "Синий",      value: "#007aff" },
    { id: "green",  name: "Зелёный",    value: "#34c759" },
    { id: "red",    name: "Красный",    value: "#ff3b30" },
    { id: "orange", name: "Оранжевый",  value: "#ff9500" },
    { id: "purple", name: "Фиолетовый", value: "#af52de" },
    { id: "pink",   name: "Розовый",    value: "#ff2d55" },
    { id: "teal",   name: "Бирюзовый",  value: "#5ac8fa" },
    { id: "yellow", name: "Жёлтый",     value: "#ffcc00" }
];

const APP_ICONS = ["☀️", "🌞", "🌻", "🌴", "🌊", "⛱️"];

const TRANSLATIONS = {
    ru: {
        settings_title: "Настройки",
        back_to_messenger: "Назад в мессенджер",
        save: "Сохранить", cancel: "Отмена", confirm: "Подтвердить",
        close: "Закрыть", delete: "Удалить", add: "Добавить",
        enable: "Включить", disable: "Выключить", test: "Тест",
        loading: "Загрузка...", error: "Ошибка", success: "Успешно",

        section_profile: "Профиль",
        section_security: "Безопасность",
        section_appearance: "Внешний вид",
        section_notifications: "Уведомления",
        section_sounds: "Звуки",
        section_data: "Данные",
        section_app: "Приложение",
        section_about: "О системе",

        profile_avatar: "Аватар",
        profile_username: "Имя пользователя",
        profile_email: "Email",
        profile_phone: "Телефон",
        profile_status: "Статус",
        profile_icon: "Иконка в шапке",

        security_change_password: "Смена пароля",
        security_old_password: "Старый пароль",
        security_new_password: "Новый пароль",
        security_confirm_password: "Повторите пароль",
        security_2fa: "Двухфакторная аутентификация",
        security_2fa_enable: "Включить 2FA",
        security_incognito: "Режим инкогнито",
        security_incognito_hint: "Скрывает онлайн-статус и прочтение",
        security_hide_last_seen: "Показывать время последнего входа",
        security_hide_last_seen_hint: "Если выключено — только «был недавно»",

        appearance_theme: "Тема",
        appearance_theme_light: "Светлая",
        appearance_theme_dark: "Тёмная",
        appearance_theme_system: "Системная",
        appearance_accent: "Акцентный цвет",
        appearance_font_size: "Размер текста",
        appearance_language: "Язык",
        appearance_language_ru: "🇷🇺 Русский",
        appearance_language_en: "🇬🇧 English",

        notify_enabled: "Включить уведомления",
        notify_sound: "Звук уведомлений",
        notify_vibrate: "Вибрация",
        notify_badge: "Бейдж с числом непрочитанных",
        notify_quiet_hours: "Тихие часы",
        notify_quiet_hours_from: "с",
        notify_quiet_hours_to: "до",
        notify_email: "Email для уведомлений",
        notify_email_enabled: "Пересылать на почту",
        notify_personal: "Личные сообщения",
        notify_groups: "Группы",
        notify_channels: "Каналы",
        notify_mentions: "Упоминания",

        sounds_message: "Звук нового сообщения",
        sounds_sent: "Звук отправки",
        sounds_test_message: "Тест: новое сообщение",
        sounds_test_sent: "Тест: отправка",

        data_backup: "Резервная копия",
        data_export: "Экспорт данных",
        data_import: "Импорт данных",
        data_export_hint: "Создать JSON-файл с настройками и 4 ключами для входа на новом устройстве",
        data_import_hint: "Восстановить из JSON-файла",
        data_clear_cache: "Очистить кэш",
        data_clear_cache_hint: "Удалить локальные данные (кроме аккаунта)",
        data_backup_success: "Резервная копия создана",
        data_import_success: "Данные восстановлены",
        data_import_error: "Файл повреждён",
        data_cache_cleared: "Кэш очищен",

        app_status: "Статус",
        app_status_in_app: "📱 Вы в приложении",
        app_status_in_browser: "🌐 Вы на сайте",
        app_download_apk: "Скачать APK",
        app_check_updates: "Проверить обновления",

        about_version: "Версия",
        about_developer: "Разработчик",
        about_tech: "Технологии",
        about_tech_value: "Supabase + Vanilla JS",

        twofa_title: "Введите код из письма",
        twofa_hint: "Мы отправили 4-значный код на",
        twofa_confirm: "Подтвердить",
        twofa_resend: "Отправить повторно",
        twofa_resend_timer: "Отправить повторно через",
        twofa_sec: "сек",
        twofa_wrong: "Неверный код. Попробуйте ещё раз.",
        twofa_expired: "Код истёк. Запросите новый.",
        twofa_success: "Код подтверждён!",

        toast_password_changed: "Пароль изменён",
        toast_2fa_enabled: "2FA включена",
        toast_2fa_disabled: "2FA выключена",
        toast_blocked: "Пользователь заблокирован",
        toast_unblocked: "Пользователь разблокирован"
    },
    en: {
        settings_title: "Settings",
        back_to_messenger: "Back to Messenger",
        save: "Save", cancel: "Cancel", confirm: "Confirm",
        close: "Close", delete: "Delete", add: "Add",
        enable: "Enable", disable: "Disable", test: "Test",
        loading: "Loading...", error: "Error", success: "Success",

        section_profile: "Profile",
        section_security: "Security",
        section_appearance: "Appearance",
        section_notifications: "Notifications",
        section_sounds: "Sounds",
        section_data: "Data",
        section_app: "App",
        section_about: "About",

        profile_avatar: "Avatar",
        profile_username: "Username",
        profile_email: "Email",
        profile_phone: "Phone",
        profile_status: "Status",
        profile_icon: "Header icon",

        security_change_password: "Change password",
        security_old_password: "Old password",
        security_new_password: "New password",
        security_confirm_password: "Confirm password",
        security_2fa: "Two-factor authentication",
        security_2fa_enable: "Enable 2FA",
        security_incognito: "Incognito mode",
        security_incognito_hint: "Hides online status and read receipts",
        security_hide_last_seen: "Show last seen time",
        security_hide_last_seen_hint: "If off — only «recently»",

        appearance_theme: "Theme",
        appearance_theme_light: "Light",
        appearance_theme_dark: "Dark",
        appearance_theme_system: "System",
        appearance_accent: "Accent color",
        appearance_font_size: "Font size",
        appearance_language: "Language",
        appearance_language_ru: "🇷🇺 Русский",
        appearance_language_en: "🇬🇧 English",

        notify_enabled: "Enable notifications",
        notify_sound: "Notification sound",
        notify_vibrate: "Vibration",
        notify_badge: "Unread badge",
        notify_quiet_hours: "Quiet hours",
        notify_quiet_hours_from: "from",
        notify_quiet_hours_to: "to",
        notify_email: "Notification email",
        notify_email_enabled: "Forward to email",
        notify_personal: "Direct messages",
        notify_groups: "Groups",
        notify_channels: "Channels",
        notify_mentions: "Mentions",

        sounds_message: "New message sound",
        sounds_sent: "Sent sound",
        sounds_test_message: "Test: new message",
        sounds_test_sent: "Test: sent",

        data_backup: "Backup",
        data_export: "Export data",
        data_import: "Import data",
        data_export_hint: "Create JSON file with settings and 4 keys",
        data_import_hint: "Restore from JSON file",
        data_clear_cache: "Clear cache",
        data_clear_cache_hint: "Remove local data (except account)",
        data_backup_success: "Backup created",
        data_import_success: "Data restored",
        data_import_error: "File corrupted",
        data_cache_cleared: "Cache cleared",

        app_status: "Status",
        app_status_in_app: "📱 You are in the app",
        app_status_in_browser: "🌐 You are on the website",
        app_download_apk: "Download APK",
        app_check_updates: "Check for updates",

        about_version: "Version",
        about_developer: "Developer",
        about_tech: "Tech",
        about_tech_value: "Supabase + Vanilla JS",

        twofa_title: "Enter code from email",
        twofa_hint: "We sent a 4-digit code to",
        twofa_confirm: "Confirm",
        twofa_resend: "Resend",
        twofa_resend_timer: "Resend in",
        twofa_sec: "sec",
        twofa_wrong: "Wrong code. Try again.",
        twofa_expired: "Code expired. Request a new one.",
        twofa_success: "Code confirmed!",

        toast_password_changed: "Password changed",
        toast_2fa_enabled: "2FA enabled",
        toast_2fa_disabled: "2FA disabled",
        toast_blocked: "User blocked",
        toast_unblocked: "User unblocked"
    }
};

function t(key, lang) {
    const l = lang || localStorage.getItem('leto_language') || 'ru';
    return (TRANSLATIONS[l] && TRANSLATIONS[l][key]) || key;
}

function isMedianApp() {
    return !!(window.median) || /Median|wv|WebView/i.test(navigator.userAgent);
}

function getActiveUser() {
    return localStorage.getItem('leto_active_user');
}

const LocalStore = {
    get(key, fallback) {
        const v = localStorage.getItem('leto_' + key);
        if (v === null) return fallback;
        if (v === 'true') return true;
        if (v === 'false') return false;
        if (!isNaN(v) && v !== '') return Number(v);
        return v;
    },
    set(key, val) {
        localStorage.setItem('leto_' + key, String(val));
    },
    remove(key) {
        localStorage.removeItem('leto_' + key);
    }
};

// =======================================================
// REALTIME — для подтверждения входа с другого устройства
// =======================================================
const REALTIME_URL = SUPABASE_CONFIG.url + "/realtime/v1";
const REALTIME_TOPIC_PREFIX = "auth_";