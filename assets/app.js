"use strict";

const byId = (id) => document.getElementById(id);
const LIFECYCLE_STATES = ["WATCH", "ARMED", "TRIGGERED", "INVALIDATED", "EXPIRED"];
const PICK_STATUSES = ["AVAILABLE", "NO_QUALIFYING_SETUPS", "UNAVAILABLE"];
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
function lifecycleLabel(value) {
  return ({WATCH:"Watch",ARMED:"Armed",TRIGGERED:"Triggered",INVALIDATED:"Invalidated",EXPIRED:"Expired"})[value] || "Unavailable";
}
function score(value) {
  const parsed = safeNumber(value);
  return parsed === null ? "—" : `${Math.round(Math.max(0, Math.min(1, parsed)) * 100)}%`;
}
function reasonLabel(value) {
  return String(value || "").replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}
function pickCard(pick, stale) {
  const article = element("article", `pick-card state-${pick.state.toLowerCase()}${stale ? " stale" : ""}`);
  const top = element("div", "pick-top");
  const ticker = element("button", "ticker pick-ticker", pick.ticker);
  ticker.type = "button";
  ticker.dataset.chartTicker = pick.ticker;
  top.append(ticker, element("span", `lifecycle-chip state-${pick.state.toLowerCase()}`, lifecycleLabel(pick.state)));
  const setup = element("p", "pick-setup", reasonLabel(pick.setupType));
  const levels = element("dl", "pick-levels");
  for (const [label, value] of [["Trigger ref.",fixed(pick.triggerReference)],["Invalidation ref.",fixed(pick.invalidationReference)],["To trigger",fixed(pick.distanceToTriggerPct,"%")]]) {
    const wrapper = element("div");
    wrapper.append(element("dt", "", label), element("dd", "", value));
    levels.append(wrapper);
  }
  const scores = element("div", "pick-scores");
  for (const [label, value] of [["Compression",score(pick.compressionScore)],["Participation",score(pick.participationScore)],["Resilience",score(pick.resilienceScore)]]) {
    const wrapper = element("span");
    wrapper.append(document.createTextNode(`${label} `), element("b", "", value));
    scores.append(wrapper);
  }
  const reasons = element("ul", "pick-reasons");
  for (const reason of Array.isArray(pick.reasonCodes) ? pick.reasonCodes : []) reasons.append(element("li", "", reasonLabel(reason)));
  article.append(top, setup, levels, scores, reasons, element("small", "evidence-label", evidenceBadge(pick.evidenceQuality)));
  return article;
}
let alerts = [];
let picks = [];
let picksStale = true;
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
function filterPicks() {
  const term = byId("pick-search").value.trim().toUpperCase();
  const state = byId("pick-filter").value;
  const rows = picks.filter((pick) => String(pick.ticker).toUpperCase().includes(term) && (state === "ALL" || pick.state === state));
  byId("pick-items").replaceChildren(...rows.map((pick) => pickCard(pick, picksStale)));
  byId("pick-visible-count").textContent = `${rows.length} of ${picks.length} setups`;
  byId("pick-items").hidden = rows.length === 0;
  if (picks.length > 0) {
    byId("pick-empty-qualified").hidden = rows.length !== 0;
    byId("pick-empty-unavailable").hidden = true;
  }
}
function renderMyPicks(value, freshness, updatedAt) {
  const valid = value && typeof value === "object" && value.shadowOnly === true && PICK_STATUSES.includes(value.status) && Array.isArray(value.items);
  const data = valid ? value : {status:"UNAVAILABLE",items:[],counts:{}};
  picksStale = freshness.stale;
  picks = data.items.filter((pick) => pick && LIFECYCLE_STATES.includes(pick.state) && /^[A-Z][A-Z0-9.]{0,9}$/.test(String(pick.ticker || "")));
  const unavailable = data.status === "UNAVAILABLE";
  byId("pick-state").textContent = freshness.stale ? "STALE — RESEARCH ONLY" : unavailable ? "Unavailable · no inference" : "Shadow only · no fills";
  byId("my-picks").classList.toggle("publication-stale", freshness.stale);
  byId("pick-session-date").textContent = data.sessionDate || "—";
  byId("pick-version").textContent = data.lifecycleVersion || "—";
  byId("pick-updated").textContent = updatedAt ? `Published ${new Date(updatedAt).toLocaleString()}` : "Not published yet";
  byId("pick-counts").replaceChildren(...LIFECYCLE_STATES.map((state) => {
    const count = Number.isInteger(data.counts && data.counts[state]) ? data.counts[state] : 0;
    const chip = element("span", `lifecycle-count state-${state.toLowerCase()}`);
    chip.append(document.createTextNode(`${lifecycleLabel(state)} `), element("b", "", count));
    return chip;
  }));
  byId("pick-empty-unavailable").hidden = !unavailable;
  byId("pick-empty-qualified").hidden = unavailable || picks.length > 0;
  filterPicks();
}
function diagnosticMetric(title, status, rows) {
  const article = element("article", "diagnostic-card");
  const top = element("div", "diagnostic-top");
  top.append(element("h3", "", title), element("span", `diagnostic-status ${String(status).toLowerCase()}`, status === "AVAILABLE" ? "Available" : "Unavailable"));
  const list = element("dl", "diagnostic-values");
  for (const [label, value] of rows) {
    const wrapper = element("div");
    wrapper.append(element("dt", "", label), element("dd", "", value));
    list.append(wrapper);
  }
  article.append(top, list);
  return article;
}
function renderEvidenceDiagnostics(value, freshness) {
  const valid = value && typeof value === "object" && ["AVAILABLE","UNAVAILABLE"].includes(value.status);
  const data = valid ? value : {status:"UNAVAILABLE"};
  const available = data.status === "AVAILABLE";
  byId("diagnostics-state").textContent = freshness.stale ? "STALE — RESEARCH ONLY" : available ? "Available · aggregate only" : "Unavailable · no inference";
  byId("evidence-diagnostics").classList.toggle("publication-stale", freshness.stale);
  byId("diagnostics-unavailable").hidden = available;
  if (!available) {
    byId("diagnostic-grid").replaceChildren();
    return;
  }
  const rejected = data.rejectedCandidates || {};
  const missed = data.missedOpportunityObservability || {};
  const lag = data.availabilityLag || {};
  const participation = data.sameTimeParticipation || {};
  const regimes = data.regimes || {};
  const reasonRows = Array.isArray(rejected.byReason) ? rejected.byReason.slice(0, 5).map((row) => [reasonLabel(row.reason), String(row.count)]) : [];
  const regimeRows = Array.isArray(regimes.buckets) ? regimes.buckets.map((row) => [`${reasonLabel(row.name)} records`, String(row.records)]) : [];
  byId("diagnostic-grid").replaceChildren(
    diagnosticMetric("Rule rejections", rejected.status, [["Total reasons", rejected.total ?? "—"], ...reasonRows]),
    diagnosticMetric("Follow-up observability", missed.status, [["Observable", missed.observable ?? "—"],["Unavailable", missed.unavailable ?? "—"]]),
    diagnosticMetric("Data availability lag", lag.status, [["Samples", lag.samples ?? "—"],["Median", lag.p50Ms == null ? "—" : `${fixed(lag.p50Ms)} ms`],["95th percentile", lag.p95Ms == null ? "—" : `${fixed(lag.p95Ms)} ms`]]),
    diagnosticMetric("Same-time participation", participation.status, [["Available", participation.available ?? "—"],["Unavailable", participation.unavailable ?? "—"],["Median ratio", participation.ratioP50 == null ? "—" : `${fixed(participation.ratioP50)}×`]]),
    diagnosticMetric("Session regimes", regimes.status, regimeRows.length ? regimeRows : [["Buckets", "—"]]),
  );
}
function checkRow(check) {
  const row = document.createElement("li");
  const state = ["ready","pending","failed"].includes(check.state) ? check.state : "pending";
  row.append(element("span", `check-dot ${state}`), document.createTextNode(String(check.label)), element("b", "", check.value));
  return row;
}
function publicationFreshness(updatedAt, nowMs = Date.now()) {
  const publishedMs = Date.parse(updatedAt || "");
  if (!Number.isFinite(publishedMs)) return {stale:true, label:"No valid publication timestamp"};
  const ageHours = Math.max(0, (nowMs - publishedMs) / 3600000);
  return {stale:ageHours > 72, label:`${ageHours.toFixed(1)} hours old`};
}
function render(data) {
  alerts = Array.isArray(data.latestAlerts) ? data.latestAlerts : [];
  const freshness = publicationFreshness(data.updatedAt);
  byId("status").textContent = freshness.stale ? `STALE — ${data.status}` : data.status;
  byId("updated").textContent = data.updatedAt ? `Published ${new Date(data.updatedAt).toLocaleString()}` : "No current IEX publication loaded";
  byId("snapshot-notice").textContent = `${freshness.stale ? `STALE (${freshness.label}) · ` : ""}${data.feedScope} · ${data.coverageCertified ? "Coverage certified" : "Coverage not certified"} · ${data.executionModeled ? "Execution modeled" : "Execution not modeled"}`;
  byId("sessions").textContent = data.sessions;
  byId("signals").textContent = data.alerts;
  byId("complete-alerts").textContent = data.completeObservedSequenceAlerts;
  byId("promotion").textContent = data.promotionStatus;
  byId("session-date").textContent = data.latestSessionDate || "—";
  byId("feed").textContent = data.feed;
  byId("universe").textContent = data.universe;
  byId("alert-updated").textContent = data.updatedAt ? `Published ${new Date(data.updatedAt).toLocaleString()}` : "Not published yet";
  renderMyPicks(data.myPicks, freshness, data.updatedAt);
  renderEvidenceDiagnostics(data.evidenceDiagnostics, freshness);
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
function loadPublication() {
fetch("data/public-iex.json", {cache:"no-store"})
  .then((response) => { if (!response.ok) throw new Error(`IEX publication failed: ${response.status}`); return response.json(); })
  .then(render)
  .catch(() => {
    byId("status").textContent = "IEX DATA UNAVAILABLE";
    byId("updated").textContent = "The sanitized evaluator output could not be loaded";
    byId("snapshot-notice").textContent = "Historical September 3 SIP files are not displayed as current IEX evidence.";
    renderMyPicks(null, {stale:true}, null);
    renderEvidenceDiagnostics(null, {stale:true});
  });
}
loadPublication();
setInterval(loadPublication, 300000);
byId("ticker-search").addEventListener("input", filterAlerts);
byId("sort-order").addEventListener("change", filterAlerts);
byId("pick-search").addEventListener("input", filterPicks);
byId("pick-filter").addEventListener("change", filterPicks);
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
byId("pick-items").addEventListener("click", (event) => {
  const button = event.target.closest("button.pick-ticker");
  if (button) { showChart(button.dataset.chartTicker); byId("chart-panel").scrollIntoView(); }
});
showChart(activeChartTicker);
