# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 产品方向

这个产品的核心价值不是财务管理，而是帮用户用最低负担看清消费去向，在日常生活中重获秩序感和掌控感。

**目标用户**：重视生活美感和秩序感、讨厌复杂财务工具、不想被预算/目标/分析/焦虑驱动、只想清楚知道钱去了哪里的人。

**产品原则**：
1. 记录必须快到不打断生活
2. 页面必须美到愿意再次打开
3. 分类必须清晰到一眼看懂去向
4. 统计必须克制，只回答"钱去了哪里"
5. 数据属于用户，提供安全感和掌控力

**体验红线**：
- 优先路径：金额 → 去向 → 落笔
- 统计解释而非堆砌图表，偏好解读而非更多可视化
- 不引入预算、提醒、资产、净值等理财概念（除非用户明确要求）
- 文案保持平静克制，不制造焦虑、羞耻、压力，不做消费评价

**设计红线**：
- "生活秩序仪"方向：安静、精确、成熟、移动优先
- 强层次、克制用色、稳定间距、精确数字排版
- 避免通用仪表盘风格、卡片堆砌、喧闹渐变、装饰性视觉
- 360px 和 390px 手机宽度下文字不溢出

## Commands

```bash
npm run dev      # 启动 Vite 开发服务器（HMR）
npm run build    # 生成图标 + 生产构建（输出到 dist/）
npm run lint     # ESLint 检查
npm run preview  # 本地预览生产构建
```

无测试框架，验证方式是 `npm run build` 通过即可。

## 部署

Cloudflare Pages 自动部署：push 到 `origin/master` → `accounting-app-9f0.pages.dev`。每次改动完成后必须 build → commit → push。

## 架构

纯前端 PWA 记账应用。React 19 + Vite 8，**不使用 TypeScript**，纯 `.jsx` + `.css`。

### 数据层

所有数据存 localStorage，无后端。三个独立 key：

| Hook | localStorage key | 数据 |
|------|-----------------|------|
| `useRecords` | `accounting_records` | 收支记录（含周期归属） |
| `useCategories` | `accounting_categories` | 分类（expense/income） |
| `useTags` | `accounting_tags` | 标签（归属于分类） |

每个 hook 内部做 normalize（防御性解析 + 旧数据编码修复），写回 localStorage 通过 `useEffect`。`utils/storage.js` 提供统一的 `getStorage`/`setStorage` 封装。

### 页面结构

`App.jsx` 通过 `activeTab` 状态切换三个页面，无路由库：
- **记录** (`RecordForm`) — 快速记账表单，大号金额输入 + 分类横向滚动 + 标签选择
- **明细** (`RecordList`) — 按日分组的记录列表，含编辑/删除/补记/数据备份恢复
- **统计** (`Statistics`) — 周期洞察、分类去向占比、变化分析、数据册导出

`ManageItems` 是分类/标签管理的 Modal 叠加层，从任意页面触发。

### 主题系统

8 套主题（4 暗 + 4 亮），通过 `[data-theme="xxx"]` CSS 选择器切换。

- 变量定义在 `src/index.css`，所有组件只引用语义化变量
- `useTheme` hook 管理 `data-theme` 属性 + localStorage 持久化（key: `accounting_theme`）
- `ThemePicker` 是可旋转圆环调色盘（触控手势：角度旋转、惯性、吸附、点击选择）

**核心 CSS 变量**：`--accent`, `--bg`, `--bg-card`, `--bg-up`, `--bg-line`, `--text`, `--text-soft`, `--text-muted`, `--text-ghost`, `--accent-glow`, `--accent-wash`, `--accent-deep`, `--accent-pale`, `--green`, `--warn`, `--danger` + 各自的 `-soft` 变体。

**排版**：`--font-serif`（Noto Serif SC）用于金额、标题、日期等强调位置。Google Fonts 在 `index.html` 中引入。

### 视觉风格

社论式（editorial）全出血布局：无卡片边框/阴影，用 `::after` 分割线 + `::before` 色条，衬线字体强调数字。设计原型在 `public/design-prototype.html`。

### 统计引擎

`utils/statistics.js` 导出 `getStatisticsInsightViewModel(records, periodDays, selectedCategory)`，返回完整的视图模型：洞察标题/正文、分类排名、变化状态、周期归属分摊计算。`Statistics.jsx` 是纯展示层。

### 数据导出

`utils/dataBookExport.js` — 生成 HTML/Excel/JSON 三种格式的数据册。`utils/export.js` — JSON 备份导出。`utils/backup.js` — 备份导入（合并/覆盖两种模式）。

## 约定

- 每个组件一个 `.jsx` + 同名 `.css`，CSS 只用主题变量，不硬编码颜色
- 界面文案用中文，讲究韵味（如"落笔"而非"记录"，"去向"而非"分类"）
- `scripts/generate-icons.mjs` 用 sharp + puppeteer 从 SVG 生成 PNG 图标，build 时自动执行
- 改动只触及需要的文件，不做投机性抽象
- 保持现有 localStorage 数据结构，除非任务明确要求迁移
- 实现后跑 `npm run build` 验证，前端改动注意 360px/390px 宽度适配
- 每次改动完成后：build → commit → push，报告 commit 信息
