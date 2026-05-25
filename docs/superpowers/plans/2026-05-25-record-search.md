# Record Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal, premium instant search experience to the record page so users can recover past records from partial clues.

**Architecture:** Keep the feature local to `RecordList`. Add pure helper functions for query normalization, date-range parsing, and record matching, then feed the existing grouped list from filtered records. Search affects only visibility and must not mutate record data.

**Tech Stack:** React, plain JavaScript, existing CSS tokens, Vite, ESLint.

---

## File Structure

- Modify `src/components/RecordList.jsx`
  - Add `searchQuery` state.
  - Add pure helper functions near the top of the file.
  - Filter records before sorting/grouping.
  - Render search input, result count, clear button, and search empty state.
  - Preserve editing and long-press delete behavior.

- Modify `src/components/RecordList.css`
  - Add search block, input, result summary, clear button, and no-match empty state styles.
  - Keep the UI compact, mobile-first, and visually consistent with current tokens.

## Task 1: Search Helpers

**Files:**
- Modify: `src/components/RecordList.jsx`

- [ ] **Step 1: Add helper functions**

Add helpers above `RecordList`:

```js
function normalizeSearchText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
```

- [ ] **Step 2: Add relative date parsing**

Support `今天`, `昨天`, `前天`, `本周`, `上周`, `本月`, `上月`, `今年`, `去年`.

- [ ] **Step 3: Add exact/partial date parsing**

Support these query shapes:

```text
2026-05-20
2026/05/20
05-20
5-20
5月20
5月
2026年5月
```

- [ ] **Step 4: Add record matching**

Create `recordMatchesSearch(record, query)` that returns `true` when the query matches:

- category
- tags
- note
- amount
- type labels
- recurrence labels
- date range
- formatted date text

## Task 2: Wire Search Into RecordList

**Files:**
- Modify: `src/components/RecordList.jsx`

- [ ] **Step 1: Add `searchQuery` state**

```js
const [searchQuery, setSearchQuery] = useState('');
```

- [ ] **Step 2: Derive `visibleRecords`**

Use all records when the normalized query is empty. Otherwise filter with `recordMatchesSearch`.

- [ ] **Step 3: Sort and group visible records**

Use `visibleRecords` as the source for `sortedRecords` and `groupedRecords`.

- [ ] **Step 4: Auto-expand groups while searching**

When `searchQuery` is active, date groups should render as expanded without mutating `expandedGroups`.

## Task 3: Search UI

**Files:**
- Modify: `src/components/RecordList.jsx`
- Modify: `src/components/RecordList.css`

- [ ] **Step 1: Render the search block**

Place it after summary cards and before `.list-actions`.

- [ ] **Step 2: Add result metadata**

When searching, display:

```text
找到 N 条相关记录
```

Also show a clear button.

- [ ] **Step 3: Add the search no-match state**

When records exist but no result matches, show:

```text
没有找到相关记录
换个日期、分类、标签或备注试试
```

- [ ] **Step 4: Keep the original no-records state**

When there are no records at all, continue showing:

```text
暂无记录
```

## Task 4: Verification

**Files:**
- Modify: `src/components/RecordList.jsx`
- Modify: `src/components/RecordList.css`

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: pass.

- [ ] **Step 3: Manual browser smoke check**

Check that:

- Empty query shows all records.
- Search by category filters records.
- Search by note filters records.
- Search by amount filters records.
- Search by relative date filters records.
- Editing from a search result still opens the edit modal.
- Long-press delete still reveals the delete button.
- Mobile width does not overflow.

## Task 5: Commit And Deploy

**Files:**
- Modify: `src/components/RecordList.jsx`
- Modify: `src/components/RecordList.css`
- Add: `docs/superpowers/plans/2026-05-25-record-search.md`

- [ ] **Step 1: Commit**

```bash
git add docs/superpowers/plans/2026-05-25-record-search.md src/components/RecordList.jsx src/components/RecordList.css
git commit -m "feat: add record search"
```

- [ ] **Step 2: Push**

```bash
git push origin master
```

- [ ] **Step 3: Check deployed page**

Confirm Cloudflare serves the new build at:

```text
https://accounting-app-9f0.pages.dev
```

## Self-Review

- The plan maps directly to the approved spec.
- No storage migration is needed.
- Existing record edit and delete interactions stay inside the current row code.
- No placeholder tasks remain.
- Verification includes lint, build, and interaction smoke checks.
