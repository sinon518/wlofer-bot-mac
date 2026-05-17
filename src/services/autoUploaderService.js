const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const youtubeService = require('./youtubeService');

const DATA_PATH = process.env.WLOFER_DATA_PATH || path.join(__dirname, '../../');
const BASE_DIR = path.join(DATA_PATH, 'icerik');
const DIRS = {
    VIDEOS: path.join(BASE_DIR, 'videolar'),
    THUMBNAILS: path.join(BASE_DIR, 'kapak_fotograflari'),
    DESCRIPTIONS: path.join(BASE_DIR, 'aciklamalar'),
    TITLES: path.join(BASE_DIR, 'isimler'),
    UPLOADED: path.join(BASE_DIR, 'yuklenenler')
};

// Ensure directories exist
Object.values(DIRS).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

class AutoUploaderService {
    constructor() {
        this.jobs = [];
        const DATA_PATH = process.env.WLOFER_DATA_PATH || path.join(__dirname, '../../');
        this.configPath = path.join(DATA_PATH, 'config.json');
        this.config = this.loadConfig();
    }

    loadConfig() {
        if (fs.existsSync(this.configPath)) {
            try {
                return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            } catch(e) { }
        }
        return { youtube: [], instagram: [], tiktok: [] };
    }

    saveConfig(config) {
        this.config = config;
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        this.restartJobs();
    }

    restartJobs() {
        if (this.jobs.length > 0) {
            this.jobs.forEach(j => j.stop());
            this.jobs = [];
        }

        const platforms = ['youtube', 'instagram', 'tiktok'];
        platforms.forEach(platform => {
            const times = this.config[platform] || [];
            times.forEach(timeStr => {
                const [hour, minute] = timeStr.split(':');
                if(hour && minute) {
                    const cronExpr = `${parseInt(minute)} ${parseInt(hour)} * * *`;
                    console.log(`[${platform.toUpperCase()}] Registering job for: ${timeStr} -> ${cronExpr} (Europe/Istanbul)`);
                    const job = cron.schedule(cronExpr, async () => {
                        console.log(`[AutoUploader - ${platform}] Waking up for scheduled time ${timeStr}...`);
                        await this.processNextVideo(platform);
                    }, { timezone: 'Europe/Istanbul' });
                    job.start();
                    this.jobs.push(job);
                }
            });
        });
    }

    start() {
        this.restartJobs();
    }

    getPendingCount() {
        return fs.readdirSync(DIRS.VIDEOS).filter(f => f.endsWith('.mp4')).length;
    }

    getUploadedCount() {
        return fs.readdirSync(DIRS.UPLOADED).filter(f => f.endsWith('.mp4')).length;
    }

    getNextUploadTimeStrings() {
        const platforms = ['youtube', 'instagram', 'tiktok'];
        let result = {};

        const istanbulTimeOptions = { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false };
        const nowStr = new Date().toLocaleTimeString('en-US', istanbulTimeOptions);
        const [nowH, nowM] = nowStr.split(':').map(Number);
        const nowMinutes = nowH * 60 + nowM;

        platforms.forEach(platform => {
            const times = this.config[platform] || [];
            if (times.length === 0) {
                result[platform] = null;
                return;
            }

            let timesInMinutes = times.map(t => {
                const [h, m] = t.split(':').map(Number);
                return { timeStr: t, minutes: h * 60 + m };
            });

            let futureTimes = timesInMinutes.filter(t => t.minutes > nowMinutes);
            if (futureTimes.length > 0) {
                futureTimes.sort((a, b) => a.minutes - b.minutes);
                result[platform] = futureTimes[0].timeStr;
            } else {
                timesInMinutes.sort((a, b) => a.minutes - b.minutes);
                result[platform] = timesInMinutes[0].timeStr + " (Yarın)";
            }
        });
        
        return result;
    }

