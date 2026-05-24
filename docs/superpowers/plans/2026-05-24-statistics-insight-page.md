# Statistics Insight Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the statistics tab into a premium, useful insight page that immediately answers where money went and what changed.

**Architecture:** Move statistical meaning into pure functions in `src/utils/statistics.js`, then render a single inline page in `src/components/Statistics.jsx`. Keep storage unchanged, but shape the calculation layer so fixed-expense attribution can replace payment-date amounts later without rewriting the page.

**Tech Stack:** React 19, Vite, plain CSS, existing localStorage-backed records, no charting library.

---

## File Structure

- Modify: `src/utils/statistics.js`
  - Owns date ranges, validation, period comparison, category ranking, composition segments, attention copy, and selected-category detail.
  - Exports `getStatisticsInsightViewModel(records, periodDays, selectedCategory, now)`.
  - Keeps `getStatisticsViewModel(...)` as a compatibility alias for any older caller.
- Modify: `src/components/Statistics.jsx`
  - Renders the full statistics tab as an inline page.
  - Owns UI-only state: selected period and selected category.
  - Uses the view model only; it should not recalculate business logic.
- Modify: `src/components/Statistics.css`
  - Replaces modal/sparkline styles with a mobile-first insight layout.
  - Uses stable dimensions for bars, rows, and touch targets to avoid layout shift.
- Verify: `npm run lint`, `npm run build`, and browser checks at mobile widths.

## Implementation Notes

- This pass does not add new record fields or a fixed-expense input UI.
- If a future record contains attribution metadata, the calculation layer should have a clear place to consume it.
- Current records are treated as immediate expenses and counted on their payment date.
- The statistics page should not open a modal. It is the page.

---

### Task 1: Rewrite The Statistics View Model

**Files:**
- Modify: `src/utils/statistics.js`

- [ ] **Step 1: Replace the existing curve-focused model with an insight model**

Implement these exported functions and internal helpers:

```js
export function getStatisticsInsightViewModel(
  records,
  periodDays = 7,
  selectedCategory = '',
  now = new Date()
) {
  // Returns period totals, comparison, ranked categories, composition,
  // attention callout, selected category detail, and fixedExpenseSummary.
}

export function getStatisticsViewModel(records, periodDays, selectedCategory = 'all', selectedTag = 'all', now = new Date()) {
  return getStatisticsInsightViewModel(records, periodDays, selectedCategory === 'all' ? '' : selectedCategory, now);
}
```

- [ ] **Step 2: Calculate current and previous equal-length periods**

Use inclusive day ranges with an exclusive end:

```js
const currentRange = getPeriodRange(periodDays, now);
const previousRange = {
  start: addDays(currentRange.start, -periodDays),
  end: addDays(currentRange.end, -periodDays),
  endExclusive: currentRange.start,
};
```

- [ ] **Step 3: Build category comparisons**

For each category, compute:

```js
{
  name,
  currentAmount,
  previousAmount,
  share,
  changeAmount,
  changePercent,
  changeState,
  series,
  recentRecords
}
```

Sort by `currentAmount` descending and return the top five real categories. Group overflow only in `compositionSegments` as `其他`.

- [ ] **Step 4: Generate plain-language insight copy**

Use deterministic copy rules:

```js
if (currentTotal === 0) insightTitle = '这段时间几乎没有支出';
else insightTitle = `钱主要花在${topCategory.name}`;
```

The insight body should mention share and comparison, for example:

```text
占最近7天支出的42%，比前7天多 ¥86.00。
```

- [ ] **Step 5: Add fixed-expense compatibility summary**

Return:

```js
fixedExpenseSummary: {
  total: 0,
  dailyAverage: 0,
  count: 0,
  description: '当前记录都按付款日计入；固定支出归属入口已预留。'
}
```

When future records include attribution metadata, this object becomes the display contract for fixed expenses.

- [ ] **Step 6: Run a focused runtime check**

Run:

