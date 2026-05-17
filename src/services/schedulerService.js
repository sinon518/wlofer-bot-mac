const cron = require('node-cron');
const youtubeService = require('./youtubeService');

class SchedulerService {
    constructor() {
        this.jobs = []; // In-memory jobs tracking
    }

    /**
     * Parses the datetime-local string to cron format
     * Ex: 2026-05-16T08:30 -> "30 8 16 5 *"
     */
    dateToCron(dateString) {
        const date = new Date(dateString);
        const minutes = date.getMinutes();
        const hours = date.getHours();
        const days = date.getDate();
        const months = date.getMonth() + 1; // 1-12
        return `${minutes} ${hours} ${days} ${months} *`;
    }

    scheduleUpload(videoData, videoFile) {
        const { title, description, scheduledTime, platforms } = videoData;
        const cronTime = this.dateToCron(scheduledTime);
        
        let platformArray = platforms;
        if (!Array.isArray(platformArray)) {
            platformArray = platforms ? [platforms] : [];
        }

        console.log(`Scheduling a job at ${cronTime} for platforms: ${platformArray.join(', ')}`);

        const job = cron.schedule(cronTime, async () => {
            console.log(`[SCHEDULE TIK!]: Starting upload job for video "${title}"`);
            
            if (platformArray.includes('youtube')) {
                try {
                    await youtubeService.uploadVideo(videoFile.path, title, description, 'public');
                    console.log(`[YouTube] Scheduled upload success for ${title}`);
                } catch (e) {
                    console.error(`[YouTube] Scheduled upload error:`, e.message);
                }
            }
            
            if (platformArray.includes('instagram')) {
                console.log(`[Instagram] Commencing puppeteer task for scheduled upload...`);
                // Placeholder for puppeteer logic
            }
            
            if (platformArray.includes('tiktok')) {
                console.log(`[TikTok] Commencing puppeteer task for scheduled upload...`);
                // Placeholder for puppeteer logic
            }

            // Stop and destroy job after execution (run-once job)
            job.stop();
        });

        this.jobs.push({
            title,
            platforms: platformArray,
            scheduledTime,
            job
        });

        job.start();
    }
}

module.exports = new SchedulerService();