    async processNextVideo(platform) {
        if (platform === 'youtube' && !youtubeService.isAuthorized()) {
            console.log('[AutoUploader - youtube] Not authorized yet. Skipping.');
            return;
        }

        // Loop Mechanism Check
        let allMp4s = fs.readdirSync(DIRS.VIDEOS).filter(f => f.endsWith('.mp4'));
        if (allMp4s.length === 0) {
            console.log('[AutoUploader] No pending videos found in icerik/videolar. Checking yuklenenler folder to loop...');
            const uploadedDirs = fs.readdirSync(DIRS.UPLOADED);
            if (uploadedDirs.length > 0) {
                console.log('[AutoUploader] Looping media: moving files back from yuklenenler to content queues...');
                for (const d of uploadedDirs) {
                    const dirPath = path.join(DIRS.UPLOADED, d);
                    const fileStat = fs.statSync(dirPath);
                    if (fileStat.isDirectory()) {
                        const innerFiles = fs.readdirSync(dirPath);
                        for (const f of innerFiles) {
                            const p = path.join(dirPath, f);
                            if (f.toLowerCase().endsWith('.mp4')) {
                                fs.renameSync(p, path.join(DIRS.VIDEOS, f));
                            } else if (f.toLowerCase().includes('.txt')) {
                                if (f.endsWith('_isim.txt') || f.includes('isim')) {
                                    fs.renameSync(p, path.join(DIRS.TITLES, f));
                                } else {
                                    fs.renameSync(p, path.join(DIRS.DESCRIPTIONS, f));
                                }
                            } else if (f.match(/\.(jpg|jpeg|png)$/i)) {
                                fs.renameSync(p, path.join(DIRS.THUMBNAILS, f));
                            }
                        }
                        fs.rmdirSync(dirPath);
                    }
                }
                allMp4s = fs.readdirSync(DIRS.VIDEOS).filter(f => f.endsWith('.mp4'));
            }
            if (allMp4s.length === 0) {
                console.log('[AutoUploader] Everything is completely empty.');
                return;
            }
        }

        // Find the next video specific for THIS platform
        allMp4s.sort();
        let targetVideo = null;
        for (const file of allMp4s) {
            const baseName = path.parse(file).name;
            const markerPath = path.join(DIRS.VIDEOS, `${baseName}_${platform}.ok`);
            if (!fs.existsSync(markerPath)) {
                targetVideo = file;
                break;
            }
        }

        if (!targetVideo) {
            console.log(`[AutoUploader - ${platform}] No unuploaded videos left for this platform right now.`);
            return;
        }

        const baseName = path.parse(targetVideo).name;
        const videoPath = path.join(DIRS.VIDEOS, targetVideo);

        // Fetch Title from icerik/isimler
        const titleFiles = fs.readdirSync(DIRS.TITLES).filter(f => f.startsWith(baseName) && f.toLowerCase().includes('.txt'));
        let videoTitle = `${baseName} Video`;
        let foundTitlePath = null;
        if (titleFiles.length > 0) {
            foundTitlePath = path.join(DIRS.TITLES, titleFiles[0]);
            videoTitle = fs.readFileSync(foundTitlePath, 'utf8').trim();
        }

        // Fetch Description from icerik/aciklamalar
        const descFiles = fs.readdirSync(DIRS.DESCRIPTIONS).filter(f => f.startsWith(baseName) && f.toLowerCase().includes('.txt'));
        let descriptionText = `${videoTitle} - Otomatik Yüklendi`;
        let foundDescPath = null;
        if (descFiles.length > 0) {
            foundDescPath = path.join(DIRS.DESCRIPTIONS, descFiles[0]);
            descriptionText = fs.readFileSync(foundDescPath, 'utf8');
        }

        // Fetch Thumbnail
        const thumbFiles = fs.readdirSync(DIRS.THUMBNAILS).filter(f => f.startsWith(baseName) && f.match(/\.(jpg|jpeg|png)$/i));
        let thumbFileToUse = null;
        if (thumbFiles.length > 0) {
            thumbFileToUse = path.join(DIRS.THUMBNAILS, thumbFiles[0]);
        }

        console.log(`[AutoUploader - ${platform}] Target item: ${baseName} | Title: ${videoTitle}`);

        try {
            // Upload Logic
            if (platform === 'youtube') {
                const successIds = await youtubeService.uploadVideoToAll(videoPath, videoTitle, descriptionText, 'public');
                if (thumbFileToUse && successIds && successIds.length > 0) {
                    await youtubeService.setThumbnailForMultiple(successIds, thumbFileToUse);
                }
            } else if (platform === 'instagram') {
                const instagramService = require('./instagramService');
                const igSuccess = await instagramService.uploadVideoToAll(videoPath, videoTitle, descriptionText);
                if (!igSuccess) {
                    throw new Error('Instagram upload failed or no accounts reached.');
                }
            } else if (platform === 'tiktok') {
                console.log('[TikTok] Mock Uploading...');
            }

            // Mark this platform as OK for this video
            fs.writeFileSync(path.join(DIRS.VIDEOS, `${baseName}_${platform}.ok`), '1');
            console.log(`[AutoUploader - ${platform}] Successfully uploaded ${baseName}`);

            // Archive checking: Have ALL active platforms uploaded this video?
            const activePlatforms = ['youtube', 'instagram', 'tiktok'].filter(p => this.config[p] && this.config[p].length > 0);
            let fullyUploaded = true;
            for (const p of activePlatforms) {
                if (!fs.existsSync(path.join(DIRS.VIDEOS, `${baseName}_${p}.ok`))) {
                    fullyUploaded = false;
                    break;
                }
            }

            if (fullyUploaded) {
                console.log(`[AutoUploader] ${baseName} is fully uploaded across ALL scheduled platforms. Archiving...`);
                // Move logic
                const p = path.join(DIRS.UPLOADED, baseName);
                if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });

                fs.renameSync(videoPath, path.join(p, targetVideo));
                if (thumbFileToUse && fs.existsSync(thumbFileToUse)) fs.renameSync(thumbFileToUse, path.join(p, path.basename(thumbFileToUse)));
                if (foundDescPath && fs.existsSync(foundDescPath)) fs.renameSync(foundDescPath, path.join(p, path.basename(foundDescPath)));
                if (foundTitlePath && fs.existsSync(foundTitlePath)) fs.renameSync(foundTitlePath, path.join(p, path.basename(foundTitlePath)));
                
                // Cleanup marker dots
                activePlatforms.forEach(pOK => {
                    const mk = path.join(DIRS.VIDEOS, `${baseName}_${pOK}.ok`);
                    if (fs.existsSync(mk)) fs.rmSync(mk);
                });
            }

        } catch (error) {
            console.error(`[AutoUploader - ${platform}] Failed to process ${baseName}:`, error.message);
        }
    }
}

module.exports = new AutoUploaderService();
