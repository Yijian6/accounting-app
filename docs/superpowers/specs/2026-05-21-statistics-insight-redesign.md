# Statistics Insight Redesign Design

Date: 2026-05-21

## Background

The current statistics page looks polished but does not answer a useful question quickly. It opens with a dark trend card and a decorative sparkline, but the user still has to infer what changed, where money went, and whether the current period is getting worse. The redesigned page must keep the refined visual tone while making the first screen immediately meaningful.

This redesign focuses on two user questions only:

1. Where did my money go?
2. Am I spending more or getting worse than before?

Everything else is out of scope for this pass: budgeting, monthly reports, net worth, income analysis, reminders, and deep accounting summaries.

## Product Goal

When the user opens the statistics tab, they should see a plain-language insight first, then the numbers and category breakdown that support it. The page should feel like a quiet personal finance assistant, not a chart gallery.

The first screen should answer:

- The current period's total expense.
- The category that took the largest share.
- How the current period compares with the previous equal-length period.
- The one category most worth paying attention to.

## Approved Direction

Use the "insight summary" direction.

The page should lead with a concise judgment, for example:

> Money mostly went to food, taking 42% of the last 7 days. That is CNY 86 more than the previous 7 days.

The visual system should remain high-end and restrained, but the sense of quality must come from information hierarchy, not decorative charting. Use one strong summary card, a compact category composition view, and one attention callout.

## Non-Goals

- Do not add budget setting.
- Do not add push reminders or notifications.
- Do not analyze income trends.
- Do not introduce a charting library.
- Do not add a full-screen statistics modal.
- Do not migrate or rewrite stored record data.
- Do not turn the page into a long report.

## Information Architecture

The statistics tab becomes a single scrollable page with five sections.

### 1. Period Switch

At the top, show a compact segmented control:

- Last 7 days
- Last 30 days

Switching the period recalculates every section on the page. If a selected category still exists in the new period, keep it selected. Otherwise select the largest expense category in the new period.

### 2. Insight Summary Card

This replaces the current dark sparkline card.

It contains:

- Period label, such as "Last 7 days".
- One sentence insight.
- Total spending for the current period.
- Change vs previous equal-length period.
- Short support sentence when useful.

Example content:

- Insight: "Most spending went to food, 42% of the last 7 days."
- Support: "That is CNY 86 more than the previous 7 days."
- Total: "CNY 612.50"
- Change: "+16% vs previous 7 days"

Comparison rules:

- Last 7 days compares against the previous 7 days.
- Last 30 days compares against the previous 30 days.
- If previous period is zero and current period is greater than zero, show "new this period" instead of a percentage.
- If both periods are zero, show a calm empty insight.
- If change is very small, show "roughly flat" instead of a noisy percentage.

### 3. Category Destination

This section answers "where did the money go?"

It contains:

- A stacked composition bar for the top expense categories.
- A ranked list of up to five categories.
- Each category row shows category name, amount, share of current period, and change vs previous period.

Ranking rules:

- Include expense records only.
- Rank by current period amount, descending.
- Show up to five categories.
- If there are more than five categories, group the rest into "Other" in the stacked bar only.
- The ranked list remains the top five real categories, not including "Other".

Each row can be tapped to select the category and update the detail section.

### 4. Attention Callout

This section answers "am I spending more or getting worse?"

It shows one most meaningful warning or reassurance:

- Prefer the category with the largest positive increase amount.
- If no category increased meaningfully, show a positive "no major increase" message.
- If the biggest category is also the biggest increase, say that directly.
- Avoid showing multiple warnings at once.

Examples:

- "Food is the main increase: CNY 86 more than the previous 7 days."
- "Transportation is down CNY 32 from the previous period."
- "No category increased meaningfully this period."

### 5. Selected Category Detail

Below the first-screen summary, show details for the selected category.

It contains:

- Category name and current period total.
- Current share of total period expense.
- Change vs previous period.
- A restrained trend line or daily bar strip for the current period.
- Recent records in that category for the current period.

This section stays inline on the page. It must not open a modal by default.

## Data Model

Use existing record fields:

- `type`
- `amount`
- `category`
- `tags`
- `note`
- `datetime`

Only records with `type === "expense"` count toward the statistics page. Invalid dates, invalid amounts, empty categories, and non-expense records are ignored for insight calculations.

No storage migration is needed.

## View Model Requirements

Create or replace the statistics view model so the component receives data that is already shaped for display.

The view model should provide:

- `periodDays`
- `periodLabel`
- `currentTotal`
- `previousTotal`
- `changeAmount`
- `changePercent`
- `changeState`: `up`, `down`, `flat`, `new`, or `none`
- `insightTitle`
- `insightBody`
- `topCategories`
- `compositionSegments`
- `attention`
- `selectedCategoryDetail`

Each category item should include:

- `name`
- `currentAmount`
- `previousAmount`
- `share`
- `changeAmount`
- `changePercent`
- `changeState`
- `series`
- `recentRecords`

The calculation layer must be pure functions so it can be tested without rendering React.

## Visual Direction

The redesign should feel premium but practical.

Use:

- Quiet warm background from the existing app.
- A single dark insight card for emphasis.
- Soft surface cards for supporting sections.
- Precise numeric typography with tabular numbers.
- One accent color for expense emphasis.
- Muted green only for decreases or improvement.
- Compact stacked bars and small inline trend visuals.

Avoid:

- Decorative chart hero without an explanatory sentence.
- Large empty canvas space.
- Dense dashboards.
- Multiple competing charts above the fold.
- Full-screen modal for basic statistics.
- Loud gradients or one-note color themes.

## Interaction Rules

- Tapping the period switch recalculates the page.
- Tapping a category row selects it and updates the detail section.
- The selected row has a subtle active state.
- Trend visuals are informational, not the primary navigation.
- The user should be able to understand the first screen without tapping anything.

## Empty States

If there are no expense records in the selected period:

- Show an insight card saying there is no spending in the period.
- Hide category composition and attention warnings.
- Show a gentle prompt to add records.

If there are expenses in the current period but none in the previous period:

- Use "new this period" instead of a percentage.

If previous period has spending but current period has none:

- Show a positive decrease message.

If only one category exists:

- Still show the category destination section.
- The stacked bar is a single segment.
- The attention callout compares that category against its previous period.

## Accessibility and Mobile Constraints

- All interactive elements are buttons.
- Touch targets should be at least 44px tall where practical.
- Text must not overflow in a 360px-wide viewport.
- Category names should truncate gracefully.
- Charts and bars must not be required to understand the insight.
- Do not rely on color alone; pair color with labels such as "up", "down", "new", or "flat".

## Testing and Verification

Calculation tests or focused runtime checks should cover:

- Empty records.
- Income-only records.
- Current period with no previous period.
- Previous period with no current period.
- Multiple expense categories.
- More than five categories.
- Last 7 days vs previous 7 days.
- Last 30 days vs previous 30 days.
- Invalid records ignored safely.

Manual UI verification should cover:

- Mobile viewport at 390x844.
- Narrow mobile viewport around 360px.
- Period switching.
- Category selection.
- First screen readability.
- No horizontal overflow.
- Existing add and record pages unaffected.

## Acceptance Criteria

- The statistics tab first screen answers "where did money go?" without requiring a tap.
- The first screen also communicates whether spending is up, down, flat, new, or absent compared with the previous equal-length period.
- The page no longer relies on a decorative sparkline as the primary meaning.
- The user can inspect a selected category inline.
- The design remains visually aligned with the app: refined, quiet, mobile-first, and not dashboard-heavy.
- `npm run lint` and `npm run build` pass.
