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
