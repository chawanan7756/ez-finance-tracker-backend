/**
 * Thai Financial Message Parser
 * Parses various Thai financial message formats:
 * 1. User manual input: "รายรับ 5000 เงินเดือน" / "จ่าย 200 อาหาร"
 * 2. Bank notifications: "เงินเข้า 15,000.00 บาท" / "เงินออก 500.00 บาท"
 * 3. เจ้าขุนทอง bill-split messages
 */

// ===== Category mappings =====
const EXPENSE_KEYWORDS = {
    'อาหาร': 'อาหาร',
    'กิน': 'อาหาร',
    'ข้าว': 'อาหาร',
    'กาแฟ': 'อาหาร',
    'น้ำ': 'อาหาร',
    'เครื่องดื่ม': 'อาหาร',
    'เดินทาง': 'เดินทาง',
    'รถ': 'เดินทาง',
    'แท็กซี่': 'เดินทาง',
    'taxi': 'เดินทาง',
    'grab': 'เดินทาง',
    'น้ำมัน': 'เดินทาง',
    'ค่าเช่า': 'ที่อยู่อาศัย',
    'หอ': 'ที่อยู่อาศัย',
    'บ้าน': 'ที่อยู่อาศัย',
    'ค่าไฟ': 'ที่อยู่อาศัย',
    'ค่าน้ำ': 'ที่อยู่อาศัย',
    'ค่าเน็ต': 'ที่อยู่อาศัย',
    'โทรศัพท์': 'ที่อยู่อาศัย',
    'ช้อปปิ้ง': 'ช้อปปิ้ง',
    'ซื้อ': 'ช้อปปิ้ง',
    'เซเว่น': 'ช้อปปิ้ง',
    '7-11': 'ช้อปปิ้ง',
    'เสื้อผ้า': 'ช้อปปิ้ง',
    'สุขภาพ': 'สุขภาพ',
    'หมอ': 'สุขภาพ',
    'ยา': 'สุขภาพ',
    'โรงพยาบาล': 'สุขภาพ',
    'บันเทิง': 'บันเทิง',
    'หนัง': 'บันเทิง',
    'เกม': 'บันเทิง',
    'การศึกษา': 'การศึกษา',
    'เรียน': 'การศึกษา',
    'หนังสือ': 'การศึกษา',
    'ออม': 'ออมเงิน',
    'เก็บ': 'ออมเงิน',
};

const INCOME_KEYWORDS = {
    'เงินเดือน': 'เงินเดือน',
    'salary': 'เงินเดือน',
    'โบนัส': 'โบนัส',
    'bonus': 'โบนัส',
    'ขาย': 'รายได้จากการขาย',
    'ค่าจ้าง': 'ค่าจ้าง',
    'freelance': 'ฟรีแลนซ์',
    'ฟรีแลนซ์': 'ฟรีแลนซ์',
    'ดอกเบี้ย': 'ดอกเบี้ย',
    'ปันผล': 'เงินปันผล',
    'คืน': 'เงินคืน',
    'refund': 'เงินคืน',
    'โอน': 'โอนเงิน',
};

const SAVINGS_KEYWORDS = {
    'กองทุน': 'กองทุน',
    'ประกัน': 'ประกัน',
    'เงินฝาก': 'เงินฝาก',
    'ฉุกเฉิน': 'เงินสำรองฉุกเฉิน',
    'เกษียณ': 'เงินเกษียณ',
    'ltf': 'LTF/SSF',
    'ssf': 'LTF/SSF',
    'rmf': 'RMF',
    'ทอง': 'ทองคำ',
    'หุ้น': 'หุ้น',
    'คริปโต': 'คริปโต',
    'crypto': 'คริปโต',
    'สลาก': 'สลากออมสิน',
    'ฝาก': 'เงินฝาก',
};

/**
 * Parse amount from Thai text (supports comma-separated numbers)
 */
function parseAmount(text) {
    const match = text.match(/[\d,]+\.?\d*/);
    if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
    }
    return null;
}

/**
 * Detect category from description text
 */
