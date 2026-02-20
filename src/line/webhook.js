const { PrismaClient } = require('@prisma/client');
const { parseMessage, createReplyMessage } = require('./parser');

const prisma = new PrismaClient();

// Initialize LINE Client once
const line = require('@line/bot-sdk');
const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

/**
 * LINE Webhook Handler
 */
async function webhookHandler(body, lineConfig) {
    const events = body.events;

    // Non-blocking log for incoming webhook
    logDebug({
        level: 'info',
        tag: 'webhook',
        message: `Incoming Webhook: ${events.length} events`,
        metadata: { body }
    });

    const results = await Promise.all(events.map(handleEvent));
    return results;
}

/**
 * Helper to log to DebugLog table (Non-blocking)
 */
function logDebug({ level, tag, message, metadata, lineUserId, displayName }) {
    // Fire and forget to not block the main flow
    prisma.debugLog.create({
        data: {
            level: level || 'info',
            tag: tag || 'webhook',
            message,
            metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
            lineUserId: lineUserId || null,
            displayName: displayName || null,
            appVersion: 'backend-1.0.0',
            deviceInfo: 'Server'
        }
    }).catch(err => {
        console.error('Failed to write debug log to DB:', err);
    });
}

/**
 * Handle individual LINE event
 */
async function handleEvent(event) {
    const userId = event.source.userId;
    const sourceId = event.source.groupId || event.source.roomId || userId;

    // Log every event type (Non-blocking)
    logDebug({
        level: 'debug',
        tag: 'event',
        message: `Processing event: ${event.type}`,
        lineUserId: userId,
        metadata: { event }
    });

    // Handle follow/unfollow events
    if (event.type === 'follow') {
        await syncUserProfile(userId);
        return replyMessage(event.replyToken, 'สวัสดีครับ! ขอบคุณที่ติดตาม Ez Finance Tracker 💰\n\nลองพิมพ์ "ช่วย" เพื่อดูวิธีใช้งานนะครับ', userId);
    }

    if (event.type === 'unfollow') {
        await prisma.userProfile.update({
            where: { lineUserId: userId },
            data: { notificationsEnabled: false }
        }).catch(() => { });
        return { status: 'unfollowed' };
    }

    // Update last active and profile on every message
    if (userId) {
        syncUserProfile(userId).catch(() => { });
    }

    // Only process text messages
    if (event.type !== 'message' || event.message.type !== 'text') {
        return { status: 'skipped', reason: 'not a text message' };
    }

    const text = event.message.text;

    console.log(`📨 Message from ${userId}: ${text}`);
    logDebug({
        level: 'info',
        tag: 'message',
        message: `Message: ${text}`,
        lineUserId: userId,
        metadata: { event }
    });

    // Help command
    if (text.trim() === 'ช่วย' || text.trim().toLowerCase() === 'help') {
        return replyMessage(event.replyToken, getHelpMessage(), userId);
    }

    // Summary command
    if (text.trim() === 'สรุป' || text.trim() === 'summary') {
        return handleSummaryCommand(event.replyToken, userId);
    }

    // ID / Setup command
    if (text.trim().toLowerCase() === 'id' || text.trim() === 'ไอดี') {
        const user = await prisma.userProfile.findUnique({
            where: { lineUserId: userId }
        }).catch(() => null);

        const setupUrl = `ezfinance://app/auth?id=${userId}`;
        const msg = [
            `👋 สวัสดีครับคุณ ${user?.displayName || 'ลูกค้า'}`,
            `🆔 ของคุณคือ: ${userId}`,
            ``,
            `📲 คลิกที่นี่เพื่อตั้งค่าแอปอัตโนมัติ:`,
            setupUrl
        ].join('\n');
        return replyMessage(event.replyToken, msg, userId);
    }

    // Try to parse the message
    const parsed = parseMessage(text);

    if (!parsed) {
        // Can't parse - send help hint
        return replyMessage(
            event.replyToken,
            '❓ ไม่เข้าใจข้อความ\n\nลองพิมพ์:\n• "จ่าย 200 อาหาร"\n• "รายรับ 5000 เงินเดือน"\n• "ช่วย" เพื่อดูวิธีใช้'
        );
    }

    // Save to database
    try {
        const transaction = await prisma.transaction.create({
            data: {
                type: parsed.type,
                amount: parsed.amount,
                category: parsed.category,
                description: parsed.description || null,
                source: parsed.source,
                lineUserId: userId,
            },
        });

        console.log(`✅ Saved transaction #${transaction.id}`);

        // Reply with confirmation
        const replyText = createReplyMessage(parsed);
        return replyMessage(event.replyToken, replyText, userId);
    } catch (err) {
        console.error('Database error:', err);
        logDebug({
            level: 'error',
            tag: 'database',
            message: `Failed to save transaction: ${err.message}`,
            lineUserId: userId,
            metadata: { stack: err.stack, parsed }
        });
        return replyMessage(event.replyToken, '❌ เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง', userId);
    }
}

