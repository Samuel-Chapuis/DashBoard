(() => {
  const GitDash = window.GitDash = window.GitDash || {};

  GitDash.PERSONS = [];

  GitDash.PERSON_COLORS = [
    "#8b5cf6",
    "#22c55e",
    "#f59e0b",
    "#38bdf8",
    "#f472b6",
    "#a3e635",
    "#f97316",
    "#14b8a6",
  ];

  GitDash.profileImageURL = {};

  // Date utilities
  GitDash.WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  GitDash.parseISODate = function parseISODate(s){ // YYYY-MM-DD
    const [y,m,d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m-1, d));
  };

  GitDash.weekdayIndexUTC = function weekdayIndexUTC(dateObj){
    // JS: 0=Sun..6=Sat. We want Mon..Sun => 0..6
    const js = dateObj.getUTCDay(); // Sun=0
    return (js + 6) % 7; // Mon=0 .. Sun=6
  };
})();
