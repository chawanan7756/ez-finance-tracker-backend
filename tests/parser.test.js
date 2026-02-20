const {
    parseMessage,
    parseManualInput,
    parseBankNotification,
    parseKhunThongMessage,
    parseAmount,
    detectCategory,
} = require('../src/line/parser');

describe('parseAmount', () => {
    test('parses integer', () => {
        expect(parseAmount('5000')).toBe(5000);
    });

    test('parses decimal', () => {
        expect(parseAmount('15000.50')).toBe(15000.5);
    });

    test('parses comma-separated', () => {
        expect(parseAmount('1,500,000.00')).toBe(1500000);
    });

    test('returns null for no number', () => {
        expect(parseAmount('ไม่มีตัวเลข')).toBeNull();
    });
});

describe('parseManualInput', () => {
    test('parses "จ่าย 200 อาหาร"', () => {
        const result = parseManualInput('จ่าย 200 อาหาร');
        expect(result).toEqual({
            type: 'expense',
            amount: 200,
            description: 'อาหาร',
            category: 'อาหาร',
            source: 'line',
        });
    });

    test('parses "รายรับ 15000 เงินเดือน"', () => {
        const result = parseManualInput('รายรับ 15000 เงินเดือน');
        expect(result).toEqual({
            type: 'income',
            amount: 15000,
            description: 'เงินเดือน',
            category: 'เงินเดือน',
            source: 'line',
        });
    });

    test('parses "+5000 freelance"', () => {
        const result = parseManualInput('+5000 freelance');
        expect(result).toEqual({
            type: 'income',
            amount: 5000,
            description: 'freelance',
            category: 'ฟรีแลนซ์',
            source: 'line',
        });
    });

    test('parses "-300 กาแฟ"', () => {
        const result = parseManualInput('-300 กาแฟ');
        expect(result).toEqual({
            type: 'expense',
            amount: 300,
            description: 'กาแฟ',
            category: 'เครื่องดื่ม',
            source: 'line',
        });
    });

    test('parses "ได้ 1000 ขายของ"', () => {
        const result = parseManualInput('ได้ 1000 ขายของ');
        expect(result).toEqual({
            type: 'income',
            amount: 1000,
            description: 'ขายของ',
            category: 'รายได้จากการขาย',
            source: 'line',
        });
    });

    test('parses "รายจ่าย 500 ค่าเช่า"', () => {
        const result = parseManualInput('รายจ่าย 500 ค่าเช่า');
        expect(result).toEqual({
            type: 'expense',
            amount: 500,
            description: 'ค่าเช่า',
            category: 'ที่อยู่อาศัย',
            source: 'line',
        });
    });

    test('returns null for unparseable text', () => {
        expect(parseManualInput('สวัสดีครับ')).toBeNull();
    });
});

describe('parseBankNotification', () => {
    test('parses "เงินเข้า 15,000.00 บาท"', () => {
        const result = parseBankNotification('บัญชี xxx-x-xxxxx-x เงินเข้า 15,000.00 บาท');
        expect(result).toEqual({
            type: 'income',
            amount: 15000,
            description: expect.any(String),
            category: 'โอนเงินเข้า',
            source: 'bank_notify',
        });
    });

    test('parses "เงินออก 500.00 บาท"', () => {
        const result = parseBankNotification('บัญชี xxx เงินออก 500.00 บาท');
        expect(result).toEqual({
            type: 'expense',
            amount: 500,
            description: expect.any(String),
            category: 'โอนเงินออก',
            source: 'bank_notify',
        });
    });

    test('parses "โอนเงิน 1,000 บาท สำเร็จ"', () => {
        const result = parseBankNotification('โอนเงิน 1,000 บาท สำเร็จ');
        expect(result).toEqual({
            type: 'expense',
            amount: 1000,
            description: expect.any(String),
            category: 'โอนเงินออก',
            source: 'bank_notify',
        });
    });

    test('returns null for non-bank message', () => {
        expect(parseBankNotification('สวัสดีครับ')).toBeNull();
    });
});

describe('parseKhunThongMessage', () => {
    test('parses "คุณต้องจ่าย 250 บาท"', () => {
        const result = parseKhunThongMessage('เจ้าขุนทอง: คุณต้องจ่าย 250 บาท');
        expect(result).toEqual({
            type: 'expense',
            amount: 250,
            description: 'หารบิลจากเจ้าขุนทอง',
            category: 'หารบิล',
            source: 'khunthong',
        });
    });

    test('parses "หารบิล 1000 บาท 4 คน"', () => {
        const result = parseKhunThongMessage('หารบิล 1000 บาท 4 คน');
        expect(result).toEqual({
            type: 'expense',
            amount: 1000,
            description: 'หารบิลจากเจ้าขุนทอง',
            category: 'หารบิล',
            source: 'khunthong',
        });
    });

    test('parses "คนละ 333.33 บาท"', () => {
        const result = parseKhunThongMessage('เจ้าขุนทอง คนละ 333.33 บาท');
        expect(result).toEqual({
            type: 'expense',
            amount: 333.33,
            description: 'หารบิลจากเจ้าขุนทอง',
            category: 'หารบิล',
            source: 'khunthong',
        });
    });

    test('returns null for non-khunthong message', () => {
        expect(parseKhunThongMessage('จ่าย 200 อาหาร')).toBeNull();
    });
});

describe('parseMessage (main parser)', () => {
    test('prioritizes KhunThong format', () => {
        const result = parseMessage('เจ้าขุนทอง คุณต้องจ่าย 500 บาท');
        expect(result.source).toBe('khunthong');
    });

    test('detects bank notification', () => {
        const result = parseMessage('บัญชี xxx เงินเข้า 10,000 บาท');
        expect(result.source).toBe('bank_notify');
    });

    test('falls back to manual input', () => {
        const result = parseMessage('จ่าย 50 กาแฟ');
        expect(result.source).toBe('line');
        expect(result.amount).toBe(50);
    });

    test('returns null for empty string', () => {
        expect(parseMessage('')).toBeNull();
    });

    test('returns null for null', () => {
        expect(parseMessage(null)).toBeNull();
    });
});