/**
 * Handle summary command
 */
async function handleSummaryCommand(replyToken, userId) {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const transactions = await prisma.transaction.findMany({
            where: {
                lineUserId: userId,
                date: { gte: startOfMonth },
            },
        });

        const income = transactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expense = transactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const savings = transactions
            .filter((t) => t.type === 'savings')
            .reduce((sum, t) => sum + t.amount, 0);

        const balance = income - expense - savings;

        const monthName = now.toLocaleDateString('th-TH', {
            month: 'long',
            year: 'numeric',
        });

        const summary = [
            `📊 สรุปเดือน${monthName}`,
            `━━━━━━━━━━━━━━`,
            `💰 รายรับ: ${formatNum(income)} บาท`,
            `💸 รายจ่าย: ${formatNum(expense)} บาท`,
            `🏦 ออมเงิน: ${formatNum(savings)} บาท`,
            `━━━━━━━━━━━━━━`,
            `${balance >= 0 ? '✅' : '⚠️'} คงเหลือ: ${formatNum(balance)} บาท`,
            `📝 จำนวนรายการ: ${transactions.length} รายการ`,
        ].join('\n');

        return replyMessage(replyToken, summary, userId);
    } catch (err) {
        console.error('Summary error:', err);
        return replyMessage(replyToken, '❌ ไม่สามารถดึงข้อมูลสรุปได้', userId);
    }
}

function formatNum(num) {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

/**
 * Get help message text
 */
function getHelpMessage() {
    return [
        '📖 วิธีใช้งาน 💰 Ez Finance Tracker Bot',
        '━━━━━━━━━━━━━━',
        '',
        '💸 บันทึกรายจ่าย:',
        '• "จ่าย 200 อาหาร"',
        '• "รายจ่าย 500 ค่าเช่า"',
        '• "-300 กาแฟ"',
        '',
        '💰 บันทึกรายรับ:',
        '• "ได้ 15000 เงินเดือน"',
        '• "รายรับ 5000 freelance"',
        '• "+1000 ขายของ"',
        '',
        '🏦 บันทึกการออม:',
        '• "ออม 500 กองทุน"',
        '• "เก็บ 1000 ฉุกเฉิน"',
        '• "savings 2000 ประกัน"',
        '',
        '📊 ดูสรุป:',
        '• พิมพ์ "สรุป"',
        '',
        '🆔 ตั้งค่าแอป:',
        '• พิมพ์ "id" เพื่อดึง ID ไปตั้งค่าในแอป',
        '',
        '🐥 เจ้าขุนทอง:',
        '• เพิ่ม bot เข้ากลุ่มเดียวกับเจ้าขุนทอง',
        '• bot จะอ่านข้อความหารบิลอัตโนมัติ',
        '',
        '🏦 แจ้งเตือนธนาคาร:',
        '• forward ข้อความแจ้งเตือนมาที่ bot',
        '• bot จะ parse และบันทึกให้อัตโนมัติ',
    ].join('\n');
}

/**
 * Send reply message via LINE
 */
async function replyMessage(replyToken, text, userId) {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        console.error('❌ Missing LINE_CHANNEL_ACCESS_TOKEN');
        return { status: 'error', error: 'Missing token' };
    }

    try {
        await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: String(text).substring(0, 5000) }],
        });

        logDebug({
            level: 'info',
            tag: 'reply',
            message: `Replied: ${String(text).substring(0, 50)}...`,
            lineUserId: userId
        });

        return { status: 'replied' };
    } catch (err) {
        console.error('Reply error:', err);

        // Detailed log
        logDebug({
            level: 'error',
            tag: 'reply',
            message: `Reply error: ${err.message}`,
            lineUserId: userId,
            metadata: {
                error: err.message,
                replyToken,
                text: String(text).substring(0, 200),
                body: err.body || null
            }
        });

        return { status: 'error', error: err.message };
    }
}

/**
 * Sync LINE User Profile to database
 */
async function syncUserProfile(lineUserId) {
    if (!lineUserId) return;

    try {
        const profile = await client.getProfile(lineUserId);

        await prisma.userProfile.upsert({
            where: { lineUserId },
            update: {
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
                statusMessage: profile.statusMessage,
                notificationsEnabled: true,
                lastActiveAt: new Date(),
            },
            create: {
                lineUserId,
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
                statusMessage: profile.statusMessage,
                notificationsEnabled: true,
            },
        });
    } catch (err) {
        console.error('Sync profile error:', err);
    }
}

module.exports = { webhookHandler, handleEvent };
