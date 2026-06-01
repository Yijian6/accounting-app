# Life Order UI Design

Date: 2026-06-01

## Goal

Align the main app screens with the first-stage value proposition:

> Let users record with minimal effort, clearly see where money went, and regain a quiet sense of control.

## Direction

Use a "life order instrument" direction. The app should feel quiet, precise, and personal rather than like a finance dashboard.

## Page Changes

### Quick Entry

- Keep the fast path: amount, destination, record.
- Keep optional fields collapsed.
- Make the amount input feel calmer and more deliberate.
- Use less explanatory text and more visual hierarchy.

### Records

- Reframe the top summary away from net-worth accounting.
- Show the main money destination for today and this month.
- Keep records as payment-date truth.
- Show tags, notes, and periodic markers inline so the list is more than raw流水.

### Statistics

- Keep the first question as "where did the money go?"
- Lead with a clear plain-language insight.
- Keep category composition and periodic attribution, but reduce dashboard noise.
- Avoid judgmental copy.

## Non-Goals

- No budget system.
- No new storage fields.
- No automatic categorization.
- No cloud sync changes.
- No record-level accounting refactor.

## Verification

- `npm run lint`
- `npm run build`
- Mobile render check around 390px and 360px widths
