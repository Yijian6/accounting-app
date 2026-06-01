# AGENTS.md

## Product North Star

This app is not a traditional finance-management system. It is a quiet personal accounting tool for people who want life aesthetics and a sense of order.

Core value proposition:

> Let users record with minimal effort, clearly know where their money went, and regain a sense of control.

Users come here to turn vague spending feelings into visible life order. They are not here to be judged, lectured, or pushed into complex financial management.

## First-Stage Product Principles

- Fast recording: recording one expense should not feel like a separate task.
- Clear classification: when users look back, they should not only see raw流水.
- Visible destinations: statistics should first answer "where did the money go?"
- Calm control: avoid anxiety, shame, pressure, and judgmental copy.
- Local-first safety: data should stay in the user's hands by default.
- Beauty with restraint: the interface should be worth reopening, but never decorative at the cost of clarity.

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

