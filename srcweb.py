#Tool By DarkJPT

import argparse
import json
import time
import random
import asyncio
import hashlib
import ssl
from datetime import datetime, timedelta
from typing import Dict, List, Set, Optional, Tuple
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
import cloudscraper
import dns.resolver
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from fake_useragent import UserAgent
import pandas as pd
import socket
from urllib.parse import urljoin, urlparse, parse_qs
import aiohttp
import redis
from concurrent.futures import ThreadPoolExecutor, as_completed


class Config:
    def __init__(self, config_file='config.json'):
        self.data = self.load_config(config_file)
        self.cache = redis.Redis(
            host='localhost',
            port=6379,
            db=0,
            decode_responses=True
        ) if self.data.get('use_cache', False) else None

    def load_config(self, config_file):
        with open(config_file, 'r') as f:
            return json.load(f)

def load_config(self, config_file):
    defaults = {
        'delay_min': 1,
        'delay_max': 3,
        'backoff_factor': 2,
        'crawl_depth': 2,
        'bot_types': ['google', 'bing', 'facebook'],
        'max_retries': 3,
        'timeout': 30,
        'concurrent_requests': 5,
        'use_cache': False,
        'cache_ttl': 3600,
        'user_agents_rotation': True,
        'proxy_enabled': False,
        'proxy_list': []
    }
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
            defaults.update(config)
    except FileNotFoundError:
        print(f"[INFO] Config file not found, using defaults")
    return defaults


def get_advanced_headers(bot_type=None, stealth=True):
    """Return advanced HTTP headers with optional bot type."""
    ua = UserAgent()

    bots = {
        'google': {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'From': 'googlebot@google.com'
        },
        'bing': {
            'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
            'From': 'bingbot@msn.com'
        },
        'facebook': {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'From': 'facebookexternalhit@fb.com'
        },
        'stealth': {
            'User-Agent': ua.random
        }
    }

    headers = bots.get(bot_type, bots['stealth'])

    headers.update({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
    })

    return headers


def smart_delay(config, fail_count=0, response_time=0, status_code=None):
    """Calculate a smart delay based on config, response time, and failure count"""
    base_delay = random.uniform(config['delay_min'], config['delay_max'])

    if response_time > 2:
        base_delay *= 1.5

    if status_code == 429:
        base_delay *= 3
        print(f"[WARN] Rate limited detected, waiting {base_delay:.2f}s")

    backoff = config.get('backoff_factor', 1) ** fail_count
    total_delay = base_delay * backoff
    actual_delay = min(total_delay, 60)

    time.sleep(actual_delay)
    return min(fail_count + 1, 5)


def get_cache_key(url, params=None):
    """Generate MD5 cache key from URL and optional params"""
    key = url
    if params:
        key += str(sorted(params.items()))
    return hashlib.md5(key.encode()).hexdigest()


def get_from_cache(cache, key):
    """Retrieve data from Redis cache"""
    if not cache:
        return None
    try:
        data = cache.get(key)
        return json.loads(data) if data else None
    except Exception:
        return None


def save_to_cache(cache, key, data, ttl=3600):
    """Save data to Redis cache with TTL"""
    if not cache:
        return
    try:
        cache.setex(key, ttl, json.dumps(data))
    except Exception:
        pass


def check_target_advanced(url, config):
    """Enhanced target checking with more details"""
    try:
        scraper = cloudscraper.create_scraper()
        headers = get_advanced_headers(random.choice(config['bot_types']))

        start_time = time.time()
        response = scraper.get(url, headers=headers, timeout=config['timeout'])
        response_time = time.time() - start_time

        return {
            'success': response.status_code == 200,
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'response_time': response_time,
            'redirected': response.history != [],
            'final_url': response.url
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'status_code': 0
        }


import re
from urllib.parse import urljoin

def analyze_security_headers(headers):
    """Analyze security-related headers"""
    security_headers = {
        'Content-Security-Policy': headers.get('content-security-policy', 'Missing'),
        'X-Frame-Options': headers.get('x-frame-options', 'Missing'),
        'X-Content-Type-Options': headers.get('x-content-type-options', 'Missing'),
        'Strict-Transport-Security': headers.get('strict-transport-security', 'Missing'),
        'X-XSS-Protection': headers.get('x-xss-protection', 'Missing'),
        'Referrer-Policy': headers.get('referrer-policy', 'Missing')
    }

    score = sum(1 for v in security_headers.values() if v != 'Missing')
    return security_headers, f"{score}/6"


