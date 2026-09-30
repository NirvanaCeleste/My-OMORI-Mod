# -*- coding: utf-8 -*-
"""全项目 Bug 扫描器 —— 静态分析 OMORI 模组工程的各类潜在问题
用法:
  python tools/bug_scanner.py                    # 扫 F 盘（实际操作区）
  python tools/bug_scanner.py --dir <工程目录>   # 指定目录
  python tools/bug_scanner.py --quick            # 只跑快速检查（跳过耗时项）

扫描项目（按严重度分级 🔴ERROR / 🟡WARN / 🔵INFO）：
  A. YAML 语法+重复键       会被引擎静默吞掉的定时炸弹
  B. 事件消息引用断裂        ShowMessage 引用的 yaml 键不存在
  C. 开关/变量冲突           模组用了原作占用的 ID
  D. 地图转移断裂            转移目标地图不存在或无 Tiled 数据
  E. 插件一致性              plugins.js 注册 vs 磁盘文件
  F. 资产引用缺失            事件引用的脸图/行走图文件不存在
  G. en 镜像缺失             sc 有 en 没有
  H. 死代码                  空事件/无命令事件
  I. 书内容结构              调用 validate_books 的检查逻辑
退出码: 0=无ERROR  1=有ERROR
"""
import os, sys, re, glob, json, subprocess
from collections import defaultdict

# ============================================================
# 配置
# ============================================================
PROJ = sys.argv[sys.argv.index("--dir") + 1] if "--dir" in sys.argv else r"F:\OMORI mod\www_playtest_2c7c22ee"
QUICK = "--quick" in sys.argv

ERRORS, WARNS, INFOS = [], [], []
def err(cat, msg): ERRORS.append(f"🔴 [{cat}] {msg}")
def warn(cat, msg): WARNS.append(f"🟡 [{cat}] {msg}")
def info(cat, msg): INFOS.append(f"🔵 [{cat}] {msg}")

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False
    warn("ENV", "PyYAML 未安装，跳过 yaml 深度检查")

# ============================================================
# A. YAML 语法 + 重复键检测
# ============================================================
def check_yaml_duplicate_keys():
    """用自定义 Loader 检测重复键（yaml.safe_load 会静默用后者覆盖前者）"""
    if not HAS_YAML: return
    
    class StrictLoader(yaml.SafeLoader): pass
    
    def no_dupes(loader, node, deep=False):
        mapping = {}
        for k_node, v_node in node.value:
            key = loader.construct_object(k_node, deep=deep)
            if key in mapping:
                line = k_node.start_mark.line + 1
                raise ValueError(f"DUPE:{key}@{line}")
            mapping[key] = loader.construct_object(v_node, deep=deep)
        return mapping
    
    StrictLoader.add_constructor(
        yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, no_dupes)
    
    yaml_files = glob.glob(os.path.join(PROJ, "languages", "sc", "*.yaml"))
    if not QUICK:
        yaml_files += glob.glob(os.path.join(PROJ, "languages", "en", "*.yaml"))
    
    passed = 0
    for path in yaml_files:
        rel = os.path.relpath(path, PROJ)
        try:
            with open(path, encoding="utf-8") as f:
                yaml.load(f, Loader=StrictLoader)
            passed += 1
        except ValueError as e:
            if "DUPE:" in str(e):
                key, line = str(e).replace("DUPE:", "").split("@")
                err("A.重复键", f"{rel}: 键 '{key}' 在第 {line} 行重复定义")
        except yaml.YAMLError as e:
            err("A.语法", f"{rel}: YAML 语法错误 → {str(e).splitlines()[0]}")
    info("A.YAML", f"{passed}/{len(yaml_files)} 文件通过（重复键+语法）")

