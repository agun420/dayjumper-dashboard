"use strict";

const byId = (id) => document.getElementById(id);
const number = (value, suffix = "") => {
  const parsed = Number(value);
  return value === null || !Number.isFinite(parsed) ? "—" : `${parsed.toFixed(2)}${suffix}`;
};
const progress = (value, target) => {
  const observed = Number(value);
  const goal = Number(target);
  if (!Number.isFinite(observed) || !Number.isFinite(goal) || goal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((observed / goal) * 100)));
};

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = String(value);
  return node;
}

function laneStat(label, value) {
  const wrapper = element("div");
  wrapper.append(element("span", "", label), element("strong", "", value));
  return wrapper;
}

function laneCard(lane) {
  const article = document.createElement("article");
  article.className = "lane-card";
  const heading = element("div", "lane-top");
  const title = element("div");
  title.append(element("span", "", lane.role), element("h3", "", lane.name));
  heading.append(title, element("b", "", lane.gate));
  const stats = element("div", "lane-stats");
  stats.append(
    laneStat("Outcomes", lane.outcomes),
    laneStat("Expectancy", number(lane.expectancyR, "R")),
    laneStat("Win rate", number(lane.winRate, "%")),
    laneStat("Drawdown", number(lane.drawdownR, "R")),
  );
  article.append(heading, stats);
  return article;
}

function checkRow(check) {
  const row = document.createElement("li");
  const state = ["ready", "pending", "failed"].includes(check.state) ? check.state : "pending";
  row.append(
    element("span", `check-dot ${state}`),
    document.createTextNode(String(check.label)),
    element("b", "", state),
  );
  return row;
}

function compactInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(parsed) : "—";
}

function watchlistCell(label, value, className = "") {
  const cell = element("td", className, value);
  cell.dataset.label = label;
  return cell;
}

function watchlistRow(candidate) {
  const row = document.createElement("tr");
  const gap = Number(candidate.gapPct);
  const gapClass = Number.isFinite(gap) ? (gap >= 0 ? "positive" : "negative") : "";
  row.append(
    watchlistCell("Rank", candidate.rank),
    watchlistCell("Ticker", candidate.ticker, "ticker"),
    watchlistCell("Price", number(candidate.price, "")),
    watchlistCell("Gap", number(candidate.gapPct, "%"), gapClass),
    watchlistCell("Rel. volume", number(candidate.rvol, "×")),
    watchlistCell("Premarket volume", compactInteger(candidate.premarketVolume)),
    watchlistCell("ATR", number(candidate.atr14, "")),
    watchlistCell("Spread", number(candidate.spreadPct, "%")),
  );
  return row;
}

function renderWatchlist(data) {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  byId("watchlist-state").textContent = data.status === "FROZEN" ? "Frozen · research only" : "Waiting for publication";
  byId("watchlist-session").textContent = data.sessionDate || "—";
  byId("watchlist-count").textContent = Number.isFinite(Number(data.candidateCount)) ? data.candidateCount : candidates.length;
  byId("watchlist-feed").textContent = data.feed || "—";
  byId("watchlist-updated").textContent = data.updatedAt ? `Published ${new Date(data.updatedAt).toLocaleString()}` : "Not published yet";
  byId("watchlist-rows").replaceChildren(...candidates.map(watchlistRow));
  byId("watchlist-table-wrap").hidden = candidates.length === 0;
  byId("watchlist-empty").hidden = candidates.length > 0;
}

function render(data) {
  byId("status").textContent = data.status;
  byId("updated").textContent = data.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleString()}` : "Waiting for the first verified session";
  byId("sessions").textContent = data.sessions;
  byId("signals").textContent = data.selectedSignals;
  byId("outcomes").textContent = data.modeledOutcomes;
  byId("session-target").textContent = `Target ${data.targetSessions}`;
  byId("signal-target").textContent = `Target ${data.targetSignals}`;
  const sessionProgress = progress(data.sessions, data.targetSessions);
  const signalProgress = progress(data.selectedSignals, data.targetSignals);
  byId("session-percent").textContent = `${sessionProgress}%`;
  byId("signal-percent").textContent = `${signalProgress}%`;
  byId("session-bar").style.width = `${sessionProgress}%`;
  byId("signal-bar").style.width = `${signalProgress}%`;
  byId("lanes").replaceChildren(...data.lanes.map(laneCard));
  byId("checks").replaceChildren(...data.checks.map(checkRow));
}

fetch("data/public-summary.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`summary request failed: ${response.status}`);
    return response.json();
  })
  .then(render)
  .catch(() => {
    byId("status").textContent = "DATA UNAVAILABLE";
    byId("updated").textContent = "The last sanitized summary could not be loaded";
  });

fetch("data/public-watchlist.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`watchlist request failed: ${response.status}`);
    return response.json();
  })
  .then(renderWatchlist)
  .catch(() => {
    byId("watchlist-state").textContent = "Data unavailable";
    byId("watchlist-updated").textContent = "The sanitized watchlist could not be loaded";
  });
