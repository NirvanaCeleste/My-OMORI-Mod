# 《未竟之事 Unwritten Story》—— OMORI 模组工作仓库

OMORI 中文同人模组的开发仓库。坦白路线（好结局）之后的故事：Basil 在 IPSU 的三天与疗愈线。
核心玩法：梦境之书《未竟之事》——逐字书写、修改/擦除/保留、树状状态机分支。

## 目录结构

| 目录 | 内容 | 是否入库 |
|---|---|---|
| `www_playtest_2c7c22ee/` | **主游戏工程**（RPG Maker MV，OneLoader 解密版）。所有开发在这里进行 | 文本部分入库* |
| `剧本/` | 剧本文档（Unwritten Story.docx 等） | ✅ |
| `docs/` | 项目文档、开关变量对照表、移动清单 | ✅ |
| `tools/` | 自制工具（mapgen.py 地图生成器、switchvar_report.py 等） | ✅ |
| `教程/` | 模组制作教程（英文原稿 + 中译本 PDF + zip） | ❌ 体积大 |
| `参考资料/` | 第三方知识库、资源库、VS Code 插件、小工具 | ❌ 第三方 |
| `素材/` | 图片视频素材收集 | ❌ 二进制 |
| `归档/` | 历史快照：AAA备份、8月18日交付件、旧基线工程 9714bb70 | ❌ 历史快照 |

\* 工程入库范围：`data/`（70M，含全部地图事件）、`maps/`（64M，Tiled 图）、`languages/`（对话 yaml）、
`js/`（插件，不含 libs）、`img/pictures/Unwritten/`（书本 UI）、根目录文本文件。
音频/图像/字体等约 2G 资产不入库——**新机器恢复方法**：Steam 版 OMORI + OneLoader 解密生成
playtest 工程，再把本仓库文件覆盖上去。

## 关键约定

- **开关分配**：2001/2002/2003 = 三夜书完成开关；2005 = 书首次提示。**1001-1008 是原作占用，禁用**（详见 `docs/开关变量对照表.md`）。
- **书内容**：`languages/sc/00_MOD_book_night{0,1,2}.yaml`，树状状态机格式（v1.38 插件），改完跑 `python tools/validate_books.py`（待建）校验。
- **地图**：用 `tools/mapgen.py` 生成，不要手点编辑器（详见工具内注释）。

## 常用命令

```bash
# 开关/变量对照表更新
python tools/switchvar_report.py

# 一键提交（F盘改动回灌D + commit + push）
python tools/f_commit.py "说明"

# 生成/重新生成地图（示例：探视室）
python tools/gen_532_visitroom.py
```
