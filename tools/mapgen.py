# -*- coding: utf-8 -*-
"""
OMORI 地图生成器 —— 不打开 RPG Maker MV / Tiled 直接造图
=========================================================
产物（与游戏工程的现有自定义地图完全同格式，参照 maps/map519.json 实测结构）：
  maps/mapXXX.json    Tiled 1.12 格式图层（properties 为数组，由 TILED Map Fixer 转换）
  data/MapXXX.json    RPG Maker 数据（事件用 dict 格式，与全工程一致）
  data/MapInfos.json  注册新地图（自动备份到 backups/）
  render/mapXXX.png   编辑器缩略图（PIL 合成）
  tools/preview/      2x 放大预览（人眼检查用）

用法：
  from mapgen import MapGenerator, cmd
  gen = MapGenerator(r"..\www_playtest_2c7c22ee")
  m = gen.map(532, "IPSU_VisitRoom", 17, 13, displayName="探视室")
  m.room()                      # 四面墙 + 门缺口 + 碰撞
  m.door(8, to_map=520, to_x=30, to_y=30)
  m.npc("Kel", 5, 5, char="FA_KEL", msgs=[("00_MOD_visit", "message_1")])
  m.save(parent=527, order=537)
"""
import json, os, shutil, datetime

# ---- 标准图块集（照抄 map519 的引用表，每个占 1024 个 GID）----
STANDARD_TILESETS = [
    "DW_Stage.json", "FA_INTERIOR2.json", "general_use.json",
    "Tile_Collisions_32x32.json", "BS_Blackspace.json", "BS_Blackspace3.json",
    "Tile_Regions_32x32.json", "FA_Interior2.json", "BS_HOSPITAL.json",
    "FA_HALLUCINATION.json", "BS_OBJECTS_HALLUCINATION.json",
    "BS_BasilDeathTrap.json", "BS_Stage.json", "FA_HOSPITAL.json",
    "FA_INTERIOR.json",
]
COLLISION_GID = 3073          # Tile_Collisions_32x32 第 0 块 = 实心碰撞
REGION_GID    = 5145          # Tile_Regions_32x32 第 0 块

# ---- 已实证的常用图块（map519 逐格解码确认语义）----
PALETTE = {
    "floor":     11549,       # FA_HOSPITAL 医院地板（519 室内地砖）
    "wall":      2195,        # FA_INTERIOR2 墙体（519 四周墙）
    "window":    11520,       # FA_HOSPITAL 窗带（519 北墙第1行）
    "bed":       [11683, 11715, 11747],  # 病床三段（床头/床身/床尾，画在最低层 pri1）
    "overhang":  2096,        # 南墙压檐（above-all 层，519 第8行）
    "wall_deco": 11803,       # 墙面挂饰（above-all，519 海报位）
    "floor_alt": 2195,        # 同 wall（备用）
    "prop":      12780,       # 小物件
    "lamp":      12748,       # 吸顶灯（z6 层，519 (1,4)）
}

# ============================ 事件指令构造 ============================

def cmd_plugin(text):        return {"code": 356, "indent": 0, "parameters": [text]}
def cmd_showmsg(f, key):     return cmd_plugin(f"ShowMessage {f}.{key}")
def cmd_addchoice(f, k, lb): return cmd_plugin(f"AddChoice {f}.{k} {lb}")
def cmd_showchoices(cancel=1): return cmd_plugin(f"ShowChoices {cancel}")
def cmd_label(name):         return {"code": 118, "indent": 0, "parameters": [name]}
def cmd_jump(name):          return {"code": 119, "indent": 0, "parameters": [name]}
def cmd_transfer(map_id, x, y, direction=2, fade=0):
    return {"code": 201, "indent": 0, "parameters": [0, map_id, x, y, direction, fade]}
def cmd_wait(frames):        return {"code": 230, "indent": 0, "parameters": [frames]}
def cmd_se(name, volume=90, pitch=100):
    return {"code": 250, "indent": 0,
            "parameters": [{"name": name, "volume": volume, "pitch": pitch, "pan": 0}]}
def cmd_switch(i, on):       return {"code": 121, "indent": 0, "parameters": [i, i, 0 if on else 1]}
def cmd_selfswitch(ch, on):  return {"code": 123, "indent": 0, "parameters": [ch, 0 if on else 1]}
def cmd_if_switch(switch_id, on=True):
    return {"code": 111, "indent": 0, "parameters": [0, switch_id, 0 if on else 1]}
def cmd_else():              return {"code": 411, "indent": 0, "parameters": []}
def cmd_endif():             return {"code": 412, "indent": 0, "parameters": []}
def cmd_end():               return {"code": 0,   "indent": 0, "parameters": []}
def cmd_script(text):
    return {"code": 355, "indent": 0, "parameters": [text]}

