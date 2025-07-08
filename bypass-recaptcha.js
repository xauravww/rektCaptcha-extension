const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // Path to the unpacked extension
  const extensionPath = path.join(__dirname, 'build');

  console.log('Launching browser in headless mode with extension...');
  const context = await chromium.launchPersistentContext('', {
    headless: true, // Run in headless mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--lang=en-US',
      '--window-size=1280,800',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ],
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  // Add network logging
  page.on('request', request => {
    console.log(`[Request] ${request.method()} ${request.url()}`);
  });
  page.on('response', response => {
    console.log(`[Response] ${response.status()} ${response.url()}`);
  });

  console.log('Navigating to the reCAPTCHA demo page...');
  await page.goto('https://www.google.com/recaptcha/api2/demo');

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
    process.exit(1);
  }

  // Now set up the network listener for form submission
  console.log('Setting up network listener for form submission...');
  let formSuccess = false;
  page.on('response', async (response) => {
    if (response.url().includes('/recaptcha/api2/demo') && response.request().method() === 'POST') {
      const status = response.status();
      const body = await response.text();
      console.log(`[Form Submission] Status: ${status}`);
      if (status === 200 && body.includes('Verification Success')) {
        formSuccess = true;
        console.log('CAPTCHA bypassed: Verification Success detected in network response!');
      } else {
        console.log('Form submission did not return expected success.');
      }
    }
  });

  console.log('Clicking the submit button...');
  await page.click('#recaptcha-demo-submit');

  // Wait for the network-based success or timeout
  const maxWait = 15000;
  const pollInterval = 500;
  let waited = 0;
  while (!formSuccess && waited < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval));
    waited += pollInterval;
  }
  if (!formSuccess) {
    console.log('Did not detect success in network response within timeout.');
  }

//   await context.close();
})(); 