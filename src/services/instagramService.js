const axios = require('axios');
const fs = require('fs');
const path = require('path');
const localtunnel = require('localtunnel');

const DATA_PATH = process.env.WLOFER_DATA_PATH || path.join(__dirname, '../../');
const ACCOUNTS_PATH = path.join(DATA_PATH, 'instagram_accounts.json');

const instagramService = {
    getAllAccounts() {
        if (fs.existsSync(ACCOUNTS_PATH)) {
            try {
                return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
            } catch (e) {
                console.error("Error reading instagram accounts", e);
            }
        }
        return [];
    },

    saveAccounts(accounts) {
        fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
    },

    // A helper to initialize the default token if provided and not yet saved
    async initializeDefaultToken() {
        const defaultToken = process.env.INSTAGRAM_DEFAULT_TOKEN;
        if (!defaultToken) return;

        const accounts = this.getAllAccounts();
        const existing = accounts.find(a => a.token === defaultToken);
        if (existing) return;

        try {
            // Meta Graph API - find Pages -> find IG Business Accounts
            const pagesRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts`, {
                params: { access_token: defaultToken }
            });

            if (pagesRes.data && pagesRes.data.data) {
                for (let page of pagesRes.data.data) {
                    const igRes = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
                        params: { fields: 'instagram_business_account', access_token: defaultToken }
                    });

                    if (igRes.data && igRes.data.instagram_business_account) {
                        const igId = igRes.data.instagram_business_account.id;
                        
                        // Get Username
                        const profileRes = await axios.get(`https://graph.facebook.com/v19.0/${igId}`, {
                            params: { fields: 'username,profile_picture_url', access_token: defaultToken }
                        });
                        
                        accounts.push({
                            id: igId,
                            title: profileRes.data.username || 'Instagram Hesabı',
                            token: defaultToken
                        });
                    }
                }
                this.saveAccounts(accounts);
                console.log(`[Instagram] Initialized default token accounts. Loaded ${accounts.length} linked IG accounts.`);
            }
        } catch (error) {
            console.error('[Instagram] Failed to initialize default token:', error.response?.data || error.message);
        }
    },

    async uploadVideoToAll(videoPath, title, description) {
        const accounts = this.getAllAccounts();
        if (accounts.length === 0) {
            console.error('[Instagram] No connected accounts to upload.');
            return;
        }

        console.log('[Instagram] Attempting to create a secure LocalTunnel to expose media to Meta...');
        let tunnel;
        try {
            tunnel = await localtunnel({ port: 3000 });
            console.log(`[Instagram] LocalTunnel online: ${tunnel.url}`);

            const fileName = path.basename(videoPath);
            // Must have this exposed in server.js or app.js as express.static
            const publicVideoUrl = `${tunnel.url}/public_icerik/${fileName}`;

            let successCount = 0;

            for (const account of accounts) {
                console.log(`[Instagram] Starting Reels upload to account: ${account.title}`);
                try {
                    // Step 1: Create Media Container
                    const containerRes = await axios.post(`https://graph.facebook.com/v19.0/${account.id}/media`, null, {
                        params: {
                            video_url: publicVideoUrl,
                            caption: `${title}\n\n${description}`,
                            media_type: 'REELS',
                            access_token: account.token
                        }
                    });

                    const creationId = containerRes.data.id;
                    console.log(`[Instagram] Video Container Created (ID: ${creationId}). Waiting for Meta to download...`);

                    // Step 2: Poll Status
                    let isReady = false;
                    let attempts = 0;
                    while (!isReady && attempts < 15) {
                        await new Promise(r => setTimeout(r, 6000)); // wait 6 seconds
                        attempts++;
                        const statusRes = await axios.get(`https://graph.facebook.com/v19.0/${creationId}`, {
                            params: { fields: 'status_code', access_token: account.token }
                        });
                        
                        const status = statusRes.data.status_code;
                        console.log(`[Instagram] Status poll ${attempts}: ${status}`);
                        if (status === 'FINISHED') {
                            isReady = true;
                        } else if (status === 'ERROR') {
                            throw new Error('Meta Graph API returned ERROR processing video.');
                        }
                    }

                    if (!isReady) {
                        throw new Error('Timeout waiting for Meta to process the Reel.');
                    }

                    // Step 3: Publish Media
                    const publishRes = await axios.post(`https://graph.facebook.com/v19.0/${account.id}/media_publish`, null, {
                        params: {
                            creation_id: creationId,
                            access_token: account.token
                        }
                    });

                    console.log(`[Instagram] Success for ${account.title}! Reel ID:`, publishRes.data.id);
                    successCount++;
                } catch (error) {
                    console.error(`[Instagram] Error uploading to ${account.title}:`, error.response?.data?.error?.message || error.message);
                }
            }

            tunnel.close();
            console.log('[Instagram] LocalTunnel closed.');
            return successCount > 0;

        } catch (globalError) {
            console.error('[Instagram] Critical error during upload sequence:', globalError.message);
            if (tunnel) tunnel.close();
            return false;
        }
    },

    removeAccount(id) {
        const accounts = this.getAllAccounts();
        const filtered = accounts.filter(acc => acc.id !== id);
        this.saveAccounts(filtered);
        console.log(`[Instagram] Account removed: ${id}`);
    }
};

module.exports = instagramService;
