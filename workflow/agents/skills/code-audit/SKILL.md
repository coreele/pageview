---
name: code-audit
description: 对照代码审计标准只读审计仓库源码，输出违规 Findings 与关注项（Known Issue / Tech Debt / 优化），报告写入 workflow/audit/ 并核对登记册。当用户要求代码审计、code audit、审查技术债或已知问题时使用。审计期间不修改任何源码。
---

# code-audit — 代码质量审计

对照 `workflow/agents/standards/code-audit*.md` 审计源码，产出违规 Findings 与关注项。**流程外活动**，不进工作流状态机。

**只读。** 执行期间不得编辑、新建或删除任何源码文件，也不得运行会改动工作树代码的命令。即使发现 Critical 也不顺手修；修复由用户另行发起为工作项。唯一允许的写入是审计报告与登记册。

## 资源

| 资源 | 路径 | 规则 |
|---|---|---|
| 基线标准 | [code-audit.md](../../standards/code-audit.md) | 必读 |
| 专项标准 | `workflow/agents/standards/code-audit-<topic>.md` | 通配自动加载 |
| 登记册 | [register.md](../../../audit/register.md) | 存在则必读，**不**当条款标准 |
| 其他标准 | 用户点名的文件 | 仅显式指定时追加 |

**不要**加载 `quality.md`、`git.md`、`documentation.md` 等流程规范，除非用户明确点名。

## 范围

- **代码**：默认仓库主源码目录（由用户指定或按仓库约定推断，如 `src/`、`lib/`、`app/`）。首次审计须与用户确认根路径并写进报告。可收窄到子路径，不得扩大到声明范围外。
- **产出**：`workflow/audit/YYYY-MM-DD-<scope>.md`。对话中可摘要，完整结论以文件为准。

## 步骤

1. 枚举并完整读取 `workflow/agents/standards/code-audit*.md`。
2. 存在 [register.md](../../../audit/register.md) 时读取，记下待核对条目。
3. 一份标准都没有：**停止**并提示补基线标准；禁止编造条款，禁止用 `quality.md` 顶替。
4. 确定审计路径。
5. 按条款取证形成 Findings；按基线 §8 与 `TODO` / `FIXME` / `HACK` / `XXX` 等标记收集关注项。
6. 核对登记册：仍存在则建议更新，疑似已修复则建议标 `resolved`。
7. 按下方模板落盘。

## 报告模板

```markdown
# 代码质量审计报告

## 范围
- 代码：<path>
- 标准：<code-audit*.md 列表>
- 登记册：<path 或「无」>

## 摘要
- Findings — Critical: N | High: N | Medium: N | Low: N | Info: N
- 关注项 — Known Issue: N | Tech Debt: N | 优化: N
- <一句话质量结论>

## Findings（违规）
| 级别 | 标准 | 位置 | 问题 | 建议 |
|---|---|---|---|---|

## 关注项
| 类型 | 级别 | 位置 | 描述 | 影响或收益 | 建议下一步 | 登记册 |
|---|---|---|---|---|---|---|

## 登记册核对
| ID | 原状态 | 审计结论 | 建议 |
|---|---|---|---|

## 覆盖说明
- 已读：<文件列表>
- 未覆盖条款：<说明或「无」>
```

无对应条目的表写一行「无」。「标准」列须含文件路径与条款编号。

## 边界

| 情况 | 行为 |
|---|---|
| 无 `code-audit*.md` | 停止并提示补充 |
| 无登记册 | 跳过核对，仍从代码收集关注项 |
| 条款无法落到范围 | 在覆盖说明注明 |
| 疑似敏感信息 | 报告位置与类型，不回显完整密钥 |
| 安全类问题 | 只报风险与偏差，不写 exploit 或 PoC |
| 审计中用户要求修复 | 先落盘报告；修复作为审计外的新任务 |