# ============================================================
# B. 事件消息引用断裂
# ============================================================
def check_message_references():
    """扫描 Map*.json 事件里的 ShowMessage/AddChoice 提到的 yaml.键，确认存在
    正确解析 JSON 事件结构，不用正则匹配原始文本"""
    if not HAS_YAML: return
    
    # 加载 sc 全部 yaml 键
    sc_dir = os.path.join(PROJ, "languages", "sc")
    all_keys = {}  # filename -> set of keys
    for f in glob.glob(os.path.join(sc_dir, "*.yaml")):
        name = os.path.basename(f)[:-5]
        try:
            data = yaml.safe_load(open(f, encoding="utf-8"))
            if isinstance(data, dict):
                all_keys[name] = set(data.keys())
        except: pass
    
    def extract_refs(event_data):
        """从事件/公共事件数据结构中提取消息引用"""
        refs = []
        pages = []
        if "pages" in event_data and event_data["pages"]:
            pages = event_data["pages"]
        elif "list" in event_data:
            pages = [{"list": event_data["list"]}]
        for page in pages:
            if not page or not isinstance(page, dict): continue
            for cmd in (page.get("list") or []):
                if not isinstance(cmd, dict) or cmd.get("code") != 356: continue
                params = cmd.get("parameters") or []
                if not params: continue
                text = str(params[0])
                if text.startswith("ShowMessage ") or text.startswith("AddChoice "):
                    parts = text.split(" ")
                    if len(parts) >= 2:
                        ref = parts[1]
                        if "." in ref:
                            yaml_name, msg_key = ref.rsplit(".", 1)
                            refs.append((yaml_name, msg_key))
        return refs
    
    broken = 0
    total_refs = 0
    
    # mod 地图（只查 515-549 范围的 mod 自建地图；900+ 是原作）
    map_files = [f for f in glob.glob(os.path.join(PROJ, "data", "Map*.json"))
                 if re.search(r'Map(\d+)\.json', f)
                 and 515 <= int(re.search(r'Map(\d+)\.json', f).group(1)) <= 549]
    
    # 公共事件：只查引用 00_MOD 开头的 yaml 的（mod 自己的）
    ce_path = os.path.join(PROJ, "data", "CommonEvents.json")
    
    sources = []
    for path in map_files:
        rel = os.path.relpath(path, PROJ)
        try:
            data = json.load(open(path, encoding="utf-8"))
            for ev in (data.get("events") or []):
                if ev and isinstance(ev, dict):
                    sources.append((rel, ev.get("name", "?"), extract_refs(ev)))
        except: pass
    
    # 公共事件：过滤只留 00_MOD_* 引用
    if os.path.exists(ce_path):
        try:
            ce = json.load(open(ce_path, encoding="utf-8"))
            for ev in ce:
                if ev and isinstance(ev, dict):
                    refs = extract_refs(ev)
                    mod_refs = [r for r in refs if r[0].startswith("00_MOD")]
                    if mod_refs:
                        sources.append(("CommonEvents", ev.get("name", "?"), mod_refs))
        except: pass
    
    for source, ev_name, refs in sources:
        for yaml_name, msg_key in refs:
            total_refs += 1
            if yaml_name not in all_keys:
                err("B.消息断裂", f"{source}·{ev_name}: {yaml_name}.{msg_key} → yaml 文件不存在")
                broken += 1
            elif msg_key not in all_keys[yaml_name]:
                err("B.消息断裂", f"{source}·{ev_name}: {yaml_name}.{msg_key} → 键不存在")
                broken += 1
    
    info("B.消息引用", f"{total_refs - broken}/{total_refs} 引用完整")

