"use strict";

const byId = (id) => document.getElementById(id);
const safeNumber = (value) => {
  const parsed = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(parsed) ? null : parsed;
};
const fixed = (value, suffix = "") => {
  const parsed = safeNumber(value);
  return parsed === null ? "—" : `${parsed.toFixed(2)}${suffix}`;
};
const progress = (value, target) => {
  const observed = safeNumber(value);
  const goal = safeNumber(target);
  if (observed === null || goal === null || goal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((observed / goal) * 100)));
};
function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = String(value);
  return node;
}
function cell(label, value, className = "") {
  const node = element("td", className, value);
  node.dataset.label = label;
  return node;
}
function policyName(id) {
  return ({baseline_2r_eod:"2R + session close",trail_1r_half_r:"Causal 1R trail",nonfollow_30m:"30-minute non-follow"})[id] || id;
}
function policyCard(policy) {
  const article = element("article", "lane-card");
  const heading = element("div", "lane-top");
  const title = element("div");
  title.append(element("span", "", policy.role), element("h3", "", policy.name));
  heading.append(title, element("b", "", policy.gate));
  const stats = element("div", "lane-stats");
  for (const [label, value] of [["Outcomes",policy.outcomes],["Gross mean",fixed(policy.grossMeanR,"R")],["10 bps/side",fixed(policy.netMeanR10Bps,"R")],["Positive",fixed(policy.positiveRate,"%")]]) {
    const wrapper = element("div");
    wrapper.append(element("span", "", label), element("strong", "", value));
    stats.append(wrapper);
  }
  article.append(heading, stats);
  return article;
}
function evidenceBadge(value) {
  return value === "COMPLETE_IEX_BAR_SEQUENCE" ? "Complete observed" : "Sparse IEX";
}
function tickerCell(ticker) {
  const node = cell("Ticker", "");
  const button = element("button", "ticker", ticker);
  button.type = "button";
  node.append(button);
  return node;
}
function alertRow(alert) {
  const row = document.createElement("tr");
  const decision = alert.decisionAt ? new Date(alert.decisionAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "—";
  const baseline = safeNumber(alert.baselineGrossR);
  row.append(
    tickerCell(alert.ticker),
    cell("Decision", decision),
    cell("Entry reference", fixed(alert.entryReference)),
    cell("Risk/share", fixed(alert.initialRiskPerShare)),
    cell("Baseline", fixed(baseline,"R"), baseline === null ? "" : baseline >= 0 ? "positive" : "negative"),
    cell("1R trail", fixed(alert.trailGrossR,"R")),
    cell("30m rule", fixed(alert.nonfollowGrossR,"R")),
    cell("MFE", fixed(alert.mfeR,"R")),
    cell("Evidence", evidenceBadge(alert.evidenceQuality), "evidence-label"),
  );
  return row;
}
let alerts = [];
function filterAlerts() {
  const term = byId("ticker-search").value.trim().toUpperCase();
  const sort = byId("sort-order").value;
  const rows = alerts.filter((row) => String(row.ticker).toUpperCase().includes(term));
  rows.sort((a,b) => {
    if (sort === "ticker") return String(a.ticker).localeCompare(String(b.ticker));
    if (sort === "decisionAt") return String(a.decisionAt).localeCompare(String(b.decisionAt));
    return (safeNumber(b[sort]) || 0) - (safeNumber(a[sort]) || 0);
  });
  byId("alert-rows").replaceChildren(...rows.map(alertRow));
  byId("visible-count").textContent = `${rows.length} of ${alerts.length} alerts`;
  byId("alert-table-wrap").hidden = rows.length === 0;
  byId("alert-empty").hidden = rows.length > 0;
}
function checkRow(check) {
  const row = document.createElement("li");
  const state = ["ready","pending","failed"].includes(check.state) ? check.state : "pending";
  row.append(element("span", `check-dot ${state}`), document.createTextNode(String(check.label)), element("b", "", check.value));
  return row;
}
function render(data) {
  alerts = Array.isArray(data.latestAlerts) ? data.latestAlerts : [];
  byId("status").textContent = data.status;
  byId("updated").textContent = data.updatedAt ? `Published ${new Date(data.updatedAt).toLocaleString()}` : "No current IEX publication loaded";
  byId("snapshot-notice").textContent = `${data.feedScope} · ${data.coverageCertified ? "Coverage certified" : "Coverage not certified"} · ${data.executionModeled ? "Execution modeled" : "Execution not modeled"}`;
  byId("sessions").textContent = data.sessions;
  byId("signals").textContent = data.alerts;
  byId("complete-alerts").textContent = data.completeObservedSequenceAlerts;
  byId("promotion").textContent = data.promotionStatus;
  byId("session-date").textContent = data.latestSessionDate || "—";
  byId("feed").textContent = data.feed;
  byId("universe").textContent = data.universe;
  byId("alert-updated").textContent = data.updatedAt ? `Published ${new Date(data.updatedAt).toLocaleString()}` : "Not published yet";
  const sessionPct = progress(data.sessions, data.targetSessions);
  const alertPct = progress(data.alerts, data.targetAlerts);
  byId("session-target").textContent = `Gate ${data.targetSessions}`;
  byId("signal-target").textContent = `Gate ${data.targetAlerts}`;
  byId("session-percent").textContent = `${sessionPct}%`;
  byId("signal-percent").textContent = `${alertPct}%`;
  byId("session-bar").style.width = `${sessionPct}%`;
  byId("signal-bar").style.width = `${alertPct}%`;
  byId("policy-cards").replaceChildren(...(Array.isArray(data.policies) ? data.policies : []).map(policyCard));
  byId("checks").replaceChildren(...(Array.isArray(data.checks) ? data.checks : []).map(checkRow));
  filterAlerts();
}
fetch("data/public-iex.json", {cache:"no-store"})
  .then((response) => { if (!response.ok) throw new Error(`IEX publication failed: ${response.status}`); return response.json(); })
  .then(render)
  .catch(() => {
    byId("status").textContent = "IEX DATA UNAVAILABLE";
    byId("updated").textContent = "The sanitized evaluator output could not be loaded";
    byId("snapshot-notice").textContent = "Historical September 3 SIP files are not displayed as current IEX evidence.";
  });
byId("ticker-search").addEventListener("input", filterAlerts);
byId("sort-order").addEventListener("change", filterAlerts);
byId("theme-toggle").addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  byId("theme-toggle").setAttribute("aria-pressed", String(document.documentElement.classList.contains("dark")));
  showChart(activeChartTicker);
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
  byId("chart-link").href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(ticker)}`;
  byId("chart-link").textContent = `${ticker} chart by TradingView ↗`;
}
byId("alert-rows").addEventListener("click", (event) => {
  const button = event.target.closest("button.ticker");
  if (button) { showChart(button.textContent); byId("chart-panel").scrollIntoView(); }
});
showChart(activeChartTicker);