def _conditions():
    return {"actorId": 1, "actorValid": False, "itemId": 1, "itemValid": False,
            "selfSwitchCh": "A", "selfSwitchValid": False,
            "switch1Id": 1, "switch1Valid": False, "switch2Id": 1, "switch2Valid": False,
            "variableId": 1, "variableValid": False, "variableValue": 0}

def page(list_, char="", char_index=0, direction=2, trigger=0,
         priority_type=1, dir_fix=False, through=False, conditions=None):
    """trigger: 0=动作按钮 1=玩家接触 2=事件接触 3=自动执行 4=并行
       priority_type: 0=下方 1=同层 2=上方"""
    return {
        "conditions": conditions or _conditions(),
        "directionFix": dir_fix,
        "image": {"characterIndex": char_index, "characterName": char,
                  "direction": direction, "pattern": 0, "tileId": 0},
        "list": list_,
        "moveFrequency": 3, "moveRoute": {"list": [{"code": 0, "parameters": []}],
                                          "repeat": True, "skippable": False, "wait": False},
        "moveSpeed": 3, "moveType": 0, "priorityType": priority_type,
        "stepAnime": False, "through": through, "trigger": trigger, "walkAnime": True,
    }

# ============================ 地图构造器 ============================

def _props(**kw):
    props = []
    for name in ("zIndex", "priority", "collision", "regionId"):
        if kw.get(name) is not None:
            props.append({"name": name, "type": "string", "value": str(kw[name])})
    return props

