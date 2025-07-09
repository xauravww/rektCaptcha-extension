const express = require('express');

const path = require('path');
const fs = require('fs');

const { chromium } = require('playwright');

const app = express();

app.use(express.json());

const EXTENSION_PATH = path.join(__dirname, 'build');
const DEMO_URL = 'https://www.google.com/recaptcha/api2/demo';



app.post('/solve-recaptcha', async (req, res) => {
  const { sitekey, url } = req.body;
  if (!sitekey) {
    console.log('[Error] sitekey is required');
    return res.status(400).json({ error: 'sitekey is required' });
  }
  const targetUrl = url || DEMO_URL;

  let browserContext;
  let page;
  let pTokens = [];
  let responseToken = null;
  let error = null;

  try {
    console.log('Launching browser in headless mode with extension...');
    browserContext = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--lang=en-US',
        '--window-size=1280,800',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ],
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });

    page = await browserContext.newPage();

    // Add network logging
    page.on('request', request => {
      console.log(`[Request] ${request.method()} ${request.url()}`);
    });
    page.on('response', response => {
      console.log(`[Response] ${response.status()} ${response.url()}`);
    });

    // Listen for the response token in network requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/recaptcha/api2/payload') && url.includes('p=')) {
        const match = url.match(/[?&]p=([^&]+)/);
        if (match && match[1]) {
          const token = decodeURIComponent(match[1]);
          pTokens.push(token);
          responseToken = token; // always keep the latest
          console.log(`[Token] Extracted response token: ${token}`);
        }
      }
    });

    console.log(`Navigating to the target page: ${targetUrl}`);
    await page.goto(targetUrl);

    // If using the demo page, fill the sitekey if needed
    if (targetUrl === DEMO_URL) {
      // The demo page already has the sitekey, so nothing to do
      console.log('Using Google reCAPTCHA demo page.');
    }

    // Wait for the reCAPTCHA iframe to appear
    console.log('Waiting for reCAPTCHA iframe to appear...');
    await page.waitForSelector('iframe[src*="recaptcha"]', { timeout: 20000 });

    // Wait for the CAPTCHA to be solved (simulate user interaction or let extension do it)
    console.log('Setting up network listener for userverify...');
    let captchaSolved = false;
    page.on('response', async (response) => {
      if (response.url().includes('/recaptcha/api2/userverify') && response.request().method() === 'POST') {
        const status = response.status();
        if (status === 200) {
          captchaSolved = true;
          console.log('CAPTCHA appears solved (userverify 200)!');
        }
      }
    });

    console.log('Waiting for CAPTCHA to be solved...');
    const maxWaitCaptcha = 120000;
    const pollIntervalCaptcha = 500;
    let waitedCaptcha = 0;
    while (!captchaSolved && waitedCaptcha < maxWaitCaptcha) {
      await new Promise(r => setTimeout(r, pollIntervalCaptcha));
      waitedCaptcha += pollIntervalCaptcha;
    }
    if (!captchaSolved) {
      console.log('CAPTCHA was not solved in time.');
      throw new Error('CAPTCHA was not solved in time.');
    }

    // Click the submit button (for demo page)
    if (targetUrl === DEMO_URL) {
      console.log('Waiting for submit button to be enabled...');
      await page.waitForSelector('#recaptcha-demo-submit:not([disabled])', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000); // Give overlays time to disappear
      console.log('Clicking the submit button via JS...');
      await page.evaluate(() => {
        document.querySelector('#recaptcha-demo-submit').click();
      });
    }

    // Wait a bit to ensure the response token is captured
    await new Promise(r => setTimeout(r, 2000));

    // Extract the g-recaptcha-response value from the page (by name)
    let gRecaptchaResponse = await page.evaluate(() => {
      return document.querySelector('[name="g-recaptcha-response"]')?.value || '';
    });
    console.log('[g-recaptcha-response]', gRecaptchaResponse);

    // If the token is empty or likely expired, poll for a new one
    let attemptCount = 0;
    if (!gRecaptchaResponse) {
      console.log('g-recaptcha-response is empty, polling for a fresh token...');
      const maxWaitToken = 30000; // 30 seconds
      const pollIntervalToken = 500;
      let waitedToken = 0;
      let lastToken = '';
      while (waitedToken < maxWaitToken) {
        await new Promise(r => setTimeout(r, pollIntervalToken));
        waitedToken += pollIntervalToken;
        // Check for new g-recaptcha-response
        const newToken = await page.evaluate(() => {
          return document.querySelector('[name="g-recaptcha-response"]')?.value || '';
        });
        if (newToken && newToken !== lastToken) {
          attemptCount++;
          console.log(`[g-recaptcha-response] Attempt #${attemptCount}: ${newToken}`);
          gRecaptchaResponse = newToken;
          break;
        }
        lastToken = newToken;
      }
      if (!gRecaptchaResponse) {
        console.log('No fresh g-recaptcha-response token found after polling.');
      }
    }

    if (!responseToken) {
      console.log('Could not extract response token.');
      throw new Error('Could not extract response token.');
    }

    console.log('Returning last response token, g-recaptcha-response, and attemptCount to client.');
    res.json({ token: responseToken, gRecaptchaResponse, attemptCount });
  } catch (err) {
    error = err.message || String(err);
    console.log(`[Error] ${error}`);
    res.status(500).json({ error });
  } finally {
    if (browserContext) {
      await browserContext.close();
      console.log('Browser context closed.');
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 