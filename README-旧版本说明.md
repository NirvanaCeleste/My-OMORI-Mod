# 旧版本快照（F 盘基线，2026-08 下旬状态）

本分支是 `F:\OMORI mod` 的文本快照，保存 **2026-09-29 整理与修复工作开始之前** 的完整状态。
主开发线在 `main` 分支。

## 与 main 的差异（恰好是 2026-09-29 那次会话的全部改动）

main 相对本分支多了：

1. **Map532「IPSU 探视室」**（新生成地图 + MapInfos 注册）
2. **书 yaml 开关搬迁**：night0/1/2 的 `doneSwitchId` 1001/1002/1003 → 2001/2002/2003（原 ID 与原作开关冲突）
3. **plugins.js** 给 UnwrittenStory 补 `hintSwitchId=2005`（原默认 1006 撞原作）
4. **目录结构重组**：`1/2/3` → `教程/剧本/素材`，第三方资料入 `参考资料/`，历史快照入 `归档/`（见 main 的 `docs/移动清单_20260929.md`）
5. 新增 `tools/`（mapgen.py、switchvar_report.py）与 `docs/`

## 本分支内容

- `www_playtest_2c7c22ee/`：F 盘工程文本部分（data/maps/languages/js/书UI）——与 main 的差异见上
- `2/`：剧本文档（与 main 的 `剧本/` 内容完全一致，哈希已核对）
- `未竟之事_工作成果_20260818_113258/`：8月18日交付件（与 main 的 `归档/` 副本一致）

未收录（体积/第三方原因）：AAA备份（6.4G）、教程资料、素材媒体、游戏大资产——仍在 F 盘原处。

## 想对比新旧？

```bash
git diff 旧版本-F盘 main -- www_playtest_2c7c22ee
```
