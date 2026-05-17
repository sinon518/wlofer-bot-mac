const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const youtubeService = require('../services/youtubeService');
const autoUploaderService = require('../services/autoUploaderService');

const DATA_PATH = process.env.WLOFER_DATA_PATH || path.join(__dirname, '../../');
const CONFIG_PATH = path.join(DATA_PATH, 'config.json');

// Ensure uploads dir exists
const uploadsDir = path.join(DATA_PATH, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file,_cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        _cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

// YouTube Multiple Accounts Check
router.get('/youtube/accounts', (req, res) => {
    const accounts = youtubeService.getAllAccounts();
    res.json({ accounts: accounts.map(a => ({ title: a.channelTitle, id: a.channelId })) });
});

// Instagram Multiple Accounts Check
router.get('/instagram/accounts', async (req, res) => {
    const instagramService = require('../services/instagramService');
    await instagramService.initializeDefaultToken();
    const accounts = instagramService.getAllAccounts();
    res.json({ accounts: accounts.map(a => ({ title: a.title, id: a.id })) });
});

// Delete YouTube Account
router.post('/youtube/accounts/delete', (req, res) => {
    const { id } = req.body;
    youtubeService.removeAccount(id);
    res.json({ success: true, message: 'YouTube hesabı kaldırıldı.' });
});

// Delete Instagram Account
router.post('/instagram/accounts/delete', (req, res) => {
    const { id } = req.body;
    const instagramService = require('../services/instagramService');
    instagramService.removeAccount(id);
    res.json({ success: true, message: 'Instagram hesabı kaldırıldı.' });
});

// YouTube Auth URL
router.get('/youtube/auth-url', (req, res) => {
    const url = youtubeService.getAuthUrl();
    res.json({ url });
});

// Basic status
router.get('/status', (req, res) => {
    res.json({ status: 'ok' });
});

// Dashboard stats
router.get('/dashboard', (req, res) => {
    try {
        const autoUploaderService = require('../services/autoUploaderService');
        const pending = autoUploaderService.getPendingCount();
        const uploaded = autoUploaderService.getUploadedCount();
        const nextDateObj = autoUploaderService.getNextUploadTimeStrings();

        res.json({
            pending,
            uploaded,
            nextDate: nextDateObj // example { youtube: "10:30", instagram: "14:00 (Yarın)" }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET configuration
router.get('/settings/auto-upload', (req, res) => {
    const autoUploaderService = require('../services/autoUploaderService');
    res.json(autoUploaderService.config);
});

// POST configuration
router.post('/settings/auto-upload', (req, res) => {
    try {
        const configParams = req.body; // Expects { youtube: [], instagram: [], tiktok: [] }
        const autoUploaderService = require('../services/autoUploaderService');
        
        autoUploaderService.saveConfig(configParams);
        
        res.json({ message: 'Ayrı platform ayarları kaydedildi ve zamanlayıcılar güncellendi!' });
    } catch (error) {
        console.error('Settings save error:', error);
        res.status(500).json({ message: 'Ayarlar kaydedilemedi.', error: error.toString() });
    }
});

module.exports = router;
