import { scrapeProductPrice } from './scraper/priceScraper.js';

// Test product IDs from the store's catalog
const SAMPLE_PRODUCT_IDS = [
  687, // Nordkraft Cable Kit S
  751, // Vista Curved Monitor X
  5,   // Ironwood Microphone Pro
  934, // Amperage Motion Sensor Studio
  265, // Copperpot Monitor Max
  272, // Meridian Field Monitor Max
  612, // Amperage Indoor Camera Three
  611, // Vista Video Doorbell Three
  659, // Nordkraft Smart Ring S
  212, // Vantablack Indoor Camera Air
  482, // Meridian Earbuds Two
  965, // Copperpot Microphone Neo
  109, // Domus Pro Display Mini
  315, // Cobalt Recovery Slide Max
  569, // Vista Ultrabook Three
  324, // Vantablack Soundbar Lite
  686, // Summit USB Hub S
  378, // Summit Messenger Bag Lite
  573, // Copperpot Convertible Three
  692  // Meridian Indoor Camera S
];

async function runSingle(productId, headless = true, maxAttempts = 3) {
  console.log(`\n======================================================`);
  console.log(`TESTING PRODUCT ID: ${productId} (Headless: ${headless}, MaxRetries: ${maxAttempts})`);
  console.log(`======================================================`);

  const result = await scrapeProductPrice(productId, { headless, maxAttempts });
  console.log('\n--- Scraper Result Summary ---');
  console.log(`Success: ${result.success}`);
  if (result.success) {
    console.log('Price Data:', result.data);
  } else {
    console.log('Failure Reason:', result.reason);
  }
  console.log('Attempts Taken:', result.attempts);
  console.log(`Total Duration: ${result.totalDurationMs}ms`);
  console.log(`======================================================\n`);
  return result;
}

async function runBatch(count = 15, headless = true, maxAttempts = 3) {
  console.log(`\n======================================================`);
  console.log(`STARTING BATCH TEST SUITE (${count} RUNS, Headless: ${headless}, MaxRetries: ${maxAttempts})`);
  console.log(`======================================================`);

  const results = [];
  const testIds = SAMPLE_PRODUCT_IDS.slice(0, count);

  for (let i = 0; i < testIds.length; i++) {
    const pId = testIds[i];
    console.log(`\n[Run ${i + 1}/${testIds.length}] Testing product ${pId}...`);
    const start = Date.now();
    try {
      const res = await scrapeProductPrice(pId, { headless, maxAttempts });
      results.push({
        index: i + 1,
        productId: pId,
        success: res.success,
        price: res.data?.price,
        stock: res.data?.stock,
        currency: res.data?.currency,
        raw: res.data?.raw,
        attemptsCount: res.attempts.length,
        durationMs: Date.now() - start
      });
    } catch (e) {
      results.push({
        index: i + 1,
        productId: pId,
        success: false,
        error: e.message,
        durationMs: Date.now() - start
      });
    }
  }

  console.log(`\n======================================================`);
  console.log(`BATCH TEST RESULTS TABLE:`);
  console.table(results.map(r => ({
    Index: r.index,
    ProductID: r.productId,
    Success: r.success ? '✅ YES' : '❌ NO',
    Price: r.price ? `${r.currency || '$'}${r.price}` : 'N/A',
    Stock: r.stock ?? 'N/A',
    Attempts: r.attemptsCount || 0,
    Duration: `${r.durationMs}ms`
  })));

  const successCount = results.filter(r => r.success).length;
  console.log(`Summary: ${successCount}/${count} succeeded (${((successCount / count) * 100).toFixed(1)}%)`);
  console.log(`======================================================\n`);
}

// Execution entry point
const args = process.argv.slice(2);
const isBatch = args.includes('--batch');
const isHeaded = args.includes('--headed');
const headless = !isHeaded;

const countArg = args.find(a => a.startsWith('--count='));
const count = countArg ? parseInt(countArg.split('=')[1], 10) : 15;

const retriesArg = args.find(a => a.startsWith('--maxRetries=') || a.startsWith('--retries='));
const maxRetries = retriesArg ? parseInt(retriesArg.split('=')[1], 10) : 3;

const singleIdArg = args.find(a => !a.startsWith('--'));
const singleId = singleIdArg ? parseInt(singleIdArg, 10) : 687;

if (isBatch) {
  runBatch(count, headless, maxRetries);
} else {
  runSingle(singleId, headless, maxRetries);
}
