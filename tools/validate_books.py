# -*- coding: utf-8 -*-
"""《未竟之事》书 yaml 校验器 —— 静态模拟 UnwrittenStory.js v1.41 的加载/推进逻辑
用法:
  python tools/validate_books.py                 # 校验 languages/sc/00_MOD_book_*.yaml
  python tools/validate_books.py --en            # 同时检查 en 镜像完整性
  python tools/validate_books.py <yaml路径>...   # 只校验指定文件
  python tools/validate_books.py --dir <目录>    # 指定工程根（默认 ../www_playtest_2c7c22ee）

校验规则来源 = 插件源码事实（不是猜测）：
  A2  片段数==edits 数        parseInline 按 **成对** 顺序消耗 edits
  A4  states 非空              create() 前置判空
  树   id 唯一/parent 存在/无环/states[0] 为根   buildStatePages/currentVisibleOrder
  推进 trigger.sentence==parent.editable, action∈{variant,erase,keep},
      variant.value < 父状态该句变体数            findMatchingState
  分支完备 variant 0..N-1 + erase + keep 各一（缺 = 玩家选择死路）
  开关 doneSwitchId 只允许 MOD 区（2001-2007 已分配，1-2000 为原作区）
  布局 origin 越界（书页原图 1140x720）、direction 合法
退出码：0=全过  1=有 ERROR
"""
import io, os, re, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PROJ = os.path.join(ROOT, '..', 'www_playtest_2c7c22ee')

# MOD 开关分配（docs/开关变量对照表.md；1-2000 视为原作/未分配区）
MOD_SWITCHES = {2001: 'night0 完成', 2002: 'night1 完成', 2003: 'night2 完成',
                2005: '书首次提示', 2006: '封存完成', 2007: '演示书'}
BOOK_PAGE_W, BOOK_PAGE_H = 1140, 720
DIRECTIONS = {'ltr', 'rtl', 'ttb', 'btt'}
MAX_CHAIN = 100  # buildStatePages 的 guard

try:
    import yaml
except ImportError:
    print('需要 PyYAML: pip install pyyaml'); sys.exit(2)


class Book:
    def __init__(self, name, path):
        self.name, self.path = name, path
        self.errors, self.warns = [], []
        self.stats = {}

    def err(self, msg): self.errors.append(msg)
    def warn(self, msg): self.warns.append(msg)


def count_fragments(text):
    """与 parseInline 一致：逐行匹配 **...**（非贪婪、不跨行）"""
    n = 0
    for line in str(text).split('\n'):
        n += len(re.findall(r'\*\*(.+?)\*\*', line))
    return n


def check_page(book, state_id, page_key, page):
    """单页定义检查（该页自身，不合并父链）"""
    where = f'[{state_id}]{page_key}'
    if not isinstance(page, dict):
        book.err(f'{where}: 页定义不是映射'); return
    blocks = page.get('blocks')
    frags, edits = 0, []
    if isinstance(blocks, list) and blocks:
        for bi, blk in enumerate(blocks):
            direction = blk.get('direction', 'ltr')
            if direction not in DIRECTIONS:
                book.warn(f'{where} 块{bi}: direction={direction!r} 不合法（应为 ltr/rtl/ttb/btt），运行时按 ltr 处理')
            origin = blk.get('origin')
            if origin and (not (0 <= origin[0] <= BOOK_PAGE_W and 0 <= origin[1] <= BOOK_PAGE_H)):
                book.warn(f'{where} 块{bi}: origin={origin} 超出书页原图 {BOOK_PAGE_W}x{BOOK_PAGE_H}')
            frags += count_fragments(blk.get('text', ''))
            edits.extend(blk.get('edits') or [])
    else:
        frags = count_fragments(page.get('text', ''))
        edits.extend(page.get('edits') or [])
    # A2：片段数必须等于 edits 数（多出的片段拿不到 variants，少出的 edit 永远不显示）
    if frags != len(edits):
        book.err(f'{where}: **片段**数={frags} != edits数={len(edits)}（A2 同类问题）')
    ids = [str(e.get('id')) for e in edits if e.get('id') is not None]
    if len(ids) != len(set(ids)):
        dup = [i for i in ids if ids.count(i) > 1]
        book.err(f'{where}: 页内 edits id 重复: {sorted(set(dup))}')
    for e in edits:
        eid = e.get('id', '?')
        variants = e.get('variants') or []
        if not variants:
            book.warn(f'{where}: 片段 {eid} 无 variants（该句无法"修改"，只能擦除/保留）')
        for vi, v in enumerate(variants):
            if v is None or str(v).strip() == '':
                book.warn(f'{where}: 片段 {eid} 变体{vi} 为空串')
    if page.get('readonly') and edits:
        book.warn(f'{where}: readonly 页含可改句（锁死页在结局阶段只读展示，edits 不会生效）')
    if page.get('confirm') and page.get('doneSwitchId') is None:
        book.warn(f'{where}: confirm 页未挂 doneSwitchId（书读完不会置任何开关）')
    sw = page.get('doneSwitchId')
    if sw is not None:
        sw = int(sw)
        if sw in (1, 4, 5, 6, 16, 17) or 1 <= sw <= 2000:
            book.err(f'{where}: doneSwitchId={sw} 落在原作/未分配区（1-2000）；MOD 区见 2001-2007')
        elif sw not in MOD_SWITCHES:
            book.warn(f'{where}: doneSwitchId={sw} 不在已登记的 MOD 开关表，请在 docs/开关变量对照表.md 登记')
    img = page.get('image')
    if img:
        for ext in ('.png', '.jpg', '.webp'):
            if os.path.isfile(os.path.join(book.img_dir, str(img) + ext)):
                break
        else:
            book.warn(f'{where}: image={img!r} 在 img/pictures/ 下找不到')
    return edits