class MapBuilder:
    # 标准图层（名字, zIndex, priority）——与 map519 一致
    LAYER_PLAN = [
        ("G1", 1, 1), ("G2", 1, 2), ("G3", 1, 3), ("G4", 1, 4),
        ("G5", 1, 5), ("G6", 1, 6), ("G7", 1, 7),
        ("A1", 5, 1), ("A2", 5, 2), ("A3", 5, 3), ("A4", 5, 4), ("A5", 5, 4),
        ("AX", 6, 1),
    ]

    def __init__(self, gen, map_id, name, w, h, displayName=""):
        self.gen, self.id, self.name = gen, map_id, name
        self.w, self.h, self.displayName = w, h, (displayName or name)
        self.data = {n: [0] * (w * h) for n, _, _ in self.LAYER_PLAN}
        self.coll = [0] * (w * h)
        self.regions = {}                     # regionId -> data
        self.events = []
        self.parallaxName = ""

    # ---- 绘制 ----
    def _idx(self, x, y): return y * self.w + x
    def set(self, layer, x, y, gid):
        self.data[layer][self._idx(x, y)] = gid
    def get(self, layer, x, y):
        return self.data[layer][self._idx(x, y)]
    def fill(self, layer, gid, x=0, y=0, w=None, h=None):
        w = w or self.w; h = h or self.h
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(layer, xx, yy, gid)
    def rect(self, layer, x, y, w, h, gid):
        self.fill(layer, gid, x, y, w, h)
    def hline(self, layer, x, y, length, gid):
        self.fill(layer, gid, x, y, length, 1)
    def vline(self, layer, x, y, length, gid):
        self.fill(layer, gid, x, y, 1, length)
    def border(self, layer, gid, thickness=1):
        self.fill(layer, gid, 0, 0, self.w, thickness)
        self.fill(layer, gid, 0, self.h - thickness, self.w, thickness)
        self.fill(layer, gid, 0, 0, thickness, self.h)
        self.fill(layer, gid, self.w - thickness, 0, thickness, self.h)

    # ---- 碰撞 / 区域 ----
    def block(self, x, y):        self.coll[self._idx(x, y)] = COLLISION_GID
    def unblock(self, x, y):      self.coll[self._idx(x, y)] = 0
    def block_rect(self, x, y, w, h):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.block(xx, yy)
    def block_border(self):
        for x in range(self.w):
            self.block(x, 0); self.block(x, self.h - 1)
        for y in range(self.h):
            self.block(0, y); self.block(self.w - 1, y)
    def region(self, region_id, x, y):
        layer = f"REGION - {region_id}"
        if layer not in self.regions:
            self.regions[layer] = [0] * (self.w * self.h)
        self.regions[layer][self._idx(x, y)] = REGION_GID

    # ---- 常用结构 ----
    def room(self, floor="floor", door_x=None, windows=True):
        """标准室内房间（配方照抄 map519）：
        北墙两行(墙体+窗带) / 侧墙整列 / 南墙+压檐(above-all) / 室内地板(pri2)"""
        self.fill("G2", PALETTE[floor])                        # 地板在 pri2 层
        self.fill("G2", PALETTE["wall"], 0, 0, self.w, 2)      # 北墙
        if windows:
            self.fill("G2", PALETTE["window"], 1, 1, self.w - 2, 1)
        self.vline("G2", 0, 0, self.h, PALETTE["wall"])        # 侧墙
        self.vline("G2", self.w - 1, 0, self.h, PALETTE["wall"])
        self.hline("G2", 0, self.h - 1, self.w, PALETTE["wall"])   # 南墙
        self.hline("A2", 0, self.h - 1, self.w, PALETTE["overhang"])  # 压檐
        self.block_border()                                    # 碰撞
        self.block_rect(0, 1, self.w, 1)
        if door_x is not None:                                 # 北门缺口
            for dy in (0, 1):
                self.set("G2", door_x, dy, PALETTE[floor])
                self.unblock(door_x, dy)

    def bed(self, x, y):
        """病床（三段竖条，画在最低层 pri1 —— 与 519 的摆床方式一致）"""
        for i, gid in enumerate(PALETTE["bed"]):
            self.set("G1", x, y + i, gid)
        self.block_rect(x, y, 1, 3)

    def door(self, x, to_map, to_x, to_y, direction=8, se=None, name="Door"):
        """门事件（玩家接触触发 → 转移）。需先在 room(door_x=x) 里开缺口"""
        lst = []
        if se: lst.append(cmd_se(se))
        lst += [cmd_transfer(to_map, to_x, to_y, direction, 0), cmd_end()]
        self.events.append({"id": len(self.events) + 2, "name": name, "note": "",
                            "x": x, "y": 1, "pages": [page(lst, trigger=1)]})

    def npc(self, name, x, y, char, msgs, char_index=0, direction=2,
            trigger=0, extra_list=None):
        """对话 NPC：msgs = [(yaml文件, 消息键), ...]"""
        lst = [cmd_showmsg(f, k) for f, k in msgs]
        if extra_list: lst += extra_list
        lst.append(cmd_end())
        self.events.append({"id": len(self.events) + 2, "name": name, "note": "",
                            "x": x, "y": y,
                            "pages": [page(lst, char=char, char_index=char_index,
                                           direction=direction, trigger=trigger)]})

    def sign(self, name, x, y, yaml_file, keys):
        """告示牌/调查点：keys = [消息键, ...]"""
        lst = [cmd_showmsg(yaml_file, k) for k in keys] + [cmd_end()]
        self.events.append({"id": len(self.events) + 2, "name": name, "note": "",
                            "x": x, "y": y, "pages": [page(lst, trigger=0)]})

    def raw_event(self, name, x, y, pages):
        self.events.append({"id": len(self.events) + 2, "name": name, "note": "",
                            "x": x, "y": y, "pages": pages})

    # ---- 输出 ----
    def _tiled_json(self):
        layers = []
        for lname, z, p in self.LAYER_PLAN:
            layers.append({"data": self.data[lname], "height": self.h, "id": len(layers) + 1,
                           "name": lname, "opacity": 1, "type": "tilelayer",
                           "visible": True, "width": self.w, "x": 0, "y": 0,
                           "properties": _props(zIndex=z, priority=p)})
        layers.append({"data": self.coll, "height": self.h, "id": len(layers) + 1,
                       "name": "Collisions", "opacity": 1, "type": "tilelayer",
                       "visible": False, "width": self.w, "x": 0, "y": 0,
                       "properties": _props(collision="tile-base")})
        for rname, rdata in self.regions.items():
            rid = rname.split("-")[1].strip()
            layers.append({"data": rdata, "height": self.h, "id": len(layers) + 1,
                           "name": rname, "opacity": 1, "type": "tilelayer",
                           "visible": True, "width": self.w, "x": 0, "y": 0,
                           "properties": _props(regionId=rid)})
        tilesets = [{"firstgid": 1 + i * 1024, "source": s} for i, s in enumerate(STANDARD_TILESETS)]
        return {"compressionlevel": -1, "height": self.h, "infinite": False,
                "layers": layers, "nextlayerid": len(layers) + 1, "nextobjectid": 1,
                "orientation": "orthogonal", "renderorder": "right-down",
                "tiledversion": "1.12.2", "tileheight": 32, "tilesets": tilesets,
                "tilewidth": 32, "type": "map", "version": "1.10", "width": self.w}

    def _rmmv_json(self):
        evs = [None] + [e for e in sorted(self.events, key=lambda e: e["id"])]
        return {"autoplayBgm": False, "autoplayBgs": False,
                "battleback1Name": "", "battleback2Name": "",
                "bgm": {"name": "", "pan": 0, "pitch": 100, "volume": 90},
                "bgs": {"name": "", "pan": 0, "pitch": 100, "volume": 90},
                "disableDashing": True, "displayName": self.displayName,
                "encounterList": [], "encounterStep": 30, "height": self.h, "note": "",
                "parallaxLoopX": False, "parallaxLoopY": False,
                "parallaxName": self.parallaxName, "parallaxShow": True,
                "parallaxSx": 1, "parallaxSy": 5, "scrollType": 0,
                "specifyBattleback": False, "tilesetId": 1, "width": self.w,
                "data": [0] * (self.w * self.h * 6), "events": evs}

    def save(self, parent=515, order=None, register=True):
        g = self.gen
        os.makedirs(g.preview_dir, exist_ok=True)
        tiled, rmmv = self._tiled_json(), self._rmmv_json()
        json.dump(tiled, open(os.path.join(g.maps_dir, f"map{self.id}.json"), "w",
                              encoding="utf-8"), ensure_ascii=False)
        json.dump(rmmv, open(os.path.join(g.data_dir, f"Map{self.id}.json"), "w",
                             encoding="utf-8"), ensure_ascii=False)
        if register:
            g.register_mapinfo(self.id, self.name, parent, order)
        prev = g.render_preview(self, os.path.join(g.preview_dir, f"map{self.id}_preview.png"), scale=2)
        # 编辑器缩略图（1x，覆盖到 render/）
        g.render_preview(self, os.path.join(g.proj, "render", f"map{self.id}.png"), scale=1)
        print(f"[mapgen] Map{self.id} '{self.displayName}' {self.w}x{self.h} "
              f"事件{len(self.events)} 已保存，预览: {prev}")
        return prev


