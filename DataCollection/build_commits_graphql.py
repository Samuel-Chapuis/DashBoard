# ----------------- CONFIG -----------------
import os
import sys
import time
import importlib.util
import requests
import pandas as pd
from typing import List, Dict, Any, Optional

# Load credentials from environment
secrets_path = os.path.join(os.path.dirname(__file__), ".secrets.py")
spec = importlib.util.spec_from_file_location("project_secrets", secrets_path)
project_secrets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(project_secrets)
GITHUB_TOKEN =  getattr(project_secrets, "GITHUB_TOKEN", None)
GITHUB_LOGIN =  getattr(project_secrets, "GITHUB_LOGIN", None)

# Test if the github token works by making a simple API call
if GITHUB_TOKEN and GITHUB_LOGIN:
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": GITHUB_LOGIN,
    }
    response = requests.get("https://api.github.com/user", headers=headers)
    if response.status_code != 200:
        print("Error: Invalid GITHUB_TOKEN or GITHUB_LOGIN.")
        sys.exit(1)
else:
    print("Error: GITHUB_TOKEN and GITHUB_LOGIN must be set in .secrets.py.")
    sys.exit(1)
    
# ----------------- Scraping (historique de commits 2023+ via REST) -----------------

OUT_CSV = "data/commits_history.csv"

# Fenêtre temporelle : remonter jusqu'à 2023
START_DATE = "2023-01-01T00:00:00Z"   # ISO 8601 UTC
END_DATE   = "2025-10-14T23:59:59Z"   # mets "now" si tu veux: datetime.utcnow().isoformat() + "Z"

# Filtrer les commits par auteur :
# - Mets ton login GitHub (ex. "Samuel-Chapuis") pour ne garder que **tes** commits
# - Mets None pour prendre **tous** les commits (toutes personnes)
AUTHOR_LOGIN = "Samuel-Chapuis"  # ou None

PER_PAGE = 100
MAX_PAGES = 200   # sécurité pour gros dépôts
RATE_LIMIT_THRESHOLD = 10
SLEEP_ON_RATE_LIMIT = 10

SESSION = requests.Session()
SESSION.headers.update({
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": GITHUB_LOGIN or "commits-history-scraper",
})

def github_get_all(url: str, params: Optional[Dict[str, Any]] = None,
                   max_pages: int = MAX_PAGES) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    page = 1
    params = dict(params or {})
    params.setdefault("per_page", PER_PAGE)
    while url and page <= max_pages:
        r = SESSION.get(url, params=params if page == 1 else None, timeout=60)
        remaining = int(r.headers.get("X-RateLimit-Remaining", "1000"))
        reset = int(r.headers.get("X-RateLimit-Reset", "0"))
        if remaining <= RATE_LIMIT_THRESHOLD:
            wait = max(SLEEP_ON_RATE_LIMIT, reset - int(time.time()) + 1)
            print(f"[rate-limit] remaining={remaining}, sleeping {wait}s…")
            time.sleep(wait)
            continue
        if r.status_code != 200:
            print(f"[warn] GET {url} page {page} -> {r.status_code}; {r.text[:200]}")
            break
        data = r.json()
        if isinstance(data, list):
            out.extend(data)
        else:
            out.append(data)
        # parse Link header
        link = r.headers.get("Link", "")
        next_url = None
        if link:
            for part in link.split(","):
                if 'rel="next"' in part:
                    next_url = part.split(";")[0].strip().lstrip("<").rstrip(">")
        url = next_url
        page += 1
    return out

def fetch_accessible_repos() -> List[Dict[str, Any]]:
    url = "https://api.github.com/user/repos"
    params = {"affiliation": "owner,collaborator,organization_member", "per_page": PER_PAGE}
    return github_get_all(url, params=params, max_pages=50)

def fetch_repo_commits(full_name: str) -> List[Dict[str, Any]]:
    url = f"https://api.github.com/repos/{full_name}/commits"
    params = {"since": START_DATE, "until": END_DATE}
    if AUTHOR_LOGIN:
        params["author"] = AUTHOR_LOGIN  # filtre côté serveur (par login GitHub)
    return github_get_all(url, params=params, max_pages=MAX_PAGES)

