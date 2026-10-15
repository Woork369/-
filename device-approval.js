// =======================================================
// ☀️ ПОДТВЕРЖДЕНИЕ ВХОДА С ДРУГОГО УСТРОЙСТВА
// Через Supabase Realtime Broadcast
// =======================================================

const DeviceApproval = {
    _client: null,
    _username: null,
    _onApproved: null,
    _onDenied: null,

    _initClient() {
        if (this._client) return;
        this._client = new WebSocket(
            "wss://rvmtghettsndnnhdeasx.supabase.co/realtime/v1/websocket?apikey=" +
            "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q"
        );
    },

    subscribeAsTrustedDevice(username, callbacks) {
        this._username = username;
        this._initClient();
        const topic = "auth_" + username;

        this._client.onopen = () => {
            this._client.send(JSON.stringify({
                topic: "realtime:" + topic,
                event: "phx_join",
                payload: {},
                ref: "1"
            }));
        };

        this._client.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.event === "challenge_request" && callbacks.onChallenge) {
                    callbacks.onChallenge(data.payload);
                }
            } catch (e) {}
        };
    },

    sendApprovalRequest(username, challengeCode) {
        const topic = "auth_" + username;
        fetch("https://rvmtghettsndnnhdeasx.supabase.co/realtime/v1/api/broadcast", {
            method: 'POST',
            headers: {
                'apikey': "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q",
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{
                    topic: topic,
                    event: "challenge_request",
                    payload: { code: challengeCode, timestamp: Date.now() }
                }]
            })
        }).catch(() => {});
    },

    sendApprovalResponse(username, approved) {
        const topic = "auth_" + username;
        fetch("https://rvmtghettsndnnhdeasx.supabase.co/realtime/v1/api/broadcast", {
            method: 'POST',
            headers: {
                'apikey': "sb_publishable_GQxHLUlRpEVdmFeq_UKcqA_PPdYfm_Q",
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{
                    topic: topic,
                    event: approved ? "challenge_approved" : "challenge_denied",
                    payload: { timestamp: Date.now() }
                }]
            })
        }).catch(() => {});
    },

    subscribeForResponse(username, callbacks) {
        this._onApproved = callbacks.onApproved;
        this._onDenied = callbacks.onDenied;
        this._initClient();
        const topic = "auth_" + username;

        this._client.onopen = () => {
            this._client.send(JSON.stringify({
                topic: "realtime:" + topic,
                event: "phx_join",
                payload: {},
                ref: "2"
            }));
        };

        this._client.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.event === "challenge_approved" && this._onApproved) this._onApproved();
                if (data.event === "challenge_denied" && this._onDenied) this._onDenied();
            } catch (e) {}
        };
    }
};