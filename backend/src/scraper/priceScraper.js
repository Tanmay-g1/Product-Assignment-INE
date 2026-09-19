import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_TARGET_BASE_URL = process.env.TARGET_BASE_URL || 'https://demo.inelabteamdev.com';

/**
 * Dismisses any adversarial cookie overlays or modal banners that intercept clicks.
 * @param {import('playwright').Page} page
 */
async function dismissOverlays(page) {
  try {
    const cookieBtn = page.locator('button[aria-label="Accept cookies"], button:has-text("Accept")');
    if (await cookieBtn.count() > 0 && await cookieBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('[Scraper] Dismissing adversarial cookie banner...');
      await cookieBtn.first().click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(150);
    }
    // Remove overlay if lingering in DOM
    await page.evaluate(() => {
      const overlay = document.querySelector('.cookie-overlay');
      if (overlay) overlay.remove();
    }).catch(() => {});
  } catch (e) {
    // Ignore non-fatal overlay cleanup errors
  }
}

/**
 * Scrapes product price and stock for a given productId using Playwright.
 * Intercepts the genuine /api/products/:id/price response fired by the client app
 * after completing the WebAssembly Proof-of-Work challenge, behavioral fingerprinting,
 * and client-side decrypt.
 *
 * @param {string|number} productId - The product ID (e.g. 687)
 * @param {Object} [options]
 * @param {boolean} [options.headless] - Whether to run browser headless (defaults to env or true)
 * @param {number} [options.maxAttempts=3] - Maximum retry attempts
 * @param {number} [options.timeoutMs=25000] - Timeout per attempt
 * @param {string} [options.baseUrl] - Base URL of the target site
 * @returns {Promise<{
 *   success: boolean,
 *   data?: { price: number, stock: number|null, currency: string, mrp?: number, raw: any },
 *   reason?: string,
 *   attempts: Array<{ attempt: number, durationMs: number, outcome: string, detail?: string }>,
 *   totalDurationMs: number
 * }>}
 */
