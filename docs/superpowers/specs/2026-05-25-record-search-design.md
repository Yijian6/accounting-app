# Record Search Design

Date: 2026-05-25

## Background

The record page is where users return when they need proof, memory, and control. Today it can show history, edit records, delete records, and summarize income and expense, but it does not help users recover a half-remembered transaction.

The new search feature should answer one practical question:

> I vaguely remember spending money on something. Where is that record?

This should not become a heavy reporting or filter console. It should feel like a quiet retrieval surface inside the existing record page.

## Product Goal

Give users a fast way to find past records when they only remember partial clues:

- An approximate date.
- A category.
- A tag.
- A note keyword.
- An amount.
- Whether it was income, expense, or a fixed expense.

The target experience:

> The user can type one clue and locate the likely record within 3 seconds.

Examples:

```text
GPT
订阅
午餐
140
昨天
本月
上周
5月
2026-05-20
```

## Approved Direction

Use a local instant search bar on the record page.

The search entry sits below the summary cards and above the historical record list. It filters the existing record list in place. There is no separate search page, no backend search, and no AI-powered semantic search in this pass.

This preserves the current architecture:

- `RecordList` remains the record page owner.
- Records remain local data passed into `RecordList`.
- Editing, deleting, grouping, importing, exporting, and sync behavior remain unchanged.
- Search only changes which records are visible.

## Search Surface

The record page adds a compact search block:

```text
搜索记录
输入日期、分类、标签、备注或金额
```

When the user enters a query, the block shows:

```text
找到 3 条相关记录
清空
```

When there are no matches:

```text
没有找到相关记录
换个日期、分类、标签或备注试试
```

When the query is empty, the page behaves exactly like the current full history list.

## Matching Rules

Search is case-insensitive and trims extra spaces.

Each record can match through any of these fields:

- `category`
- `tags`
- `note`
- `amount`
- `type`
- `recurrence`
- formatted date values

The search is inclusive: if any field matches, the record appears.

## Text Matching

The query should match visible user text:

- Category names, such as `餐饮`, `交通`, `订阅`.
- Tag names, such as `午餐`, `奶茶`, `AI`.
- Notes, such as `朋友`, `咖啡`, `GPT`.
- Type labels, such as `收入`, `支出`.
- Fixed expense labels, such as `固定`, `月`, `年`.

Matching is substring-based. A query like `GT` should match a note containing `GPT`.

## Amount Matching

The query should match amount text in a simple, predictable way.

Examples:

```text
140
140.00
28
```

Rules:

- Match the raw amount string.
- Match the formatted amount string with two decimals.
- Match Chinese text only when it is already in another field; do not parse phrases like `一百四十`.
- Do not implement approximate phrases such as `100左右` in this pass.

## Date Matching

The first version supports common exact and relative date clues.

Exact or partial date examples:

```text
2026-05-20
2026/05/20
05-20
5-20
5月20
5月
2026年5月
```

Relative date examples:

```text
今天
昨天
前天
本周
上周
本月
上月
今年
去年
```

Rules:

- Date matching uses the user's local time.
- A date clue matches records whose `datetime` falls inside the resolved date range.
- `5月` means the May of the current year.
- `2026年5月` means the full month of May 2026.
- `上周` means the previous Monday-to-Sunday range.
- `本周` means the current Monday-to-Sunday range.
- `上月` means the full previous calendar month.
- `本月` means the current calendar month.

If the query is not recognized as a date clue, it falls back to text and amount matching.

## List Behavior

Search results reuse the current grouped record list.

Rules:

- Sort order remains newest first.
- Group headers remain date-based.
- Search results should auto-expand their date groups so the user sees matching records immediately.
- When the query is cleared, the previous normal grouping behavior returns.
- The record row still supports click-to-edit.
- Long press still reveals delete.
- Clicking outside a delete-open row still closes the delete action.

## Visual Direction

The search UI should feel:

- Minimal.
- Premium.
- Quiet.
- Mobile-first.
- More like a recall field than a database filter.

Use:

- A single refined input surface.
- Small result count copy.
- A subtle clear button.
- Stable height and no layout jump.
- Existing color tokens and border radii.

Avoid:

- Heavy filter chips.
- Search result cards inside cards.
- A separate search page.
- Advanced query syntax.
- Over-explaining the feature in visible UI.

## Empty States

There are two empty states:

1. No records at all:

```text
暂无记录
```

2. Records exist, but search has no matches:

```text
没有找到相关记录
换个日期、分类、标签或备注试试
```

These states should not be confused.

## Data Compatibility

The feature must work with all existing record shapes:

```js
{
  id: string,
  amount: number,
  type: 'expense' | 'income',
  category: string,
  tags: string[],
  note: string,
  datetime: string,
  recurrence: null | { type: 'monthly' | 'yearly' }
}
```

Rules:

- Missing `tags` is treated as an empty array.
- Missing `note` is treated as an empty string.
- Missing `recurrence` is treated as `null`.
- Invalid dates should not crash the page.
- Search must not mutate record data.

## Non-Goals

Do not implement these in this pass:

- AI semantic search.
- Server-side search.
- Search history.
- Saved filters.
- Multi-field advanced filters.
- Amount ranges.
- Natural-language numeric parsing.
- Highlighting matched text inside rows.
- New storage schema.
- New route or page.

## Acceptance Criteria

- A search input appears on the record page above the historical list.
- Empty query shows the full existing record list.
- Typing a category, tag, note keyword, amount, type, or fixed-expense clue filters records instantly.
- Typing common date clues such as `今天`, `昨天`, `本周`, `上周`, `本月`, `上月`, `5月`, and `2026-05-20` filters records by date.
- Search results remain grouped by date and sorted newest first.
- Search result groups are visible immediately when a query is active.
- No-match state is distinct from the no-records state.
- Record editing still works from a search result.
- Long-press delete still works from a search result.
- Clicking outside still closes an exposed delete action.
- Existing fixed expense, income, and expense records remain searchable.
- `npm run lint` passes.
- `npm run build` passes.
- Mobile widths around 360px and 390px have no horizontal overflow.

## Spec Self-Review

- No placeholder requirements remain.
- Search is scoped to local instant filtering only.
- Date parsing rules are explicit enough for a first implementation.
- Existing record interactions are preserved.
- The feature can be implemented inside `RecordList` without storage migration.
