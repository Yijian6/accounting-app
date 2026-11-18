import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ActionMenu, { PencilIcon, TrashIcon } from './ActionMenu';
import { NAME_MAX, orderDestinations, usageCounter } from '../utils/taxonomy';
import './DestinationPicker.css';

const LONG_PRESS_MS = 450;
const ITEM_H = 42;
const SETTLE_MS = 140;
const BRACE_WIDTH = 18;
const BRACE_RADIUS = 7;

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** 一个从 (2, tipY) 指向左侧去向、上下张开到 [top, bottom] 的大括号 */
function bracePath(tipY, top, bottom) {
  const w = BRACE_WIDTH;
  const m = w / 2;
  const r = Math.min(BRACE_RADIUS, Math.max(2, (bottom - top) / 4));
  const y1 = Math.min(top, tipY - r);
  const y2 = Math.max(bottom, tipY + r);
  return [
    `M${w} ${y1}`,
    `Q${m} ${y1} ${m} ${y1 + r}`,
    `L${m} ${tipY - r}`,
    `Q${m} ${tipY} 2 ${tipY}`,
    `Q${m} ${tipY} ${m} ${tipY + r}`,
    `L${m} ${y2 - r}`,
    `Q${m} ${y2} ${w} ${y2}`,
  ].join(' ');
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** 循环滚轮需要的份数：去向太少不循环；否则复制成奇数份，中间那份是「本体」 */
function wheelCopies(count) {
  if (count < 3) return 1;
  const copies = Math.max(5, Math.ceil(2400 / (count * ITEM_H)));
  return copies % 2 === 0 ? copies + 1 : copies;
}

/**
 * 去向 + 细分选择器：左栏去向上下滑动，中间一条分割线，右侧用大括号展开所选去向的细分。
 * 细分单选；记录里已有、但不在当前列表里的旧细分照样显示并保持选中，不会被悄悄丢掉。
 */
export default function DestinationPicker({
  type,
  categories,
  tags,
  records = [],
  category,
  selectedTags,
  onChange,
  onAddTag,
  onRequestRename,
  onDeleteTag,
  onManageCategories,
  onManageTags,
  onOrganize,
  keepUnknownTags = false,
  title,
}) {
  const railRef = useRef(null);
  const branchRef = useRef(null);
  const tagsRef = useRef(null);
  const braceRef = useRef(null);
  const frameRef = useRef(0);
  const pressRef = useRef({ timer: 0, fired: false });
  const railPressRef = useRef({ timer: 0, fired: false });
  // 回车提交后输入框卸载还可能触发 blur：用它保证一次编辑只提交一次
  const editDoneRef = useRef(false);

  // 长按细分弹出的操作菜单：{ ownerId, anchor, title, items }
  const [menu, setMenu] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const isExpense = type === 'expense';
  const destinations = useMemo(
    () => orderDestinations(categories.filter((item) => item.type === type), type),
    [categories, type]
  );
  const selectedCategory = destinations.find((item) => item.name === category) || null;

  const categoryTags = useMemo(() => {
    if (!isExpense || !selectedCategory) return [];
    return tags.filter((tag) => tag.categoryId === selectedCategory.id);
  }, [isExpense, selectedCategory, tags]);

  // 记录上带着、但当前去向下已经没有的细分（改名前的旧名、已删除的细分）
  const legacyNames = useMemo(() => {
    const known = new Set(categoryTags.map((tag) => tag.name));
    return (selectedTags || []).filter((name) => !known.has(name));
  }, [categoryTags, selectedTags]);

  // 用过的细分：去向名 + 细分名
  const usedKeys = useMemo(() => {
    const keys = new Set();
    records.forEach((record) => {
      if (record.type !== 'expense' || !Array.isArray(record.tags)) return;
      record.tags.forEach((name) => keys.add(`${record.category}\u0000${name}`));
    });
    return keys;
  }, [records]);

  const isUsed = (name) => usedKeys.has(`${category}\u0000${name}`);
  const isSelected = (name) => (selectedTags || []).includes(name);

  // ── 滚轮：去向循环滚动，正中一行就是选中的去向 ──
  const count = destinations.length;
  const copies = wheelCopies(count);
  const mid = Math.floor(copies / 2);
  const wheelItems = useMemo(() => {
    const list = [];
    for (let copy = 0; copy < copies; copy += 1) {
      destinations.forEach((item, k) => list.push({ item, copy, index: copy * destinations.length + k }));
    }
    return list;
  }, [copies, destinations]);

  // 代码发起的滚动要停到哪一行；停下时位置对得上才算「不是用户滚的」，被手指打断时照常选中
  const programmaticRef = useRef(null);
  const settleTimerRef = useRef(0);
  // 上次摆放时的类型：类型变了（支出 ⇄ 收入）就当作第一次摆放
  const placedRef = useRef(null);
  const latestRef = useRef({ category, onChange });
  useEffect(() => {
    latestRef.current = { category, onChange };
  });

  /** 按离中线的距离把每一行缩小、变淡，像一只鼓轮 */
  const paintWheel = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const center = rail.scrollTop;
    rail.querySelectorAll('.dpick-rail-item').forEach((button) => {
      const distance = Math.abs(Number(button.dataset.index) * ITEM_H - center) / ITEM_H;
      const near = Math.min(distance, 3);
      button.style.opacity = String(Math.max(0.14, 1 - distance * 0.3));
      button.style.transform = `scale(${1 - near * 0.07})`;
    });
  }, []);

  const scrollToIndex = useCallback((index, smooth) => {
    const rail = railRef.current;
    if (!rail) return;
    const top = index * ITEM_H;
    if (Math.abs(rail.scrollTop - top) < 1) return;
    programmaticRef.current = index;
    if (smooth && !prefersReducedMotion()) {
      rail.scrollTo({ top, behavior: 'smooth' });
    } else {
      rail.scrollTop = top;
    }
  }, []);

  /** 离当前位置最近的那一份里的同名去向 */
  const nearestIndexOf = useCallback((name) => {
    const rail = railRef.current;
    const k = destinations.findIndex((item) => item.name === name);
    if (!rail || k === -1) return -1;
    if (copies === 1) return k;
    const currentCopy = Math.floor(Math.round(rail.scrollTop / ITEM_H) / count);
    let best = mid * count + k;
    [currentCopy - 1, currentCopy, currentCopy + 1].forEach((copy) => {
      if (copy < 0 || copy >= copies) return;
      const index = copy * count + k;
      if (Math.abs(index * ITEM_H - rail.scrollTop) < Math.abs(best * ITEM_H - rail.scrollTop)) best = index;
    });
    return best;
  }, [copies, count, destinations, mid]);

  // 滚动停下：正中那一行成为选中；然后悄悄跳回中间那一份，保证上下都还能继续滚
  const settle = useCallback(() => {
    const rail = railRef.current;
    if (!rail || count === 0) return;
    const index = Math.min(copies * count - 1, Math.max(0, Math.round(rail.scrollTop / ITEM_H)));
    const k = index % count;
    const name = destinations[k]?.name;

    const expected = programmaticRef.current;
    programmaticRef.current = null;
    if (expected !== index && name && name !== latestRef.current.category) {
      setAdding(false);
      latestRef.current.onChange(name, []);
    }

    if (copies > 1 && Math.floor(index / count) !== mid) {
      const recentered = mid * count + k;
      programmaticRef.current = recentered;
      rail.scrollTop = recentered * ITEM_H;
    }
  }, [copies, count, destinations, mid]);

  const handleScroll = () => {
    clearTimeout(railPressRef.current.timer);
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(paintWheel);
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(settle, SETTLE_MS);
  };

  useEffect(() => () => {
    clearTimeout(settleTimerRef.current);
    cancelAnimationFrame(frameRef.current);
  }, []);

  // 选中的去向（或第一次打开时的第一项）停在正中
  useLayoutEffect(() => {
    if (count === 0) return;
    const firstPlacement = placedRef.current !== type;
    placedRef.current = type;
    if (!category) {
      if (firstPlacement) scrollToIndex(mid * count, false);
      paintWheel();
      return;
    }
    const index = nearestIndexOf(category);
    if (index !== -1) scrollToIndex(index, !firstPlacement);
    paintWheel();
  }, [category, count, mid, nearestIndexOf, paintWheel, scrollToIndex, type]);

  // ── 大括号：尖端固定在中线，上下对称地抱住细分块 ──
  const layoutBrace = useCallback(() => {
    const branch = branchRef.current;
    const block = tagsRef.current;
    const brace = braceRef.current;
    if (!branch || !block || !brace) return;
    const height = branch.clientHeight;
    const blockHeight = block.offsetHeight;
    const top = (height - blockHeight) / 2;
    brace.setAttribute('d', bracePath(height / 2, top + 6, top + blockHeight - 6));
  }, []);

  useLayoutEffect(() => {
    layoutBrace();
  });

  useEffect(() => {
    window.addEventListener('resize', layoutBrace);
    return () => window.removeEventListener('resize', layoutBrace);
  }, [layoutBrace]);

  useEffect(() => () => clearTimeout(pressRef.current.timer), []);

  // 选中的去向 / 细分在别处被改名或删除了：清掉，免得存出一个不存在的名字。
  // 编辑旧记录时（keepUnknownTags）保留列表里没有的旧细分。
  useEffect(() => {
    if (!category) return;
    if (!selectedCategory) {
      latestRef.current.onChange('', []);
      return;
    }
    if (keepUnknownTags || !selectedTags?.length) return;
    const known = new Set(categoryTags.map((tag) => tag.name));
    const kept = selectedTags.filter((name) => known.has(name));
    if (kept.length !== selectedTags.length) latestRef.current.onChange(category, kept);
  }, [category, selectedCategory, categoryTags, selectedTags, keepUnknownTags]);

  // ── 长按左栏的去向：打开整理面板并展开它 ──
  const startRailPress = (item) => {
    clearTimeout(railPressRef.current.timer);
    railPressRef.current.fired = false;
    if (!onOrganize) return;
    railPressRef.current.timer = setTimeout(() => {
      railPressRef.current.fired = true;
      window.navigator?.vibrate?.(8);
      onOrganize({ type, focusId: item.id });
    }, 520);
  };
  const cancelRailPress = () => clearTimeout(railPressRef.current.timer);
  useEffect(() => () => clearTimeout(railPressRef.current.timer), []);

  // ── 选择 ──
  const pickCategory = (index, name) => {
    if (railPressRef.current.fired) {
      railPressRef.current.fired = false;
      return;
    }
    setMenu(null);
    setAdding(false);
    const rail = railRef.current;
    const centered = rail && Math.abs(rail.scrollTop - index * ITEM_H) < 2;
    if (name === category && centered) {
      onChange('', []);
      return;
    }
    scrollToIndex(index, true);
    if (name !== category) onChange(name, []);
  };

  const pickTag = (name) => {
    if (pressRef.current.fired) {
      pressRef.current.fired = false;
      return;
    }
    if (isSelected(name)) {
      onChange(category, selectedTags.filter((item) => item !== name));
      return;
    }
    onChange(category, [name]);
  };

  const startPress = (event, tag) => {
    clearTimeout(pressRef.current.timer);
    pressRef.current.fired = false;
    const element = event.currentTarget;
    pressRef.current.timer = setTimeout(() => {
      pressRef.current.fired = true;
      setAdding(false);
      window.navigator?.vibrate?.(8);
      const count = usageCounter(records).tag(category, tag.name);
      setMenu({
        ownerId: tag.id,
        anchor: element.getBoundingClientRect(),
        title: `细分「${tag.name}」 · ${count} 笔`,
        items: [
          {
            key: 'rename',
            label: '改名',
            icon: <PencilIcon />,
            onSelect: () => onRequestRename?.(tag, (result) => followResult(tag.name, result)),
          },
          { key: 'delete', label: '删除', icon: <TrashIcon />, danger: true, onSelect: () => commitDelete(tag) },
        ],
      });
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => clearTimeout(pressRef.current.timer);

  // ── 新建 / 改名 / 删除 ──
  const commitAdd = () => {
    if (editDoneRef.current) return;
    editDoneRef.current = true;
    const name = draft.replace(/\s+/g, ' ').trim();
    setAdding(false);
    setDraft('');
    if (!name || !selectedCategory) return;
    const existing = categoryTags.find((tag) => tag.name === name);
    if (!existing) {
      const result = onAddTag?.(name, selectedCategory.id);
      if (result?.error) return;
    }
    onChange(category, [name]);
  };

  /** 改名 / 合并 / 删除转移完成后，把选中的细分换成结果里的那个（可能换了去向） */
  const followResult = (oldName, result) => {
    if (!isSelected(oldName)) return;
    const target = result?.result;
    if (!target) return;
    if (target.categoryName && target.categoryName !== category) {
      onChange(target.categoryName, target.tagName ? [target.tagName] : []);
      return;
    }
    const next = selectedTags
      .map((item) => (item === oldName ? target.tagName : item))
      .filter((item, index, list) => item && list.indexOf(item) === index);
    onChange(category, next);
  };

  // 改名在改名浮层里完成，有记录的删除会弹出转移面板；都在完成后才回调
  const commitDelete = (tag) => {
    onDeleteTag?.(tag, (result) => followResult(tag.name, result));
  };

  const renderTag = (tag, index) => {
    const style = { '--i': index };
    const selected = isSelected(tag.name);
    return (
      <button
        key={tag.id}
        type="button"
        className={`dpick-tag${selected ? ' is-selected' : ''}${isUsed(tag.name) ? '' : ' is-unused'}${menu?.ownerId === tag.id ? ' is-pressed' : ''}`}
        style={style}
        aria-pressed={selected}
        title={isUsed(tag.name) ? undefined : '还没有记录用过这个细分'}
        onClick={() => pickTag(tag.name)}
        onPointerDown={(event) => startPress(event, tag)}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(event) => event.preventDefault()}
      >
        {tag.name}
      </button>
    );
  };

  const emptyHint = !selectedCategory
    ? (isExpense ? '选一个去向，\n它的细分会出现在这里' : '选一个来源')
    : '收入不再细分';

  return (
    <section className={`dpick${isExpense ? '' : ' is-income'}`}>
      <div className="dpick-head">
        <h3>{title || (isExpense ? '去 向' : '来 源')}</h3>
        <div className="dpick-head-actions">
          {isExpense && selectedCategory && onManageTags && (
            <button
              type="button"
              className="dpick-gear dpick-gear--label"
              onClick={() => onManageTags(selectedCategory.id)}
              title={`整理「${selectedCategory.name}」的细分`}
            >
              <span>细分</span>
              <GearIcon />
            </button>
          )}
          {onManageCategories && (
            <button type="button" className="dpick-gear" data-guide="manage" onClick={onManageCategories} title="管理去向" aria-label="管理去向">
              <GearIcon />
            </button>
          )}
        </div>
      </div>

      <div className={`dpick-body${selectedCategory ? ' has-selection' : ''}`}>
        <div className="dpick-wheel" data-guide={onManageCategories ? 'wheel' : undefined}>
          <div
            className="dpick-rail"
            ref={railRef}
            onScroll={handleScroll}
            role="group"
            aria-label={isExpense ? '去向' : '来源'}
          >
            {wheelItems.map(({ item, copy, index }) => (
              <button
                key={`${copy}:${item.id}`}
                type="button"
                data-index={index}
                className={`dpick-rail-item${item.name === category ? ' is-active' : ''}`}
                aria-pressed={item.name === category}
                aria-hidden={copy !== mid || undefined}
                tabIndex={copy === mid ? 0 : -1}
                onClick={() => pickCategory(index, item.name)}
                onPointerDown={() => startRailPress(item)}
                onPointerUp={cancelRailPress}
                onPointerLeave={cancelRailPress}
                onPointerCancel={cancelRailPress}
                onContextMenu={(event) => event.preventDefault()}
              >
                {item.name}
              </button>
            ))}
            {destinations.length === 0 && <span className="dpick-rail-empty">还没有{isExpense ? '去向' : '来源'}</span>}
          </div>
          <span className="dpick-lens" aria-hidden="true" />
        </div>

        <div className="dpick-line" aria-hidden="true">
          <span className="dpick-indicator" />
        </div>

        <div className="dpick-branch" ref={branchRef} data-guide={onManageCategories ? 'branch' : undefined}>
          {isExpense && selectedCategory ? (
            <>
              <svg className="dpick-brace" aria-hidden="true" key={`brace:${category}`}>
                <path ref={braceRef} pathLength="1" />
              </svg>
              <div className="dpick-tags" ref={tagsRef} key={`tags:${category}`} role="group" aria-label={`${category}的细分`}>
                {categoryTags.map(renderTag)}
                {legacyNames.map((name, index) => (
                  <button
                    key={`legacy:${name}`}
                    type="button"
                    className={`dpick-tag is-legacy${isSelected(name) ? ' is-selected' : ''}`}
                    style={{ '--i': categoryTags.length + index }}
                    aria-pressed={isSelected(name)}
                    title="这条记录原有的细分"
                    onClick={() => onChange(category, selectedTags.filter((item) => item !== name))}
                  >
                    {name}
                  </button>
                ))}
                {adding ? (
                  <span className="dpick-tag is-editing" style={{ '--i': categoryTags.length + legacyNames.length }}>
                    <input
                      value={draft}
                      maxLength={NAME_MAX}
                      placeholder="新细分"
                      aria-label="新细分名称"
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') { event.preventDefault(); commitAdd(); }
                        if (event.key === 'Escape') { setAdding(false); setDraft(''); }
                      }}
                      onBlur={commitAdd}
                      autoFocus
                    />
                  </span>
                ) : (
                  onAddTag && (
                    <button
                      type="button"
                      className="dpick-tag dpick-add"
                      data-guide={onManageCategories ? 'add-tag' : undefined}
                      style={{ '--i': categoryTags.length + legacyNames.length }}
                      onClick={() => { editDoneRef.current = false; setMenu(null); setDraft(''); setAdding(true); }}
                    >
                      + 新细分
                    </button>
                  )
                )}
              </div>
            </>
          ) : (
            <p className="dpick-hint" key={`hint:${type}:${category}`}>{emptyHint}</p>
          )}
        </div>
      </div>
      <ActionMenu request={menu} onClose={() => setMenu(null)} />
    </section>
  );
}