# ============================================================
# C. 开关/变量冲突
# ============================================================
def check_switch_conflicts():
    """模组脚本/事件中使用的开关，若在原作命名区(1-1000)且有名字 → 冲突"""
    try:
        sysd = json.load(open(os.path.join(PROJ, "data", "System.json"), encoding="utf-8"))
    except: return
    
    switches = sysd.get("switches") or []
    variables = sysd.get("variables") or []
    
    # 扫 mod 地图 + 插件 + 书 yaml 中的开关使用
    MOD_ZONE = set(range(2001, 2100))  # 模组已分配区
    used_switches = set()
    
    # 从事件 JSON 扫
    pattern_sw = re.compile(r'"parameters"\s*:\s*\[(\d+),\s*(\d+),\s*[01]\]')
    for f in glob.glob(os.path.join(PROJ, "data", "Map5*.json")):
        try:
            content = open(f, encoding="utf-8").read()
            for m in pattern_sw.finditer(content):
                sw_id = int(m.group(1))
                if sw_id > 0:
                    used_switches.add(sw_id)
        except: pass
    
    # 从书 yaml 扫
    for f in glob.glob(os.path.join(PROJ, "languages", "sc", "00_MOD_book_*.yaml")):
        try:
            content = open(f, encoding="utf-8").read()
            for m in re.finditer(r'doneSwitchId:\s*(\d+)', content):
                used_switches.add(int(m.group(1)))
        except: pass
    
    conflicts = 0
    for sw_id in sorted(used_switches):
        if sw_id <= 1000 and sw_id < len(switches) and switches[sw_id - 1]:
            err("C.开关冲突", f"开关 {sw_id} ('{switches[sw_id - 1]}') 是原作占用的，模组正在使用")
            conflicts += 1
    
    unregistered = [s for s in sorted(used_switches) if s > 1000 and s not in MOD_ZONE]
    if unregistered:
        warn("C.开关未登记", f"开关 {unregistered} 在模组区但未在 docs/开关变量对照表.md 登记")
    
    info("C.开关冲突", f"模组使用 {len(used_switches)} 个开关，冲突 {conflicts} 个")

# ============================================================
# D. 地图转移断裂
# ============================================================
def check_map_transfers():
    """检查事件中的转移命令目标地图是否存在"""
    map_ids_on_disk = set()
    for f in glob.glob(os.path.join(PROJ, "data", "Map*.json")):
        m = re.search(r'Map(\d+)\.json', os.path.basename(f))
        if m: map_ids_on_disk.add(int(m.group(1)))
    
    tiled_on_disk = set()
    for f in glob.glob(os.path.join(PROJ, "maps", "map*.json")):
        m = re.search(r'map(\d+)\.json', os.path.basename(f), re.I)
        if m: tiled_on_disk.add(int(m.group(1)))
    
    broken = 0
    total = 0
    # code 201 = Transfer Player: [mode, mapId, x, y, dir, fade]
    pattern = re.compile(r'"code"\s*:\s*201.*?"parameters"\s*:\s*\[0,\s*(\d+),')
    
    for f in glob.glob(os.path.join(PROJ, "data", "Map5*.json")):
        rel = os.path.relpath(f, PROJ)
        try:
            content = open(f, encoding="utf-8").read()
        except: continue
        for m in pattern.finditer(content):
            map_id = int(m.group(1))
            total += 1
            if map_id not in map_ids_on_disk:
                err("D.转移断裂", f"{rel}: 转移到 Map{map_id} 但 data/Map{map_id}.json 不存在")
                broken += 1
            elif map_id not in tiled_on_disk:
                warn("D.缺Tiled", f"{rel}: 转移到 Map{map_id}，data 存在但 maps/map{map_id}.json 缺失")
    
    info("D.地图转移", f"{total - broken}/{total} 转移目标有效")

# ============================================================
# E. 插件一致性
# ============================================================
def check_plugins():
    # plugins.js 里注册的插件
    try:
        pj = open(os.path.join(PROJ, "js", "plugins.js"), encoding="utf-8").read()
    except:
        err("E.插件", "plugins.js 无法读取"); return
    
    registered = set(re.findall(r'"name"\s*:\s*"([^"]+)"', pj))
    
    # 磁盘上的 .js 文件
    on_disk = set()
    for f in glob.glob(os.path.join(PROJ, "js", "plugins", "*.js")):
        on_disk.add(os.path.basename(f)[:-3])
    
    # 忽略已知的非插件文件
    ignore = {"--------------------", "---------OMORI----------", "---------MESSAGE---------",
              "---------MAP---------", "---------SYSTEM---------", "---------BATTLE---------"}
    on_disk -= ignore
    
    missing_on_disk = registered - on_disk
    unregistered = on_disk - registered
    
    for p in sorted(missing_on_disk):
        if p not in ignore:
            err("E.插件缺失", f"plugins.js 注册了 '{p}' 但 js/plugins/{p}.js 不存在")
    
    for p in sorted(unregistered):
        if p not in ignore and not p.startswith('_'):
            warn("E.未注册", f"js/plugins/{p}.js 存在但未在 plugins.js 注册")
    
    info("E.插件", f"注册 {len(registered)} / 磁盘 {len(on_disk)} / 缺失 {len(missing_on_disk)} / 未注册 {len(unregistered)}")
    
    # node --check 语法验证（只查 mod 自制插件）
    mod_plugins = ["UnwrittenStory", "UnwrittenSeal"]
    for mp in mod_plugins:
        path = os.path.join(PROJ, "js", "plugins", mp + ".js")
        if os.path.exists(path):
            r = subprocess.run(["node", "--check", path], capture_output=True, text=True, timeout=10)
            if r.returncode != 0:
                err("E.语法", f"{mp}.js 语法错误: {r.stderr.strip()[:100]}")
            else:
                info("E.语法", f"{mp}.js 语法 OK")

