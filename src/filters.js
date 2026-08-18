export function buildParticipants(record) {
  const participants = [];
  const victim = record?.esi?.victim;

  if (victim) {
    participants.push({
      side: "VICTIM",
      activityType: "LOSS",
      characterId: Number(victim.character_id || 0),
      corporationId: Number(victim.corporation_id || 0),
      allianceId: Number(victim.alliance_id || 0),
      shipTypeId: Number(victim.ship_type_id || 0),
      finalBlow: false
    });
  }

  for (const attacker of Array.isArray(record?.esi?.attackers)
    ? record.esi.attackers
    : []) {
    participants.push({
      side: "ATTACKER",
      activityType: attacker?.final_blow ? "FINAL BLOW" : "ASSIST",
      characterId: Number(attacker?.character_id || 0),
      corporationId: Number(attacker?.corporation_id || 0),
      allianceId: Number(attacker?.alliance_id || 0),
      shipTypeId: Number(attacker?.ship_type_id || 0),
      finalBlow: Boolean(attacker?.final_blow)
    });
  }

  return participants;
}

export function activityMatchesRule(participant, rule) {
  if (rule.activity === "KILLS") {
    return participant.side === "ATTACKER";
  }

  if (rule.activity === "LOSSES") {
    return participant.side === "VICTIM";
  }

  return true;
}

export function participantMatchesRule(participant, rule) {
  if (!activityMatchesRule(participant, rule)) {
    return false;
  }

  const tests = [];

  if (rule.characterIdSet.size > 0) {
    tests.push(rule.characterIdSet.has(participant.characterId));
  }

  if (rule.corporationIdSet.size > 0) {
    tests.push(rule.corporationIdSet.has(participant.corporationId));
  }

  if (rule.allianceIdSet.size > 0) {
    tests.push(rule.allianceIdSet.has(participant.allianceId));
  }

  if (tests.length === 0) {
    return false;
  }

  return rule.participantMatch === "ALL"
    ? tests.every(Boolean)
    : tests.some(Boolean);
}

export function findRuleCandidates(participants, rules) {
  return rules
    .map((rule) => ({
      rule,
      matchedParticipants: rule.hasParticipantFilters
        ? participants.filter((participant) =>
            participantMatchesRule(participant, rule)
          )
        : []
    }))
    .filter(
      ({ rule, matchedParticipants }) =>
        !rule.hasParticipantFilters || matchedParticipants.length > 0
    );
}