def parse_commit(row: Dict[str, Any], repo_meta: Dict[str, Any]) -> Dict[str, Any]:
    commit = row.get("commit") or {}
    author = row.get("author") or {}       # compte GitHub (peut être None si mail non associé)
    committer = row.get("committer") or {}
    parents = row.get("parents") or []
    is_merge = (len(parents) > 1)
    # prefer author date if present, otherwise committer date
    author_date = (commit.get("author") or {}).get("date")
    committer_date = (commit.get("committer") or {}).get("date")
    commit_date = author_date or committer_date
    commit_day = None
    commit_hour = None
    if commit_date:
        # commit_date is usually ISO 8601 like '2024-12-23T22:32:14Z' or with offset
        try:
            commit_day = commit_date.split("T")[0]
        except Exception:
            commit_day = None
        # derive hour (0-23) in UTC from the timestamp if possible
        try:
            # try to parse using pandas for robustness
            parsed_dt = pd.to_datetime(commit_date, utc=True)
            if not pd.isna(parsed_dt):
                commit_hour = int(parsed_dt.hour)
        except Exception:
            commit_hour = None

    return {
        "repo_full_name": repo_meta.get("full_name"),
        "repo_private": repo_meta.get("private"),
        "repo_language": repo_meta.get("language"),
        "repo_stars": repo_meta.get("stargazers_count"),
        "repo_forks": repo_meta.get("forks_count"),
        # "sha": row.get("sha"),
        # "html_url": row.get("html_url"),
        # "author_login": author.get("login"),
        # "author_id": author.get("id"),
        # "author_name": (commit.get("author") or {}).get("name"),
        # "author_email": (commit.get("author") or {}).get("email"),
        # "author_date": author_date,
        # "committer_login": committer.get("login"),
        # "committer_id": committer.get("id"),
        # "committer_name": (commit.get("committer") or {}).get("name"),
        # "committer_email": (commit.get("committer") or {}).get("email"),
        # "committer_date": committer_date,
        # "commit_date": commit_date,
        "commit_day": commit_day,
        "commit_hour": commit_hour,
        "message": commit.get("message"),
        "is_merge": is_merge,
    }

def append_dedup(df_new: pd.DataFrame, out_path: str = OUT_CSV, key: str = "sha") -> int:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        df_old = pd.read_csv(out_path, low_memory=False)
        df_all = pd.concat([df_old, df_new], ignore_index=True)
        if key in df_all.columns:
            df_all = df_all.drop_duplicates(subset=[key])
    else:
        df_all = df_new.copy()
    # Types utiles
    # parse datetime-like columns
    for col in ["author_date", "committer_date", "commit_date"]:
        if col in df_all:
            df_all[col] = pd.to_datetime(df_all[col], utc=True, errors="coerce")
    # commit_day is date-only; keep as date (no tz)
    if "commit_day" in df_all:
        try:
            df_all["commit_day"] = pd.to_datetime(df_all["commit_day"], errors="coerce").dt.date
        except Exception:
            # fallback: leave as-is
            pass
    # commit_hour should be integer 0-23 when possible
    if "commit_hour" in df_all:
        try:
            df_all["commit_hour"] = pd.to_numeric(df_all["commit_hour"], errors="coerce").astype(pd.Int64Dtype())
        except Exception:
            # best-effort: leave as-is
            pass
    df_all.to_csv(out_path, index=False)
    return len(df_all)

def main_commits_history():
    print(f"Listing accessible repos… (token scopes déterminent l’accès privé/public)")
    repos = fetch_accessible_repos()
    print(f"Found {len(repos)} repos.")
    total_added = 0
    for i, r in enumerate(repos):
        full = r.get("full_name")
        print(f"[{i+1}/{len(repos)}] commits {START_DATE} → {END_DATE} for {full} (private={r.get('private')})…")
        try:
            commits = fetch_repo_commits(full)
        except Exception as e:
            print(f"  Error on {full}: {e}")
            continue
        if not commits:
            continue
        rows = [parse_commit(c, r) for c in commits]
        df_chunk = pd.DataFrame(rows)
        before = 0
        if os.path.exists(OUT_CSV):
            try:
                before = sum(1 for _ in open(OUT_CSV)) - 1
            except Exception:
                before = 0
        total_now = append_dedup(df_chunk, OUT_CSV, key="sha")
        added = max(0, total_now - before)
        total_added += added
        print(f"  wrote {len(rows)} rows, file now has {total_now} rows (added {added}).")

    print(f"Done. Total new commits added this run: {total_added}. Output -> {OUT_CSV}")

if __name__ == "__main__":
    main_commits_history()