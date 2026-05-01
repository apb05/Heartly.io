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

const defaultPayload = {
  baselineLowHr: 55,
  baselineHighHr: 68,
  restingHrToday: 62,
  peakHrLightActivity: 101,
  recoveryHrDrop5Min: 18,
  expectedRecoveryDrop: 15,
  steps: 4632,
  activeMinutes: 32,
  inactiveHours: 7.2,
  decliningActivityPastDays: false,
  suddenHrSpikeAboveBaseline: false,
  suddenHrDropBelowBaseline: false,
  symptomsReported: [],
  clinicianHrLimit: null,
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

function buildPayloadFromState(state) {
  return {
    baselineLowHr: state.baselineLow,
    baselineHighHr: state.baselineHigh,
    restingHrToday: state.restingHr,
    peakHrLightActivity: state.activityHr,
    recoveryHrDrop5Min: state.recoveryDrop,
    expectedRecoveryDrop: state.recoveryBaseline,
    steps: state.steps,
    activeMinutes: state.activeMinutes,
    inactiveHours: state.inactiveHours,
    decliningActivityPastDays: state.decliningActivity === "true",
    suddenHrSpikeAboveBaseline: state.suddenSpike,
    suddenHrDropBelowBaseline: state.suddenDrop,
    symptomsReported: currentSymptoms(state),
    clinicianHrLimit: state.clinicianLimit,
    caregiverEnabled: state.caregiverEnabled,
  };
}

function renderPayload(state, result) {
  const summaryLines = [];
  const primaryRule = result.rules.find((item) => item.severity !== "green") ?? result.rules[0];
  const symptoms = currentSymptoms(state);

  summaryLines.push(`${result.output.heartStatus}. ${result.output.reason}`);

  if (primaryRule) {
    summaryLines.push(`The decision is mainly driven by this check: ${primaryRule.detail}`);
  }

  if (result.output.status === "CRITICAL" || result.output.status === "ALERT") {
    if (symptoms.length > 0) {
      summaryLines.push(`Reported symptoms for this reading are ${symptoms.join(", ")}. These symptoms override otherwise reassuring metrics.`);
    }

    if (state.suddenSpike || state.suddenDrop) {
      summaryLines.push(
        state.suddenSpike && state.suddenDrop
          ? "Both a sudden spike and a sudden drop were marked, which Heartly treats as an abrupt heart-rate change."
          : state.suddenSpike
            ? "A sudden spike above baseline was marked, which Heartly treats as an abrupt heart-rate change."
            : "A sudden drop below baseline was marked, which Heartly treats as an abrupt heart-rate change."
      );
    }
  } else if (result.output.status === "CAUTION") {
    summaryLines.push(
      `Resting heart rate is ${state.restingHr} bpm, compared with a baseline range of ${state.baselineLow} to ${state.baselineHigh} bpm. Peak light-activity heart rate is ${state.activityHr} bpm, and 5-minute recovery drop is ${state.recoveryDrop} bpm against an expected ${state.recoveryBaseline} bpm.`
    );
  } else if (result.output.status === "MONITOR") {
    summaryLines.push(
      `Today's activity pattern shows ${state.steps} steps, ${state.activeMinutes} active minutes, and ${state.inactiveHours} inactive hours, which supports monitoring rather than an urgent stop.`
    );
  } else {
    summaryLines.push(
      `Resting heart rate stays within the baseline range, light-activity heart rate is not beyond the expected threshold, and recovery meets the expected drop.`
    );
  }

  summaryLines.push(
    `Caregiver alert is ${result.output.caregiverAlert ? "on" : "off"}, and another check is recommended in ${result.output.nextCheckMinutes} minutes.`
  );

  payloadSummary.innerHTML = summaryLines.map((line) => `<p>${line}</p>`).join("");
}

function buildReasoningText(result) {
  const { output } = result;
  const caregiverText = output.caregiverAlert ? "on" : "off";

  return {
    title:
      output.status === "CRITICAL"
        ? "This looks urgently concerning"
        : output.status === "ALERT"
          ? "This looks concerning"
          : output.status === "CAUTION"
            ? "This may be concerning"
            : output.status === "MONITOR"
              ? "This is not urgent, but it should be monitored"
              : "This does not look concerning right now",
    copy: `${output.reason} ${output.movementRecommendation}.`,
    meta: `Next check in ${output.nextCheckMinutes} minutes. Caregiver alert is ${caregiverText}.`,
  };
}

function readStateFromForm() {
  const form = document.getElementById("monitor-form");
  if (!form) return loadState();
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
  const form = document.getElementById("monitor-form");
  if (!form) return;
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

function rule(label, severity, detail) {
  return { label, severity, detail };
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

function isSevereSymptoms(symptoms) {
  return symptoms.includes("chest discomfort") || symptoms.includes("fainting");
}

function evaluateState(state) {
  const requiredNumericFields = [
    ["baseline resting HR low", state.baselineLow],
    ["baseline resting HR high", state.baselineHigh],
    ["current resting HR", state.restingHr],
    ["peak HR during light activity", state.activityHr],
    ["recovery HR drop after activity", state.recoveryDrop],
    ["expected recovery baseline", state.recoveryBaseline],
    ["steps today", state.steps],
    ["active minutes", state.activeMinutes],
    ["inactive hours", state.inactiveHours],
  ];
  const missingFields = requiredNumericFields
    .filter(([, value]) => value === null || Number.isNaN(value))
    .map(([label]) => label);
  const symptoms = currentSymptoms(state);
  const redFlagSymptoms = symptoms.filter((item) =>
    ["shortness of breath", "chest discomfort", "fainting"].includes(item)
  );
  const severeSymptoms = isSevereSymptoms(symptoms);
  const clinicianLimitActive =
    typeof state.clinicianLimit === "number" &&
    state.clinicianLimit > 0 &&
    state.activityHr !== null &&
    state.activityHr > state.clinicianLimit;
  const elevatedResting =
    state.restingHr !== null &&
    state.baselineHigh !== null &&
    state.restingHr > state.baselineHigh;
  const baselineRange = state.baselineHigh - state.baselineLow;
  const highDuringLight =
    state.activityHr !== null &&
    state.baselineHigh !== null &&
    state.activityHr > state.baselineHigh + Math.max(12, baselineRange * 0.25);
  const poorRecovery =
    state.recoveryDrop !== null &&
    state.recoveryBaseline !== null &&
    state.recoveryDrop < state.recoveryBaseline;
  const multiDayDecline = state.decliningActivity === "true";
  const movementClear =
    missingFields.length === 0 &&
    redFlagSymptoms.length === 0 &&
    !clinicianLimitActive &&
    !state.suddenSpike &&
    !state.suddenDrop &&
    !elevatedResting &&
    !highDuringLight &&
    !poorRecovery &&
    !multiDayDecline &&
    symptoms.length === 0;

  const rules = [];
  let output = {
    status: "MONITOR",
    heartStatus: "Evaluation pending",
    movementRecommendation: "Use caution until complete data is available",
    reason: "The evaluation requires all manual input fields before activity guidance can be issued.",
    caregiverAlert: false,
    nextCheckMinutes: 15,
  };

  if (missingFields.length > 0) {
    rules.push(
      rule(
        "Missing required data",
        "amber",
        `No recommendation beyond caution can be made until these fields are provided: ${missingFields.join(", ")}.`
      )
    );
    return { output, rules };
  }

  if (redFlagSymptoms.length > 0) {
    output = {
      status: severeSymptoms ? "CRITICAL" : "ALERT",
      heartStatus: "Red flag symptoms reported",
      movementRecommendation: "Stop activity and rest",
      reason: `Red flag symptoms were reported: ${redFlagSymptoms.join(", ")}.`,
      caregiverAlert: state.caregiverEnabled,
      nextCheckMinutes: 5,
    };
    rules.push(rule("Red flag symptoms", "red", output.reason));
    return { output, rules };
  }

  rules.push(rule("Red flag symptoms", "green", "No red flag symptoms were reported."));

  if (clinicianLimitActive) {
    output = {
      status: "ALERT",
      heartStatus: "Clinician heart rate limit exceeded",
      movementRecommendation: "Stop activity and rest",
      reason: `Peak heart rate of ${state.activityHr} bpm exceeded the clinician limit of ${state.clinicianLimit} bpm.`,
      caregiverAlert: state.caregiverEnabled,
      nextCheckMinutes: 5,
    };
    rules.push(rule("Clinician heart rate limit", "red", output.reason));
    return { output, rules };
  }

  rules.push(
    rule(
      "Clinician heart rate limit",
      "green",
      state.clinicianLimit
        ? `Peak heart rate remained at or below the clinician limit of ${state.clinicianLimit} bpm.`
        : "No clinician heart rate limit was provided."
    )
  );

  if (state.suddenSpike || state.suddenDrop) {
    const eventText = state.suddenSpike && state.suddenDrop
      ? "Sudden spike and drop were reported."
      : state.suddenSpike
        ? "Sudden heart rate spike above baseline was reported."
        : "Sudden heart rate drop below baseline was reported.";
    output = {
      status: "ALERT",
      heartStatus: "Abrupt heart rate change detected",
      movementRecommendation: "Stop or avoid activity and rest",
      reason: eventText,
      caregiverAlert: state.caregiverEnabled && symptoms.length > 0,
      nextCheckMinutes: 5,
    };
    rules.push(rule("Sudden HR spike or drop", "red", output.reason));
    return { output, rules };
  }

  rules.push(rule("Sudden HR spike or drop", "green", "No sudden spike or drop was reported."));

  if (elevatedResting) {
    output = {
      status: "CAUTION",
      heartStatus: "Elevated resting heart rate",
      movementRecommendation: "Rest today and monitor how you feel",
      reason: `Current resting heart rate of ${state.restingHr} bpm is above the baseline high of ${state.baselineHigh} bpm.`,
      caregiverAlert: false,
      nextCheckMinutes: 10,
    };
    rules.push(rule("Elevated resting HR", "amber", output.reason));
    return { output, rules };
  }

  rules.push(rule("Elevated resting HR", "green", "Resting heart rate is within the provided baseline range."));

  if (highDuringLight) {
    output = {
      status: "CAUTION",
      heartStatus: "Elevated heart rate during light activity",
      movementRecommendation: "Slow down or stop and rest",
      reason: `Peak heart rate during light activity rose to ${state.activityHr} bpm, above the expected range from baseline.`,
      caregiverAlert: false,
      nextCheckMinutes: 5,
    };
    rules.push(rule("High HR during light activity", "amber", output.reason));
    return { output, rules };
  }

  rules.push(rule("High HR during light activity", "green", "Peak heart rate during light activity is not above the expected threshold."));

  if (poorRecovery) {
    output = {
      status: symptoms.length > 0 ? "CAUTION" : "MONITOR",
      heartStatus: "Recovery below expected baseline",
      movementRecommendation: "Reduce activity and recheck after rest",
      reason: `Recovery HR drop was ${state.recoveryDrop} bpm within 5 minutes, below the expected drop of ${state.recoveryBaseline} bpm.`,
      caregiverAlert: false,
      nextCheckMinutes: symptoms.length > 0 ? 10 : 15,
    };
    rules.push(rule("Poor recovery", "amber", output.reason));
    return { output, rules };
  }

  rules.push(rule("Poor recovery", "green", "Recovery HR drop met or exceeded the expected baseline."));

  if (multiDayDecline) {
    output = {
      status: "MONITOR",
      heartStatus: "Declining activity trend noted",
      movementRecommendation: "Use light activity only if tolerated",
      reason: "Declining activity over past days was reported and should be observed before encouraging more movement.",
      caregiverAlert: false,
      nextCheckMinutes: 15,
    };
    rules.push(rule("Multi-day decline", "amber", output.reason));
    return { output, rules };
  }

  rules.push(rule("Multi-day decline", "green", "No declining multi-day activity pattern was reported."));

  if (movementClear) {
    output = {
      status: "NORMAL",
      heartStatus: "No immediate concerning pattern detected",
      movementRecommendation: "Your current data looks stable for light movement.",
      reason: "Higher-priority safety checks are clear and current heart and recovery values do not show a concerning deviation.",
      caregiverAlert: false,
      nextCheckMinutes: 15,
    };
    rules.push(rule("Movement encouragement", "green", output.reason));
  }

  return { output, rules };
}

function renderState(state, result) {
  document.getElementById("heart-status").textContent = result.output.status;
  document.getElementById("heart-summary").textContent = result.output.heartStatus;
  document.getElementById("recommendation-title").textContent =
    result.output.movementRecommendation;
  document.getElementById("recommendation-copy").textContent =
    result.output.reason;
  document.getElementById("caregiver-status").textContent = String(
    result.output.caregiverAlert
  );
  document.getElementById("alert-state").textContent = `Next check: ${result.output.nextCheckMinutes} min`;
  const concernPill = document.getElementById("concern-pill");
  concernPill.textContent =
    result.output.status === "NORMAL"
      ? "Not concerning right now"
      : result.output.status === "MONITOR"
        ? "Worth monitoring"
        : result.output.status === "CAUTION"
          ? "Somewhat concerning"
          : result.output.status === "ALERT"
            ? "Concerning"
            : "Urgent concern";

  const heroCard = document.getElementById("hero-status-card");
  const severity =
    result.output.status === "CRITICAL" || result.output.status === "ALERT"
      ? "red"
      : result.output.status === "CAUTION" || result.output.status === "MONITOR"
        ? "amber"
        : "green";

  heroCard.style.borderColor =
    severity === "red"
      ? "rgba(255, 115, 104, 0.26)"
      : severity === "amber"
        ? "rgba(255, 177, 26, 0.24)"
        : "rgba(87, 239, 114, 0.22)";
  concernPill.style.background =
    severity === "red"
      ? "rgba(255, 115, 104, 0.16)"
      : severity === "amber"
        ? "rgba(255, 177, 26, 0.16)"
        : "rgba(87, 239, 114, 0.14)";
  concernPill.style.color =
    severity === "red"
      ? "#ffd0cc"
      : severity === "amber"
        ? "#ffe0a1"
        : "#bbf6c6";
  const reasoning = buildReasoningText(result);
  document.getElementById("reasoning-title").textContent = reasoning.title;
  document.getElementById("reasoning-copy").textContent = reasoning.copy;
  document.getElementById("reasoning-meta").textContent = reasoning.meta;

  const ruleStack = document.getElementById("rule-stack");
  ruleStack.innerHTML = "";
  result.rules.forEach((item) => {
    const node = document.createElement("article");
    node.className = `rule-item ${item.severity}`;
    node.innerHTML = `<strong>${item.label}</strong><small>${item.detail}</small>`;
    ruleStack.appendChild(node);
  });

  lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function runEvaluation() {
  const state = readStateFromForm();
  saveState(state);
  const result = evaluateState(state);
  renderPayload(state, result);
  renderState(state, result);
}

const initialState = loadState();
writeStateToForm(initialState);
const initialResult = evaluateState(initialState);
renderPayload(initialState, initialResult);
renderState(initialState, initialResult);

monitorForm.addEventListener("input", runEvaluation);
monitorForm.addEventListener("change", runEvaluation);
resetButton.addEventListener("click", () => {
  writeStateToForm(defaultState);
  saveState(defaultState);
  const resetResult = evaluateState(defaultState);
  renderPayload(defaultState, resetResult);
  renderState(defaultState, resetResult);
});
applyApiPayloadButton.disabled = true;
applyApiPayloadButton.textContent = "Live updates on";
