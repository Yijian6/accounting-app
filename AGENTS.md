# AGENTS.md

## Product North Star

This product's core value is not financial management. It helps users see where their consumption went with the lowest possible burden, so they can regain order and control in everyday life.

Core value proposition:

> Help users see their consumption destinations with minimal effort, and gain a sense of life order and control.

Users come here to turn vague spending feelings into visible life order. They are not here to be judged, lectured, or pushed into complex financial management.

## Target Users

- People who value life aesthetics and a sense of order.
- People who dislike complex financial management tools.
- People who do not want to be driven by budgets, goals, analysis, or anxiety.
- People who simply want to clearly know where their money went.

## First-Stage Product Principles

1. Recording must be fast enough that it does not interrupt life.
2. Pages must be beautiful enough that users are willing to reopen them.
3. Categories must be clear enough that users can understand consumption destinations at a glance.
4. Statistics must be restrained and only answer "where did the money go?"
5. Data belongs to the user and should provide safety and control.

Supporting principles:

- Clear classification: when users look back, they should not only see raw流水.
- Calm control: avoid anxiety, shame, pressure, and judgmental copy.
- Beauty with restraint: visual polish must never reduce clarity.

## Experience Rules

- Prioritize the path: amount -> destination -> record.
- Keep optional details collapsed unless they clearly support future clarity.
- Statistics must explain, not overwhelm.
- Prefer interpretation over more charts.
- Do not introduce budgets, reminders, assets, net worth, or accounting concepts unless explicitly requested.
- Keep periodic spending attribution: record pages preserve payment-date truth; statistics pages show attribution truth.

## Design Rules

- Follow the project's "life order instrument" direction: quiet, precise, mature, and mobile-first.
- Use strong hierarchy, restrained color, stable spacing, and precise numeric typography.
- Avoid generic dashboard styling, card clutter, loud gradients, and decorative visuals.
- Do not let text overflow on 360px and 390px mobile widths.
- Any visual polish must support speed, clarity, or control.

## Engineering Rules

- Think before coding: state assumptions when the task is ambiguous.
- Keep changes surgical: touch only files needed for the user's request.
- Simplicity first: no speculative flexibility, no unused abstractions.
- Preserve existing storage shape unless the task explicitly requires migration.
- Verify with `npm run lint` and `npm run build` after implementation.
- Check mobile rendering around 360px and 390px after frontend changes.

## Git and Deployment Rules

- After every completed change, create a Git commit.
- Tell the user the commit name and hash.
- Maintain `GIT_HISTORY.md` in this folder with commit name, time, and hash when known.
- Deploy directly after every completed change.
- Default deployment target: Cloudflare Pages project `accounting-app`.
- After deployment, report the deployed URL and whether verification succeeded.
