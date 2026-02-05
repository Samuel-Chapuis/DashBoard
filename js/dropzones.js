(() => {
  const GitDash = window.GitDash = window.GitDash || {};
  const { profileImageURL } = GitDash;

  GitDash.setDropzoneHandlers = function setDropzoneHandlers(onLoadAll) {
    const zones = [
      { dz: "dz1", input: "file1", label: "fn1" },
      { dz: "dz2", input: "file2", label: "fn2" },
      { dz: "dz3", input: "file3", label: "fn3" },
    ];

    zones.forEach(z => {
      const dz = document.getElementById(z.dz);
      const inp = document.getElementById(z.input);
      const fn = document.getElementById(z.label);

      // click => open picker
      dz.addEventListener("click", () => inp.click());

      // picker change
      inp.addEventListener("change", () => {
        fn.textContent = inp.files?.[0]?.name ? `✓ ${inp.files[0].name}` : "";
        onLoadAll();
      });

      // dragover
      dz.addEventListener("dragover", (e) => {
        e.preventDefault();
        dz.classList.add("dragover");
      });

      dz.addEventListener("dragleave", () => {
        dz.classList.remove("dragover");
      });

      // drop
      dz.addEventListener("drop", (e) => {
        e.preventDefault();
        dz.classList.remove("dragover");

        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".csv")) {
          fn.textContent = "⚠️ Non-CSV file";
          return;
        }

        // Put file into the hidden input using DataTransfer
        const dt = new DataTransfer();
        dt.items.add(file);
        inp.files = dt.files;

        fn.textContent = `✓ ${file.name}`;
        onLoadAll();
      });
    });
  };

  GitDash.setImageDropzones = function setImageDropzones(onLoadAll) {
    const zones = [
      { dz: "idz1", input: "imgfile1", label: "ifn1", pid: "p1" },
      { dz: "idz2", input: "imgfile2", label: "ifn2", pid: "p2" },
      { dz: "idz3", input: "imgfile3", label: "ifn3", pid: "p3" },
    ];

    zones.forEach(z => {
      const dz = document.getElementById(z.dz);
      const inp = document.getElementById(z.input);
      const fn = document.getElementById(z.label);

      dz.addEventListener("click", () => inp.click());

      inp.addEventListener("change", () => {
        const file = inp.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
          fn.textContent = "⚠️ Not an image";
          return;
        }

        profileImageURL[z.pid] = URL.createObjectURL(file);
        fn.textContent = `✓ ${file.name}`;
        onLoadAll(); // rerender
      });

      dz.addEventListener("dragover", (e) => {
        e.preventDefault();
        dz.classList.add("dragover");
      });

      dz.addEventListener("dragleave", () => {
        dz.classList.remove("dragover");
      });

      dz.addEventListener("drop", (e) => {
        e.preventDefault();
        dz.classList.remove("dragover");

        const file = e.dataTransfer?.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
          fn.textContent = "⚠️ Not an image";
          return;
        }

        const dt = new DataTransfer();
        dt.items.add(file);
        inp.files = dt.files;

        profileImageURL[z.pid] = URL.createObjectURL(file);
        fn.textContent = `✓ ${file.name}`;
        onLoadAll();
      });
    });
  };
})();
