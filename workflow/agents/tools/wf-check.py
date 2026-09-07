#!/usr/bin/env python3
"""工作流一致性校验。

用法: python3 workflow/agents/tools/wf-check.py [--verbose]
退出码: 0 全部通过 / 1 存在错误
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]   # workflow/
MECH = ROOT / "agents"                       # 机制目录
REPO = ROOT.parent                           # 仓库根
IS_GIT = (REPO / ".git").exists()            # worktree 中 .git 可能是文件

STATES = {
    "backlog", "speccing", "spec-approval", "designing", "planning",
    "developing", "reviewing", "qa", "merge-approval", "done",
    "archived", "blocked", "cancelled",
}
# 已关闭：源分支允许已合入删除或取消后丢弃
CLOSED_STATES = {"done", "archived", "cancelled"}
# 达到该状态时必须已存在的产物
REQUIRED_AT = [
    ("developing", "plan.md"),
    ("reviewing", "plan.md"), ("reviewing", "dev-notes.md"),
    ("qa", "plan.md"), ("qa", "dev-notes.md"),
    ("merge-approval", "qa-report.md"),
    ("done", "qa-report.md"),
    ("archived", "qa-report.md"),
]
ORDER = ["backlog", "speccing", "spec-approval", "designing", "planning",
         "developing", "reviewing", "qa", "merge-approval", "done", "archived"]
LEVELS = {"fast", "standard", "full"}
GATES = {"required", "skipped"}
SPEC_APPROVALS = {"required", "not-required", "approved", "rejected"}
ARTIFACTS = {"spec.md", "design.md", "ui-design.md", "plan.md",
             "dev-notes.md", "review.md", "qa-report.md"}
RECORD_NAME = "main.md"
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
PROTECTED = re.compile(r"^(main|master|release/.*)$")
SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")
CELL_SEP = re.compile(r"(?<!\\)\|")   # 单元格内的 \| 是转义竖线，不是分隔符

errors: list[str] = []
warnings: list[str] = []


def err(where: str, msg: str) -> None:
    errors.append(f"{where}: {msg}")


def warn(where: str, msg: str) -> None:
    warnings.append(f"{where}: {msg}")


def git(*args: str) -> tuple[int, str]:
    result = subprocess.run(
        ["git", *args], cwd=REPO, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False
    )
    return result.returncode, result.stdout.strip()


def rows(text: str, heading: str) -> list[list[str]]:
    """取某个二级标题下第一张表的数据行。"""
    m = re.search(rf"^##\s+{re.escape(heading)}\s*$(.*?)(?=^##\s|\Z)",
                  text, re.M | re.S)
    if not m:
        return []
    out, seen_sep = [], False
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in CELL_SEP.split(line.strip("|"))]
        if all(set(c) <= set("-: ") for c in cells):
            seen_sep = True
            continue
        if seen_sep:
            out.append(cells)
    return out


def check_tables(path: Path) -> None:
    """同一张表内列数必须一致。"""
    width = None
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        s = line.strip()
        if s.startswith("|") and s.endswith("|"):
            n = len(CELL_SEP.split(s.strip("|")))
            if width is None:
                width = n
            elif n != width:
                err(f"{path.relative_to(REPO)}:{i}",
                    f"表格列数不一致（{n} 列，本表为 {width} 列）")
        else:
            width = None


def check_paths(path: Path) -> None:
    """反引号内的 workflow/ 路径必须存在。"""
    text = path.read_text(encoding="utf-8")
    for i, line in enumerate(text.splitlines(), 1):
        for ref in re.findall(r"`(workflow/[^`\s]+)`", line):
            if "<" in ref or "*" in ref:
                continue
            if not (REPO / ref.rstrip("/")).exists():
                err(f"{path.relative_to(REPO)}:{i}", f"路径不存在 `{ref}`")


def check_label(path: Path, line_no: int, label: str, target: Path) -> None:
    """链接文本长得像路径时，必须与目标解析到同一文件（防改目标忘改文本）。"""
    label = label.strip().strip("`").rstrip("/")
    if not label or "<" in label or " " in label:
        return
    if "/" in label:
        base = REPO if label.startswith("workflow/") else path.parent
        if (base / label).resolve() != target:
            err(f"{path.relative_to(REPO)}:{line_no}",
                f"链接文本与目标不一致：`{label}` vs {target.relative_to(REPO)}")
    elif label.endswith((".md", ".py")) and label != target.name:
        err(f"{path.relative_to(REPO)}:{line_no}",
            f"链接文本 `{label}` 与目标文件名 `{target.name}` 不符")


def check_links(path: Path) -> None:
    """相对 markdown 链接必须解析得到；链接文本若是路径，须与目标一致。

    行内代码里的链接是文档示例，不参与校验。
    """
    text = path.read_text(encoding="utf-8")
    for i, line in enumerate(text.splitlines(), 1):
        line = re.sub(r"`+[^`]*`+", "", line)
        for label, url in re.findall(r"\[([^\]]*)\]\(([^)\s]+)\)", line):
            if url.startswith(("http", "#", "mailto")) or "<" in url:
                continue
            target = (path.parent / url.split("#")[0]).resolve()
            check_label(path, i, label, target)
            if not target.exists():
                err(f"{path.relative_to(REPO)}:{i}", f"坏链 {url}")


def check_entry(d: Path, archived: bool) -> tuple[str, str] | None:
    """校验一个工作项目录。记录文件固定为 main.md。"""
    rel = d.relative_to(REPO)
    if not ID_RE.match(d.name):
        err(str(rel), "目录名不是合法 <id>（小写短横线）")
    record = d / RECORD_NAME
    if not record.exists():
        err(str(rel), f"缺少工作项记录 {RECORD_NAME}")
        return None
    doc = str(rel / RECORD_NAME)

    for child in d.iterdir():
        if child.is_dir():
            err(str(rel), f"禁止子目录：{child.name}")
        elif child.name not in ARTIFACTS and child.name != RECORD_NAME:
            if re.search(r"-v\d+\.md$", child.name):
                err(str(rel), f"禁止版本后缀文件：{child.name}")
            else:
                warn(str(rel), f"非约定产物：{child.name}")

    text = record.read_text(encoding="utf-8")
    def field(name: str) -> str:
        match = re.search(rf"^{re.escape(name)}:\s*(.*?)\s*$", text, re.M)
        return match.group(1) if match else ""

    target = field("目标分支")
    source = field("源分支")
    baseline = field("基线提交")
    gate = rows(text, "门禁")
    state_rows = rows(text, "状态")
    if not gate or not state_rows:
        err(doc, "缺少「门禁」或「状态」表")
        return None

    g, s = gate[0], state_rows[0]
    if len(g) < 5:
        err(doc, f"门禁表应为 5 列，实际 {len(g)} 列")
        return None
    level = g[0]
    spec_gate = g[1]
    spec_approval = g[2]
    design_gate = g[3]
    review_gate = g[4]
    state = s[0]

    if state not in STATES:
        err(doc, f"未知状态 `{state}`")
    if level not in LEVELS:
        err(doc, f"未知路径等级 `{level}`")
    for name, val in (("Spec", spec_gate), ("Design", design_gate),
                      ("Review", review_gate)):
        if val not in GATES:
            err(doc, f"{name} 门禁取值非法 `{val}`")
    if spec_approval not in SPEC_APPROVALS:
        err(doc, f"Spec 用户确认取值非法 `{spec_approval}`")
    if review_gate == "skipped" and level != "fast":
        err(doc, "Review=skipped 仅允许 fast 路径")
    if IS_GIT:
        if not target or target == "N/A":
            err(doc, "工作项必须填写目标分支")
        if not source or source == "N/A":
            err(doc, "工作项必须填写源分支")
        elif PROTECTED.match(source):
            err(doc, f"源分支不得为受保护分支 `{source}`")
        elif source != d.name and not source.startswith(f"{d.name}-"):
            err(doc, f"源分支 `{source}` 必须为 `<id>` 或以 `<id>-` 开头")
        if not SHA_RE.match(baseline):
            err(doc, "工作项必须填写 7–40 位十六进制基线提交 SHA")
        else:
            if git("cat-file", "-e", f"{baseline}^{{commit}}")[0] != 0:
                err(doc, f"基线提交 `{baseline}` 在当前仓库中不存在")
        if target and target != "N/A" \
                and git("rev-parse", "--verify", target)[0] != 0:
            err(doc, f"目标分支 `{target}` 在当前仓库中不存在")
        closed = archived or state in CLOSED_STATES
        if source and source != "N/A":
            source_exists = git("rev-parse", "--verify", source)[0] == 0
            if not source_exists:
                if not closed:
                    err(doc, f"源分支 `{source}` 在当前仓库中不存在")
            else:
                if SHA_RE.match(baseline) and \
                        git("merge-base", "--is-ancestor", baseline, source)[0] != 0:
                    err(doc, f"基线提交 `{baseline}` 不是源分支 `{source}` 的祖先")
                if not closed:
                    current = git("branch", "--show-current")[1]
                    if current != source:
                        err(doc, f"当前分支 `{current or '(detached HEAD)'}` "
                                 f"与记录的源分支 `{source}` 不一致")
    elif any(v != "N/A" for v in (target, source, baseline)):
        err(doc, "非 Git 仓库的目标分支、源分支与基线提交应为 N/A")

    if state in ORDER:
        idx = ORDER.index(state)
        missing = {f for at, f in REQUIRED_AT
                   if idx >= ORDER.index(at) and not (d / f).exists()}
        for fname in sorted(missing):
            err(str(rel), f"状态 `{state}` 要求已存在 {fname}")
        if spec_gate == "required" and idx >= ORDER.index("designing") \
                and not (d / "spec.md").exists():
            err(str(rel), "Spec 门禁 required 但缺少 spec.md")
        if design_gate == "required" and idx >= ORDER.index("planning") \
                and not (d / "design.md").exists():
            err(str(rel), "Design 门禁 required 但缺少 design.md")
        if review_gate == "required" and idx >= ORDER.index("qa") \
                and not (d / "review.md").exists():
            err(str(rel), "Review 门禁 required 但缺少 review.md")

    if archived and state not in {"archived", "cancelled"}:
        err(doc, f"已归档目录的状态应为 archived / cancelled，实为 `{state}`")
    if not archived and state == "archived":
        err(doc, "状态为 archived 但仍在 workspace/，应移入 archive/")
    return state, level


LANES = ["等待用户", "进行中", "待办", "阻塞", "待归档"]
# 概览「已归档」对应细表「归档索引」
OVERVIEW_ALIAS = {"已归档": "归档索引"}


def check_board(active: set[str], archived: set[str]) -> None:
    """看板与目录双向一致，且「概览」的计数与各泳道实际条目相符。"""
    path = ROOT / "STATUS.md"
    text = path.read_text(encoding="utf-8")

    def ids(cells: list[list[str]]) -> set[str]:
        return {r[0] for r in cells if ID_RE.match(r[0])}

    listed: set[str] = set()
    per_lane: dict[str, set[str]] = {}
    for lane in LANES + ["归档索引"]:
        found = ids(rows(text, lane))
        per_lane[lane] = found
        listed |= found

    for i in sorted(active - listed):
        err("workflow/STATUS.md", f"活跃工作项未上看板：{i}")
    for i in sorted(listed - active - archived):
        err("workflow/STATUS.md", f"看板条目无对应目录：{i}")

    overview = rows(text, "概览")
    expected = LANES + ["已归档"]
    got = [r[0] for r in overview]
    if got != expected:
        err("workflow/STATUS.md",
            f"概览泳道应为 {expected}，实为 {got}")

    for row in overview:
        lane = row[0]
        source = OVERVIEW_ALIAS.get(lane, lane)
        if source not in per_lane:
            err("workflow/STATUS.md", f"概览出现未知泳道 `{lane}`")
            continue
        actual = per_lane[source]
        try:
            claimed = int(row[1])
        except (ValueError, IndexError):
            err("workflow/STATUS.md", f"概览「{lane}」的数量不是整数")
            continue
        if claimed != len(actual):
            err("workflow/STATUS.md",
                f"概览「{lane}」计数 {claimed} 与该泳道实际 {len(actual)} 项不符")
        cell = row[2] if len(row) > 2 else ""
        if cell and cell != "—":
            named = {s.strip() for s in re.split(r"[,，、]", cell) if s.strip()}
            if named != actual:
                err("workflow/STATUS.md",
                    f"概览「{lane}」列出的条目与该泳道不符：{sorted(named ^ actual)}")


def main() -> int:
    verbose = "--verbose" in sys.argv

    for p in ("WORKFLOW.md", "STATUS.md", "agents/agents",
              "agents/standards", "agents/templates", "workspace"):
        if not (ROOT / p).exists():
            err("workflow", f"缺少 {p}")

    md_files = list(ROOT.rglob("*.md"))
    for p in md_files:
        check_tables(p)
        check_paths(p)
        check_links(p)

    active: set[str] = set()
    for d in sorted((ROOT / "workspace").iterdir()):
        if d.is_dir():
            active.add(d.name)
            check_entry(d, archived=False)
    if IS_GIT and len(active) > 1:
        err("workflow/workspace",
            f"一个 Git 工作树只允许一个工作项，当前有：{sorted(active)}")

    # archive/ 首次归档时才创建，存在则校验
    archived: set[str] = set()
    if (ROOT / "archive").is_dir():
        for year in sorted((ROOT / "archive").iterdir()):
            if not year.is_dir():
                continue
            if not re.match(r"^\d{4}$", year.name):
                err(f"workflow/archive/{year.name}", "归档年份目录名应为 YYYY")
                continue
            for d in sorted(year.iterdir()):
                if d.is_dir():
                    archived.add(d.name)
                    check_entry(d, archived=True)

    dup = active & archived
    if dup:
        err("workflow", f"同一 id 同时存在于 workspace/ 与 archive/：{sorted(dup)}")

    check_board(active, archived)

    if warnings and verbose:
        print("警告：")
        for w in warnings:
            print(f"  ! {w}")
    if errors:
        print(f"发现 {len(errors)} 个问题：")
        for e in errors:
            print(f"  x {e}")
        return 1
    n = len(active) + len(archived)
    extra = f"，{len(warnings)} 条警告（--verbose 查看）" if warnings else ""
    print(f"通过：{len(md_files)} 份文档，{n} 个工作项{extra}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
