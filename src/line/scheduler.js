const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const line = require('@line/bot-sdk');

const prisma = new PrismaClient();
const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

/**
 * Initialize Scheduler
 */
function initScheduler() {
    // Schedule daily reminder at 16:26
    cron.schedule('53 08 * * *', async () => {
        console.log('⏰ Running daily reminder cron job...');
        await sendDailyReminders();
    }, {
        scheduled: true,
        timezone: "Asia/Bangkok"
    });

    console.log('📅 Scheduler initialized: Daily reminder at 20:00 (Asia/Bangkok)');
}

/**
 * Send reminders to all active users
 */
async function sendDailyReminders() {
    try {
        const users = await prisma.userProfile.findMany({
            where: {
                notificationsEnabled: true
            }
        });

        console.log(`📢 Sending reminders to ${users.length} users...`);

        for (const user of users) {
            try {
                await client.pushMessage({
                    to: user.lineUserId,
                    messages: [{
                        type: 'text',
                        text: `สวัสดีครับคุณ ${user.displayName || 'ลูกค้า'} 🙏\nวันนี้อย่าลืมบันทึกรายรับรายจ่ายนะครับ! 💰\n\nพิมพ์ "สรุป" เพื่อดูภาพรวมของเดือนนี้ได้เลยครับ`
                    }]
                });
                console.log(`✅ Sent reminder to ${user.lineUserId} (${user.displayName})`);
            } catch (err) {
                console.error(`❌ Failed to send reminder to ${user.lineUserId}:`, err.message);

                // If user blocked the bot, disable notifications
                if (err.statusCode === 400 || err.statusCode === 401) {
                    await prisma.userProfile.update({
                        where: { lineUserId: user.lineUserId },
                        data: { notificationsEnabled: false }
                    });
                }
            }
        }
    } catch (err) {
        console.error('Daily reminder error:', err);
    }
}

module.exports = { initScheduler };
