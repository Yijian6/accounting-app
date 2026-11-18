/**
 * 页面指南：点左上角「拾序」打开当前页的指南清单，每条可以「演示」。
 * 演示用聚光灯指向真实界面上带 data-guide 的元素；target 可以给多个候选，取第一个找得到的。
 * 演示只负责指，不替用户点，也不改任何数据。改文案只改这个文件。
 */

export const GUIDES = {
  add: {
    title: '「记录」怎么用',
    items: [
      {
        title: '记一笔',
        desc: '金额 → 去向 → 细分（可不选）→ 落笔',
        steps: [
          { target: 'amount', title: '先写金额', body: '打开就能直接输入，不用先点任何地方。' },
          { target: 'wheel', title: '滚轮选去向', body: '上下滑动，停在两条细线中间的就是选中的去向；也可以直接点一行。' },
          { target: 'branch', title: '细分可选可不选', body: '选好去向后，它的细分会从大括号里展开。点一下选中，再点取消。' },
          { target: 'submit', title: '落笔', body: '金额和去向都有了，按钮就会亮起，点一下就记好了。' },
        ],
      },
      {
        title: '支出与收入',
        desc: '点顶部「支 出」切换成「收 入」',
        steps: [
          { target: 'type', title: '切换支出 / 收入', body: '点这里，「支 出」会变成绿色的「收 入」，左栏也换成收入的来源。再点一次换回来。' },
        ],
      },
      {
        title: '新建和整理细分',
        desc: '末尾「+ 新细分」新建；长按细分改名或删除',
        steps: [
          { target: ['add-tag', 'branch'], title: '新建细分', body: '选好去向后，细分末尾有「+ 新细分」，原地输入、回车，就建好并选中了。' },
          { target: 'branch', title: '长按细分', body: '按住一个细分，会弹出「改名 / 删除」。改成已有的名字会合并；有记录的细分删除前会先让你安排去处。' },
          { target: 'branch', title: '虚线框', body: '还没被任何记录用过的细分是虚线框，用过的是实线。' },
        ],
      },
      {
        title: '管理去向',
        desc: '齿轮或长按左栏的去向，打开整理面板',
        steps: [
          { target: 'manage', title: '整理去向与细分', body: '点齿轮打开整理面板：每个去向和细分都标着用了多少笔，点细分或「···」就能改名、删除。' },
          { target: 'wheel', title: '长按左栏的去向', body: '按住左栏里的某个去向，也会直接打开整理面板并展开它。' },
          { target: 'manage', title: '放心改', body: '改名、合并、删除之后，底部会出现 6 秒的「撤销」。' },
        ],
      },
      {
        title: '备注、时间、周期',
        desc: '「···」里展开，按需填写',
        steps: [
          { target: 'more', title: '更多信息', body: '点这里可以写一句备注、改成别的时间，或者标记为每月 / 每年的周期支出。' },
        ],
      },
    ],
  },

  list: {
    title: '「明细」怎么用',
    items: [
      {
        title: '换一段时间看',
        desc: '日 · 月 · 年 · 全部，左右滑动切换',
        steps: [
          { target: 'review-modes', title: '选回看范围', body: '按日、按月、按年或全部记录来看。' },
          { target: 'review-nav', title: '前后翻', body: '点两边的箭头，或在这一块左右滑动，换到前一天 / 前一个月 / 前一年。' },
          { target: 'metrics', title: '这段时间的总数', body: '这段时间一共花了多少、收到多少、记了几笔。' },
        ],
      },
      {
        title: '花销日历',
        desc: '点日期打开，每格是当天花了多少',
        steps: [
          { target: 'review-title', title: '点日期打开日历', body: '每一格是那天花了多少，颜色越深花得越多。点某一天就跳到那天。在「年」下是 12 个月的格子。' },
          { target: 'review-title', title: '点一下试试', body: '结束演示后，点这里打开日历看看。' },
        ],
      },
      {
        title: '按去向看',
        desc: '日历里切到圆环，点去向看明细',
        steps: [
          { target: 'review-title', title: '日历里的圆环', body: '打开日历后，月份下方有两枚小图标：左边按天看，右边按去向看。圆环显示这个月钱都去了哪里。' },
          { target: 'review-title', title: '点去向看明细', body: '在圆环下面点任意一个去向，就能看到这段时间它的每一笔和细分构成，点某一笔还能直接改。' },
        ],
      },
      {
        title: '改一笔、删一笔、补记',
        desc: '点开编辑，长按删除，「补记这天」',
        steps: [
          { target: ['record-row', 'records-empty'], title: '改一笔', body: '点任意一笔记录，打开编辑；改金额、去向、细分、时间都可以。' },
          { target: ['record-row', 'records-empty'], title: '删一笔', body: '按住一笔记录，右侧会出现「删除」。' },
          { target: ['add-day', 'review-modes'], title: '补记', body: '在「日」下，「补记这天」可以给那一天补一笔，时间会自动落在那天。' },
        ],
      },
      {
        title: '搜索和数据管理',
        desc: '找某一笔；备份、导出数据',
        steps: [
          { target: 'search', title: '搜索', body: '输入日期、去向、细分、备注或金额都能找到。「日」下搜全部记录，「月」「年」下只搜那段时间。' },
          { target: 'data-manager', title: '数据管理', body: '导出备份、导入备份、导出数据册，以及整理去向与细分，都在这里。数据只存在你的手机里，定期备份更安心。' },
        ],
      },
    ],
  },

  stats: {
    title: '「统计」怎么用',
    items: [
      {
        title: '换一段时间',
        desc: '今日 · 7 天 · 30 天',
        steps: [
          { target: 'period', title: '选一段时间', body: '默认看今天。切到 7 天或 30 天，圆环和下面的数字都会跟着变。' },
        ],
      },
      {
        title: '看圆环',
        desc: '点一块聚焦，再点中间看详情',
        steps: [
          { target: 'donut', title: '点一块', body: '点圆环的某一块，它会抬起，中间显示它占了多少。再点同一块取消。' },
          { target: 'donut', title: '点中间', body: '选中一块之后，点圆环中间，就能看到这个去向的每一笔和细分构成。' },
        ],
      },
      {
        title: '看去向明细',
        desc: '点列表的一行，详情里还能改某一笔',
        steps: [
          { target: ['stats-list', 'donut'], title: '点一行', body: '点任意一个去向，直接打开它的详情：金额最大的几笔，上拉看全部，还能搜索。' },
          { target: ['stats-list', 'donut'], title: '顺手改', body: '在详情里点某一笔，会打开它的编辑，改完回来，数字立刻更新。' },
        ],
      },
      {
        title: '那一句解读',
        desc: '一句话说清钱主要去了哪里',
        steps: [
          { target: 'summary', title: '一句话', body: '前半句说最大的去向占了多少，后半句只说和上一段时间相比变化最大的那一项；变化很小时就说「差不多」。' },
        ],
      },
    ],
  },
};

export function guideFor(tab) {
  return GUIDES[tab] || GUIDES.add;
}