def detect_waf_cdn_advanced(headers, content=''):
    """Enhanced WAF and CDN detection"""
    waf_cdn = {}
    headers_lower = {k.lower(): v for k, v in headers.items()}
    content_lower = content.lower()

    cdn_signatures = {
        'Cloudflare': ['cf-ray', 'cf-cache-status', '__cfduid'],
        'Akamai': ['x-akamai', 'akamai-origin-hop'],
        'AWS CloudFront': ['x-amz-cf-id', 'via'],
        'Fastly': ['x-fastly', 'fastly-io'],
        'Cloudfront': ['cloudfront'],
        'Incapsula': ['x-cdn', 'incap_ses'],
        'Sucuri': ['x-sucuri']
    }

    waf_signatures = {
        'ModSecurity': ['mod_security', 'modsecurity'],
        'AWS WAF': ['x-amzn-requestid'],
        'Cloudflare WAF': ['cf-ray'],
        'Imperva': ['incapsula', 'visid_incap'],
        'F5 BIG-IP': ['bigipserver', 'f5-'],
        'Barracuda': ['barra_counter_session'],
        'Wordfence': ['wordfence']
    }

    for name, signatures in {**cdn_signatures, **waf_signatures}.items():
        for sig in signatures:
            if any(sig in h for h in headers_lower.keys()) or sig in content_lower:
                waf_cdn[name] = 'Detected'
                break

    return waf_cdn


def detect_api_endpoints(soup, base_url):
    """Detect potential API endpoints from JavaScript"""
    api_patterns = []
    scripts = soup.find_all('script')

    patterns = [
        r'/api/', r'/v\d+/', r'/rest/', r'/graphql',
        r'\.json', r'/data/', r'/ajax/'
    ]

    for script in scripts:
        if script.string:
            for pattern in patterns:
                matches = re.findall(f'["\']([^"\']*{pattern}[^"\']*)["\']', script.string)
                api_patterns.extend([urljoin(base_url, m) for m in matches])

    return list(set(api_patterns))[:20]



def detect_technologies(headers, soup):
    """Detect web technologies used"""
    tech_stack = {}

    server = headers.get('server', 'Unknown')
    tech_stack['Server'] = server

    meta_generator = soup.find('meta', {'name': 'generator'})
    if meta_generator:
        tech_stack['Generator'] = meta_generator.get('content', 'Unknown')

    scripts = soup.find_all('script', src=True)
    frameworks = {
        'React': ['react', 'react-dom'],
        'Vue': ['vue.js', 'vue.min.js'],
        'Angular': ['angular.js', 'angular.min.js'],
        'jQuery': ['jquery'],
        'Bootstrap': ['bootstrap']
    }

    detected_frameworks = []
    for script in scripts:
        src = script.get('src', '').lower()
        for framework, patterns in frameworks.items():
            if any(p in src for p in patterns):
                detected_frameworks.append(framework)

    tech_stack['Frameworks'] = list(set(detected_frameworks))
    return tech_stack


async def scrape_async(url, config, session=None):
    """Async scraping with better error handling"""
    close_session = False
    if not session:
        session = aiohttp.ClientSession()
        close_session = True

    try:
        headers = get_advanced_headers(random.choice(config['bot_types']))
        async with session.get(url, headers=headers, timeout=config['timeout']) as response:
            content = await response.text()
            soup = BeautifulSoup(content, 'lxml')
            return soup, response.status
    except Exception as e:
        print(f"[ERROR] Scraping {url}: {str(e)}")
        return None, 0
    finally:
        if close_session:
            await session.close()


def extract_structured_data(soup):
    """Extract JSON-LD and microdata"""
    structured_data = []

    json_ld_scripts = soup.find_all('script', type='application/ld+json')
    for script in json_ld_scripts:
        try:
            data = json.loads(script.string)
            structured_data.append({'type': 'JSON-LD', 'data': data})
        except:
            pass

    og_data = {}
    og_tags = soup.find_all('meta', property=lambda x: x and x.startswith('og:'))
    for tag in og_tags:
        og_data[tag.get('property')] = tag.get('content')

    if og_data:
        structured_data.append({'type': 'OpenGraph', 'data': og_data})

    return structured_data


