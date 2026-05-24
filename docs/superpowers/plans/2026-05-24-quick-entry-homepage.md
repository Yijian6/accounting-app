# Quick Entry Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the add-record homepage into a fast, premium quick-entry surface with real fixed-expense metadata.

**Architecture:** Keep the current app architecture. `RecordForm` owns the homepage interaction, `App` passes submitted data into `useRecords`, and `useRecords` normalizes the saved shape including `recurrence`. Record editing must preserve and update the same field so backup/sync flows keep the metadata.

**Tech Stack:** React 19, Vite, plain CSS, localStorage records, existing category/tag hooks.

---

## File Structure

- Modify: `src/hooks/useRecords.js`
  - Normalize `recurrence` to either `null` or `{ type: 'monthly' | 'yearly' }`.
  - Preserve recurrence on add, update, import, and storage normalization.
- Modify: `src/components/RecordForm.jsx`
  - Replace the form-first layout with the approved quick-entry layout.
  - Add fixed expense controls under the collapsed "更多" section.
  - Submit `recurrence`.
- Modify: `src/components/RecordForm.css`
  - Rebuild homepage visual hierarchy around the large amount input.
  - Keep mobile layout stable at 360px and 390px.
- Modify: `src/components/RecordList.jsx`
  - Add recurrence to the edit form so editing an existing fixed expense does not drop the field.
  - Add lightweight fixed-expense controls in the existing edit modal.
- Modify: `src/components/RecordList.css`
  - Style the fixed-expense controls added to the edit modal.
- Verify: `npm run lint`, `npm run build`, and browser checks.

---

### Task 1: Add Recurrence Normalization

**Files:**
- Modify: `src/hooks/useRecords.js`

- [ ] **Step 1: Add a recurrence normalizer**

Add this helper near `normalizeText`:

```js
function normalizeRecurrence(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (value.type !== 'monthly' && value.type !== 'yearly') {
    return null;
  }

  return { type: value.type };
}
```

- [ ] **Step 2: Include recurrence in normalized records**

Update `normalizeRecord(record)` to return:

```js
return {
  id: typeof record.id === 'string' && record.id ? record.id : generateId(),
  amount: Number.isFinite(amount) ? amount : 0,
  type: record.type === 'income' ? 'income' : 'expense',
  category: normalizeText(record.category || ''),
  tags: Array.isArray(record.tags) ? record.tags.map(normalizeText).filter(Boolean) : [],
  note: typeof record.note === 'string' ? record.note : '',
  datetime: record.datetime || new Date().toISOString(),
  recurrence: record.type === 'income' ? null : normalizeRecurrence(record.recurrence),
};
```

- [ ] **Step 3: Preserve recurrence on add**

Update `addRecord` to pass:

```js
recurrence: data.recurrence || null,
```

- [ ] **Step 4: Runtime check**

Run:

```bash
npm run lint
```

Expected: no ESLint errors.

---

### Task 2: Rebuild RecordForm Markup And State

**Files:**
- Modify: `src/components/RecordForm.jsx`

- [ ] **Step 1: Add recurrence state**

Add state:

```js
const [isFixedExpense, setIsFixedExpense] = useState(false);
const [recurrenceType, setRecurrenceType] = useState('monthly');
```

- [ ] **Step 2: Add common destination ordering**

Add constants:

```js
const DEFAULT_EXPENSE_DESTINATIONS = ['餐饮', '交通', '咖啡', '购物', '订阅', '日用', '娱乐', '其他'];
const DEFAULT_INCOME_DESTINATIONS = ['工资', '兼职', '理财', '其他'];
```

Build displayed categories by preferred names first, then remaining categories, with "其他" last where present.

- [ ] **Step 3: Submit recurrence**

Submit:

```js
recurrence: type === 'expense' && isFixedExpense ? { type: recurrenceType } : null,
```

After submit, reset:

```js
setType('expense');
setIsFixedExpense(false);
setRecurrenceType('monthly');
```

- [ ] **Step 4: Render approved layout**

Render sections in this order:

1. `quick-entry-hero`
2. `quick-destinations`
3. `quick-tags` only when category has tags
4. `quick-more`
5. sticky-ish submit button

- [ ] **Step 5: Place income/type switch in More**

Move the existing income/expense switch into "更多" and label it "记录类型".

- [ ] **Step 6: Add fixed expense controls in More**

Only show fixed expense controls when `type === 'expense'`:

```jsx
<label className="fixed-expense-toggle">
  <input
    type="checkbox"
    checked={isFixedExpense}
    onChange={(event) => setIsFixedExpense(event.target.checked)}
  />
  <span>这是固定支出</span>
</label>
```

When checked, show monthly/yearly segmented buttons.

---

### Task 3: Rebuild RecordForm Styling

**Files:**
- Modify: `src/components/RecordForm.css`

- [ ] **Step 1: Replace old form-first styles**

Keep useful class names only if they still match the new layout. The visual emphasis should be:

- Large amount prompt and input.
- Compact 4-column destination grid.
- Optional tag chips.
- Collapsed more section.
- Strong record button.

- [ ] **Step 2: Add responsive constraints**

At 360px:

- Destination buttons remain readable.
- Amount input does not overflow.
- Record button remains full width.
- More controls stack cleanly.

- [ ] **Step 3: Keep active states distinct**

Active destination, active tag, active type, and active recurrence period must be visually distinct through color plus weight/border.

---

### Task 4: Preserve Recurrence In Record Editing

**Files:**
- Modify: `src/components/RecordList.jsx`
- Modify: `src/components/RecordList.css`

- [ ] **Step 1: Include recurrence when starting edit**

Update `startEdit(record)`:

```js
recurrence: record.recurrence || null,
```

- [ ] **Step 2: Clear recurrence for income edits**

When saving:

```js
recurrence: editForm.type === 'expense' ? editForm.recurrence : null,
```

- [ ] **Step 3: Add edit controls under the existing more section**

Inside the edit modal more section, render a checkbox and monthly/yearly buttons for expense records. This keeps editing compatible with the homepage feature without redesigning the record list.

- [ ] **Step 4: Add edit recurrence styles**

Add `.edit-fixed-section`, `.edit-fixed-toggle`, and `.edit-recurrence-switch` styles so the edit controls match the existing modal.

---

### Task 5: Verify In Browser And Commit

**Files:**
- Verify: `src/hooks/useRecords.js`
- Verify: `src/components/RecordForm.jsx`
- Verify: `src/components/RecordForm.css`
- Verify: `src/components/RecordList.jsx`
- Verify: `src/components/RecordList.css`

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: no ESLint errors.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: production build succeeds.

- [ ] **Step 3: Browser verification**

Use a seeded or clean local app and verify:

- Homepage shows "今天花了多少？" and large amount input.
- Amount + category saves a normal expense.
- Tags appear only after category selection.
- More contains note, time, type switch, and fixed expense controls.
- Fixed expense saves `recurrence: { type: 'monthly' }` or `{ type: 'yearly' }`.
- 390px and 360px widths have no horizontal overflow.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-05-24-quick-entry-homepage.md src/hooks/useRecords.js src/components/RecordForm.jsx src/components/RecordForm.css src/components/RecordList.jsx src/components/RecordList.css
git commit -m "feat: redesign quick entry homepage"
```

- [ ] **Step 5: Push and deploy**

Run:

```bash
git push origin master
```

Confirm Cloudflare Pages serves the latest generated asset hash.
