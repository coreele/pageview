# 工作项: visibility-map-info

描述: 为 heap block 显示 visibility map（VM）信息：新增 server 端点读取 pg_visibility 扩展的 all_visible / all_frozen / pd_all_visible；扩展缺失时按既有守卫模式自动安装，安装失败时 web 显示「Install」按钮（而非仅文本）。同步修订 README 双语 Requirements / Scope / Troubleshooting。
目标分支: main
源分支: visibility-map-info
基线提交: 96c5f7388b15f3a5dc593d5926b04e2100c49ad4
文档影响: README.md / README.zh-CN.md（Requirements、Scope、Troubleshooting）；细节由 Plan 落实。

> **本文件须保存为 `workflow/workspace/visibility-map-info/main.md`**，不要沿用模板名 `record.md`。
> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/visibility-map-info/`，无子目录、无版本后缀。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| developing | Developer 实施与自验 | | | |

## 进度笔记

- 2026-09-14 Manager 从 main@96c5f73 创建并检出源分支 `visibility-map-info`，登记工作项。路径等级 standard；Spec required（新增行为 + 公开接口 + 错误约定 + 跨模块合约）；Design skipped（沿用既有 auto-install 守卫与 meta-stats 展示模式，无结构决策）；Review required。Spec 用户确认 required（install 按钮语义与 VM 展示位置存在业务歧义，待用户确认后进入 Plan）。
- 2026-09-14 用户确认 Spec（三处裁决按建议：install 按钮仅覆盖 pg_visibility；专门 `POST /api/extensions/install` 端点；VM 展示于 heap meta-stats 条）。Spec 用户确认 → approved，状态 → planning，产出 plan.md 后 → developing。