def extract_products_advanced(soup):
    """Advanced product extraction with more fields"""
    products = []

    product_selectors = [
        ('div', {'class': lambda x: x and any(k in str(x).lower() for k in ['product', 'item', 'card'])}),
        ('article', {'class': lambda x: x and 'product' in str(x).lower()}),
    ]

    for tag, attrs in product_selectors:
        items = soup.find_all(tag, attrs)
        for item in items:
            product = {
                'title': None,
                'price': None,
                'description': None,
                'image': None,
                'url': None,
                'rating': None,
                'availability': None
            }

            title_tags = item.find_all(
                ['h1', 'h2', 'h3', 'h4'],
                class_=lambda x: x and any(k in str(x).lower() for k in ['title', 'name', 'product'])
            )
            if title_tags:
                product['title'] = title_tags[0].text.strip()

            price_tags = item.find_all(
                ['span', 'div', 'p'],
                class_=lambda x: x and 'price' in str(x).lower()
            )
            if price_tags:
                product['price'] = price_tags[0].text.strip()

            img = item.find('img')
            if img:
                product['image'] = img.get('src') or img.get('data-src')

            link = item.find('a')
            if link:
                product['url'] = link.get('href')

            rating = item.find(class_=lambda x: x and 'rating' in str(x).lower())
            if rating:
                product['rating'] = rating.text.strip()

            if product['title'] or product['price']:
                products.append(product)

    return products


from bs4 import BeautifulSoup
import cloudscraper

def analyze_forms(soup):
    """Analyze forms for security testing"""
    forms = []
    for form in soup.find_all('form'):
        form_data = {
            'action': form.get('action', 'N/A'),
            'method': form.get('method', 'GET').upper(),
            'inputs': [],
            'has_csrf': False
        }

        for input_tag in form.find_all(['input', 'textarea', 'select']):
            input_data = {
                'name': input_tag.get('name'),
                'type': input_tag.get('type', 'text'),
                'required': input_tag.has_attr('required')
            }
            form_data['inputs'].append(input_data)

            # CSRF token detection
            if input_tag.get('name') and 'csrf' in input_tag.get('name').lower():
                form_data['has_csrf'] = True

        forms.append(form_data)

    return forms


def check_website_comprehensive(url, config):
    """Comprehensive website analysis"""
    print(f"\n{'='*60}")
    print(f"🔍 Comprehensive Analysis: {url}")
    print(f"{'='*60}\n")

    result = check_target_advanced(url, config)
    ip = get_origin_ip(url)

    print(f"📍 Origin IP: {ip}")
    print(f"⚡ Status: {result.get('status_code', 'N/A')}")
    print(f"⏱️  Response Time: {result.get('response_time', 0):.2f}s")
    print(f"🔄 Redirected: {result.get('redirected', False)}")

    if result['success']:
        headers = result['headers']

        print(f"\n🛡️  Security Services:")
        waf_cdn = detect_waf_cdn_advanced(headers)
        if waf_cdn:
            for service, status in waf_cdn.items():
                print(f"   - {service}: {status}")
        else:
            print("   - None detected")

        print(f"\n🔒 Security Headers:")
        sec_headers, score = analyze_security_headers(headers)
        print(f"   Score: {score}")
        for header, value in sec_headers.items():
            status = "✓" if value != "Missing" else "✗"
            print(f"   {status} {header}: {value}")

        print(f"\n📜 SSL Certificate:")
        try:
            cert_info = get_ssl_certificate(url)
            print(f"   Issuer: {cert_info.get('issuer', 'N/A')}")
            print(f"   Expiry: {cert_info.get('expiry', 'N/A')}")
            print(f"   Valid: {cert_info.get('valid', 'Unknown')}")
        except Exception as e:
            print(f"   Error: {str(e)}")

        try:
            scraper = cloudscraper.create_scraper()
            response = scraper.get(url, headers=get_advanced_headers(), timeout=10)
            soup = BeautifulSoup(response.content, 'lxml')

            print(f"\n💻 Technology Stack:")
            tech = detect_technologies(headers, soup)
            for key, value in tech.items():
                print(f"   - {key}: {value}")

            print(f"\n🔌 Detected API Endpoints:")
            apis = detect_api_endpoints(soup, url)
            for api in apis[:5]:
                print(f"   - {api}")
            if len(apis) > 5:
                print(f"   ... and {len(apis) - 5} more")
        except Exception as e:
            print(f"[ERROR] Fetching page content: {str(e)}")

    print(f"\n{'='*60}\n")
    return result

