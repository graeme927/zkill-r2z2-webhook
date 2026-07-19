import fs from "node:fs";
import path from "node:path";

const DATA_DIRECTORY = path.resolve("data");
const STATE_FILE = path.join(DATA_DIRECTORY, "state.json");
const TEMP_FILE = path.join(DATA_DIRECTORY, "state.json.tmp");
const MAX_POSTED_KEYS = 50000;

function createEmptyState() {
  return {
    version: 3,
    startedAt: null,
    nextSequence: null,
    postedKeys: []
  };
}

export function loadState() {
  fs.mkdirSync(DATA_DIRECTORY, { recursive: true });

  if (!fs.existsSync(STATE_FILE)) {
    return createEmptyState();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));

    if (parsed?.version === 2) {
      console.log(
        "[STATE] Upgrading v2 state to rule-based v3 state at the " +
          "existing R2Z2 position."
      );

      return {
        version: 3,
        startedAt:
          typeof parsed.startedAt === "string" ? parsed.startedAt : null,
        nextSequence: Number.isSafeInteger(parsed.nextSequence)
          ? parsed.nextSequence
          : null,
        postedKeys: []
      };
    }

    if (parsed?.version !== 3) {
      console.log(
        "[STATE] Unknown state format found; creating a fresh baseline."
      );
      return createEmptyState();
    }

    return {
      version: 3,
      startedAt:
        typeof parsed.startedAt === "string" ? parsed.startedAt : null,
      nextSequence: Number.isSafeInteger(parsed.nextSequence)
        ? parsed.nextSequence
        : null,
      postedKeys: Array.isArray(parsed.postedKeys)
        ? parsed.postedKeys.map(String).slice(-MAX_POSTED_KEYS)
        : []
    };
  } catch (error) {
    console.error(`[STATE] Could not read state.json: ${error.message}`);
    return createEmptyState();
  }
}

export function hasPosted(state, killmailId, ruleId) {
  return state.postedKeys.includes(`${killmailId}:rule:${ruleId}`);
}

export function markPosted(state, killmailId, ruleId) {
  const key = `${killmailId}:rule:${ruleId}`;

  if (!state.postedKeys.includes(key)) {
    state.postedKeys.push(key);
  }

  if (state.postedKeys.length > MAX_POSTED_KEYS) {
    state.postedKeys = state.postedKeys.slice(-MAX_POSTED_KEYS);
  }
}

export function saveState(state) {
  fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
  fs.writeFileSync(TEMP_FILE, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(TEMP_FILE, STATE_FILE);
}
