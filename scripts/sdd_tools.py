import os
import sys
import subprocess
from pathlib import Path

def get_repo_root():
    res = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True)
    return Path(res.stdout.strip())

def sdd_workspace(plan_file):
    root = get_repo_root()
    plan_path = Path(plan_file)
    slug = plan_path.stem
    base = root / ".superpowers" / "sdd"
    base.mkdir(parents=True, exist_ok=True)
    gitignore = base / ".gitignore"
    if not gitignore.exists():
        gitignore.write_text("*\n", encoding="utf-8")
    
    ws = base / slug
    ws.mkdir(parents=True, exist_ok=True)
    plan_marker = ws / "plan-path"
    try:
        rel_plan = plan_path.resolve().relative_to(root.resolve())
        plan_marker.write_text(str(rel_plan).replace("\\", "/") + "\n", encoding="utf-8")
    except ValueError:
        plan_marker.write_text(str(plan_path.resolve()).replace("\\", "/") + "\n", encoding="utf-8")
    return ws

def task_brief(plan_file, task_num):
    ws = sdd_workspace(plan_file)
    out_file = ws / f"task-{task_num}-brief.md"
    
    with open(plan_file, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    in_task = False
    task_lines = []
    task_prefix = f"Task {task_num}:"
    
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("### Task "):
            if in_task:
                # Next task reached
                break
            # Check if this is the target task
            heading_part = stripped.replace("### ", "").strip()
            if heading_part.startswith(task_prefix):
                in_task = True
                task_lines.append(line)
        elif in_task:
            task_lines.append(line)
            
    if not task_lines:
        raise ValueError(f"Task {task_num} not found in {plan_file}")
        
    out_file.write_text("".join(task_lines), encoding="utf-8")
    print(f"wrote {out_file}: {len(task_lines)} lines")
    return out_file

def review_package(plan_file, base_sha, head_sha):
    ws = sdd_workspace(plan_file)
    root = get_repo_root()
    base7 = subprocess.run(["git", "-C", str(root), "rev-parse", "--short", base_sha], capture_output=True, text=True, check=True).stdout.strip()
    head7 = subprocess.run(["git", "-C", str(root), "rev-parse", "--short", head_sha], capture_output=True, text=True, check=True).stdout.strip()
    out_file = ws / f"review-{base7}..{head7}.diff"
    
    log = subprocess.run(["git", "-C", str(root), "log", "--oneline", f"{base_sha}..{head_sha}"], capture_output=True, text=True, check=True).stdout
    stat = subprocess.run(["git", "-C", str(root), "diff", "--stat", f"{base_sha}..{head_sha}"], capture_output=True, text=True, check=True).stdout
    diff = subprocess.run(["git", "-C", str(root), "diff", "-U10", f"{base_sha}..{head_sha}"], capture_output=True, text=True, check=True).stdout
    
    content = f"# Review package: {base_sha}..{head_sha}\n\n## Commits\n{log}\n\n## Files changed\n{stat}\n\n## Diff\n{diff}\n"
    out_file.write_text(content, encoding="utf-8")
    print(f"wrote {out_file}")
    return out_file

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "workspace":
        print(sdd_workspace(sys.argv[2]))
    elif cmd == "brief":
        print(task_brief(sys.argv[2], sys.argv[3]))
    elif cmd == "review-package":
        print(review_package(sys.argv[2], sys.argv[3], sys.argv[4]))
