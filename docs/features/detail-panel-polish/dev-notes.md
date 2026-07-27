# detail-panel-polish — dev notes

## 续作实现（2026-07-27）

- 结构：`selection-detail__title` 移出 `.panel.selection-detail`，外包 `selection-detail-wrap`；左对齐 offset 落在 wrap。
- CSS：增大 panel padding / section gap / title→panel 间距；scoped 调整 value/label/columns；infomask 上下留白。
- 未改 free-space / hex / 行高 / 顶栏 Collapse。
- 无自动化测试覆盖纯布局 polish；自检：`pnpm --filter web typecheck`。
