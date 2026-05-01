const STORAGE_KEY = "heartly-dashboard-state";

const defaultState = {
  baselineLow: 55,
  baselineHigh: 68,
  restingHr: 62,
  activityHr: 101,
  recoveryDrop: 18,
  recoveryBaseline: 15,
  steps: 4632,
  activeMinutes: 32,
  inactiveHours: 7.2,
  decliningActivity: "false",
  clinicianLimit: "",
  symptomDizziness: false,
  symptomBreath: false,
  symptomChest: false,
  symptomFatigue: false,
  symptomFainting: false,
  suddenSpike: false,
  suddenDrop: false,
  caregiverEnabled: true,
};

const fieldIds = {
  baselineLow: "baseline-low",
  baselineHigh: "baseline-high",
  restingHr: "resting-hr",
  activityHr: "activity-hr",
  recoveryDrop: "recovery-drop",
  recoveryBaseline: "recovery-baseline",
  steps: "steps",
  activeMinutes: "active-minutes",
  inactiveHours: "inactive-hours",
  decliningActivity: "declining-activity",
  clinicianLimit: "clinician-limit",
  symptomDizziness: "symptom-dizziness",
  symptomBreath: "symptom-breath",
  symptomChest: "symptom-chest",
  symptomFatigue: "symptom-fatigue",
  symptomFainting: "symptom-fainting",
  suddenSpike: "sudden-spike",
  suddenDrop: "sudden-drop",
  caregiverEnabled: "caregiver-enabled",
};

const severityStyles = {
  NORMAL: {
    chip: "Stable",
    border: "rgba(21, 128, 61, 0.24)",
    background: "rgba(233, 248, 238, 0.98)",
    chipBackground: "#e9f8ee",
    chipColor: "#15803d",
  },
  MONITOR: {
    chip: "Monitor",
    border: "rgba(18, 93, 149, 0.24)",
    background: "rgba(234, 244, 251, 0.98)",
    chipBackground: "#eaf4fb",
    chipColor: "#125d95",
  },
  CAUTION: {
    chip: "Caution",
    border: "rgba(183, 121, 31, 0.26)",
    background: "rgba(255, 245, 223, 0.98)",
    chipBackground: "#fff5df",
    chipColor: "#b7791f",
  },
  ALERT: {
    chip: "Alert",
    border: "rgba(180, 35, 24, 0.24)",
    background: "rgba(254, 235, 232, 0.98)",
    chipBackground: "#feebe8",
    chipColor: "#b42318",
  },
  CRITICAL: {
    chip: "Critical",
    border: "rgba(180, 35, 24, 0.32)",
    background: "rgba(252, 225, 220, 0.98)",
    chipBackground: "#f9d5cf",
    chipColor: "#8d1f17",
  },
};

