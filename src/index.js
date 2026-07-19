import config from "./config.js";
import { postRuleWebhook } from "./discord.js";
import {
  getLocation,
  resolveConfiguredNames,
  resolveNames
} from "./esi.js";
import {
  fetchCurrentSequence,
  fetchSequence
} from "./r2z2.js";
import {
  buildParticipants,
  findRuleCandidates
} from "./filters.js";
import {
  hasPosted,
  loadState,
  markPosted,
  saveState
} from "./state.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debug(...values) {
  if (config.debug) {
    console.log("[DEBUG]", ...values);
  }
}

function normaliseName(value) {
  return String(value || "").trim().toLocaleLowerCase("en");
}

function resolvedIdsForNames(names, resolvedMap, label) {
  const byName = new Map(
    [...resolvedMap.entries()].map(([id, name]) => [
      normaliseName(name),
      Number(id)
    ])
  );

  return names.map((name) => {
    const id = byName.get(normaliseName(name));

    if (!Number.isSafeInteger(id)) {
      throw new Error(`Could not resolve configured ${label}: ${name}`);
    }

    return id;
  });
}

async function buildRules() {
  const requestedNames = {
    characters: config.rules.flatMap((rule) => rule.characterNames),
    corporations: config.rules.flatMap((rule) => rule.corporationNames),
    alliances: config.rules.flatMap((rule) => rule.allianceNames),
    regions: config.rules.flatMap((rule) => rule.regionNames)
  };

  const resolved = await resolveConfiguredNames(requestedNames);

  return config.rules.map((rule) => {
    const characterIds = [
      ...new Set([
        ...rule.characterIds,
        ...resolvedIdsForNames(
          rule.characterNames,
          resolved.characters,
          "character"
        )
      ])
    ];
    const corporationIds = [
      ...new Set([
        ...rule.corporationIds,
        ...resolvedIdsForNames(
          rule.corporationNames,
          resolved.corporations,
          "corporation"
        )
      ])
    ];
    const allianceIds = [
      ...new Set([
        ...rule.allianceIds,
        ...resolvedIdsForNames(
          rule.allianceNames,
          resolved.alliances,
          "alliance"
        )
      ])
    ];
    const regionIds = [
      ...new Set([
        ...rule.regionIds,
        ...resolvedIdsForNames(
          rule.regionNames,
          resolved.regions,
          "region"
        )
      ])
    ];

    return {
      ...rule,
      characterIds,
      corporationIds,
      allianceIds,
      regionIds,
      characterIdSet: new Set(characterIds),
      corporationIdSet: new Set(corporationIds),
      allianceIdSet: new Set(allianceIds),
      regionIdSet: new Set(regionIds),
      hasParticipantFilters:
        characterIds.length > 0 ||
        corporationIds.length > 0 ||
        allianceIds.length > 0,
      hasRegionFilters: regionIds.length > 0
    };
  });
}

function validateRecord(record, expectedSequence) {
  if (!record || typeof record !== "object") {
    throw new Error(`Sequence ${expectedSequence} returned invalid JSON`);
  }

  if (!Number.isSafeInteger(Number(record.killmail_id))) {
    throw new Error(
      `Sequence ${expectedSequence} has no valid killmail_id`
    );
  }

  if (!record.esi?.killmail_time || !record.esi?.victim) {
    throw new Error(
      `Sequence ${expectedSequence} has no complete ESI killmail`
    );
  }
}

async function buildActivity(
  record,
  rule,
  location,
  participants,
  matchedParticipants
) {
  const victim = participants.find(
    (participant) => participant.side === "VICTIM"
  );
  const finalBlow = participants.find(
    (participant) => participant.finalBlow
  );

  const idsToResolve = [];

  for (const participant of [
    victim,
    finalBlow,
    ...matchedParticipants
  ]) {
    if (!participant) {
      continue;
    }

    idsToResolve.push(
      participant.characterId,
      participant.corporationId,
      participant.allianceId,
      participant.shipTypeId
    );
  }

  const names = await resolveNames(idsToResolve);

  function describeParticipant(participant) {
    if (!participant) {
      return null;
    }

    return {
      ...participant,
      characterName: participant.characterId
        ? names.get(participant.characterId) ||
          `Unknown character (${participant.characterId})`
        : "NPC or structure",
      corporationName: participant.corporationId
        ? names.get(participant.corporationId) ||
          `Unknown corporation (${participant.corporationId})`
        : "No corporation",
      allianceName: participant.allianceId
        ? names.get(participant.allianceId) ||
          `Unknown alliance (${participant.allianceId})`
        : "No alliance",
      shipName: participant.shipTypeId
        ? names.get(participant.shipTypeId) ||
          `Unknown ship (${participant.shipTypeId})`
        : "Ship not supplied"
    };
  }

  const describedMatches = matchedParticipants.map(describeParticipant);
  const describedVictim = describeParticipant(victim);
  const describedFinalBlow = describeParticipant(finalBlow);

  return {
    rule,
    killmailId: Number(record.killmail_id),
    killmailTime: record.esi.killmail_time,
    sequenceId: Number(record.sequence_id),
    systemName: location.systemName,
    regionName: location.regionName,
    regionId: location.regionId,
    victim: describedVictim,
    finalBlow: describedFinalBlow,
    matchedParticipants: describedMatches,
    totalValue: Number(record?.zkb?.totalValue || 0),
    thumbnailTypeId:
      describedMatches.length === 1 && describedMatches[0].shipTypeId
        ? describedMatches[0].shipTypeId
        : describedVictim?.shipTypeId || 0
  };
}

