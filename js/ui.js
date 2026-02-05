(() => {
  const GitDash = window.GitDash = window.GitDash || {};
  const { profileImageURL, drawHeatmap, drawPie } = GitDash;

  // UI rendering
  GitDash.renderPeoplePanels = function renderPeoplePanels(personsData){
    const container = document.getElementById("people");
    container.innerHTML = "";

    personsData.forEach((p) => {
      const person = p.person;
      const imgUrl = profileImageURL[person.id];

      const panel = document.createElement("div");
      panel.className = "person";

      // --- Column 1: Profile (avatar + text)
      const profileCol = document.createElement("div");
      profileCol.className = "profileCol";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.style.borderColor = person.color;

      if(imgUrl){
        const img = document.createElement("img");
        img.src = imgUrl;
        img.alt = person.name;
        avatar.appendChild(img);
      } else {
        // fallback: show the filename (or P1)
        avatar.textContent = person.name.slice(0, 2).toUpperCase();
      }

      const meta = document.createElement("div");
      meta.className = "pmeta";
      meta.innerHTML = `
        <h3 style="color:${person.color}">${person.name}</h3>
        <p class="hint">${p.rows.length} commits · ${p.uniqueRepos} repos · top language: ${p.topLanguage || "Unknown"}</p>
      `;

      profileCol.appendChild(avatar);
      profileCol.appendChild(meta);

      // --- Column 2: Heatmap
      const heatCard = document.createElement("div");
      heatCard.className = "card heatCard";
      heatCard.innerHTML = `
        <h4>Activity heatmap</h4>
        <p class="hint">Brightness = number of commits (day × hour).</p>
        <svg id="${person.id}-heat"></svg>
      `;

      // --- Column 3: Pie chart
      const pieCard = document.createElement("div");
      pieCard.className = "card pieCard";
      pieCard.innerHTML = `
        <h4>Nomenclature pie chart</h4>
        <p class="hint">Share of commits following the naming convention.</p>
        <svg id="${person.id}-pie"></svg>
      `;

      // assemble
      panel.appendChild(profileCol);
      panel.appendChild(heatCard);
      panel.appendChild(pieCard);

      container.appendChild(panel);

      // draw
      drawHeatmap(document.getElementById(`${person.id}-heat`), p.heatmap, person.color);
      drawPie(document.getElementById(`${person.id}-pie`), p.nomenclature, person.color);
    });
  };

  GitDash.renderLegend = function renderLegend(currentLoaded = null, fallbackPersons = []){
    const legend = document.getElementById("legend");
    legend.innerHTML = "";

    const list = currentLoaded
      ? currentLoaded.map(x => x.person)   // names based on files
      : fallbackPersons;                   // fallback

    list.forEach(p=>{
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `<span class="dot" style="background:${p.color}"></span>${p.name}`;
      legend.appendChild(chip);
    });
  };
})();
