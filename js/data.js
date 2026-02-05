(() => {
  const GitDash = window.GitDash = window.GitDash || {};
  const { parseISODate, weekdayIndexUTC } = GitDash;

  /**
   * Expected in each CSV (at minimum):
   * - repo_full_name
   * - repo_language
   * - commit_day (YYYY-MM-DD)
   * - commit_hour (0-23)
   * - is_merge (true/false or 0/1)
   * - message_type, message_argument, message_message (optional for this UI)
   */

  const parseRow = d => ({
    repo_full_name: d.repo_full_name,
    sha: d.sha,
    parent_shas: d.parent_shas,
    branch: d.branch,
    author_name: d.author_name,
    repo_private: d.repo_private,
    repo_language: d.repo_language,
    repo_stars: +d.repo_stars,
    repo_forks: +d.repo_forks,
    commit_day: d.commit_day,
    commit_hour: +d.commit_hour,
    is_merge: (String(d.is_merge).toLowerCase() === "true" || d.is_merge === "1"),
    message_type: d.message_type,
    message_argument: d.message_argument,
    message_message: d.message_message,
    nomenclature: d.nomenclature === "1" || d.nomenclature === 1
  });

  GitDash.readCSVFile = async function readCSVFile(file){
    const text = await file.text();
    return d3.csvParse(text, parseRow);
  };

  GitDash.readCSVUrl = async function readCSVUrl(url){
    return d3.csv(url, parseRow);
  };

  GitDash.heatmapMatrix = function heatmapMatrix(rows){
    // 7 x 24 counts
    const M = Array.from({length:7}, () => Array(24).fill(0));
    for(const r of rows){
      if(!r.commit_day || Number.isNaN(r.commit_hour)) continue;
      const dt = parseISODate(r.commit_day);
      const wi = weekdayIndexUTC(dt);
      const h = Math.max(0, Math.min(23, r.commit_hour));
      M[wi][h] += 1;
    }
    return M;
  };

  GitDash.languageCounts = function languageCounts(rows){
    const m = new Map();
    for(const r of rows){
      const k = (r.repo_language || "Unknown").trim() || "Unknown";
      m.set(k, (m.get(k)||0) + 1);
    }
    return Array.from(m, ([k,v]) => ({key:k, value:v})).sort((a,b)=>b.value-a.value);
  };

  GitDash.nomenclatureCounts = function nomenclatureCounts(rows){
    let ok = 0;
    let ko = 0;
    for(const r of rows){
      if(r.nomenclature) ok += 1;
      else ko += 1;
    }
    return [
      { key: "Respecte", value: ok },
      { key: "Non conforme", value: ko }
    ];
  };

  GitDash.projectCounts = function projectCounts(rows){
    const m = new Map();
    for(const r of rows){
      const k = (r.repo_full_name || "unknown-repo").trim() || "unknown-repo";
      m.set(k, (m.get(k)||0) + 1);
    }
    return Array.from(m, ([k,v]) => ({key:k, value:v})).sort((a,b)=>b.value-a.value);
  };

  GitDash.commitsPerDay = function commitsPerDay(rows){
    const m = new Map();
    for(const r of rows){
      if(!r.commit_day) continue;
      m.set(r.commit_day, (m.get(r.commit_day)||0) + 1);
    }
    return Array.from(m, ([day,count]) => ({
      day,
      date: parseISODate(day),
      count
    })).sort((a,b)=>a.date - b.date);
  };
})();
