(() => {
  const GitDash = window.GitDash = window.GitDash || {};
  const { WEEKDAYS } = GitDash;

  // Drawing helpers
  const clearSVG = (svgSel) => svgSel.selectAll("*").remove();
  GitDash.clearSVG = clearSVG;

  GitDash.drawHeatmap = function drawHeatmap(svgEl, matrix, color){
    const svg = d3.select(svgEl);
    clearSVG(svg);

  const cell = 10, gap = 2;
  const margin = {top: 18, right: 8, bottom: 24, left: 34};
  const width = 340, height = margin.top + margin.bottom + 7*(cell+gap);

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const maxV = d3.max(matrix.flat()) || 1;
  const scale = d3.scaleLinear().domain([0, maxV]).range([0.12, 1]);

  // axis labels
  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 12)
    .attr("fill", "#9aa7b2")
    .attr("font-size", 11)

    // y labels + cells
    for(let r=0; r<7; r++){
      svg.append("text")
        .attr("x", margin.left - 6)
        .attr("y", margin.top + r*(cell+gap) + 8)
        .attr("text-anchor", "end")
        .attr("fill", "#9aa7b2")
        .attr("font-size", 10)
        .text(WEEKDAYS[r]);

      for(let h=0; h<24; h++){
        const v = matrix[r][h];
        svg.append("rect")
          .attr("x", margin.left + h*(cell+gap))
          .attr("y", margin.top + r*(cell+gap))
          .attr("width", cell)
          .attr("height", cell)
          .attr("rx", 2)
          .attr("fill", color)
          .attr("opacity", scale(v));
      }
    }

    // x ticks (0,6,12,18,23)
    const ticks = [0,6,12,18,23];
    ticks.forEach(t=>{
      svg.append("text")
        .attr("x", margin.left + t*(cell+gap) + 3)
        .attr("y", height - 8)
        .attr("fill", "#9aa7b2")
        .attr("font-size", 10)
        .text(t);
    });
  };

  GitDash.drawPie = function drawPie(svgEl, data, color){
    const svg = d3.select(svgEl);
    clearSVG(svg);

  const w = 220, h = 170;
  svg.attr("viewBox", `0 0 ${w} ${h}`);

  svg.append("text")
    .attr("x", 10).attr("y", 14)
    .attr("fill", "#9aa7b2").attr("font-size", 11)

  const radius = 55;
  const cx = 70, cy = 95;

  const total = d3.sum(data, d=>d.value) || 1;

  const pie = d3.pie().value(d=>d.value)(data.slice(0, 6)); // top 6
  const arc = d3.arc().innerRadius(0).outerRadius(radius);

  const bright = d3.color(color);
  const darkShade = d3.interpolateRgb(bright.formatRgb(), "#0b121a")(0.7);
  const pickColor = d => {
    const key = String(d.data.key || "").toLowerCase();
    if(key.includes("respect")) return bright.formatRgb();
    if(key.includes("non")) return darkShade;
    return bright.formatRgb();
  };

  svg.append("g")
    .attr("transform", `translate(${cx},${cy})`)
    .selectAll("path")
    .data(pie)
    .join("path")
    .attr("d", arc)
    .attr("fill", d=>pickColor(d))
    .attr("stroke", "#1a2633")
    .attr("stroke-width", 1);

  // mini legend
  const legendX = 140, legendY = 40;
  const items = pie.map(p=>({
    key: p.data.key,
    pct: Math.round((p.data.value/total)*100),
    value: p.data.value
  }));

  const g = svg.append("g").attr("transform", `translate(${legendX},${legendY})`);
  items.forEach((it,i)=>{
    g.append("rect")
      .attr("x", 0).attr("y", i*18)
      .attr("width", 10).attr("height", 10)
      .attr("rx", 2)
      .attr("fill", pickColor({ data: it }));
    g.append("text")
      .attr("x", 14).attr("y", i*18 + 9)
      .attr("fill", "#9aa7b2").attr("font-size", 10)
      .text(`${it.key} (${it.pct}%)`);
  });
  };

  GitDash.drawProjectBars = function drawProjectBars(svgEl, personsData){
    // personsData: [{person, projects: [{key,value}, ...]}]
    const svg = d3.select(svgEl);
    clearSVG(svg);

  const margin = {top: 26, right: 18, bottom: 28, left: 180};
  const width = 720;

  // 1) union of repos
  const repoSet = new Set();
  personsData.forEach(p => (p.projects || []).forEach(d => repoSet.add(d.key)));
  const repos = Array.from(repoSet);

  if(repos.length === 0) return;

  // 2) dynamic height (1 row per repo)
  const rowH = 26;
  const height = Math.max(420, repos.length * rowH + margin.top + margin.bottom);

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  // 3) build table: repo -> counts per person
  const table = repos.map(repo => {
    const row = { repo };
    personsData.forEach(p => {
      const found = (p.projects || []).find(d => d.key === repo);
      row[p.person.id] = found ? found.value : 0;
    });
    return row;
  });

  // 4) scales
  const y0 = d3.scaleBand()
    .domain(repos)
    .range([margin.top, height - margin.bottom])
    .paddingInner(0.18);

  const y1 = d3.scaleBand()
    .domain(personsData.map(p => p.person.id))
    .range([0, y0.bandwidth()])
    .padding(0.12);

  const maxX = d3.max(table, r => d3.max(personsData, p => r[p.person.id])) || 1;

  const x = d3.scaleLinear()
    .domain([0, maxX])
    .nice()
    .range([margin.left, width - margin.right]);

  // 5) axes
  const xAxis = g => g
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6));

  const yAxis = g => g
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y0));

  svg.append("g").attr("class","axis").call(xAxis);
  svg.append("g").attr("class","axis").call(yAxis);

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 16)
    .attr("fill", "#9aa7b2")
    .attr("font-size", 11)
    .text("Commits per repo (grouped horizontal bars)");

  // 6) bars
  svg.append("g")
    .selectAll("g")
    .data(table)
    .join("g")
    .attr("transform", d => `translate(0,${y0(d.repo)})`)
    .selectAll("rect")
    .data(d => personsData.map(p => ({ person: p.person, value: d[p.person.id] })))
    .join("rect")
    .attr("x", x(0))
    .attr("y", d => y1(d.person.id))
    .attr("width", d => Math.max(0, x(d.value) - x(0)))
    .attr("height", y1.bandwidth())
    .attr("rx", 3)
    .attr("fill", d => d.person.color)
    .attr("opacity", 0.9);
  };

  GitDash.drawScatter = function drawScatter(svgEl, personsSeries){
    // personsSeries: [{person, series:[{date,count},...] }]
    const svg = d3.select(svgEl);
    clearSVG(svg);

  const margin = {top: 24, right: 14, bottom: 36, left: 44};
  const width = 980, height = 420;
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const allPoints = personsSeries.flatMap(p => p.series || []);
  if(allPoints.length === 0) return;

  // X (time)
  const x = d3.scaleTime()
    .domain(d3.extent(allPoints, d => d.date))
    .range([margin.left, width - margin.right]);

  // Y (>= 0)
  const ymax = Math.max(0, d3.max(allPoints, d => d.count) || 0);

  const y = d3.scaleLinear()
    .domain([0, ymax])
    .nice()
    .range([height - margin.bottom, margin.top]);

  // format date ISO (UTC)
  const fmt = d3.utcFormat("%Y-%m-%d");

  // daily ticks, label only month number on first day of month
  const fmtMonth = d3.utcFormat("%m");

  const xAxis = g => g
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(x)
        .ticks(d3.utcDay.every(1))
        .tickFormat(d => (d.getUTCDate() === 1 ? fmtMonth(d) : ""))
    );

  // ticks only >= 0
  const yAxis = g => {
    const ticks = y.ticks(6).filter(t => t >= 0);
    g.attr("transform", `translate(${margin.left},0)`)
     .call(d3.axisLeft(y).tickValues(ticks));
  };

  svg.append("g").attr("class","axis").call(xAxis);
  svg.append("g").attr("class","axis").call(yAxis);

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 16)
    .attr("fill", "#9aa7b2")
    .attr("font-size", 11)
    .text("Number of commits (per day)");

  svg.append("text")
    .attr("x", (margin.left + width - margin.right) / 2)
    .attr("y", height - 6)
    .attr("text-anchor", "middle")
    .attr("fill", "#9aa7b2")
    .attr("font-size", 11)
    .text("Time in month");

  // line + points
  const line = d3.line()
    .defined(d => d && d.date instanceof Date && Number.isFinite(d.count))
    .x(d => x(d.date))
    .y(d => y(Math.max(0, d.count)));

  personsSeries.forEach(p => {
    const series = (p.series || [])
      .filter(d => d && d.date instanceof Date && Number.isFinite(d.count))
      .map(d => ({...d, count: Math.max(0, d.count)}));

    if(series.length === 0) return;

    svg.append("path")
      .datum(series)
      .attr("fill","none")
      .attr("stroke", p.person.color)
      .attr("stroke-width", 2)
      .attr("opacity", 0.7)
      .attr("d", line);

    svg.append("g")
      .selectAll("circle")
      .data(series)
      .join("circle")
      .attr("cx", d => x(d.date))
      .attr("cy", d => y(d.count))
      .attr("r", 3)
      .attr("fill", p.person.color)
      .attr("opacity", 0.9);
  });
  };

  GitDash.drawGitGraph = function drawGitGraph(svgEl, commits, colorMap){
    const svg = d3.select(svgEl);
    clearSVG(svg);

    if(!commits || commits.length === 0) return;

    const rowH = 18;
    const laneW = 16;
    const margin = {top: 16, right: 12, bottom: 12, left: 16};

    const toDate = (r) => {
      if(!r.commit_day) return new Date(0);
      const h = Number.isFinite(r.commit_hour) ? String(r.commit_hour).padStart(2, "0") : "00";
      return new Date(`${r.commit_day}T${h}:00:00Z`);
    };

    const sorted = [...commits].sort((a,b) => toDate(b) - toDate(a));

    const active = [];
    const nodes = new Map();

    sorted.forEach((c, idx) => {
      const sha = c.sha || `row-${idx}`;
      let lane = active.indexOf(sha);
      if(lane === -1){
        lane = active.indexOf(null);
        if(lane === -1){
          lane = active.length;
          active.push(null);
        }
      }

      const parents = (c.parent_shas || "")
        .split(";")
        .map(s => s.trim())
        .filter(Boolean);

      nodes.set(sha, { idx, lane, parents, commit: c });

      active[lane] = parents[0] || null;
      parents.slice(1).forEach(p => {
        if(!active.includes(p)) active.push(p);
      });
    });

    const laneCount = Math.max(1, active.length);
    const width = margin.left + margin.right + laneCount * laneW + 80;
    const height = margin.top + margin.bottom + sorted.length * rowH;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // edges
    nodes.forEach((n, sha) => {
      const x1 = margin.left + n.lane * laneW;
      const y1 = margin.top + n.idx * rowH;
      n.parents.forEach(p => {
        const target = nodes.get(p);
        if(!target) return;
        const x2 = margin.left + target.lane * laneW;
        const y2 = margin.top + target.idx * rowH;
        svg.append("line")
          .attr("x1", x1)
          .attr("y1", y1)
          .attr("x2", x2)
          .attr("y2", y2)
          .attr("stroke", "#334155")
          .attr("stroke-width", 1.2)
          .attr("opacity", 0.9);
      });
    });

    // nodes
    nodes.forEach(n => {
      const x = margin.left + n.lane * laneW;
      const y = margin.top + n.idx * rowH;
      const author = n.commit.author_name || "Unknown";
      const color = colorMap[author] || "#94a3b8";

      svg.append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 4)
        .attr("fill", color)
        .attr("stroke", "#0b121a")
        .attr("stroke-width", 1);
    });
  };

  GitDash.drawCommitsPerDayBars = function drawCommitsPerDayBars(svgEl, personsSeries){
    const svg = d3.select(svgEl);
    clearSVG(svg);

    if(!personsSeries || personsSeries.length === 0) return;

    const allPoints = personsSeries.flatMap(p => p.series || []);
    if(allPoints.length === 0) return;

    const { WEEKDAYS, parseISODate, weekdayIndexUTC } = GitDash;
    const margin = {top: 24, right: 14, bottom: 36, left: 44};
    const width = 980;
    const height = 420;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const days = WEEKDAYS;
    const personIds = personsSeries.map(p => p.person.id);

    const table = days.map(day => {
      const row = { day };
      personsSeries.forEach(p => {
        const counts = Array(7).fill(0);
        (p.series || []).forEach(s => {
          if(!s.day) return;
          const dt = parseISODate(s.day);
          const wi = weekdayIndexUTC(dt);
          counts[wi] += s.count || 0;
        });
        const idx = WEEKDAYS.indexOf(day);
        row[p.person.id] = idx >= 0 ? counts[idx] : 0;
      });
      return row;
    });

    const x0 = d3.scaleBand()
      .domain(days)
      .range([margin.left, width - margin.right])
      .paddingInner(0.15);

    const x1 = d3.scaleBand()
      .domain(personIds)
      .range([0, x0.bandwidth()])
      .padding(0.1);

    const maxY = d3.max(table, r => d3.max(personIds, id => r[id])) || 1;

    const y = d3.scaleLinear()
      .domain([0, maxY])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const xAxis = g => g
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x0));

    const yAxis = g => g
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6));

    svg.append("g").attr("class","axis").call(xAxis);
    svg.append("g").attr("class","axis").call(yAxis);

    svg.append("text")
      .attr("x", margin.left)
      .attr("y", 16)
      .attr("fill", "#9aa7b2")
      .attr("font-size", 11)
      .text("Commits by weekday (by person)");

    const personById = new Map(personsSeries.map(p => [p.person.id, p.person]));

    svg.append("g")
      .selectAll("g")
      .data(table)
      .join("g")
      .attr("transform", d => `translate(${x0(d.day)},0)`)
      .selectAll("rect")
      .data(d => personIds.map(id => ({ id, value: d[id] })))
      .join("rect")
      .attr("x", d => x1(d.id))
      .attr("y", d => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", d => Math.max(0, y(0) - y(d.value)))
      .attr("rx", 2)
      .attr("fill", d => (personById.get(d.id)?.color || "#94a3b8"))
      .attr("opacity", 0.9);
  };
})();