def merged_pages(states, idx, id2idx):
    """模拟 buildStatePages：沿 parent 链合并，子覆盖父"""
    merged, chain, cur, guard = {}, [], idx, 0
    while cur is not None and guard < MAX_CHAIN:
        chain.append(states[cur]); guard += 1
        p = states[cur].get('parent')
        cur = id2idx.get(str(p)) if p is not None else None
    for st in reversed(chain):
        merged.update(st.get('pages') or {})
    return merged


def validate_book(name, path, img_dir):
    book = Book(name, path)
    book.img_dir = img_dir
    try:
        with open(path, encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        book.err(f'YAML 解析失败: {str(e).splitlines()[0]}')
        return book
    states = data.get('states') or []
    if not states:
        book.err('states 为空或缺失（A4：进游戏会红字"书数据加载失败"）')
        return book
    order = data.get('order') or []
    if not order:
        book.warn('顶层 order 缺失，将按根状态 pages 键序展示')

    # --- 树结构 ---
    ids = [str(s.get('id')) for s in states]
    if len(ids) != len(set(ids)):
        book.err(f'state id 重复: {sorted({i for i in ids if ids.count(i) > 1})}')
    id2idx = {sid: i for i, sid in enumerate(ids)}
    roots = [i for i, s in enumerate(states) if s.get('parent') is None]
    if not roots:
        book.err('没有任何根状态（所有 state 都有 parent）→ 运行时死循环空书')
    elif states[0].get('parent') is not None:
        book.err(f'states[0] 不是根（parent={states[0].get("parent")!r}）；create() 永远从 states[0] 开始')
    for i, s in enumerate(states):
        p = s.get('parent')
        if p is not None and str(p) not in id2idx:
            book.err(f'[{s.get("id")}] parent={p!r} 不存在')
    # 环检测（父链走 MAX_CHAIN 步没到根即视为环/超深）
    for i, s in enumerate(states):
        cur, guard = i, 0
        while cur is not None and guard < MAX_CHAIN + 1:
            p = states[cur].get('parent')
            cur = id2idx.get(str(p)) if p is not None else None
            guard += 1
        if guard >= MAX_CHAIN:
            book.err(f'[{s.get("id")}] parent 链超过 {MAX_CHAIN} 层（环或过深）')
            break

    # --- 单页检查（每个状态自己的页） ---
    for s in states:
        for key, page in (s.get('pages') or {}).items():
            check_page(book, s.get('id'), key, page or {})

    # --- 每状态：editable 存在性 + 叶子判定 ---
    for i, s in enumerate(states):
        sid = s.get('id')
        mp = merged_pages(states, i, id2idx)
        edit_ids = set()
        for page in mp.values():
            if isinstance(page, dict):
                for e in (page.get('edits') or []):
                    if isinstance(page.get('blocks'), list):
                        continue
                    if e.get('id') is not None:
                        edit_ids.add(str(e['id']))
                for blk in (page.get('blocks') or []):
                    for e in (blk.get('edits') or []):
                        if e.get('id') is not None:
                            edit_ids.add(str(e['id']))
        if s.get('editable') is not None and str(s['editable']) not in edit_ids:
            book.err(f'[{sid}] editable={s["editable"]!r} 在本状态合并后的页面里不存在（updateStoryState 永远找不到该句）')
        if i != 0 and s.get('trigger') is None:
            book.warn(f'[{sid}] 无 trigger（非根状态不可达，成为孤儿节点）')

    # --- trigger 与分支完备性 ---
    children = {}
    for i, s in enumerate(states):
        p = s.get('parent')
        if p is not None and str(p) in id2idx:
            children.setdefault(str(p), []).append(i)
    for pi, parent in enumerate(states):
        pid = str(parent.get('id'))
        editable = parent.get('editable')
        if editable is None:
            continue
        kids = children.get(pid, [])
        mp = merged_pages(states, pi, id2idx)
        n_variants = None
        for page in mp.values():
            sources = ([page] if not isinstance(page.get('blocks'), list) or not page.get('blocks') else page.get('blocks'))
            for src in sources:
                for e in (src.get('edits') or []):
                    if str(e.get('id')) == str(editable):
                        n_variants = len(e.get('variants') or [])
        for ci in kids:
            c, cid = states[ci], states[ci].get('id')
            t = c.get('trigger') or {}
            ts, ta = t.get('sentence'), t.get('action')
            if ts is None or str(ts) != str(editable):
                book.err(f'[{cid}] trigger.sentence={ts!r} != 父状态 editable={editable!r}（findMatchingState 永不命中）')
            if ta not in ('variant', 'erase', 'keep'):
                book.err(f'[{cid}] trigger.action={ta!r} 不合法（variant/erase/keep）')
            if ta == 'variant':
                if t.get('value') is None:
                    book.warn(f'[{cid}] variant trigger 未写 value = 匹配任意变体（多分支时顺序敏感，易错）')
                elif n_variants is not None and not (0 <= int(t['value']) < n_variants):
                    book.err(f'[{cid}] trigger.value={t["value"]} 超出父句变体数 {n_variants}')
        # 完备性：每个变体 + erase + keep 都该有去处
        got = {'erase': False, 'keep': False, 'variant': set()}
        for ci in kids:
            t = states[ci].get('trigger') or {}
            ta = t.get('action')
            if ta == 'variant':
                if t.get('value') is not None:
                    got['variant'].add(int(t['value']))
                else:
                    got['variant'].add('*')
            elif ta in got:
                got[ta] = True
        if n_variants:
            for v in range(n_variants):
                if v not in got['variant'] and '*' not in got['variant']:
                    book.warn(f'[{pid}] 变体{v}没有子分支（玩家选它后停在原状态，需确认是否有意）')
        if not got['erase']:
            book.warn(f'[{pid}] 没有子分支接 erase（擦除后停在原状态，需确认是否有意）')
        if not got['keep']:
            book.warn(f'[{pid}] 没有子分支接 keep（保留后停在原状态，需确认是否有意）')

    # --- order 与页对账 ---
    all_page_keys = set()
    for s in states:
        all_page_keys.update((s.get('pages') or {}).keys())
    for k in order:
        if k not in all_page_keys:
            book.warn(f'order 引用的页 {k!r} 不在任何 state 里')
    root_locked = {k for k, p in (states[0].get('pages') or {}).items()
                   if isinstance(p, dict) and p.get('readonly')}
    for k in all_page_keys - set(order) - root_locked:
        book.warn(f'页 {k!r} 不在 order 里（会按遍历顺序追加到末尾）')

    # --- 统计 ---
    depth, stack = {}, [(i, 1) for i, s in enumerate(states) if s.get('parent') is None]
    while stack:
        i, d = stack.pop(); depth[i] = d
        for ci in children.get(str(states[i].get('id')), []):
            stack.append((ci, d + 1))
    leaves = [states[i]['id'] for i in depth
              if not children.get(str(states[i].get('id')))
              and states[i].get('editable') is None]
    confirms = [k for k in all_page_keys
                if any(isinstance((s.get('pages') or {}).get(k), dict) and
                       (s.get('pages') or {})[k].get('confirm')
                       for s in states)]
    book.stats = dict(states=len(states), depth=max(depth.values()) if depth else 0,
                      leaves=len(leaves), confirm=len(confirms), locked=len(root_locked))
    return book


def main():
    args = sys.argv[1:]
    check_en = '--en' in args
    args = [a for a in args if not a.startswith('--')]
    proj = DEFAULT_PROJ
    if '--dir' in sys.argv:
        proj = sys.argv[sys.argv.index('--dir') + 1]
    img_dir = os.path.join(proj, 'img', 'pictures')
    sc_dir = os.path.join(proj, 'languages', 'sc')
    if args:
        targets = [(os.path.splitext(os.path.basename(p))[0], p) for p in args]
    else:
        targets = sorted((os.path.splitext(f)[0], os.path.join(sc_dir, f))
                         for f in os.listdir(sc_dir) if f.startswith('00_MOD_book_') and f.endswith('.yaml'))
    if not targets:
        print('没有找到任何 00_MOD_book_*.yaml'); sys.exit(1)
    total_e = total_w = 0
    for name, path in targets:
        b = validate_book(name, path, img_dir)
        mark = 'PASS' if not b.errors else 'FAIL'
        print(f'== {b.name}: {mark}  错误{len(b.errors)} 警告{len(b.warns)}  '
              f'(状态{b.stats.get("states",0)} 树深{b.stats.get("depth",0)} 叶{b.stats.get("leaves",0)} '
              f'confirm{b.stats.get("confirm",0)} 锁死页{b.stats.get("locked",0)})')
        for m in b.errors: print(f'   E  {m}')
        for m in b.warns:  print(f'   W  {m}')
        total_e += len(b.errors); total_w += len(b.warns)
    if check_en:
        en_dir = os.path.join(proj, 'languages', 'en')
        missing = [n for n, _ in targets
                   if not os.path.isfile(os.path.join(en_dir, os.path.basename(_)))]
        if missing:
            print(f'== en 镜像: 缺 {len(missing)}/{len(targets)} 本: {", ".join(missing)}')
            total_w += len(missing)
        else:
            print('== en 镜像: 齐全')
    print(f'合计: {total_e} 错误, {total_w} 警告')
    sys.exit(1 if total_e else 0)


if __name__ == '__main__':
    main()
