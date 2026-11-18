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
- 顶栏 `Header`：左上角是按主题生成的应用图标（`public/theme-icons/{theme}-192.png`）+「拾序」，换主题时图标跟着换
- **记录** (`RecordForm`) — 快速记账表单：大号金额输入（顶部「支 出」小按钮点一下切成「收 入」并转绿）+ `DestinationPicker` + 「备注 · 时间 · 周期」展开 + 落笔
- **明细** (`RecordList`) — 回看范围「日 · 月 · 年 · 全部」，含编辑/删除/补记。「年」下列表按月分组折叠（标题带当月支出和笔数，默认只展开最近一个月）。点日期标题弹出花销日历（`SpendCalendar`）：日/月下是一个月的日历（周一开头，每格是当天支出与五档深浅，点某天跳到那天），年下是 12 个月的格子（点某月切到「月」）；标题下两枚图标切换「按天/按月看 / 按去向看」，后者是这段时间的圆环 + 去向列表（数据来自 `utils/periodView.js`，按付款日计，不和上一期比），点一块只聚焦、点中心或点列表行打开与统计页同一个 `CategorySheet`。搜索：「日」「全部」下搜全部记录，「月」「年」下只搜这段时间；「数据管理」浮层集中所有数据操作：备份导出/导入、数据册（`DataBookExport`）、CSV/展示 JSON
- **统计** (`Statistics`) — 只回答「钱去了哪里」，从上到下只有四样：周期切换（今日 · 7 天 · 30 天，默认今日）→ 环形图（`DonutChart`，中心是总额或选中分类）→ 一句解读（`summarySentence`）→ 去向列表。点圆环上的一块只聚焦（这块抬起、刻度点亮、中心换成名字 + 大号百分比 + 金额，再点同一块取消），聚焦后点圆环中心才弹出分类详情；点列表行直接弹出分类详情浮层（`CategorySheet`：头部下方一行文字列出细分构成「午餐 ¥310 · 晚餐 ¥120 · 不分细分 ¥40」，半屏前 5 笔，全屏全部记录 + 搜索；点其中一笔打开 `RecordEditor` 直接改这条记录）。有周期支出时列表下方一行小字注明分摊金额。不要再往这一页加标题、卡片或第二段解读

`DonutChart` 的精致细节：外圈 72 根表盘刻度（进场顺时针依次亮起），焦点分类（选中的，没选中时是最大的）所在刻度点亮为分类色，焦点弧下垫一层模糊光晕缓慢呼吸（只动 opacity），切换周期时中心金额滚动到新值。

`Modal.jsx` 导出 `Sheet`（可跟手拖动的底部浮层，支持 content / half / full 档位，portal 到 body）和默认的 `Modal`（基于 Sheet 的普通弹层）。所有弹层都走它，保证手感一致。「整理去向与细分」（`OrganizeSheet`）是去向 / 细分的唯一管理面板：树状列出每个去向和它的细分及各自笔数，可改名、删除、新建，底部收纳「未归属的细分」。入口：记录页去向齿轮、「细分 ⚙」（展开对应去向）、长按左栏的去向、明细 → 数据管理。规则全在 `utils/taxonomy.js`（纯函数，输入输出 `{ records, categories, tags }`）：改名撞上同类型的去向 / 同去向的细分就合并（先 `ConfirmSheet` 确认）；删除有记录的去向或细分必须先在 `TransferSheet` 选去处（细分可转到同去向的细分、不分细分、新建细分或别的去向）；每种类型至少留一个；名字最长 12 字。`App.jsx` 的 `apply` 先存快照再一次性写三份数据，`UndoToast` 6 秒内可撤销。

`DestinationPicker` 是记录页、补记、编辑三处共用的去向 + 细分选择器：左栏是循环滚轮（去向列表复制成奇数份，停下后跳回中间那份；正中一行被两条细线框住，就是选中项，点一行会滚到正中并选中，滑动停下也选中正中那行），中间分割线上的强调色、右侧大括号的尖端、细分块都固定在中线上，上下对称。细分单选（数据仍是 `tags` 数组，旧的多细分记录原样保留、显示并保持选中）；没被任何记录用过的细分用虚线框；末尾「+ 新细分」原地新建并选中，长按细分可改名 / 删除。长按细分的改名 / 删除走 `App` 的整理动作（会合并、转移、可撤销），完成后选中项跟着结果走。

iOS Safari 下输入框的 `line-height` 小于字体行高会把占位文字上下截掉：`index.css` 统一给 input/textarea 设 `line-height: normal` 并去掉 search 的系统外观，组件里不要再给输入框写小行高；占位文字要在 360px 下放得下。

`RecordEditor` 是补记与编辑共用的浮层（类型切换 + 金额 + `DestinationPicker` + 备注/时间/周期），由父组件用 key 控制每次打开重新取初值。

### 动效

`src/index.css` 的 `:root` 定义 `--ease-out` 与 `--ease-spring`（CSS `linear()` 阻尼弹簧，旧系统回退 cubic-bezier）。动画只动 transform / opacity；不要写 `transition: all`；`prefers-reduced-motion` 下全局降为 1ms。Service Worker 只在生产构建注册，开发时自动注销。

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

`utils/statistics.js` 导出 `getStatisticsInsightViewModel(records, periodDays, selectedCategory)`，返回完整的视图模型：一句话解读 `summarySentence`（前半句最大去向的约数占比，后半句只说变化最大的一项，变化不足本期 5% 时说「差不多」）、分类排名、变化状态、周期归属分摊计算。`Statistics.jsx` 是纯展示层。

### 数据导出

`utils/dataBookExport.js` — 生成 HTML/Excel/JSON 三种格式的数据册，入口在「明细 → 数据管理」（`DataBookExport` 组件）。`utils/export.js` — JSON 备份导出。`utils/backup.js` — 备份导入（合并/覆盖两种模式）。

## 约定

- 每个组件一个 `.jsx` + 同名 `.css`，CSS 只用主题变量，不硬编码颜色
- 界面文案用中文，讲究韵味（如"落笔"而非"记录"，"去向"而非"分类"）
- `scripts/generate-icons.mjs` 用 sharp + puppeteer 从 SVG 生成 PNG 图标，build 时自动执行
- 改动只触及需要的文件，不做投机性抽象
- 保持现有 localStorage 数据结构，除非任务明确要求迁移
- 实现后跑 `npm run build` 验证，前端改动注意 360px/390px 宽度适配
- 每次改动完成后：build → commit → push，报告 commit 信息
