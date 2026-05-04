# 记账

极简个人记账 PWA。樱花粉主题，纯手写 CSS，无 UI 框架。

<p align="center">
  <img src="public/icon.svg" width="100" alt="记账图标" />
</p>

## 特性

**记一笔** — 输入金额，选分类，完成。可选标签、备注、时间默认折叠，需要时展开。

**看记录** — 按日期自动分组（今天 / 昨天 / 前天 / MM/DD 周X），点击即编辑。日期组可折叠。

**统计曲线** — 近七日 / 近三十天支出曲线，支持按分类和细分标签筛选。点击曲线上任意点查看当日金额。

**分类与标签** — 自定义支出/收入分类，分类下可设细分标签。从记账页直接管理，自动关联当前分类。

**数据管理** — 导出 JSON / CSV，导入备份（合并或覆盖），JSON 完整性校验。

**云端同步** — 基于 Cloudflare Worker + D1，密码认证，revision 冲突检测。可选功能，不开启也能正常使用。

**PWA** — 可安装到手机主屏幕，离线可用，数据存储在 localStorage。

## 技术栈

- React 19 + Vite
- 纯 CSS（CSS Variables + 手写组件样式）
- SVG 手绘曲线图表（无图表库）
- localStorage 持久化
- Cloudflare Worker + D1（可选同步后端）

## 开发

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

## 项目结构

```
src/
  components/
    RecordForm.jsx    # 记账表单
    RecordList.jsx    # 记录列表 + 编辑 + 数据管理
    Statistics.jsx    # 统计图表
    ManageItems.jsx   # 分类/标签 CRUD
    Header.jsx        # 顶部导航
    Modal.jsx         # 底部弹窗
    TagInput.jsx      # 标签选择
  hooks/
    useRecords.js     # 记录状态
    useCategories.js  # 分类状态
    useTags.js        # 标签状态
  utils/
    format.js         # 日期/金额格式化
    statistics.js     # 统计数据计算
    export.js         # CSV/JSON 导出
    backup.js         # 备份导入导出
    sync.js           # 云端同步
    storage.js        # localStorage 封装
  App.jsx             # 根组件
  index.css           # 全局主题变量
```

## 设计

| 变量 | 值 | 用途 |
|------|------|------|
| `--color-expense` | `#E8A0BF` | 支出 / 主题色 |
| `--color-income` | `#A8D5BA` | 收入 |
| `--color-primary` | `#d4a0c0` | 交互高亮 |
| `--color-bg` | `#FEFBFC` | 页面背景 |
| `--radius` | `12px` | 卡片圆角 |

移动端优先，最大宽度 480px。

## License

MIT