function detectCategory(text, type) {
    const keywordMaps = {
        income: INCOME_KEYWORDS,
        expense: EXPENSE_KEYWORDS,
        savings: SAVINGS_KEYWORDS,
    };
    const keywords = keywordMaps[type] || EXPENSE_KEYWORDS;
    const lowerText = text.toLowerCase();

    for (const [keyword, category] of Object.entries(keywords)) {
        if (lowerText.includes(keyword)) {
            return category;
        }
    }
    const defaults = { income: 'รายได้อื่นๆ', expense: 'โอนเงิน/ถอนเงิน', savings: 'ออมเงินทั่วไป' };
    return defaults[type] || 'อื่นๆ';
}

/**
 * Parse user manual input message
 * Formats:
 *   "รายรับ 5000 เงินเดือน"
 *   "รายจ่าย 200 อาหาร"
 *   "จ่าย 500 ค่าเช่า"
 *   "ได้ 1000 ขายของ"
 *   "+5000 เงินเดือน"
 *   "-200 อาหาร"
 */
function parseManualInput(text) {
    const trimmed = text.trim();

    // Pattern: รายรับ/ได้/เงินเข้า/+ amount description
    const incomePatterns = [
        /^(?:รายรับ|ได้|เงินเข้า|รับ|\+)\s*([\d,]+\.?\d*)\s*(.*)$/i,
        /^([\d,]+\.?\d*)\s*(?:รายรับ|ได้|เงินเข้า)\s*(.*)$/i,
    ];

    for (const pattern of incomePatterns) {
        const match = trimmed.match(pattern);
        if (match) {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            const desc = match[2].trim() || '';
            return {
                type: 'income',
                amount,
                description: desc,
                category: detectCategory(desc, 'income'),
                source: 'line',
            };
        }
    }

    // Pattern: รายจ่าย/จ่าย/เงินออก/- amount description
    const expensePatterns = [
        /^(?:รายจ่าย|จ่าย|เงินออก|ใช้|ค่า|\-)\s*([\d,]+\.?\d*)\s*(.*)$/i,
        /^([\d,]+\.?\d*)\s*(?:รายจ่าย|จ่าย|เงินออก|ค่า)\s*(.*)$/i,
    ];

    for (const pattern of expensePatterns) {
        const match = trimmed.match(pattern);
        if (match) {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            const desc = match[2].trim() || '';
            return {
                type: 'expense',
                amount,
                description: desc,
                category: detectCategory(desc, 'expense'),
                source: 'line',
            };
        }
    }

    return null;
}

/**
 * Parse savings input message
 * Formats:
 *   "ออม 500 กองทุน"
 *   "เก็บเงิน 1000 ฉุกเฉิน"
 *   "savings 2000 ประกัน"
 */
function parseSavingsInput(text) {
    const trimmed = text.trim();

    const savingsPatterns = [
        /^(?:ออม|เก็บเงิน|เก็บ|savings|save)\s*([\d,]+\.?\d*)\s*(.*)$/i,
        /^([\d,]+\.?\d*)\s*(?:ออม|เก็บเงิน|เก็บ)\s*(.*)$/i,
    ];

    for (const pattern of savingsPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            const desc = match[2].trim() || '';
            return {
                type: 'savings',
                amount,
                description: desc,
                category: detectCategory(desc, 'savings'),
                source: 'line',
            };
        }
    }

    return null;
}

/**
 * Parse bank notification messages
 * Formats:
 *   "บัญชี xxx เงินเข้า 15,000.00 บาท ..."
 *   "บัญชี xxx เงินออก 500.00 บาท ..."
 *   "โอนเงิน 1,000 บาท สำเร็จ"
 */
function parseBankNotification(text) {
    const trimmed = text.trim();

    // เงินเข้า pattern
    const inMatch = trimmed.match(/เงินเข้า\s*([\d,]+\.?\d*)\s*(?:บาท)?/);
    if (inMatch) {
        const amount = parseFloat(inMatch[1].replace(/,/g, ''));
        return {
            type: 'income',
            amount,
            description: trimmed.substring(0, 100),
            category: detectCategory(trimmed, 'income'),
            source: 'bank_notify',
        };
    }

    // เงินออก pattern
    const outMatch = trimmed.match(/เงินออก\s*([\d,]+\.?\d*)\s*(?:บาท)?/);
    if (outMatch) {
        const amount = parseFloat(outMatch[1].replace(/,/g, ''));
        return {
            type: 'expense',
            amount,
            description: trimmed.substring(0, 100),
            category: detectCategory(trimmed, 'expense'),
            source: 'bank_notify',
        };
    }

    // โอนเงิน / ชำระเงิน pattern
    const transferMatch = trimmed.match(/(?:โอนเงิน|ชำระเงิน|จ่ายเงิน)\s*([\d,]+\.?\d*)\s*(?:บาท)?/);
    if (transferMatch) {
        const amount = parseFloat(transferMatch[1].replace(/,/g, ''));
        return {
            type: 'expense',
            amount,
            description: trimmed.substring(0, 100),
            category: detectCategory(trimmed, 'expense'),
            source: 'bank_notify',
        };
    }

    return null;
}

