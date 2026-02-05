(() => {
  const GitDash = window.GitDash = window.GitDash || {};
  const {
    PERSONS,
    PERSON_COLORS,
    readCSVUrl,
    heatmapMatrix,
    languageCounts,
    nomenclatureCounts,
    projectCounts,
    commitsPerDay,
    clearSVG,
    drawGitGraph,
    drawCommitsPerDayBars,
    drawScatter,
    renderPeoplePanels,
    renderLegend
  } = GitDash;

  const DATA_URL = "./data/commits_history_cleaned.csv";

  function getPersonKey(row){
    if(row.person) return row.person;
    if(row.author_login) return row.author_login;
    if(row.author_name) return row.author_name;
    if(row.repo_full_name && row.repo_full_name.includes("/")){
      return row.repo_full_name.split("/")[0];
    }
    return "Unknown";
  }

  function buildPersonsFromRows(rows){
    const unique = Array.from(new Set(rows.map(getPersonKey)));
    return unique.map((name, i) => ({
      id: `p${i + 1}`,
      name,
      color: PERSON_COLORS[i % PERSON_COLORS.length]
    }));
  }

  let scatterCumulative = true;
  let rightView = "git";

  function toCumulative(series){
    let sum = 0;
    return (series || [])
      .slice()
      .sort((a,b)=>a.date - b.date)
      .map(d => {
        sum += d.count || 0;
        return { ...d, count: sum };
      });
  }

  async function loadAll(){
    const loaded = [];
    let rows = [];
    try {
      rows = await readCSVUrl(DATA_URL);
    } catch (err) {
      const fileInput = document.getElementById("file1");
      const file = fileInput?.files?.[0];
      if (file) {
        rows = await GitDash.readCSVFile(file);
      } else {
        console.error("Failed to load CSV:", err);
      }
    }

    const statusEl = document.getElementById("fn1");
    if (statusEl) {
      statusEl.textContent = rows.length
        ? `✓ commits_history_cleaned.csv · ${rows.length} rows`
        : "⚠️ Impossible de charger le CSV (utilisez un serveur local ou cliquez pour sélectionner le fichier)";
    }

    // Raw sample table (first rows)
    const rawSample = document.getElementById("rawSample");
    if (rawSample) {
      const cols = [
        "repo_full_name",
        "sha",
        "parent_shas",
        "branch",
        "author_name",
        "commit_day",
        "commit_hour",
        "message_type",
        "message_argument",
        "message_message",
        "nomenclature"
      ];
      const sample = rows.slice(0, 6);
      if (sample.length === 0) {
        rawSample.innerHTML = "<p class=\"hint\">No data loaded.</p>";
      } else {
        const header = cols.map(c => `<th>${c}</th>`).join("");
        const body = sample.map(r => {
          const tds = cols.map(c => {
            const v = r[c];
            const text = (v === undefined || v === null || v === "") ? "—" : String(v);
            return `<td title=\"${text.replace(/\"/g, "&quot;")}\">${text}</td>`;
          }).join("");
          return `<tr>${tds}</tr>`;
        }).join("");
        rawSample.innerHTML = `
          <div class=\"rawTableWrap\">
            <table class=\"rawTable\">
              <thead><tr>${header}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        `;
      }
    }
    const persons = buildPersonsFromRows(rows);
    GitDash.PERSONS = persons;

    const groups = new Map();
    for(const row of rows){
      const key = getPersonKey(row);
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    for(const person of persons){
      const personRows = groups.get(person.name) || [];
      const heat = heatmapMatrix(personRows);
      const langs = languageCounts(personRows);
      const nomenclature = nomenclatureCounts(personRows);
      const projects = projectCounts ? projectCounts(personRows) : [];

      loaded.push({
        person,
        rows: personRows,
        heatmap: heat,
        languages: langs,
        nomenclature,
        projects: projects,
        uniqueRepos: new Set(personRows.map(r=>r.repo_full_name)).size,
        topLanguage: (langs[0] && langs[0].key) || null,
        perDay: commitsPerDay(personRows)
      });
    }

    // People panels
    document.getElementById("peopleEmpty").style.display = loaded.length > 0 ? "none" : "block";
    if(loaded.length > 0){
      renderPeoplePanels(loaded);
    } else {
      document.getElementById("people").innerHTML = "";
    }

    renderLegend(loaded, persons);

    // Repo git graphs / commits per day view
    const repoEmpty = document.getElementById("repoGraphsEmpty");
    const repoContainer = document.getElementById("repoGraphs");
    const commitsPerDayEmpty = document.getElementById("commitsPerDayEmpty");
    const commitsPerDayChart = document.getElementById("commitsPerDayChart");

    if(repoContainer) repoContainer.innerHTML = "";
    if(commitsPerDayChart) {
      d3.select(commitsPerDayChart).selectAll("*").remove();
    }

    const authorColors = persons.reduce((acc, p) => {
      acc[p.name] = p.color;
      return acc;
    }, {});

    const repos = new Map();
    rows.forEach(r => {
      const repo = r.repo_full_name || "unknown-repo";
      if(!repos.has(repo)) repos.set(repo, []);
      repos.get(repo).push(r);
    });

    const showGit = rightView === "git";
    if(repoContainer) repoContainer.style.display = showGit ? "grid" : "none";
    if(repoEmpty) repoEmpty.style.display = showGit && repos.size > 0 ? "none" : (showGit ? "block" : "none");
    if(commitsPerDayChart) commitsPerDayChart.style.display = showGit ? "none" : "block";
    if(commitsPerDayEmpty) commitsPerDayEmpty.style.display = showGit ? "none" : (repos.size > 0 ? "none" : "block");

    if(showGit){
      if(repoContainer && repos.size > 0){
        Array.from(repos.entries()).forEach(([repo, commits]) => {
          const block = document.createElement("div");
          block.className = "card";
          block.style.marginBottom = "12px";

          const title = document.createElement("h4");
          title.textContent = repo;
          block.appendChild(title);

          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("width", "100%");
          block.appendChild(svg);

          repoContainer.appendChild(block);
          drawGitGraph(svg, commits, authorColors);
        });
      }
    } else if(commitsPerDayChart && repos.size > 0){
      drawCommitsPerDayBars(commitsPerDayChart, loaded.map(p => ({
        person: p.person,
        series: p.perDay
      })));
    }

    // Scatter
    const scatterEmpty = document.getElementById("scatterEmpty");
    scatterEmpty.style.display = loaded.length > 0 ? "none" : "block";
    if(loaded.length > 0){
      const series = loaded.map(p=>({
        person: p.person,
        series: scatterCumulative ? toCumulative(p.perDay) : p.perDay
      }));
      drawScatter(document.getElementById("scatter"), series);
    } else {
      clearSVG(d3.select("#scatter"));
    }
  }

  window.addEventListener("dragover", e => e.preventDefault());
  window.addEventListener("drop", e => e.preventDefault());

  renderLegend(null, PERSONS);
  const dz = document.getElementById("dz1");
  const fileInput = document.getElementById("file1");
  if (dz && fileInput) {
    dz.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => loadAll());
  }
  const scatterToggle = document.getElementById("scatterToggle");
  if (scatterToggle) {
    scatterToggle.textContent = "Cumulative: On";
    scatterToggle.addEventListener("click", () => {
      scatterCumulative = !scatterCumulative;
      scatterToggle.textContent = `Cumulative: ${scatterCumulative ? "On" : "Off"}`;
      loadAll();
    });
  }

  const viewGitGraphs = document.getElementById("viewGitGraphs");
  const viewCommitsPerDay = document.getElementById("viewCommitsPerDay");
  if (viewGitGraphs && viewCommitsPerDay) {
    const syncButtons = () => {
      viewGitGraphs.style.opacity = rightView === "git" ? "1" : "0.6";
      viewCommitsPerDay.style.opacity = rightView === "git" ? "0.6" : "1";
    };
    viewGitGraphs.addEventListener("click", () => {
      rightView = "git";
      syncButtons();
      loadAll();
    });
    viewCommitsPerDay.addEventListener("click", () => {
      rightView = "commits";
      syncButtons();
      loadAll();
    });
    syncButtons();
  }

  loadAll();
})();
