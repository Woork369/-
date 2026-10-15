// =======================================================
// ☀️ ПОДТВЕРЖДЕНИЕ ВХОДА С ДРУГОГО УСТРОЙСТВА
// =======================================================

const DeviceApproval = {
    _pollInterval: null,

    _getUrl() {
        return SUPABASE_CONFIG.url + "/rest/v1/" + SUPABASE_CONFIG.tables.backupKeys;
    },

    async _patchRow(username, fields) {
        const url = this._getUrl();
        const res = await fetch(url + "?username=eq." + encodeURIComponent(username), {
            method: "GET", headers: HEADERS_GET
        });
        const rows = await res.json();

        if (rows && rows[0]) {
            await fetch(url + "?username=eq." + encodeURIComponent(username), {
                method: "PATCH", headers: HEADERS,
                body: JSON.stringify(fields)
            });
        } else {
            await fetch(url, {
                method: "POST", headers: HEADERS,
                body: JSON.stringify({ username: username, ...fields })
            });
        }
    },

    async sendApprovalRequest(username, code) {
        const payload = {
            code: String(code),
            from: "new_device",
            timestamp: Date.now(),
            pending: true
        };
        await this._patchRow(username, { device_request: payload });
    },

    async sendApprovalResponse(username, approved) {
        const payload = {
            pending: false,
            approved: approved === true,
            timestamp: Date.now()
        };
        await this._patchRow(username, { device_request: payload });
    },

    startPollingAsTrustedDevice(username, onChallenge) {
        this.stopPolling();
        let lastTs = 0;

        const tick = async () => {
            try {
                const res = await fetch(
                    this._getUrl() + "?username=eq." + encodeURIComponent(username) + "&select=device_request",
                    { method: "GET", headers: HEADERS_GET }
                );
                const rows = await res.json();
                if (!rows || !rows[0]) return;

                const req = rows[0].device_request;
                if (!req || !req.pending) return;
                if (!req.timestamp || req.timestamp === lastTs) return;
                if (Date.now() - req.timestamp > 2 * 60 * 1000) return;

                lastTs = req.timestamp;
                onChallenge(req);
            } catch (e) {}
        };

        tick();
        this._pollInterval = setInterval(tick, 2000);
    },

    stopPolling() {
        if (this._pollInterval) clearInterval(this._pollInterval);
        this._pollInterval = null;
    },

    waitForResponse(username, timeoutMs = 120000) {
        return new Promise((resolve) => {
            const started = Date.now();
            const interval = setInterval(async () => {
                if (Date.now() - started > timeoutMs) {
                    clearInterval(interval);
                    resolve({ approved: false, timeout: true });
                    return;
                }
                try {
                    const res = await fetch(
                        this._getUrl() + "?username=eq." + encodeURIComponent(username) + "&select=device_request",
                        { method: "GET", headers: HEADERS_GET }
                    );
                    const rows = await res.json();
                    if (!rows || !rows[0]) return;

                    const req = rows[0].device_request;
                    if (!req) return;
                    if (req.pending) return;

                    clearInterval(interval);
                    resolve({ approved: req.approved === true, timeout: false });
                } catch (e) {}
            }, 2000);
        });
    }
};