class MapGenerator:
    def __init__(self, project_dir):
        self.proj = os.path.abspath(project_dir)
        self.maps_dir = os.path.join(self.proj, "maps")
        self.data_dir = os.path.join(self.proj, "data")
        self.preview_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "preview")
        self._ts_cache = {}

    def map(self, map_id, name, w, h, displayName=""):
        return MapBuilder(self, map_id, name, w, h, displayName)

    def register_mapinfo(self, map_id, name, parent=515, order=None):
        path = os.path.join(self.data_dir, "MapInfos.json")
        bak = os.path.join(self.proj, "backups",
                           f"MapInfos_{datetime.date.today():%Y%m%d}.json")
        os.makedirs(os.path.dirname(bak), exist_ok=True)
        if not os.path.exists(bak):
            shutil.copy2(path, bak)
        mi = json.load(open(path, encoding="utf-8"))
        while len(mi) <= map_id:
            mi.append(None)
        if mi[map_id] is not None:
            print(f"[mapgen] 警告: MapInfos[{map_id}] 已存在({mi[map_id]['name']})，跳过注册")
            return
        if order is None:
            order = max((v.get("order", 0) for v in mi if isinstance(v, dict)), default=500) + 1
        mi[map_id] = {"id": map_id, "name": name, "order": order,
                      "parentId": parent, "scrollX": 819, "scrollY": 448,
                      "expanded": False}
        json.dump(mi, open(path, "w", encoding="utf-8"), ensure_ascii=False)
        print(f"[mapgen] MapInfos 注册 id={map_id} name={name} (parent={parent} order={order})，备份: {bak}")

    # ---- 预览渲染 ----
    def _ts_image(self, firstgid, source):
        if firstgid not in self._ts_cache:
            tj = json.load(open(os.path.join(self.maps_dir, source), encoding="utf-8"))
            from PIL import Image
            img = Image.open(os.path.normpath(
                os.path.join(self.maps_dir, tj["image"]))).convert("RGBA")
            self._ts_cache[firstgid] = (img, tj["columns"])
        return self._ts_cache[firstgid]

    def render_preview(self, builder, out_png, scale=2):
        from PIL import Image
        W, H, TS = builder.w, builder.h, 32
        canvas = Image.new("RGBA", (W * TS, H * TS), (20, 18, 26, 255))
        ordered = [(n, z, p) for n, z, p in MapBuilder.LAYER_PLAN]
        draw_lists = [(builder.data[n]) for n, _, _ in ordered] + \
                     [builder.coll] + [builder.regions[r] for r in builder.regions]
        for data in draw_lists:
            for i, gid in enumerate(data):
                gid &= 0x1FFFFFFF
                if gid == 0:
                    continue
                base = max(b for b, _ in self._ts_map() if b <= gid)
                img, cols = self._ts_image(base, self._ts_source(base))
                lid = gid - base
                sx, sy = (lid % cols) * TS, (lid // cols) * TS
                canvas.paste(img.crop((sx, sy, sx + TS, sy + TS)),
                             ((i % W) * TS, (i // W) * TS))
        if scale != 1:
            canvas = canvas.resize((W * TS * scale, H * TS * scale), Image.NEAREST)
        canvas.save(out_png)
        return out_png

    def _ts_map(self):
        return [(1 + i * 1024, s) for i, s in enumerate(STANDARD_TILESETS)]

    def _ts_source(self, firstgid):
        for b, s in self._ts_map():
            if b == firstgid:
                return s
        raise KeyError(firstgid)
