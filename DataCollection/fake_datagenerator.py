from __future__ import annotations

import csv
import random
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

try:
    import pandas as pd
except Exception:
    pd = None


# ----------------------------
# Commit message configuration
# ----------------------------

MESSAGE_TYPES = [
    "feat", "fix", "chore", "docs", "style",
    "refactor", "test", "perf", "ci"
]

SCOPES = [
    "user-auth", "payment", "invoice", "readme", "api",
    "db", "ui", "core", "order-service", "user-service"
]

MESSAGE_BANK = {
    "feat": ["add login feature", "introduce new settings page"],
    "fix": ["resolve rounding issue in invoice calculation", "fix null pointer"],
    "chore": ["update dependencies", "clean up unused files"],
    "docs": ["add usage instructions", "update API documentation"],
    "style": ["fix indentation in codebase", "format code"],
    "refactor": ["simplify method flow", "remove duplicated logic"],
    "test": ["add unit tests", "improve test coverage"],
    "perf": ["improve database query performance", "reduce memory usage"],
    "ci": ["update GitHub Actions configuration", "fix CI pipeline"],
}

REPO_NAMES = [
    "user-auth-service",
    "payment-gateway",
    "order-management-api",
    "web-frontend",
]

# ----------------------------
# Repo pools (optional real data)
# ----------------------------

@dataclass
class RepoPools:
    names: list[str]
    languages: list[str]
    stars: list[int]
    forks: list[int]


def load_repo_pools(_: Optional[Path]) -> RepoPools:
    return RepoPools(
        names=[
            "user-auth-service",
            "payment-gateway",
            "order-management-api",
            "web-frontend",
        ],
        languages=["Python", "JavaScript", "TypeScript", "Go"],
        stars=[0, 1, 5, 13, 42, 120],
        forks=[0, 1, 2, 5, 10],
    )

# ----------------------------
# Utilities
# ----------------------------

def random_date(start: date, end: date) -> date:
    return start + timedelta(days=random.randint(0, (end - start).days))


# ----------------------------
# Core generator
# ----------------------------

def generate_fake_git_commits(
    n: int = 100,
    seed: int = 42,
    template_csv: Optional[Path] = None,
    start_date: date = date(2024, 1, 1),
    end_date: date = date(2026, 1, 21),
    merge_ratio: float = 0.1,
) -> list[dict]:

    random.seed(seed)
    pools = load_repo_pools(template_csv)
    commits = []

    for _ in range(n):
        is_merge = random.random() < merge_ratio

        if is_merge:
            commits.append({
                "repo_full_name": random.choice(pools.names),
                "repo_private": random.random() < 0.15,
                "repo_language": random.choice(pools.languages),
                "repo_stars": random.choice(pools.stars),
                "repo_forks": random.choice(pools.forks),
                "commit_day": random_date(start_date, end_date).isoformat(),
                "commit_hour": random.randint(0, 23),
                "is_merge": True,
                "message_type": "chore",
                "message_argument": "",
                "message_message": "merge branch 'main'",
            })
            continue

        msg_type = random.choice(MESSAGE_TYPES)
        scope = random.choice(SCOPES) if random.random() < 0.6 else ""
        message = random.choice(MESSAGE_BANK[msg_type])

        commits.append({
            "repo_full_name": random.choice(pools.names),
            "repo_private": random.random() < 0.15,
            "repo_language": random.choice(pools.languages),
            "repo_stars": random.choice(pools.stars),
            "repo_forks": random.choice(pools.forks),
            "commit_day": random_date(start_date, end_date).isoformat(),
            "commit_hour": random.randint(0, 23),
            "is_merge": False,
            "message_type": msg_type,
            "message_argument": scope,
            "message_message": message,
        })

    return commits


# ----------------------------
# CSV export
# ----------------------------

def export_to_csv(rows: list[dict], output: Path) -> None:
    fields = [
        "repo_full_name",
        "repo_private",
        "repo_language",
        "repo_stars",
        "repo_forks",
        "commit_day",
        "commit_hour",
        "is_merge",
        "message_type",
        "message_argument",
        "message_message",
    ]

    with output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


# ----------------------------
# Main
# ----------------------------

if __name__ == "__main__":
    random_seed = random.randint(0, 1000)
    commits = generate_fake_git_commits(
        n=200,
        template_csv=Path("commits_history_cleaned.csv"),
        seed=random_seed,
    )

    export_to_csv(commits, Path("fake_git_commits.csv"))
    print("CSV généré : fake_git_commits.csv")
