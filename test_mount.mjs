import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message, error.stack));
  
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root', { timeout: 10000 });
  const html = await page.$eval('#root', el => el.innerHTML);
  if (html.trim() === '') {
    console.log('PAGE ERROR: React failed to mount. #root is empty.');
  } else {
    console.log('PAGE LOG: React mounted successfully.');
  }
  
  await browser.close();
})();