```bash
node --input-type=module -e "import('./src/utils/statistics.js').then(({getStatisticsInsightViewModel}) => { const now = new Date('2026-05-24T12:00:00+08:00'); const records = [{id:'1',type:'expense',amount:100,category:'餐饮',tags:[],datetime:'2026-05-24T04:00:00.000Z'},{id:'2',type:'expense',amount:50,category:'交通',tags:[],datetime:'2026-05-23T04:00:00.000Z'},{id:'3',type:'expense',amount:30,category:'餐饮',tags:[],datetime:'2026-05-17T04:00:00.000Z'}]; const vm = getStatisticsInsightViewModel(records, 7, '', now); if (vm.currentTotal !== 150) throw new Error('currentTotal failed'); if (vm.previousTotal !== 30) throw new Error('previousTotal failed'); if (vm.topCategories[0].name !== '餐饮') throw new Error('ranking failed'); console.log('statistics check passed'); })"
```

Expected: `statistics check passed`

---

### Task 2: Replace The Modal UI With An Inline Insight Page

**Files:**
- Modify: `src/components/Statistics.jsx`

- [ ] **Step 1: Remove modal and curve-specific components**

Delete `CompactStatsCard`, `StatsDetailModal`, `CurveChart`, and the animation-only helpers from this file.

- [ ] **Step 2: Render the page skeleton**

The component should keep only:

```jsx
const [periodDays, setPeriodDays] = useState(7);
const [selectedCategory, setSelectedCategory] = useState('');
const vm = useMemo(
  () => getStatisticsInsightViewModel(records, periodDays, selectedCategory),
  [records, periodDays, selectedCategory]
);
```

Render these sections in order:

1. Period segmented control: `近7天`, `近30天`
2. Insight summary card
3. Category destination
4. Attention callout
5. Selected category detail

- [ ] **Step 3: Make categories interactive**

Each category row is a `button`. Clicking a row sets `selectedCategory` to that row name. If the selected category disappears after period switching, let the view model fall back to the top category and use `vm.selectedCategoryDetail?.name` as the active row:

```jsx
const activeCategoryName = vm.selectedCategoryDetail?.name || '';
```

- [ ] **Step 4: Render empty states inline**

If `vm.hasRecords` is false, show an insight card and a compact empty body. Do not open a modal, and do not show decorative charts as the main content.

---

### Task 3: Build The Premium Mobile Layout

**Files:**
- Modify: `src/components/Statistics.css`

- [ ] **Step 1: Replace old modal styles**

Remove styles for:

```css
.compact-card
.stats-detail-overlay
.stats-detail-modal
.curve-chart
.compact-sparkline
```

- [ ] **Step 2: Add stable layout primitives**

Use these core class groups:

```css
.statistics
.stats-period-switch
.stats-insight-card
.stats-composition-bar
.stats-category-list
.stats-category-row
.stats-attention-card
.stats-detail-card
.stats-day-strip
```

- [ ] **Step 3: Keep the visual tone refined**

Use a quiet warm background, one dark summary card, precise tabular numbers, compact bars, and 8px radius for repeated cards. Avoid large decorative chart canvases.

- [ ] **Step 4: Check narrow mobile constraints**

Ensure:

- No horizontal overflow at 360px.
- Buttons are at least 44px tall where practical.
- Long category names truncate cleanly.
- Text does not overlap the bars or amounts.

---

### Task 4: Verify, Commit, And Prepare Deployment

**Files:**
- Verify: `src/utils/statistics.js`
- Verify: `src/components/Statistics.jsx`
- Verify: `src/components/Statistics.css`

- [ ] **Step 1: Run static checks**

Run:

```bash
npm run lint
```

Expected: no ESLint errors.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: Vite production build succeeds and writes `dist`.

- [ ] **Step 3: Browser-check the UI**

Open the local app in the in-app browser and verify:

- Statistics tab loads without a modal.
- The first screen answers where money went.
- Period switching updates all numbers.
- Category row selection updates the detail section.
- 390px and 360px wide views have no horizontal overflow.

- [ ] **Step 4: Commit the implementation**

Run:

```bash
git add docs/superpowers/plans/2026-05-24-statistics-insight-page.md src/utils/statistics.js src/components/Statistics.jsx src/components/Statistics.css
git commit -m "feat: redesign statistics insight page"
```

- [ ] **Step 5: Push and deploy**

Push after the implementation commit succeeds. Deploy using the repository's existing deployment flow or hosting integration. If deployment is automated by GitHub, confirm the push is enough; otherwise run the deployment command documented in the project.
