const https = require('https');
const fs = require('fs');
const os = require('os');

class Updater {
    constructor() {
        this.currentVersion = "1.0.0";
        this.githubVersionUrl = "https://raw.githubusercontent.com";
        this.githubScriptUrl = "https://raw";
        this.ipFile = "ip.json";
    }

    getLocalIP() {
        try {
            const ifaces = os.networkInterfaces();
            for (const name of Object.keys(ifaces)) {
                for (const iface of ifaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        return iface.address;
                    }
                }
            }
        } catch (error) {
            return this.generateRandomIP();
        }
        return this.generateRandomIP();
    }

    generateRandomIP() {
        return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    checkIPCooldown() {
        try {
            if (fs.existsSync(this.ipFile)) {
                const ipData = JSON.parse(fs.readFileSync(this.ipFile, 'utf8'));
                const cooldownTime = 3 * 24 * 60 * 60 * 1000;
                if (Date.now() - ipData.timestamp < cooldownTime) {
                    return true;
                }
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    saveIP() {
        try {
            const ipData = {
                ip: this.getLocalIP(),
                timestamp: Date.now()
            };
            fs.writeFileSync(this.ipFile, JSON.stringify(ipData, null, 2));
        } catch (error) {
            // Bỏ qua lỗi
        }
    }

    fetchGitHubVersion() {
        return new Promise((resolve, reject) => {
            const req = https.get(this.githubVersionUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });
    }

    downloadNewVersion() {
        return new Promise((resolve, reject) => {
            const req = https.get(this.githubScriptUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        fs.writeFileSync('hanh_new.js', data);
                        resolve(true);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            req.on('error', reject);
            req.setTimeout(15000, () => {
                req.destroy();
                reject(new Error('Download timeout'));
            });
        });
    }

    async checkUpdate() {
        try {
            if (this.checkIPCooldown()) {
                return true;
            }

            console.log('🔍 Đang kiểm tra bản cập nhật...');
            const githubData = await this.fetchGitHubVersion();
            
            if (githubData.version === this.currentVersion) {
                console.log('✅ Đang chạy phiên bản mới nhất');
                return true;
            }

            console.log(`\n🔄 Phiên bản mới có sẵn: ${githubData.version}`);
            console.log(`📝 Phiên bản hiện tại: ${this.currentVersion}`);
            console.log(`📋 Thay đổi: ${githubData.changelog || 'Không có thông tin'}`);
            console.log('\nBạn có muốn cập nhật không? (y/n)');

            return new Promise((resolve) => {
                process.stdin.once('data', async (input) => {
                    const answer = input.toString().trim().toLowerCase();
                    
                    if (answer === 'y' || answer === 'yes') {
                        try {
                            console.log('⬇️ Đang tải bản cập nhật...');
                            await this.downloadNewVersion();
                            console.log('✅ Cập nhật thành công! File mới: hanh_new.js');
                            this.saveIP();
                            resolve(true);
                        } catch (error) {
                            console.log('❌ Lỗi khi tải bản cập nhật:', error.message);
                            resolve(true);
                        }
                    } else {
                        console.log('⏸️ Bỏ qua cập nhật.');
                        this.saveIP();
                        resolve(true);
                    }
                });
            });

        } catch (error) {
            console.log('⚠️ Không thể kiểm tra bản cập nhật, tiếp tục chạy...');
            return true;
        }
    }
}

module.exports = Updater;
