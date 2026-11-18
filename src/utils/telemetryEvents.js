/**
 * 匿名使用统计的事件清单：应用只发这里列出的事件，统计服务只收这里列出的事件，看板用这里的中文名。
 * 只记次数和很粗的分组（平台、类型、主题名等），永远不带金额、去向名、细分名、备注或时间点。
 * 改动这里后要同时重新部署 cloudflare/stats。
 */
export const TELEMETRY_EVENTS = {
  // 活跃与留存（每台设备每天 / 每周 / 每月最多一次）
  active_day: { label: '日活跃', group: '使用量' },
  active_week: { label: '周活跃（按开始使用的周分组）', group: '使用量' },
  active_month: { label: '月活跃', group: '使用量' },
  new_device: { label: '新设备', group: '使用量' },

  // 记账
  record_add: { label: '落笔', group: '记账' },
  record_tagged: { label: '落笔时选了细分', group: '记账' },
  backfill_add: { label: '补记', group: '记账' },
  record_edit: { label: '编辑记录', group: '记账' },
  record_delete: { label: '删除记录', group: '记账' },
  type_toggle: { label: '切换支出 / 收入', group: '记账' },
  picker_pick: { label: '选去向（点选 / 滑动）', group: '记账' },
  tag_create: { label: '新建细分', group: '记账' },
  tag_menu: { label: '长按细分', group: '记账' },

  // 明细
  review_mode: { label: '切换回看范围', group: '明细' },
  review_shift: { label: '前后翻时间', group: '明细' },
  search_use: { label: '搜索', group: '明细' },
  calendar_open: { label: '打开花销日历', group: '明细' },
  calendar_view: { label: '日历切换看法', group: '明细' },
  calendar_detail: { label: '日历里看去向详情', group: '明细' },
  calendar_jump: { label: '从日历跳转', group: '明细' },

  // 统计
  stats_period: { label: '切换统计周期', group: '统计' },
  donut_focus: { label: '点圆环聚焦', group: '统计' },
  stats_detail: { label: '打开去向详情', group: '统计' },
  detail_expand: { label: '详情上拉看全部', group: '统计' },

  // 整理
  organize_open: { label: '打开整理面板', group: '整理' },
  rename: { label: '改名', group: '整理' },
  merge: { label: '合并', group: '整理' },
  delete_item: { label: '删除去向 / 细分', group: '整理' },
  transfer: { label: '删除前转移', group: '整理' },
  undo: { label: '撤销', group: '整理' },

  // 指南与设置
  guide_open: { label: '打开页面指南', group: '指南与设置' },
  guide_demo: { label: '看演示', group: '指南与设置' },
  guide_finish: { label: '演示结束（看完 / 跳过）', group: '指南与设置' },
  settings_open: { label: '打开设置', group: '指南与设置' },
  rail_side: { label: '切换去向左右', group: '指南与设置' },
  theme: { label: '换主题', group: '指南与设置' },

  // 数据
  export: { label: '导出', group: '数据' },
  export_fail: { label: '导出失败', group: '数据' },
  import: { label: '导入备份', group: '数据' },
  import_fail: { label: '导入失败', group: '数据' },
};

export const TELEMETRY_DIM_PATTERN = /^[a-z0-9_-]{0,24}$/;