def get_ssl_certificate(url):
    """Get SSL certificate details"""
    domain = urlparse(url).netloc
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert(binary_form=True)
                cert_obj = x509.load_der_x509_certificate(cert, default_backend())

                expiry = cert_obj.not_valid_after
                is_valid = datetime.now() < expiry

                return {
                    'issuer': cert_obj.issuer.rfc4514_string(),
                    'expiry': expiry.isoformat(),
                    'valid': is_valid,
                    'days_left': (expiry - datetime.now()).days
                }
    except Exception as e:
        return {'error': str(e)}


def get_origin_ip(url):
    """Get origin IP with multiple DNS resolvers"""
    domain = urlparse(url).netloc
    try:
        resolver = dns.resolver.Resolver()
        resolver.nameservers = ['8.8.8.8', '1.1.1.1', '208.67.222.222']  # Google, Cloudflare, OpenDNS
        answers = resolver.resolve(domain, 'A')
        ips = [str(rdata) for rdata in answers]
        return ips[0] if ips else domain
    except Exception as e:
        return f"Error: {str(e)}"


def export_results(data, format='json', filename='scrape_results'):
    """Export results in multiple formats"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    if format == 'json':
        with open(f'{filename}_{timestamp}.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

    elif format == 'csv':
        df = pd.DataFrame(data)
        df.to_csv(f'{filename}_{timestamp}.csv', index=False, encoding='utf-8')

    elif format == 'excel':
        df = pd.DataFrame(data)
        df.to_excel(f'{filename}_{timestamp}.xlsx', index=False, engine='openpyxl')

    print(f"✅ Results exported to {filename}_{timestamp}.{format}")
def extract_ui_elements(soup):
    """Extract UI elements from page"""
    return {
        'buttons': [tag.get('id', 'no-id') for tag in soup.find_all(['button', 'input'], type='submit')],
        'forms': [form.get('action', 'no-action') for form in soup.find_all('form')],
        'images': [img.get('src', 'no-src') for img in soup.find_all('img')][:50],
        'scripts': [script.get('src', 'inline') for script in soup.find_all('script')][:50]
    }


def main(args):
    config = Config().data

    if args.check:
        check_website_comprehensive(args.url, config)
        return

    print(f"🚀 Starting scrape of {args.url}")
    print(f"📊 Crawl depth: {config['crawl_depth']}, Concurrent: {config['concurrent_requests']}\n")

    try:
        scraper = cloudscraper.create_scraper()
        response = scraper.get(args.url, headers=get_advanced_headers(), timeout=config['timeout'])
        soup = BeautifulSoup(response.content, 'lxml')
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return

    results = {
        'url': args.url,
        'timestamp': datetime.now().isoformat(),
        'ui_elements': extract_ui_elements(soup),
        'products': extract_products_advanced(soup),
        'forms': analyze_forms(soup),
        'api_endpoints': detect_api_endpoints(soup, args.url),
        'structured_data': extract_structured_data(soup),
        'technologies': detect_technologies(response.headers, soup)
    }

    # Save results
    export_results(results, format=args.format, filename=args.output)

    # Save HTML
    if args.save_html:
        with open(f'{args.output}_source.html', 'w', encoding='utf-8') as f:
            f.write(soup.prettify())

    print(f"\n✅ Scraping completed successfully!")
    print(f"   - UI Elements: {len(results['ui_elements']['buttons'])} buttons, {len(results['ui_elements']['forms'])} forms")
    print(f"   - Products: {len(results['products'])}")
    print(f"   - Forms: {len(results['forms'])}")
    print(f"   - API Endpoints: {len(results['api_endpoints'])}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Enhanced Web Scraper Pro')
    parser.add_argument('url', help='Target URL')
    parser.add_argument('--check', action='store_true', help='Comprehensive website check')
    parser.add_argument('--format', default='json', choices=['json', 'csv', 'excel'], help='Export format')
    parser.add_argument('--output', default='scrape_results', help='Output filename prefix')
    parser.add_argument('--save-html', action='store_true', dest='save_html', help='Save full HTML source')
    parser.add_argument('--config', default='config.json', help='Config file path')

    args = parser.parse_args()
    main(args)