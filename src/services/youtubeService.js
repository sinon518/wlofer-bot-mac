const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.WLOFER_DATA_PATH || path.join(__dirname, '../../');
const ACCOUNTS_PATH = path.join(DATA_PATH, 'youtube_accounts.json');

const getBaseClient = () => {
    return new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI
    );
};

const youtubeService = {
    getAllAccounts() {
        if (fs.existsSync(ACCOUNTS_PATH)) {
            try {
                return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
            } catch (e) {
                console.error("Error reading youtube accounts", e);
            }
        }
        return [];
    },

    saveAccounts(accounts) {
        fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
    },

    getAuthUrl() {
        const client = getBaseClient();
        const scopes = [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube.readonly'
        ];
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent' // force consent back so refresh tokens come through cleanly multi-acc
        });
    },

    async handleCallback(code) {
        const client = getBaseClient();
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        const youtube = google.youtube({ version: 'v3', auth: client });
        
        let channelTitle = "Bilinmeyen Kanal";
        let channelId = "unknown";
        
        try {
            const channelRes = await youtube.channels.list({
                part: 'snippet',
                mine: true
            });
            if (channelRes.data.items && channelRes.data.items.length > 0) {
                channelTitle = channelRes.data.items[0].snippet.title;
                channelId = channelRes.data.items[0].id;
            }
        } catch (error) {
            console.error("Kanala ulasilamadi:", error.message);
        }

        const accounts = this.getAllAccounts();
        
        // Remove if existing account exists (refresh)
        const filtered = accounts.filter(acc => acc.channelId !== channelId || channelId === 'unknown');
        
        filtered.push({
            channelId,
            channelTitle,
            tokens
        });

        this.saveAccounts(filtered);
        console.log(`Successfully added YouTube account: ${channelTitle}`);
        return channelTitle;
    },

    async uploadVideoToAll(videoPath, title, description, privacyStatus = 'public') {
        const accounts = this.getAllAccounts();
        if (accounts.length === 0) {
            console.error('[YouTube] No connected accounts to upload.');
            return;
        }

        const successIds = [];
        
        for (const account of accounts) {
            const client = getBaseClient();
            client.setCredentials(account.tokens);
            
            const youtube = google.youtube({
                version: 'v3',
                auth: client
            });
            
            console.log(`[YouTube] Starting upload to channel: ${account.channelTitle}`);
            try {
                const res = await youtube.videos.insert({
                    part: 'snippet,status',
                    requestBody: {
                        snippet: {
                            title: title,
                            description: description,
                            categoryId: '22'
                        },
                        status: {
                            privacyStatus: privacyStatus,
                            madeForKids: false
                        }
                    },
                    media: {
                        body: fs.createReadStream(videoPath)
                    }
                });
                
                successIds.push({ account: account.channelTitle, videoId: res.data.id });
                console.log(`[YouTube] Success for ${account.channelTitle}:`, res.data.id);
            } catch (error) {
                console.error(`[YouTube] Error uploading to ${account.channelTitle}:`, error.message);
            }
        }
        
        return successIds;
    },

    async setThumbnailForMultiple(successIds, imagePath) {
        const accounts = this.getAllAccounts();
        for (const item of successIds) {
            const acc = accounts.find(a => a.channelTitle === item.account);
            if (!acc) continue;

            const client = getBaseClient();
            client.setCredentials(acc.tokens);
            const youtube = google.youtube({ version: 'v3', auth: client });

            try {
                await youtube.thumbnails.set({
                    videoId: item.videoId,
                    media: {
                        body: fs.createReadStream(imagePath)
                    }
                });
                console.log(`[YouTube] Thumbnail set for ${item.account}`);
            } catch (err) {
                console.error(`[YouTube] Thumbnail error for ${item.account}:`, err.message);
            }
        }
    },
    
    isAuthorized() {
        return this.getAllAccounts().length > 0;
    },

    removeAccount(channelId) {
        const accounts = this.getAllAccounts();
        const filtered = accounts.filter(acc => acc.channelId !== channelId);
        this.saveAccounts(filtered);
        console.log(`[YouTube] Account removed: ${channelId}`);
    }
};

module.exports = youtubeService;
