// =======================================================
// ☀️ 2FA — Подтверждение по email
// Срабатывает ТОЛЬКО при входе (пароль / устройство / бэкап)
// =======================================================

document.addEventListener('DOMContentLoaded', async function() {

    const activeUser = getActiveUser();
    if (!activeUser) { window.location.href = "index.html"; return; }

    // Если 2FA уже пройдена в этой сессии — сразу в мессенджер
    if (sessionStorage.getItem('leto_2fa_passed') === 'true') {
        window.location.href = "messenger.html";
        return;
    }

    const PROFILES_URL = SUPABASE_CONFIG.url + "/rest/v1/" + SUPABASE_CONFIG.tables.profiles;

    let resendTimer = null;
    let resendSeconds = 0;

    // Загружаем email с сервера
    let email = '';
    try {
        const res = await fetch(PROFILES_URL + "?username=eq." + encodeURIComponent(activeUser) + "&select=notify_email", {
            method: "GET", headers: HEADERS_GET
        });
        const rows = await res.json();
        if (rows && rows[0] && rows[0].notify_email) {
            email = rows[0].notify_email;
        }
    } catch (e) {}

    if (!email) {
        document.getElementById('twofa-hint').textContent = 'Почта не привязана.';
        setTimeout(function() { window.location.href = "settings.html"; }, 2500);
        return;
    }

    document.getElementById('twofa-hint').textContent = 'Мы отправили 4-значный код на ' + email;

    async function sendCode() {
        const code = String(Math.floor(1000 + Math.random() * 9000));
        localStorage.setItem('leto_pending_code_2fa', JSON.stringify({
            code: code, target: email, timestamp: Date.now()
        }));

        try {
            const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: EMAILJS_CONFIG.serviceId,
                    template_id: EMAILJS_CONFIG.templateId,
                    user_id: EMAILJS_CONFIG.publicKey,
                    template_params: {
                        to_email: email,
                        name: 'Пользователь Лето',
                        auth_code: code,
                        verification_code: code
                    }
                })
            });
            if (res.ok) {
                setStatus('Код отправлен на ' + email, 'success');
                startResendTimer();
            } else {
                setStatus('Ошибка отправки', 'error');
            }
        } catch (e) {
            setStatus('Сетевая ошибка', 'error');
        }
    }

    function setStatus(text, type) {
        const el = document.getElementById('twofa-status');
        el.textContent = text;
        el.className = 'modal-status ' + (type || '');
    }

    const digits = document.querySelectorAll('.code-digit');
    digits.forEach(function(digit, idx) {
        digit.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value && idx < digits.length - 1) digits[idx + 1].focus();
            if (idx === digits.length - 1 && this.value) {
                const allFilled = Array.from(digits).every(function(d) { return d.value; });
                if (allFilled) setTimeout(verify, 300);
            }
        });
        digit.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && idx > 0) digits[idx - 1].focus();
            if (e.key === 'Enter') verify();
        });
    });

    function verify() {
        const userCode = Array.from(digits).map(function(d) { return d.value; }).join('');
        if (userCode.length < 4) { setStatus('Введите все 4 цифры', 'error'); return; }
        const stored = JSON.parse(localStorage.getItem('leto_pending_code_2fa') || 'null');
        if (!stored) { setStatus('Код истёк', 'error'); return; }
        if (Date.now() - stored.timestamp > 5 * 60 * 1000) {
            setStatus('Код истёк', 'error');
            localStorage.removeItem('leto_pending_code_2fa');
            return;
        }
        if (userCode === stored.code) {
            localStorage.removeItem('leto_pending_code_2fa');
            sessionStorage.setItem('leto_2fa_passed', 'true');
            setStatus('Код подтверждён! Переход...', 'success');
            setTimeout(function() { window.location.href = "messenger.html"; }, 900);
        } else {
            setStatus('Неверный код', 'error');
            digits.forEach(function(d) { d.value = ''; });
            digits[0].focus();
        }
    }

    document.getElementById('twofa-confirm').addEventListener('click', verify);

    function startResendTimer() {
        stopResendTimer();
        resendSeconds = 30;
        updateLink();
        resendTimer = setInterval(function() {
            resendSeconds--;
            if (resendSeconds <= 0) stopResendTimer();
            else updateLink();
        }, 1000);
    }
    function stopResendTimer() {
        if (resendTimer) clearInterval(resendTimer);
        resendTimer = null;
        resendSeconds = 0;
        updateLink();
    }
    function updateLink() {
        const link = document.getElementById('twofa-resend');
        if (resendSeconds > 0) {
            link.textContent = 'Отправить повторно через ' + resendSeconds + ' сек';
            link.classList.add('disabled');
        } else {
            link.textContent = 'Отправить код повторно';
            link.classList.remove('disabled');
        }
    }

    document.getElementById('twofa-resend').addEventListener('click', function(e) {
        e.preventDefault();
        if (resendSeconds > 0) return;
        sendCode();
    });

    sendCode();
});