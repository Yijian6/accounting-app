import puppeteer from 'puppeteer';

const OUTDIR = 'C:/Users/觉/Desktop/accounting-app/screenshots';
const URL = 'http://localhost:5176';

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const relativeDate = (offset) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
};

const today = relativeDate(0);
const yesterday = relativeDate(-1);
const dayBefore = relativeDate(-2);
const earlierThisWeek = relativeDate(-5);

const sampleRecords = [
  { id: 'r1', type: 'expense', amount: 35.50, category: '餐饮', tags: [], note: '午饭', datetime: `${today}T12:30:00` },
  { id: 'r2', type: 'expense', amount: 128, category: '交通', tags: [], note: '打车', datetime: `${today}T09:15:00` },
  { id: 'r3', type: 'expense', amount: 68, category: '购物', tags: [], note: '', datetime: `${yesterday}T18:20:00` },
  { id: 'r4', type: 'expense', amount: 15, category: '餐饮', tags: [], note: '早餐', datetime: `${yesterday}T08:00:00` },
  { id: 'r5', type: 'expense', amount: 200, category: '娱乐', tags: [], note: '电影', datetime: `${dayBefore}T20:00:00` },
  { id: 'r6', type: 'expense', amount: 45, category: '餐饮', tags: [], note: '晚饭', datetime: `${dayBefore}T19:00:00` },
  { id: 'r7', type: 'expense', amount: 89, category: '购物', tags: [], note: '日用品', datetime: `${earlierThisWeek}T15:00:00` },
  { id: 'r8', type: 'expense', amount: 32, category: '交通', tags: [], note: '地铁', datetime: `${earlierThisWeek}T08:30:00` },
  { id: 'r9', type: 'income', amount: 5000, category: '工资', tags: [], note: '本月工资', datetime: `${earlierThisWeek}T10:00:00` },
];

const sampleCategories = [
  { id: 'c1', name: '餐饮', type: 'expense' },
  { id: 'c2', name: '交通', type: 'expense' },
  { id: 'c3', name: '购物', type: 'expense' },
  { id: 'c4', name: '娱乐', type: 'expense' },
  { id: 'c5', name: '住房', type: 'expense' },
  { id: 'c6', name: '工资', type: 'income' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  // Seed localStorage
  console.log('Loading app and seeding data...');
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate((data) => {
    localStorage.setItem('accounting_records', JSON.stringify(data.records));
    localStorage.setItem('accounting_categories', JSON.stringify(data.categories));
    localStorage.setItem('accounting_tags', '[]');
  }, { records: sampleRecords, categories: sampleCategories });

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(1000);

  // Helper: screenshot clipped to #root, with optional extra crop from bottom
  async function takeScreenshot(filename, cropBottomPx = 0) {
    const root = await page.$('#root');
    const box = await root.boundingBox();
    // Crop bottom whitespace. At 2x scale, cropBottomPx is in CSS pixels.
    const cropPx = cropBottomPx * 2; // device scale factor 2
    await page.screenshot({
      path: `${OUTDIR}/${filename}`,
      clip: {
        x: 0,
        y: 0,
        width: box.width,
        height: Math.max(box.height - cropPx, 400),
      },
    });
    const actualH = Math.round((box.height - cropPx) / 2);
    console.log(`  ${filename}: ${Math.round(box.width / 2)}x${actualH}`);
  }

  // Screenshot 1: Add page — crop some empty bottom space
  console.log('Screenshot: add page');
  await takeScreenshot('add.png', 80);

  // Screenshot 2: List page
  console.log('Switching to list...');
  await page.evaluate(() => {
    document.querySelectorAll('.header-tab')[1]?.click();
  });
  await sleep(800);
  console.log('Screenshot: list page');
  await takeScreenshot('list.png', 0);

  // Screenshot 3: Stats page — crop bottom records list
  console.log('Switching to stats...');
  await page.evaluate(() => {
    document.querySelectorAll('.header-tab')[2]?.click();
  });
  await sleep(800);
  console.log('Screenshot: stats page');
  await takeScreenshot('stats.png', 100);

  // Screenshot 4: Stats detail modal
  console.log('Opening stats detail...');
  await page.evaluate(() => document.querySelector('.compact-card')?.click());
  await sleep(800);
  console.log('Screenshot: stats detail');
  await takeScreenshot('detail.png', 0);

  console.log('All screenshots saved!');
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