export async function scrapeProductPrice(productId, options = {}) {
  const isHeadless = options.headless ?? (process.env.SCRAPER_HEADLESS !== 'false');
  const maxAttempts = options.maxAttempts || 3;
  const timeoutMs = options.timeoutMs || 25000;
  const baseUrl = options.baseUrl || DEFAULT_TARGET_BASE_URL;

  const productUrl = `${baseUrl}/product/${productId}`;
  const targetPricePath = `/api/products/${productId}/price`;

  const attemptsLog = [];
  const overallStartTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStartTime = Date.now();
    let browser = null;

    try {
      console.log(`[Scraper] [Product ${productId}] Attempt ${attempt}/${maxAttempts} starting (headless: ${isHeadless})...`);

      browser = await chromium.launch({
        headless: isHeadless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--window-size=1280,800'
        ]
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();

      // In-page spy to capture the ground truth decrypted quote payload directly from client runtime
      await page.addInitScript(() => {
        window.__CAPTURED_PRICE_QUOTE__ = null;
        const origParse = JSON.parse;
        JSON.parse = function(text, reviver) {
          const res = origParse.call(this, text, reviver);
          if (res && typeof res === 'object' && ('p' in res) && ('s' in res) && ('c' in res)) {
            window.__CAPTURED_PRICE_QUOTE__ = res;
          }
          return res;
        };
      });

      // Also listen to raw network responses to log intercepted payload
      let rawNetworkResponse = null;
      let networkStatus = null;

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes(targetPricePath)) {
          networkStatus = response.status();
          try {
            const bodyText = await response.text();
            try {
              rawNetworkResponse = JSON.parse(bodyText);
            } catch (e) {
              rawNetworkResponse = { rawText: bodyText };
            }
            console.log(`[Scraper] [Product ${productId}] Intercepted raw price endpoint (${networkStatus}):`, rawNetworkResponse);
          } catch (e) {
            console.warn(`[Scraper] [Product ${productId}] Failed to read response body:`, e.message);
          }
        }
      });

      // 1. Navigate to product page
      console.log(`[Scraper] [Product ${productId}] Navigating to: ${productUrl}`);
      await page.goto(productUrl, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs
      });

      // 2. Dismiss any initial cookie overlays
      await dismissOverlays(page);

      // 3. Locate price block container
      const priceBlock = page.locator('.price-block');
      await priceBlock.waitFor({ state: 'visible', timeout: 10000 });
      const box = await priceBlock.boundingBox();

      if (!box) {
        throw new Error('Could not locate .price-block bounding box on page.');
      }

      // 4. Move inside .price-block to trigger onMouseEnter (starts dwell timer)
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.waitForTimeout(100);

      // 5. Perform >= 10 subtle mouse movements spaced by >= 75ms (requires minMoves: 8 with kr: 40ms)
      for (let i = 0; i < 12; i++) {
        const x = box.x + 30 + (i * 14);
        const y = box.y + 25 + ((i % 2) * 10);
        await page.mouse.move(x, y);
        await page.waitForTimeout(75);
      }

      // 6. Dwell >= 750ms inside price block (requires minDwellMs: 600ms)
      await page.waitForTimeout(750);

      // 7. Ensure no cookie overlay popped up during dwell
      await dismissOverlays(page);

      // 8. Wait for Reveal button to become enabled and click it
      const revealBtn = page.locator('button[aria-label="Reveal price"]');
      const isDisabled = await revealBtn.isDisabled();
      if (isDisabled) {
        console.log('[Scraper] Button still disabled, doing additional dwell and moves...');
        for (let i = 0; i < 5; i++) {
          await page.mouse.move(box.x + 40 + (i * 10), box.y + 35);
          await page.waitForTimeout(100);
        }
        await page.waitForTimeout(500);
      }

      await dismissOverlays(page);
      console.log(`[Scraper] [Product ${productId}] Clicking 'Reveal price' button...`);
      await revealBtn.click({ timeout: 5000 });

      // 9. Wait for either the decrypted quote hook or network response to resolve
      const quotePromise = page.waitForFunction(() => window.__CAPTURED_PRICE_QUOTE__, { timeout: 24000 })
        .then(handle => handle.jsonValue())
        .catch(e => null);

      const capturedQuote = await quotePromise;
      const durationMs = Date.now() - attemptStartTime;

      if (!capturedQuote) {
        if (networkStatus && networkStatus !== 200) {
          throw new Error(`Server returned status ${networkStatus} on price endpoint.`);
        }
        throw new Error(`Timed out waiting for decrypted price quote payload.`);
      }

      // 10. Normalize fields from ground truth payload
      // Schema returned: { p: price, s: stock, c: currency, m: mrp, t: timestamp, sl: seller, ... }
      const price = typeof capturedQuote.p === 'number' ? capturedQuote.p : parseFloat(capturedQuote.p);
      const stock = typeof capturedQuote.s === 'number' ? capturedQuote.s : 0;
      const currency = capturedQuote.c || 'INR';
      const mrp = typeof capturedQuote.m === 'number' ? capturedQuote.m : price;

      if (isNaN(price) || price === null || price === undefined) {
        throw new Error(`Invalid price value parsed from payload: ${JSON.stringify(capturedQuote)}`);
      }

      console.log(`[Scraper] [Product ${productId}] Success: ${currency} ${price}, Stock: ${stock}, MRP: ${mrp}`);

      attemptsLog.push({
        attempt,
        durationMs,
        outcome: 'success',
        detail: `Successfully scraped price (${currency} ${price}, stock: ${stock}) in attempt ${attempt}`
      });

      await browser.close();

      return {
        success: true,
        data: {
          price,
          stock,
          currency,
          mrp,
          raw: {
            decrypted: capturedQuote,
            network: rawNetworkResponse
          }
        },
        attempts: attemptsLog,
        totalDurationMs: Date.now() - overallStartTime
      };
    } catch (err) {
      const durationMs = Date.now() - attemptStartTime;
      const isLastAttempt = attempt === maxAttempts;
      const outcome = isLastAttempt ? 'failed' : 'retried';
      const errorMessage = err.message || String(err);

      console.warn(`[Scraper] [Product ${productId}] Attempt ${attempt} ${outcome}: ${errorMessage}`);

      attemptsLog.push({
        attempt,
        durationMs,
        outcome,
        detail: errorMessage
      });

      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {}
      }

      if (!isLastAttempt) {
        const backoffMs = attempt * 1000;
        console.log(`[Scraper] [Product ${productId}] Waiting ${backoffMs}ms before attempt ${attempt + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } else {
        return {
          success: false,
          reason: `All ${maxAttempts} attempts failed. Last error: ${errorMessage}`,
          attempts: attemptsLog,
          totalDurationMs: Date.now() - overallStartTime
        };
      }
    }
  }

  return {
    success: false,
    reason: `All ${maxAttempts} attempts exhausted without a valid price response.`,
    attempts: attemptsLog,
    totalDurationMs: Date.now() - overallStartTime
  };
}