const resetButton = document.getElementById("reset-data");
const lastUpdated = document.getElementById("last-updated");
const payloadSummary = document.getElementById("payload-summary");
const applyApiPayloadButton = document.getElementById("apply-api-payload");
const monitorForm = document.getElementById("monitor-form");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaultState, ...saved } : { ...defaultState };
  } catch {
    return { ...defaultState };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatBpmRange(low, high) {
  if (typeof low !== "number" || typeof high !== "number") {
    return "Unavailable";
  }
  const safeLow = Math.min(low, high);
  const safeHigh = Math.max(low, high);
  return `${safeLow}-${safeHigh} bpm`;
}

function currentSymptoms(state) {
  const names = [];
  if (state.symptomDizziness) names.push("dizziness");
  if (state.symptomBreath) names.push("shortness of breath");
  if (state.symptomChest) names.push("chest discomfort");
  if (state.symptomFatigue) names.push("unusual fatigue");
  if (state.symptomFainting) names.push("fainting");
  return names;
}

function rule(label, severity, detail) {
  return { label, severity, detail };
}

function isSevereSymptoms(symptoms) {
  return symptoms.includes("chest discomfort") || symptoms.includes("fainting");
}

function loadDecisionShell() {
  return {
    status: "MONITOR",
    assessment: "Observation set incomplete",
    recommendation: "Complete data ingestion before issuing activity guidance.",
    actionTiming: "Repeat check when all required observations are available.",
    reason: "The system requires a complete observation set before issuing a full movement recommendation.",
    trigger: "Required physiological observations are missing.",
    triggerMeta: "Decision based on partial data only.",
    escalationStatus: "Clinical review deferred pending complete data",
    caregiverAlert: false,
    nextCheckMinutes: 15,
    baselineWindow: "7-day baseline",
    dataIntegrity: "Incomplete observation set",
  };
}

function evaluateState(state) {
  const baselineLow =
    typeof state.baselineLow === "number" && typeof state.baselineHigh === "number"
      ? Math.min(state.baselineLow, state.baselineHigh)
      : state.baselineLow;
  const baselineHigh =
    typeof state.baselineLow === "number" && typeof state.baselineHigh === "number"
      ? Math.max(state.baselineLow, state.baselineHigh)
      : state.baselineHigh;

  const normalizedState = {
    ...state,
    baselineLow,
    baselineHigh,
  };

  const requiredNumericFields = [
    ["baseline resting HR low", normalizedState.baselineLow],
    ["baseline resting HR high", normalizedState.baselineHigh],
    ["current resting HR", normalizedState.restingHr],
    ["peak HR during light activity", normalizedState.activityHr],
    ["recovery HR drop after activity", normalizedState.recoveryDrop],
    ["expected recovery baseline", normalizedState.recoveryBaseline],
    ["steps today", normalizedState.steps],
    ["active minutes", normalizedState.activeMinutes],
    ["inactive hours", normalizedState.inactiveHours],
  ];

  const missingFields = requiredNumericFields
    .filter(([, value]) => value === null || Number.isNaN(value))
    .map(([label]) => label);

  const symptoms = currentSymptoms(normalizedState);
  const redFlagSymptoms = symptoms.filter((item) =>
    ["shortness of breath", "chest discomfort", "fainting"].includes(item)
  );
  const severeSymptoms = isSevereSymptoms(symptoms);
  const baselineRange = baselineHigh - baselineLow;
  const clinicianLimitActive =
    typeof normalizedState.clinicianLimit === "number" &&
    normalizedState.clinicianLimit > 0 &&
    normalizedState.activityHr !== null &&
    normalizedState.activityHr > normalizedState.clinicianLimit;
  const elevatedResting =
    normalizedState.restingHr !== null &&
    baselineHigh !== null &&
    normalizedState.restingHr > baselineHigh;
  const highDuringLight =
    normalizedState.activityHr !== null &&
    baselineHigh !== null &&
    normalizedState.activityHr > baselineHigh + Math.max(12, baselineRange * 0.25);
  const poorRecovery =
    normalizedState.recoveryDrop !== null &&
    normalizedState.recoveryBaseline !== null &&
    normalizedState.recoveryDrop < normalizedState.recoveryBaseline;
  const multiDayDecline = normalizedState.decliningActivity === "true";
  const movementClear =
    missingFields.length === 0 &&
    redFlagSymptoms.length === 0 &&
    !clinicianLimitActive &&
    !normalizedState.suddenSpike &&
    !normalizedState.suddenDrop &&
    !elevatedResting &&
    !highDuringLight &&
    !poorRecovery &&
    !multiDayDecline &&
    symptoms.length === 0;

  const output = loadDecisionShell();
  const rules = [];

  if (missingFields.length > 0) {
    rules.push(
      rule(
        "Incomplete observation set",
        "amber",
        `Required observations missing: ${missingFields.join(", ")}.`
      )
    );
    return { output, rules, normalizedState };
  }

  if (redFlagSymptoms.length > 0) {
    output.status = severeSymptoms ? "CRITICAL" : "ALERT";
    output.assessment = "Red-flag symptoms reported";
    output.recommendation = "Stop activity, rest, and arrange urgent clinical review.";
    output.actionTiming = "Repeat check in 5 minutes.";
    output.reason = `Red-flag symptoms reported: ${redFlagSymptoms.join(", ")}.`;
    output.trigger = `Symptoms reported with immediate escalation criteria: ${redFlagSymptoms.join(", ")}.`;
    output.triggerMeta = `Baseline: ${formatBpmRange(baselineLow, baselineHigh)}. Resting HR: ${normalizedState.restingHr} bpm.`;
    output.escalationStatus = severeSymptoms
      ? "Immediate escalation required"
      : "Urgent caregiver review required";
    output.caregiverAlert = normalizedState.caregiverEnabled;
    output.nextCheckMinutes = 5;
    output.dataIntegrity = "Complete observation set";
    rules.push(rule("Red-flag symptoms", "red", output.reason));
    return { output, rules, normalizedState };
  }

  if (clinicianLimitActive) {
    output.status = "ALERT";
    output.assessment = "Clinician limit exceeded during activity";
    output.recommendation = "Stop activity and rest. Notify the reviewing caregiver.";
    output.actionTiming = "Repeat check in 5 minutes.";
    output.reason = `Peak heart rate reached ${normalizedState.activityHr} bpm and exceeded the clinician limit of ${normalizedState.clinicianLimit} bpm.`;
    output.trigger = `Peak activity HR ${normalizedState.activityHr} bpm exceeded clinician limit ${normalizedState.clinicianLimit} bpm.`;
    output.triggerMeta = `Baseline: ${formatBpmRange(baselineLow, baselineHigh)}.`;
    output.escalationStatus = "Caregiver notification recommended";
    output.caregiverAlert = normalizedState.caregiverEnabled;
    output.nextCheckMinutes = 5;
    output.dataIntegrity = "Complete observation set";
    rules.push(rule("Clinician heart rate limit", "red", output.reason));
    return { output, rules, normalizedState };
  }

  if (normalizedState.suddenSpike || normalizedState.suddenDrop) {
    const eventText =
      normalizedState.suddenSpike && normalizedState.suddenDrop
        ? "Sudden heart rate spike and drop were reported."
        : normalizedState.suddenSpike
          ? "Sudden heart rate spike above baseline was reported."
          : "Sudden heart rate drop below baseline was reported.";
    output.status = "ALERT";
    output.assessment = "Abrupt heart rate change detected";
    output.recommendation = "Stop activity and rest pending repeat assessment.";
    output.actionTiming = "Repeat check in 5 minutes.";
    output.reason = eventText;
    output.trigger = eventText;
    output.triggerMeta = `Baseline: ${formatBpmRange(baselineLow, baselineHigh)}. Current resting HR: ${normalizedState.restingHr} bpm.`;
    output.escalationStatus = normalizedState.caregiverEnabled
      ? "Caregiver notification available if symptoms emerge"
      : "Immediate repeat observation recommended";
    output.caregiverAlert = normalizedState.caregiverEnabled && symptoms.length > 0;
    output.nextCheckMinutes = 5;
    output.dataIntegrity = "Complete observation set";
    rules.push(rule("Abrupt heart rate change", "red", output.reason));
    return { output, rules, normalizedState };
  }

  if (elevatedResting) {
    output.status = "CAUTION";
    output.assessment = "Resting heart rate exceeds personal baseline";
    output.recommendation = "Rest and re-evaluate before additional activity.";
    output.actionTiming = "Repeat check in 10 minutes.";
    output.reason = `Resting heart rate is ${normalizedState.restingHr} bpm, above the baseline high of ${baselineHigh} bpm.`;
    output.trigger = `Resting HR ${normalizedState.restingHr} bpm exceeds baseline ${formatBpmRange(baselineLow, baselineHigh)}.`;
    output.triggerMeta = `Peak activity HR: ${normalizedState.activityHr} bpm. Recovery drop: ${normalizedState.recoveryDrop} bpm.`;
    output.escalationStatus = "Repeat observation before escalation";
    output.nextCheckMinutes = 10;
    output.dataIntegrity = "Complete observation set";
    rules.push(rule("Elevated resting heart rate", "amber", output.reason));
    if (symptoms.length > 0) {
      rules.push(
        rule(
          "Reported symptoms",
          "amber",
          `Associated symptoms reported: ${symptoms.join(", ")}.`
        )
      );
    }
    return { output, rules, normalizedState };
  }

  if (highDuringLight) {
    output.status = "CAUTION";
    output.assessment = "Activity heart rate exceeds expected range";
    output.recommendation = "Reduce activity intensity and rest before re-evaluation.";
    output.actionTiming = "Repeat check in 5 minutes.";
    output.reason = `Peak activity heart rate reached ${normalizedState.activityHr} bpm, above the expected threshold derived from baseline.`;
    output.trigger = `Peak activity HR ${normalizedState.activityHr} bpm exceeds expected range from baseline ${formatBpmRange(baselineLow, baselineHigh)}.`;
    output.triggerMeta = `Resting HR: ${normalizedState.restingHr} bpm.`;
    output.escalationStatus = "Repeat observation before escalation";
    output.nextCheckMinutes = 5;
    output.dataIntegrity = "Complete observation set";
    rules.push(rule("Elevated activity heart rate", "amber", output.reason));
    return { output, rules, normalizedState };
  }

  if (poorRecovery) {
    output.status = symptoms.length > 0 ? "CAUTION" : "MONITOR";
    output.assessment = "Recovery below expected baseline";
    output.recommendation = "Reduce exertion and monitor for changes.";
    output.actionTiming = `Repeat check in ${symptoms.length > 0 ? 10 : 15} minutes.`;
    output.reason = `Five-minute recovery drop is ${normalizedState.recoveryDrop} bpm, below the expected ${normalizedState.recoveryBaseline} bpm.`;
    output.trigger = `Recovery drop ${normalizedState.recoveryDrop} bpm is below expected ${normalizedState.recoveryBaseline} bpm.`;
    output.triggerMeta = `Peak activity HR: ${normalizedState.activityHr} bpm.`;
    output.escalationStatus = symptoms.length > 0
      ? "Repeat observation with symptom monitoring"
      : "Routine monitoring recommended";
    output.nextCheckMinutes = symptoms.length > 0 ? 10 : 15;
    output.dataIntegrity = "Complete observation set";
    rules.push(rule("Recovery response", "amber", output.reason));
    if (symptoms.length > 0) {
      rules.push(
        rule(
          "Reported symptoms",
          "amber",
          `Symptoms present during reduced recovery: ${symptoms.join(", ")}.`
        )
      );
    }
    return { output, rules, normalizedState };
  }

  if (multiDayDecline) {
    output.status = "MONITOR";
    output.assessment = "Multi-day decline in activity detected";
    output.recommendation = "Light activity only if tolerated; monitor for additional changes.";
    output.actionTiming = "Repeat check in 15 minutes.";
    output.reason = "A decline in activity over recent days was reported in the observation set.";
    output.trigger = `Multi-day activity decline flagged with ${normalizedState.steps} steps and ${normalizedState.activeMinutes} active minutes today.`;
    output.triggerMeta = `Inactive time: ${normalizedState.inactiveHours} hours.`;
    output.escalationStatus = "Trend monitoring recommended";
    output.nextCheckMinutes = 15;
    output.dataIntegrity = "Complete observation set";
    rules.push(rule("Multi-day activity trend", "amber", output.reason));
    return { output, rules, normalizedState };
  }

  if (movementClear) {
    output.status = "NORMAL";
    output.assessment = "No current threshold breach detected";
    output.recommendation = "Light activity may continue with routine monitoring.";
    output.actionTiming = "Repeat check in 15 minutes.";
    output.reason =
      "Resting heart rate, activity response, recovery, symptoms, and recent activity trend remain within expected limits.";
    output.trigger = "No threshold breach identified in current observation set.";
    output.triggerMeta = `Baseline: ${formatBpmRange(baselineLow, baselineHigh)}. Resting HR: ${normalizedState.restingHr} bpm.`;
    output.escalationStatus = "Routine review";
    output.nextCheckMinutes = 15;
    output.dataIntegrity = "Complete observation set";
    rules.push(
      rule(
        "Stable observation set",
        "green",
        `Resting HR ${normalizedState.restingHr} bpm remains within baseline ${formatBpmRange(baselineLow, baselineHigh)}.`
      )
    );
    rules.push(
      rule(
        "Activity response",
        "green",
        `Peak activity HR ${normalizedState.activityHr} bpm and recovery drop ${normalizedState.recoveryDrop} bpm remain within expected limits.`
      )
    );
  }

  return { output, rules, normalizedState };
}

function buildIngestionCards(state) {
  const symptoms = currentSymptoms(state);
  return [
    ["Baseline", formatBpmRange(state.baselineLow, state.baselineHigh)],
    ["Resting HR", `${state.restingHr} bpm`],
    ["Peak Activity HR", `${state.activityHr} bpm`],
    ["Recovery Drop", `${state.recoveryDrop} bpm in 5 min`],
    ["Expected Recovery", `${state.recoveryBaseline} bpm`],
    ["Activity Load", `${state.steps} steps / ${state.activeMinutes} active min`],
    ["Inactive Time", `${state.inactiveHours} hours`],
    ["Symptoms Reported", symptoms.length > 0 ? symptoms.join(", ") : "None reported"],
  ];
}

function renderPayload(state) {
  const cards = buildIngestionCards(state);
  payloadSummary.innerHTML = cards
    .map(
      ([label, value]) =>
        `<article class="ingestion-card"><p class="metric-label">${label}</p><p>${value}</p></article>`
    )
    .join("");
}

function renderState(state, result) {
  const { output, rules, normalizedState } = result;
  document.getElementById("heart-status").textContent = output.status;
  document.getElementById("heart-summary").textContent = output.assessment;
  document.getElementById("recommendation-title").textContent = output.recommendation;
  document.getElementById("recommendation-copy").textContent = output.reason;
  document.getElementById("action-timing").textContent = output.actionTiming;
  document.getElementById("decision-trigger").textContent = output.trigger;
  document.getElementById("trigger-meta").textContent = output.triggerMeta;
  document.getElementById("caregiver-status").textContent = output.caregiverAlert ? "On" : "Off";
  document.getElementById("alert-state").textContent = output.escalationStatus;
  document.getElementById("baseline-window").textContent = `${output.baselineWindow} (${formatBpmRange(
    normalizedState.baselineLow,
    normalizedState.baselineHigh
  )})`;
  document.getElementById("data-integrity").textContent = output.dataIntegrity;

  const heroCard = document.getElementById("hero-status-card");
  const concernPill = document.getElementById("concern-pill");
  const style = severityStyles[output.status] || severityStyles.MONITOR;
  heroCard.style.borderColor = style.border;
  heroCard.style.background = style.background;
  concernPill.textContent = style.chip;
  concernPill.style.background = style.chipBackground;
  concernPill.style.color = style.chipColor;

  const ruleStack = document.getElementById("rule-stack");
  ruleStack.innerHTML = "";
  rules.forEach((item) => {
    const node = document.createElement("li");
    node.className = `rule-item ${item.severity}`;
    node.innerHTML = `<strong>${item.label}</strong><small>${item.detail}</small>`;
    ruleStack.appendChild(node);
  });

  lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function readStateFromForm() {
  if (!monitorForm) return loadState();
  const next = {};
  Object.entries(fieldIds).forEach(([key, id]) => {
    const element = document.getElementById(id);
    if (element.type === "checkbox") {
      next[key] = element.checked;
    } else if (element.tagName === "SELECT") {
      next[key] = element.value;
    } else if (element.type === "number") {
      next[key] = element.value === "" ? null : Number(element.value);
    } else {
      next[key] = element.value;
    }
  });
  return next;
}

function writeStateToForm(state) {
  if (!monitorForm) return;
  Object.entries(fieldIds).forEach(([key, id]) => {
    const element = document.getElementById(id);
    if (!element) return;
    if (element.type === "checkbox") {
      element.checked = Boolean(state[key]);
    } else if (element.tagName === "SELECT") {
      element.value = state[key];
    } else {
      element.value = state[key] ?? "";
    }
  });
}

function runEvaluation() {
  const state = readStateFromForm();
  saveState(state);
  const result = evaluateState(state);
  renderPayload(result.normalizedState);
  renderState(state, result);
}

const initialState = loadState();
writeStateToForm(initialState);
const initialResult = evaluateState(initialState);
renderPayload(initialResult.normalizedState);
renderState(initialState, initialResult);

monitorForm.addEventListener("input", runEvaluation);
monitorForm.addEventListener("change", runEvaluation);
resetButton.addEventListener("click", () => {
  writeStateToForm(defaultState);
  saveState(defaultState);
  const resetResult = evaluateState(defaultState);
  renderPayload(resetResult.normalizedState);
  renderState(defaultState, resetResult);
});

applyApiPayloadButton.disabled = true;
