"use strict";

const byId = (id) => document.getElementById(id);
const number = (value, suffix = "") => {
  const parsed = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(parsed) ? "—" : `${parsed.toFixed(2)}${suffix}`;
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
  return value !== null && value !== undefined && value !== "" && Number.isFinite(parsed) ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(parsed) : "—";
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
    tickerCell(candidate.ticker),
    watchlistCell("Price", number(candidate.price, "")),
    watchlistCell("Gap", number(candidate.gapPct, "%"), gapClass),
    watchlistCell("Rel. volume", number(candidate.rvol, "×")),
    watchlistCell("Premarket volume", compactInteger(candidate.premarketVolume)),
    watchlistCell("ATR", number(candidate.atr14, "")),
    watchlistCell("Spread", number(candidate.spreadPct, "%")),
  );
  return row;
}

let frozenCandidates = [];
function renderWatchlist(data) {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  frozenCandidates = candidates;
  const today = new Intl.DateTimeFormat("en-CA", {timeZone:"America/New_York", year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  byId("snapshot-notice").textContent = data.sessionDate === today ? "Current-date publication · Frozen screen, not streaming prices" : `Historical snapshot · Session ${data.sessionDate || "unknown"} · Not today’s watchlist`;
  byId("watchlist-state").textContent = data.status === "FROZEN" ? "Frozen · research only" : "Waiting for publication";
  byId("watchlist-session").textContent = data.sessionDate || "—";
  byId("watchlist-count").textContent = Number.isFinite(Number(data.candidateCount)) ? data.candidateCount : candidates.length;
  byId("watchlist-feed").textContent = data.feed || "—";
  byId("watchlist-updated").textContent = data.updatedAt ? `Published ${new Date(data.updatedAt).toLocaleString()}` : "Not published yet";
  filterCandidates();
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
  byId("lanes").replaceChildren(...(Array.isArray(data.lanes) ? data.lanes : []).map(laneCard));
  byId("checks").replaceChildren(...(Array.isArray(data.checks) ? data.checks : []).map(checkRow));
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
    byId("snapshot-notice").textContent = "Watchlist unavailable · Publication freshness cannot be verified";
    byId("watchlist-state").textContent = "Data unavailable";
    byId("watchlist-updated").textContent = "The sanitized watchlist could not be loaded";
  });

function filterCandidates() {
  const term = byId("ticker-search").value.trim().toUpperCase();
  const sort = byId("sort-order").value;
  const rows = frozenCandidates.filter(c => String(c.ticker).toUpperCase().includes(term));
  rows.sort((a,b) => sort === "ticker" ? String(a.ticker).localeCompare(String(b.ticker)) : sort === "rank" ? Number(a.rank)-Number(b.rank) : (Number(b[sort]) || 0)-(Number(a[sort]) || 0));
  byId("watchlist-rows").replaceChildren(...rows.map(watchlistRow));
  byId("visible-count").textContent = `${rows.length} of ${frozenCandidates.length} candidates`;
  byId("watchlist-table-wrap").hidden = rows.length === 0;
  byId("watchlist-empty").hidden = rows.length > 0;
  byId("watchlist-empty").textContent = term ? "No candidates match your search." : "No published candidates available.";
}
byId("ticker-search").addEventListener("input", filterCandidates);
byId("sort-order").addEventListener("change", filterCandidates);
byId("theme-toggle").addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  byId("theme-toggle").setAttribute("aria-pressed", document.documentElement.classList.contains("dark"));
});

let activeChartTicker = "NASDAQ:AAPL";
function showChart(ticker) {
  if (!/^[A-Z][A-Z0-9.:-]{0,25}$/.test(ticker)) return;
  activeChartTicker = ticker;
  const host = byId("chart");
  host.replaceChildren();
  const widget = element("div", "tradingview-widget-container__widget");
  host.append(widget);
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.textContent = JSON.stringify({symbol:ticker,interval:"15",timezone:"America/New_York",theme:document.documentElement.classList.contains("dark")?"dark":"light",style:"1",locale:"en",allow_symbol_change:true,autosize:true});
  host.append(script);
  byId("chart-link").href = "https://www.tradingview.com/chart/?symbol=" + encodeURIComponent(ticker);
  byId("chart-link").textContent = ticker + " chart by TradingView ↗";
}
byId("watchlist-rows").addEventListener("click", e => {
  const cell=e.target.closest(".ticker");
  if(cell) {showChart(cell.textContent);byId("chart-panel").scrollIntoView();}
});
async function loadNews() {
  try {
    const response=await fetch("data/public-news.json",{cache:"no-store"});
    if(response.status === 404) {
      byId("news-status").textContent = "Awaiting first publication";
      byId("news-items").replaceChildren(element("p","news-placeholder","Your news feed will appear here once publishing is enabled. This page cannot determine the private worker’s connection status."));
      return;
    }
    if(!response.ok) throw Error("Unavailable");
    const data=await response.json();
    const age=(Date.now()-Date.parse(data.updatedAt))/60000;
    byId("news-status").textContent=`${data.status} at last update · ${Number.isFinite(age) ? Math.max(0,Math.floor(age)) + " min ago" : "time unknown"}${!Number.isFinite(age)||age>10 ? " · STALE" : ""}`;
    const cards=(Array.isArray(data.items)?data.items:[]).map(item=>{
      const card=element("article","news-item");
      card.append(element("small","",`${item.event} · ${item.source}`),element("h3","",item.headline));
      for(const ticker of item.tickers||[]) {
        const button=element("button","ticker-button",ticker);
        button.addEventListener("click",()=>{showChart(ticker);byId("chart-panel").scrollIntoView();});card.append(button);
      }
      card.append(element("p","",`${item.prediction} · ${item.confidence} · ${item.horizon}`),element("p","section-note",item.reason),element("p","section-note",`Source: ${item.publishedAt || "unknown"} · Received: ${item.receivedAt} · Outcome: ${item.outcome}`));
      try{const url=new URL(item.url);if(url.protocol==="https:"){const link=element("a","","Read original ↗");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";card.append(link);}}catch{}
      return card;
    });
    byId("news-items").replaceChildren(...cards);
    if(!cards.length)byId("news-items").append(element("p","section-note","No news received yet. Historical news is not backfilled."));
  }catch{byId("news-status").textContent="News snapshot unavailable. Check worker and publication logs.";}
}
showChart("NASDAQ:AAPL");
loadNews();
setInterval(loadNews,60000);

function tickerCell(ticker) {
 const cell=watchlistCell("Ticker", "");
 cell.append(element("button","ticker",ticker));
 return cell;
}

byId("theme-toggle").addEventListener("click", () => showChart(activeChartTicker));
