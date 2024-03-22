import * as https from 'https';
import * as cheerio from 'cheerio';
import express from 'express';
import path from 'path';
import { exec } from 'child_process';
import puppeteer from 'puppeteer';
import { hostname } from 'os';
const cors = require('cors');





const app = express();
app.use(express.json());
app.use(cors());
const PORT = 3000;

const baseUrl = 'https://www.firmy.cz/Auto-moto/Auto-moto-sluzby/Autoservisy';

function fetchPage(url: string): Promise<string> {
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

async function extractLinks(html: string): Promise<string[]> {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $('a').each((index, element) => {
    const href = $(element).attr('href');
    if (href && href.includes('?utm_source')) {
      links.push(href);
    }
  });

  return links;
}

let globalLinks: string[] = [];

async function crawl(startPage: number, totalPages: number): Promise<void> {
  for (let page = startPage; page <= totalPages; page++) {
    const pageUrl = `${baseUrl}?page=${page}`;
    console.log(`Fetching ${pageUrl}`);
    try {
      const html = await fetchPage(pageUrl);
      let links = await extractLinks(html);
      links = links.map(link => link.split('?utm_source')[0]); // Modify each link to remove everything after '?utm_source'
      globalLinks = globalLinks.concat(links);
      console.log(links);
    } catch (error) {
      console.error(`Error fetching page: ${pageUrl}`, error);
    }
  }
}







async function fetchScreenshot(url: string) {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    // Accept cookies if a dialog appears
    const acceptCookiesSelector = 'button[id="accept-cookies"], button[class*="accept-cookies"]'; // Example selector, adjust based on actual site
    if (await page.$(acceptCookiesSelector) !== null) {
      await page.click(acceptCookiesSelector);
    }
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    await browser.close();
    const screenshotBase64 = screenshotBuffer.toString('base64');
    return `data:image/png;base64,${screenshotBase64}`;
  } catch (error) {
    throw new Error('Failed to take screenshot');
  }
}

// Endpoint to serve mockup data
app.get('/api/mockup-data', async (req, res) => {
  await crawl(1, 5); // Assuming you want to crawl from page 1 to 5 for this example
  const mockupData = {
    mockups: globalLinks.map(link => ({ url: link, description: 'Fetched Link Description' })),
  };
  res.json(mockupData);
});

app.post('/api/screenshot', async (req, res) => {
  const url = req.body.url;
  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }
  try {
    const screenshotLink = await fetchScreenshot(url);
    res.json({ success: true, screenshotLink });
  } catch (error) {
    console.error('Error fetching screenshot:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch screenshot' });
  }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'src', 'public')));

// Route to serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