function describeRule(rule) {
  const parts = [];

  if (rule.characterIds.length > 0) {
    parts.push(`${rule.characterIds.length} character(s)`);
  }

  if (rule.corporationIds.length > 0) {
    parts.push(`${rule.corporationIds.length} corporation(s)`);
  }

  if (rule.allianceIds.length > 0) {
    parts.push(`${rule.allianceIds.length} alliance(s)`);
  }

  if (rule.regionIds.length > 0) {
    parts.push(`${rule.regionIds.length} region(s)`);
  }

  return parts.join(", ");
}

async function initialiseState(state) {
  if (
    state.startedAt &&
    Number.isSafeInteger(state.nextSequence) &&
    state.nextSequence > 0
  ) {
    return;
  }

  const currentSequence = await fetchCurrentSequence();

  state.startedAt = new Date().toISOString();
  state.nextSequence = currentSequence + 1;
  saveState(state);

  console.log(
    `[BASELINE] Starting after R2Z2 sequence ${currentSequence}.`
  );
  console.log(
    `[BASELINE] Killmails before ${state.startedAt} will not be posted.`
  );
}

async function main() {
  const state = loadState();
  const rules = await buildRules();

  await initialiseState(state);

  console.log("===================================");
  console.log("zKILL R2Z2 MULTI-FILTER BOT");
  console.log(`Rules: ${rules.length}`);

  for (const rule of rules) {
    console.log(
      `  [${rule.id}] ${rule.name}: ${describeRule(rule)} ` +
        `(participant ${rule.participantMatch})`
    );
  }

  console.log(`Next sequence: ${state.nextSequence}`);
  console.log("===================================");

  let stopping = false;
  let consecutiveNotFound = 0;
  let processedSinceReport = 0;
  let lastWaitingLog = 0;

  const stop = () => {
    stopping = true;
    saveState(state);
    console.log("[STOP] Shutdown requested; state saved.");
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  while (!stopping) {
    const sequenceId = state.nextSequence;

    try {
      const record = await fetchSequence(sequenceId);

      if (record === null) {
        consecutiveNotFound += 1;

        if (Date.now() - lastWaitingLog >= 60000) {
          console.log(
            `[WAIT] No sequence ${sequenceId} yet; waiting for new killmails.`
          );
          lastWaitingLog = Date.now();
        }

        if (consecutiveNotFound >= 10) {
          const currentSequence = await fetchCurrentSequence();
          const gap = currentSequence - sequenceId;

          if (gap > 1000) {
            console.warn(
              `[RESYNC] Stored sequence ${sequenceId} is no longer ` +
                `available. Resuming after current sequence ${currentSequence}.`
            );
            state.nextSequence = currentSequence + 1;
            saveState(state);
          }

          consecutiveNotFound = 0;
        }

        await sleep(config.r2z2IdleDelayMs);
        continue;
      }

      consecutiveNotFound = 0;
      validateRecord(record, sequenceId);

      const killmailTime = Date.parse(record.esi.killmail_time);
      const startedAt = Date.parse(state.startedAt);

      if (!Number.isFinite(killmailTime)) {
        throw new Error(
          `Killmail ${record.killmail_id} has an invalid killmail_time`
        );
      }

      if (killmailTime >= startedAt) {
        const participants = buildParticipants(record);
        const candidates = findRuleCandidates(participants, rules);

        if (candidates.length > 0) {
          const location = await getLocation(record.esi.solar_system_id);

          for (const candidate of candidates) {
            const { rule, matchedParticipants } = candidate;

            if (
              rule.hasRegionFilters &&
              !rule.regionIdSet.has(location.regionId)
            ) {
              continue;
            }

            if (hasPosted(state, record.killmail_id, rule.id)) {
              debug(
                `Already posted ${record.killmail_id} for rule ${rule.id}`
              );
              continue;
            }

            const activity = await buildActivity(
              record,
              rule,
              location,
              participants,
              matchedParticipants
            );

            await postRuleWebhook(activity);

            markPosted(state, record.killmail_id, rule.id);
            saveState(state);

            console.log(
              `[POSTED] ${activity.killmailId} • ${rule.name} • ` +
                `${activity.systemName} • ` +
                `${activity.matchedParticipants.length} matched participant(s)`
            );
          }
        }
      } else {
        debug(
          `Skipped pre-activation killmail ${record.killmail_id} ` +
            `from ${record.esi.killmail_time}`
        );
      }

      state.nextSequence = sequenceId + 1;
      saveState(state);

      processedSinceReport += 1;

      if (processedSinceReport >= 100) {
        console.log(
          `[R2Z2] Processed through sequence ${sequenceId}; ` +
            `waiting for configured filter matches.`
        );
        processedSinceReport = 0;
      }

      await sleep(config.r2z2SuccessDelayMs);
    } catch (error) {
      console.error(
        `[ERROR] Sequence ${sequenceId}: ${error.message}`
      );

      /*
       * The sequence does not advance after a failure. Successfully sent
       * rules are stored immediately, so only the failed rule is retried.
       */
      await sleep(config.requestErrorDelayMs);
    }
  }
}

main().catch((error) => {
  console.error("[FATAL]", error);
  process.exitCode = 1;
});
