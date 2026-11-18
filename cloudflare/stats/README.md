# 拾序 · 匿名使用统计（shixu-stats）

和 Pages 上的应用分开部署的 Cloudflare Worker，地址 `https://stats.yijian6.com`。

| 路径 | 作用 | 访问 |
|---|---|---|
| `POST /collect` | 应用上报计数 | 只接受应用自己的来源（money.yijian6.com、pages.dev、安卓 / iOS 应用） |
| `GET /` | 数据看板 | 必须通过 Cloudflare Access 登录 |
| `GET /api/summary?days=180` | 看板数据 | 同上 |

## 存了什么

D1 数据库 `shixu-stats` 只有一张表 `counters(day, name, dim, count)`：哪一天、哪个事件、一个很粗的分组、一共多少次。
没有设备 ID、IP、金额、去向名、细分名或备注。事件白名单在 `src/utils/telemetryEvents.js`，应用和这里共用。
每天凌晨清理 400 天以前的计数。

## 部署

```bash
cd cloudflare/stats
npx wrangler deploy
# 改表结构时
npx wrangler d1 execute shixu-stats --remote --file schema.sql
```

改了 `src/utils/telemetryEvents.js`（加事件）后，应用和这个 Worker 都要重新部署。

## 打开看板（一次性设置）

1. Cloudflare 后台 → Zero Trust → Access → Applications → Add an application → Self-hosted。
2. 域名填 `stats.yijian6.com`，策略选 Allow，Include 选 Emails，填你自己的邮箱；登录方式用 One-time PIN。
3. 保存后，在应用详情里复制 **Application Audience (AUD) Tag**；在 Zero Trust 的 Settings 里找到团队域名（形如 `xxx.cloudflareaccess.com`）。
4. 把这两项填进 `wrangler.jsonc` 的 `vars`（`ACCESS_AUD`、`ACCESS_TEAM_DOMAIN`），重新 `npx wrangler deploy`。

两项为空或令牌校验不过时，看板和数据接口一律返回 403，不会漏出数据。