/**
 * Parse เจ้าขุนทอง (KhunThong) bill-split messages
 * Formats:
 *   "หารบิล xxx บาท 3 คน = คนละ xxx บาท"
 *   "ยอดที่ต้องจ่าย xxx บาท"
 *   "คุณต้องจ่าย xxx บาท"
 */
function parseKhunThongMessage(text) {
    const trimmed = text.trim();

    // Check if the message is from KhunThong patterns
    const isKhunThong =
        trimmed.includes('หารบิล') ||
        trimmed.includes('ยอดที่ต้องจ่าย') ||
        trimmed.includes('คุณต้องจ่าย') ||
        trimmed.includes('แบ่งจ่าย') ||
        trimmed.includes('เจ้าขุนทอง');

    if (!isKhunThong) return null;

    // ยอดที่ต้องจ่าย / คุณต้องจ่าย
    const payMatch = trimmed.match(/(?:ยอดที่ต้องจ่าย|คุณต้องจ่าย|คนละ|แบ่งจ่ายคนละ)\s*([\d,]+\.?\d*)\s*(?:บาท)?/);
    if (payMatch) {
        const amount = parseFloat(payMatch[1].replace(/,/g, ''));
        return {
            type: 'expense',
            amount,
            description: 'หารบิลจากเจ้าขุนทอง',
            category: detectCategory(trimmed, 'expense') === 'อื่นๆ' ? 'อาหาร' : detectCategory(trimmed, 'expense'),
            source: 'khunthong',
        };
    }

    // หารบิล total amount
    const splitMatch = trimmed.match(/หารบิล\s*([\d,]+\.?\d*)\s*(?:บาท)?/);
    if (splitMatch) {
        const amount = parseFloat(splitMatch[1].replace(/,/g, ''));
        return {
            type: 'expense',
            amount,
            description: 'หารบิลจากเจ้าขุนทอง',
            category: 'หารบิล',
            source: 'khunthong',
        };
    }

    return null;
}

/**
 * Main parser - try all formats
 */
function parseMessage(text) {
    if (!text || typeof text !== 'string') return null;

    // Try KhunThong first (most specific)
    let result = parseKhunThongMessage(text);
    if (result) return result;

    // Try bank notification
    result = parseBankNotification(text);
    if (result) return result;

    // Try savings input (before manual to catch "ออม" before "เก็บ" expense)
    result = parseSavingsInput(text);
    if (result) return result;

    // Try manual input
    result = parseManualInput(text);
    if (result) return result;

    return null;
}

/**
 * Format amount for display
 */
function formatAmount(amount) {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Create LINE reply message for parsed transaction
 */
function createReplyMessage(parsed) {
    const typeEmojis = { income: '💰', expense: '💸', savings: '🏦' };
    const typeTexts = { income: 'รายรับ', expense: 'รายจ่าย', savings: 'ออมเงิน' };
    const typeEmoji = typeEmojis[parsed.type] || '📝';
    const typeText = typeTexts[parsed.type] || parsed.type;
    const sourceText = {
        line: '📱 LINE',
        bank_notify: '🏦 แจ้งเตือนธนาคาร',
        khunthong: '🐥 เจ้าขุนทอง',
        manual: '✍️ Manual',
    }[parsed.source] || parsed.source;

    return [
        `✅ บันทึกสำเร็จ!`,
        `${typeEmoji} ${typeText}: ${formatAmount(parsed.amount)} บาท`,
        `📁 หมวด: ${parsed.category}`,
        parsed.description ? `📝 ${parsed.description}` : '',
        `📡 แหล่ง: ${sourceText}`,
    ]
        .filter(Boolean)
        .join('\n');
}

module.exports = {
    parseMessage,
    parseManualInput,
    parseBankNotification,
    parseKhunThongMessage,
    parseSavingsInput,
    parseAmount,
    detectCategory,
    formatAmount,
    createReplyMessage,
};
