#!/usr/bin/env python3
"""Lightweight generic guard: reject obvious secrets added to the current git diff.

Designed to be dependency-free and safe across heterogeneous repositories.
If the current directory is not a git repo, exits successfully.
"""
from __future__ import annotations
import re
import subprocess
import sys

def git_diff() -> str:
    commands = [
        ["git", "diff", "--cached", "--unified=0", "--no-ext-diff"],
        ["git", "diff", "--unified=0", "--no-ext-diff"],
    ]
    chunks = []
    for cmd in commands:
        try:
            p = subprocess.run(cmd, text=True, capture_output=True, timeout=10)
        except Exception:
            continue
        if p.returncode == 0 and p.stdout:
            chunks.append(p.stdout)
    return "\n".join(chunks)

diff = git_diff()
if not diff:
    sys.exit(0)

added = "\n".join(
    line[1:] for line in diff.splitlines()
    if line.startswith("+") and not line.startswith("+++")
)

patterns = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"),
    "generic secret assignment": re.compile(
        r"(?i)\b(api[_-]?key|secret|access[_-]?token|auth[_-]?token|password)\b"
        r"\s*[:=]\s*[\"'][^\"'\n]{12,}[\"']"
    ),
}

hits = [name for name, rx in patterns.items() if rx.search(added)]
if hits:
    print("Intent Driven Starter: possible secret detected in added git diff: " + ", ".join(hits))
    print("Move credentials to environment/secret storage before finishing.")
    sys.exit(2)

sys.exit(0)
