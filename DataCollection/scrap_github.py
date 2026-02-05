import os
import sys
import time
import importlib.util
import requests
import pandas as pd
from typing import List, Dict, Any, Optional

# ----------------- CONFIG -----------------
secrets_path = os.path.join(os.path.dirname(__file__), ".secrets.py")
spec = importlib.util.spec_from_file_location("project_secrets", secrets_path)
project_secrets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(project_secrets)

GITHUB_TOKEN = getattr(project_secrets, "GITHUB_TOKEN", None)
GITHUB_LOGIN = getattr(project_secrets, "GITHUB_LOGIN", None)

if not (GITHUB_TOKEN and GITHUB_LOGIN):
    print("Error: GITHUB_TOKEN and GITHUB_LOGIN must be set in .secrets.py.")
    sys.exit(1)

SESSION = requests.Session()
SESSION.headers.update({
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": GITHUB_LOGIN,
})

# Test token
r = SESSION.get("https://api.github.com/user", timeout=30)
if r.status_code != 200:
    print("Error: Invalid GITHUB_TOKEN or GITHUB_LOGIN.")
    print(r.status_code, r.text[:200])
    sys.exit(1)

# ------------ PARAMS À ADAPTER ------------
REPO_FULL_NAME = "ML_Differential_Solver"  # <-- ex: "Samuel-Chapuis/mon-repo"
OUT_CSV = "data/commits_repo_all_members.csv"

START_DATE = "2023-01-01T00:00:00Z"
END_DATE   = "2025-10-14T23:59:59Z"

PER_PAGE = 100
MAX_PAGES = 500
RATE_LIMIT_THRESHOLD = 10
SLEEP_ON_RATE_LIMIT = 10


def github_get_all(url: str, params: Optional[Dict[str, Any]] = None,
                   max_pages: int = MAX_PAGES) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    page = 1
    params = dict(params or {})
    params.setdefault("per_page", PER_PAGE)

    while url and page <= max_pages:
        rr = SESSION.get(url, params=params if page == 1 else None, timeout=60)

        remaining = int(rr.headers.get("X-RateLimit-Remaining", "1000"))
        reset = int(rr.headers.get("X-RateLimit-Reset", "0"))

        # Gérer rate limit (y compris 403)
        if rr.status_code == 403 and remaining == 0:
            wait = max(SLEEP_ON_RATE_LIMIT, reset - int(time.time()) + 1)
            print(f"[rate-limit] sleeping {wait}s…")
            time.sleep(wait)
            continue

        if remaining <= RATE_LIMIT_THRESHOLD:
            wait = max(SLEEP_ON_RATE_LIMIT, reset - int(time.time()) + 1)
            print(f"[rate-limit] remaining={remaining}, sleeping {wait}s…")
            time.sleep(wait)
            continue

        if rr.status_code != 200:
            print(f"[warn] GET {url} page {page} -> {rr.status_code}; {rr.text[:200]}")
            break

        data = rr.json()
        if isinstance(data, list):
            out.extend(data)
        else:
            out.append(data)

        # parse Link header for next page
        link = rr.headers.get("Link", "")
        next_url = None
        if link:
            for part in link.split(","):
                if 'rel="next"' in part:
                    next_url = part.split(";")[0].strip().lstrip("<").rstrip(">")
        url = next_url
        page += 1

    return out


def fetch_branches(full_name: str) -> List[str]:
    url = f"https://api.github.com/repos/{full_name}/branches"
    branches = github_get_all(url, params={"per_page": PER_PAGE}, max_pages=50)
    return [b["name"] for b in branches if "name" in b]


def fetch_commits_for_branch(full_name: str, branch: str) -> List[Dict[str, Any]]:
    url = f"https://api.github.com/repos/{full_name}/commits"
    params = {
        "sha": branch,          # IMPORTANT: branche ciblée
        "since": START_DATE,
        "until": END_DATE,
        "per_page": PER_PAGE
        # PAS de filtre "author" => tous les membres
    }
    return github_get_all(url, params=params, max_pages=MAX_PAGES)


def parse_commit(row: Dict[str, Any], repo_full_name: str, branch: str) -> Dict[str, Any]:
    commit = row.get("commit") or {}
    author_user = row.get("author") or {}      # compte GitHub (peut être None)
    committer_user = row.get("committer") or {}
    parents = row.get("parents") or []
    is_merge = (len(parents) > 1)

    author_block = commit.get("author") or {}
    committer_block = commit.get("committer") or {}

    author_date = author_block.get("date")
    committer_date = committer_block.get("date")
    commit_date = author_date or committer_date

    commit_day = None
    commit_hour = None
    if commit_date:
        try:
            commit_day = commit_date.split("T")[0]
        except Exception:
            pass
        try:
            dt = pd.to_datetime(commit_date, utc=True, errors="coerce")
            if not pd.isna(dt):
                commit_hour = int(dt.hour)
        except Exception:
            pass

    return {
        "repo_full_name": repo_full_name,
        "branch": branch,
        "sha": row.get("sha"),  # <-- crucial pour dedup
        "html_url": row.get("html_url"),
        "message": commit.get("message"),

        # Qui ?
        "author_login": author_user.get("login"),
        "author_name": author_block.get("name"),
        "author_email": author_block.get("email"),
        "committer_login": committer_user.get("login"),
        "committer_name": committer_block.get("name"),
        "committer_email": committer_block.get("email"),

        # Quand ?
        "author_date": author_date,
        "committer_date": committer_date,
        "commit_date": commit_date,
        "commit_day": commit_day,
        "commit_hour": commit_hour,

        "is_merge": is_merge,
    }


def append_dedup(df_new: pd.DataFrame, out_path: str, key: str = "sha") -> int:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        df_old = pd.read_csv(out_path, low_memory=False)
        df_all = pd.concat([df_old, df_new], ignore_index=True)
    else:
        df_all = df_new.copy()

    if key in df_all.columns:
        df_all = df_all.drop_duplicates(subset=[key], keep="last")

    for col in ["author_date", "committer_date", "commit_date"]:
        if col in df_all.columns:
            df_all[col] = pd.to_datetime(df_all[col], utc=True, errors="coerce")

    if "commit_day" in df_all.columns:
        df_all["commit_day"] = pd.to_datetime(df_all["commit_day"], errors="coerce").dt.date

    if "commit_hour" in df_all.columns:
        df_all["commit_hour"] = pd.to_numeric(df_all["commit_hour"], errors="coerce").astype(pd.Int64Dtype())

    df_all.to_csv(out_path, index=False)
    return len(df_all)


def main():
    print(f"Repo: {REPO_FULL_NAME}")
    print("Listing branches…")
    branches = fetch_branches(REPO_FULL_NAME)
    print(f"Found {len(branches)} branches.")

    total_rows = 0
    all_rows = []

    for i, br in enumerate(branches, 1):
        print(f"[{i}/{len(branches)}] Fetch commits on branch '{br}' ({START_DATE} → {END_DATE})…")
        commits = fetch_commits_for_branch(REPO_FULL_NAME, br)
        if not commits:
            continue
        rows = [parse_commit(c, REPO_FULL_NAME, br) for c in commits]
        all_rows.extend(rows)
        total_rows += len(rows)

    df = pd.DataFrame(all_rows)
    print(f"Fetched {total_rows} rows (before dedup). Writing…")
    total_now = append_dedup(df, OUT_CSV, key="sha")
    print(f"Done. CSV rows after dedup: {total_now} -> {OUT_CSV}")


if __name__ == "__main__":
    main()