# ============================================================
# F. 资产引用缺失
# ============================================================
def check_asset_references():
    """检查事件中引用的脸图/行走图是否存在"""
    img_faces = set(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(PROJ, "img", "faces", "*.png")))
    img_chars = set(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(PROJ, "img", "characters", "*.png")))
    
    broken = 0
    total = 0
    # faceName 引用
    face_pattern = re.compile(r'"faceName"\s*:\s*"([^"]*)"')
    char_pattern = re.compile(r'"characterName"\s*:\s*"([^"]*)"')
    
    for f in glob.glob(os.path.join(PROJ, "data", "Map5*.json")):
        rel = os.path.relpath(f, PROJ)
        try: content = open(f, encoding="utf-8").read()
        except: continue
        for m in face_pattern.finditer(content):
            name = m.group(1)
            if name:
                total += 1
                if name not in img_faces:
                    warn("F.脸图缺失", f"{rel}: faceName='{name}' 在 img/faces/ 找不到")
                    broken += 1
        for m in char_pattern.finditer(content):
            name = m.group(1)
            if name:
                total += 1
                if name not in img_chars:
                    warn("F.行走图缺失", f"{rel}: characterName='{name}' 在 img/characters/ 找不到")
                    broken += 1
    
    info("F.资产引用", f"{total - broken}/{total} 引用有效（mod 地图）")

# ============================================================
# G. en 镜像缺失
# ============================================================
def check_en_mirror():
    sc_dir = os.path.join(PROJ, "languages", "sc")
    en_dir = os.path.join(PROJ, "languages", "en")
    
    sc_files = set(os.path.basename(f) for f in glob.glob(os.path.join(sc_dir, "*.yaml")))
    en_files = set(os.path.basename(f) for f in glob.glob(os.path.join(en_dir, "*.yaml")))
    
    missing = sorted(sc_files - en_files)
    extra = sorted(en_files - sc_files)
    
    for f in missing:
        warn("G.en缺失", f"sc/{f} 存在但 en/{f} 缺失")
    for f in extra:
        info("G.en多余", f"en/{f} 存在但 sc/{f} 没有")
    
    info("G.en镜像", f"sc={len(sc_files)} en={len(en_files)} 缺失={len(missing)}")

# ============================================================
# H. 死事件检测
# ============================================================
def check_dead_events():
    """检测 mod 地图中的空事件（有名称但无命令）"""
    for f in sorted(glob.glob(os.path.join(PROJ, "data", "Map5*.json"))):
        rel = os.path.relpath(f, PROJ)
        try:
            data = json.load(open(f, encoding="utf-8"))
        except: continue
        for ev in (data.get("events") or []):
            if not ev: continue
            name = ev.get("name", "?")
            pages = ev.get("pages", [])
            has_content = any(
                any(c.get("code", 0) != 0 for c in (p.get("list") or []))
                for p in pages if p
            )
            if not has_content and name and not name.startswith("EV"):
                info("H.空事件", f"{rel}: 事件 '{name}' (id={ev.get('id')}) 所有页都无有效命令")

