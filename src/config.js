import "dotenv/config";

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIdList(value) {
  return [...new Set(
    parseList(value)
      .map((item) => Number(item))
      .filter((item) => Number.isSafeInteger(item) && item > 0)
  )];
}

function parseInteger(value, fallback, minimum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed >= minimum
    ? parsed
    : fallback;
}

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function normaliseRuleKey(index) {
  return `FILTER_${index}`;
}

function buildNumberedRules() {
  const indexes = new Set();

  for (const key of Object.keys(process.env)) {
    const match = key.match(/^FILTER_(\d+)_WEBHOOK$/);

    if (match) {
      indexes.add(Number(match[1]));
    }
  }

  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => {
      const prefix = normaliseRuleKey(index);
      const enabled = parseBoolean(process.env[`${prefix}_ENABLED`], true);
      const participantMatch = String(
        process.env[`${prefix}_PARTICIPANT_MATCH`] || "ANY"
      ).trim().toUpperCase();

      if (!["ANY", "ALL"].includes(participantMatch)) {
        throw new Error(
          `${prefix}_PARTICIPANT_MATCH must be ANY or ALL`
        );
      }

      return {
        id: String(index),
        envPrefix: prefix,
        name: String(
          process.env[`${prefix}_NAME`] || `Filter ${index}`
        ).trim(),
        enabled,
        webhook: String(
          process.env[`${prefix}_WEBHOOK`] || ""
        ).trim(),
        participantMatch,
        characterIds: parseIdList(
          process.env[`${prefix}_CHARACTER_IDS`]
        ),
        characterNames: parseList(
          process.env[`${prefix}_CHARACTER_NAMES`]
        ),
        corporationIds: parseIdList(
          process.env[`${prefix}_CORPORATION_IDS`]
        ),
        corporationNames: parseList(
          process.env[`${prefix}_CORPORATION_NAMES`]
        ),
        allianceIds: parseIdList(
          process.env[`${prefix}_ALLIANCE_IDS`]
        ),
        allianceNames: parseList(
          process.env[`${prefix}_ALLIANCE_NAMES`]
        ),
        regionIds: parseIdList(
          process.env[`${prefix}_REGION_IDS`]
        ),
        regionNames: parseList(
          process.env[`${prefix}_REGION_NAMES`]
        )
      };
    })
    .filter((rule) => rule.enabled);
}

function buildLegacyRule() {
  const webhook = String(process.env.DISCORD_WEBHOOK || "").trim();
  const characterIds = parseIdList(process.env.WATCH_CHARACTER_IDS);
  const characterNames = parseList(process.env.WATCH_CHARACTER_NAMES);

  if (
    !webhook ||
    (characterIds.length === 0 && characterNames.length === 0)
  ) {
    return null;
  }

  return {
    id: "legacy",
    envPrefix: "LEGACY",
    name: "Tracked characters",
    enabled: true,
    webhook,
    participantMatch: "ANY",
    characterIds,
    characterNames,
    corporationIds: [],
    corporationNames: [],
    allianceIds: [],
    allianceNames: [],
    regionIds: [],
    regionNames: []
  };
}

const numberedRules = buildNumberedRules();
const legacyRule = numberedRules.length === 0 ? buildLegacyRule() : null;
const rules = legacyRule ? [legacyRule] : numberedRules;

for (const rule of rules) {
  if (!rule.webhook) {
    throw new Error(`${rule.envPrefix}_WEBHOOK is missing`);
  }

  try {
    const url = new URL(rule.webhook);

    if (url.protocol !== "https:") {
      throw new Error("Webhook must use HTTPS");
    }
  } catch (error) {
    throw new Error(
      `${rule.envPrefix}_WEBHOOK is invalid: ${error.message}`
    );
  }

  const hasParticipantFilter =
    rule.characterIds.length > 0 ||
    rule.characterNames.length > 0 ||
    rule.corporationIds.length > 0 ||
    rule.corporationNames.length > 0 ||
    rule.allianceIds.length > 0 ||
    rule.allianceNames.length > 0;

  const hasRegionFilter =
    rule.regionIds.length > 0 || rule.regionNames.length > 0;

  if (!hasParticipantFilter && !hasRegionFilter) {
    throw new Error(
      `${rule.envPrefix} has no character, corporation, alliance, or region filters`
    );
  }
}

if (rules.length === 0) {
  throw new Error(
    "No filter rules configured. Add FILTER_1_WEBHOOK and at least one " +
      "FILTER_1_* filter, or use the legacy DISCORD_WEBHOOK and " +
      "WATCH_CHARACTER_IDS settings."
  );
}

const config = {
  rules,
  userAgent:
    String(process.env.USER_AGENT || "").trim() ||
    "UKCorp-zKill-R2Z2-Bot/3.0",
  esiCompatibilityDate: String(
    process.env.ESI_COMPATIBILITY_DATE || ""
  ).trim(),
  r2z2SuccessDelayMs: parseInteger(
    process.env.R2Z2_SUCCESS_DELAY_MS,
    100,
    100
  ),
  r2z2IdleDelayMs: parseInteger(
    process.env.R2Z2_IDLE_DELAY_MS,
    6000,
    6000
  ),
  requestErrorDelayMs: parseInteger(
    process.env.REQUEST_ERROR_DELAY_MS,
    15000,
    5000
  ),
  debug: String(process.env.DEBUG || "").toLowerCase() === "true"
};

export default config;
