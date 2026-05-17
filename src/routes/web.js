const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtubeService');

// This handles the OAuth2 callback from Google
router.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (code) {
        try {
            const channelName = await youtubeService.handleCallback(code);
            res.send(`<h1>${channelName} başarıyla bağlandı!</h1><p>Şimdi sekmenizi kapatıp uygulamaya dönebilirsiniz.</p><script>setTimeout(() => window.close(), 3000);</script>`);
        } catch (error) {
            res.status(500).send('OAuth callback isleminde hata olustu: ' + error.message);
        }
    } else {
        res.status(400).send('Kod bulunamadi');
    }
});

module.exports = router;