# ============================================================
# I. 书内容结构（简化版 validate_books）
# ============================================================
def check_books():
    if not HAS_YAML: return
    sc_dir = os.path.join(PROJ, "languages", "sc")
    for f in sorted(glob.glob(os.path.join(sc_dir, "00_MOD_book_*.yaml"))):
        rel = os.path.basename(f)
        try:
            data = yaml.safe_load(open(f, encoding="utf-8"))
        except yaml.YAMLError as e:
            err("I.书结构", f"{rel}: {str(e).splitlines()[0]}")
            continue
        states = data.get("states") or []
        if not states:
            err("I.书结构", f"{rel}: states 为空")
            continue
        # 片段对齐
        issues = 0
        for s in states:
            for pk, p in (s.get("pages") or {}).items():
                if not isinstance(p, dict): continue
                for bi, blk in enumerate(p.get("blocks") or []):
                    nf = len(re.findall(r'\*\*.+?\*\*', blk.get("text", "")))
                    ne = len(blk.get("edits") or [])
                    if nf != ne:
                        err("I.书对齐", f"{rel} [{s.get('id')}]{pk} 块{bi}: 片段{nf}≠edits{ne}")
                        issues += 1
                if p.get("text"):
                    nf = len(re.findall(r'\*\*.+?\*\*', p["text"]))
                    ne = len(p.get("edits") or [])
                    if nf != ne:
                        err("I.书对齐", f"{rel} [{s.get('id')}]{pk}: 片段{nf}≠edits{ne}")
                        issues += 1
        info("I.书结构", f"{rel}: {len(states)} 状态, {issues} 个对齐问题")

# ============================================================
# 主函数
# ============================================================
def main():
    print(f"{'='*60}")
    print(f"  OMORI 模组 Bug 扫描器")
    print(f"  目标: {PROJ}")
    print(f"  模式: {'快速' if QUICK else '完整'}")
    print(f"{'='*60}\n")
    
    checks = [
        ("A. YAML 语法+重复键", check_yaml_duplicate_keys),
        ("B. 事件消息引用", check_message_references),
        ("C. 开关/变量冲突", check_switch_conflicts),
        ("D. 地图转移断裂", check_map_transfers),
        ("E. 插件一致性", check_plugins),
        ("F. 资产引用缺失", check_asset_references),
        ("G. en 镜像完整性", check_en_mirror),
        ("H. 死事件检测", check_dead_events),
        ("I. 书内容结构", check_books),
    ]
    
    for name, fn in checks:
        print(f"  扫描 {name}...", end=" ", flush=True)
        try:
            fn()
            print("✅")
        except Exception as e:
            print(f"❌ 内部错误: {e}")
            err("SCANNER", f"{name} 扫描器异常: {e}")
    
    # 输出报告
    print(f"\n{'='*60}")
    print(f"  扫描结果")
    print(f"{'='*60}")
    
    for msg in ERRORS:
        print(f"  {msg}")
    for msg in WARNS:
        print(f"  {msg}")
    if not ERRORS and not WARNS:
        print("  ✅ 未发现问题")
    
    print(f"\n  合计: 🔴 {len(ERRORS)} ERROR | 🟡 {len(WARNS)} WARN | 🔵 {len(INFOS)} INFO")
    
    # 保存报告
    report_path = os.path.join(os.path.dirname(PROJ), "..", "docs", "bug_scan_report.md")
    report_path = os.path.normpath(report_path)
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as fp:
        fp.write(f"# Bug 扫描报告\n\n> 目标: {PROJ}\n> 模式: {'快速' if QUICK else '完整'}\n\n")
        fp.write(f"## 结果: 🔴 {len(ERRORS)} | 🟡 {len(WARNS)} | 🔵 {len(INFOS)}\n\n")
        for msg in ERRORS:
            fp.write(f"- {msg}\n")
        for msg in WARNS:
            fp.write(f"- {msg}\n")
        for msg in INFOS:
            fp.write(f"- {msg}\n")
    print(f"  报告已保存: {report_path}")
    
    sys.exit(1 if ERRORS else 0)

if __name__ == "__main__":
    main()
