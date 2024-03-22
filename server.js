"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const https = __importStar(require("https"));
const cheerio = __importStar(require("cheerio"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const cors = require('cors');
const app = express_1.default();
app.use(express_1.default.json());
app.use(cors());
const PORT = 3000;
const baseUrl = 'https://www.firmy.cz/Auto-moto/Auto-moto-sluzby/Autoservisy';
function fetchPage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}
function extractLinks(html) {
    return __awaiter(this, void 0, void 0, function* () {
        const $ = cheerio.load(html);
        const links = [];
        $('a').each((index, element) => {
            const href = $(element).attr('href');
            if (href && href.includes('?utm_source')) {
                links.push(href);
            }
        });
        return links;
    });
}
let globalLinks = [];
function crawl(startPage, totalPages) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let page = startPage; page <= totalPages; page++) {
            const pageUrl = `${baseUrl}?page=${page}`;
            console.log(`Fetching ${pageUrl}`);
            try {
                const html = yield fetchPage(pageUrl);
                let links = yield extractLinks(html);
                links = links.map(link => link.split('?utm_source')[0]); // Modify each link to remove everything after '?utm_source'
                globalLinks = globalLinks.concat(links);
                console.log(links);
            }
            catch (error) {
                console.error(`Error fetching page: ${pageUrl}`, error);
            }
        }
    });
}
function fetchScreenshot(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const browser = yield puppeteer_1.default.launch();
            const page = yield browser.newPage();
            yield page.goto(url, { waitUntil: 'networkidle0' });
            // Accept cookies if a dialog appears
            const acceptCookiesSelector = 'button[id="accept-cookies"], button[class*="accept-cookies"]'; // Example selector, adjust based on actual site
            if ((yield page.$(acceptCookiesSelector)) !== null) {
                yield page.click(acceptCookiesSelector);
            }
            const screenshotBuffer = yield page.screenshot({ fullPage: true });
            yield browser.close();
            const screenshotBase64 = screenshotBuffer.toString('base64');
            return `data:image/png;base64,${screenshotBase64}`;
        }
        catch (error) {
            throw new Error('Failed to take screenshot');
        }
    });
}
// Endpoint to serve mockup data
app.get('/api/mockup-data', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield crawl(1, 5); // Assuming you want to crawl from page 1 to 5 for this example
    const mockupData = {
        mockups: globalLinks.map(link => ({ url: link, description: 'Fetched Link Description' })),
    };
    res.json(mockupData);
}));
app.post('/api/screenshot', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const url = req.body.url;
    if (!url) {
        return res.status(400).json({ success: false, message: 'URL is required' });
    }
    try {
        const screenshotLink = yield fetchScreenshot(url);
        res.json({ success: true, screenshotLink });
    }
    catch (error) {
        console.error('Error fetching screenshot:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch screenshot' });
    }
}));
// Serve static files from the public directory
app.use(express_1.default.static(path_1.default.join(__dirname, 'src', 'public')));
// Route to serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'src', 'public', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
