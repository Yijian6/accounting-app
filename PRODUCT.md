# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

PWA，主力场景是 iPhone SE 3（375×667，Home 键机型）添加到主屏幕后以独立窗口运行。同一套网页代码另有 Capacitor 安卓壳（分支 `codex/mobile-app`），安卓端只需功能一致、不出错，体验以 iPhone 为准。

## Users

重视生活美感和秩序感、讨厌复杂财务工具、不想被预算/目标/分析/焦虑驱动、只想清楚知道钱去了哪里的人。典型场景是日常消费后随手打开，单手、几秒内记一笔；或者在一天/一周结束时安静地回看钱的去向。

## Product Purpose

用最低负担看清消费去向，在日常生活中重获秩序感和掌控感。成功的标志是：记录快到不打断生活，回看时一眼看懂钱去了哪里，并且愿意再次打开。

## Positioning

不是财务管理工具，而是「生活秩序仪」：只回答「钱去了哪里」，用解读代替图表堆砌，不评价消费。

## Operating Context

- 三个页面：记录（金额 → 去向 → 落笔）、明细（按日回看、补记、搜索、数据管理）、统计（周期洞察、分类去向、变化、数据册导出）。
- 统计周期：近 7 天、近 30 天、今日；周期性支出/收入按归属分摊到周期内。
- 分类去向最多单独展示前 5 个分类，其余合并为「其他」。

## Capabilities and Constraints

- React 19 + Vite，纯 JSX/CSS，无 TypeScript、无图表库、无后端；数据全部在 localStorage（`accounting_records` / `accounting_categories` / `accounting_tags`），结构保持兼容。
- 8 套主题（4 暗 4 亮），组件只能引用 `src/index.css` 中的语义变量，不硬编码颜色。
- 360px 和 390px 宽度下文字不溢出；iPhone SE 3 是首要验证尺寸。
- 数据可导出（备份 JSON、CSV、数据册 HTML/Excel/JSON）并可在新设备导入；备份格式向后兼容。
- 离线可用（Service Worker），每次 push 到 master 由 Cloudflare Pages 部署。

## Brand Commitments

- 名称：拾序 / 拾序记账。
- 文案中文，平静克制、讲究韵味（「落笔」而非「记录」，「去向」而非「分类」）；不制造焦虑、羞耻、压力，不做消费评价。
- 不引入预算、提醒、资产、净值等理财概念，除非用户明确要求。

## Evidence on Hand

- 用户自己长期使用产生的真实记录（存在设备本地，不在仓库里）。
- 设计原型：`public/design-prototype.html`；截图：`screenshots/`。
- 没有用户评价、市场数据或第三方背书，任何界面都不得编造。

## Product Principles

1. 记录必须快到不打断生活。
2. 页面必须美到愿意再次打开。
3. 分类必须清晰到一眼看懂去向。
4. 统计必须克制，只回答「钱去了哪里」。
5. 数据属于用户，提供安全感和掌控力。
