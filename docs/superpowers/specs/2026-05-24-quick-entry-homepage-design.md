# Quick Entry Homepage Design

Date: 2026-05-24

## Background

The current homepage still behaves like a compact form. It works, but it does not yet express the product's desired feeling: a minimal, premium, fast tool for capturing a spending moment before it disappears.

The redesigned homepage should feel like a quiet input instrument rather than a traditional bookkeeping form.

## Product Goal

The homepage has one core goal:

> The user can record one expense within 3 seconds; if they spend 5 more seconds, they can add tags, note, time, and fixed-expense metadata.

The default path should be:

1. Enter amount.
2. Choose destination.
3. Tap record.

Everything else is optional enhancement.

## Approved Direction

Use direction A: "ritual quick-entry input".

The homepage structure becomes:

```text
Quick amount input
Common destinations
Optional tags after category selection
Collapsed more section
Record button
```

This preserves the current architecture:

- `RecordForm` remains the homepage input surface.
- `App` continues to call `addRecord`.
- `useRecords` continues to normalize and persist records.
- Statistics can read the saved records later.

No route, storage, or app-shell rewrite is needed.

## First Screen

The first screen should show only three meaningful things:

- "今天花了多少？"
- A large amount input.
- Common expense destinations.

It should not look like a dense form. The amount input is the visual center, with calm spacing and precise numeric typography.

The user should be able to do:

```text
输入 28 -> 点 餐饮 -> 点 记录
```

## Amount Input

The amount area should:

- Default to expense mode.
- Auto-focus on page load where the browser allows it.
- Use large tabular numeric text.
- Show the currency symbol as part of the input composition.
- Keep the record button disabled when the amount is empty, non-numeric, or less than or equal to zero.

The copy should be:

```text
今天花了多少？
¥ 0.00
```

For income mode, the prompt can switch to:

```text
今天收到了多少？
¥ 0.00
```

## Common Destinations

The homepage should not feel like it is showing every possible category. The section title is:

```text
常用去向
```

Display up to eight destination buttons.

Preferred sort order for expense, only when these categories already exist:

1. 餐饮
2. 交通
3. 咖啡
4. 购物
5. 订阅
6. 日用
7. 娱乐
8. 其他

Implementation rule:

- Only show existing user categories after storage normalization.
- Use preferred defaults as a sorting reference, not as categories to create.
- Include remaining user expense categories until eight total destinations are shown.
- Keep "其他" last when present.
- If the user has fewer categories, show what exists and keep the manage button available.
- Do not invent missing categories such as "咖啡", "订阅", or "日用" when they are not in the user's saved category list.

The design should make each destination easy to tap, but not oversized. Four columns on normal mobile width is acceptable if the 360px layout remains stable.

## Optional Tags

Tags are optional enhancement. They should appear only after the user selects an expense category that has tags.

Rules:

- Do not show the tag area before category selection.
- Do not require tags.
- Selecting a different category clears selected tags.
- Tags should look lighter than destination buttons.
- The manage-tags icon remains available near the tag section.

Example:

```text
选择餐饮后：早餐 / 午餐 / 晚餐 / 咖啡 / 奶茶
```

## More Section

The "更多" section is collapsed by default.

It contains:

- Note input.
- Datetime input.
- Income / expense switch.
- Fixed expense toggle.
- Fixed expense period selector.

Income should not compete with the default expense flow. It belongs in the more section for this pass.

When the user changes type:

- Changing from expense to income clears expense-only tags.
- Fixed expense controls are only available for expenses.
- Income records save with `recurrence: null`.

## Fixed Expense

Fixed expense is a real saved field, not a visual placeholder.

Record shape:

```js
recurrence: null
```

or:

```js
recurrence: {
  type: 'monthly' | 'yearly'
}
```

Rules:

- Default is `recurrence: null`.
- The fixed expense toggle appears in "更多".
- If checked, period defaults to `monthly`.
- User can switch between `monthly` and `yearly`.
- If unchecked, save `recurrence: null`.
- Existing records without `recurrence` normalize to `null`.
- Backup, sync, and record editing should not drop the field.

If the selected category is "订阅" or contains "订阅", the UI may surface a small helper line inside more:

```text
订阅通常适合标记为固定支出。
```

Do not force the toggle on automatically.

## Submission Behavior

On submit:

- Reject invalid amount.
- Reject missing category.
- Save amount, type, category, tags, note, datetime, and recurrence.
- Reset amount, category, tags, note, recurrence, and more state.
- Reset datetime to current time.
- Keep default type as expense after submission.

The submit button text remains:

```text
记录
```

## Visual Direction

The homepage should feel:

- Fast.
- Quiet.
- Premium.
- Mobile-first.
- More like an instrument than a form.

Use:

- Warm light background.
- Large numeric amount.
- Refined destination buttons.
- Soft active state.
- One accent color.
- Predictable bottom record button.

Avoid:

- Card-within-card layout.
- A dense table-like form.
- Showing tags before category selection.
- Making income equal-weight with expense on the first screen.
- Decorative charts or gradients.

## Accessibility and Mobile Constraints

- All tap targets should be at least 44px tall where practical.
- Text must not overflow at 360px width.
- The record button must remain reachable without awkward scrolling.
- Buttons must have clear active states that do not rely only on color.
- Native inputs should keep correct keyboard behavior on mobile.

## Non-Goals

- Do not implement fixed-expense statistical attribution in this pass.
- Do not add subscription auto-detection.
- Do not add recurring reminders.
- Do not add a budget system.
- Do not rewrite record list or statistics page.
- Do not migrate all existing storage data.

## Acceptance Criteria

- The homepage first screen shows amount input and common destinations without feeling like a traditional form.
- A normal expense can be saved with amount and category only.
- Tags appear only after selecting a category with tags.
- More section contains note, time, income/expense switch, and fixed expense controls.
- Fixed expense metadata is saved as `recurrence`.
- Existing records without recurrence continue to work.
- `npm run lint` passes.
- `npm run build` passes.
- Browser verification covers 390px and 360px mobile widths with no horizontal overflow.
