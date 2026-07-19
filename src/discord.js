import config from "./config.js";

function truncate(value, maximum = 1024) {
  const text = String(value ?? "Unknown");
  return text.length <= maximum
    ? text
    : `${text.slice(0, maximum - 3)}...`;
}

function formatIsk(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Unknown";
  }

  return `${Math.round(amount).toLocaleString("en-GB")} ISK`;
}

function activityLabel(activityType) {
  if (activityType === "LOSS") {
    return "Loss";
  }

  if (activityType === "FINAL BLOW") {
    return "Final blow";
  }

  return "Assist";
}

function characterText(participant) {
  if (!participant) {
    return "Unknown";
  }

  if (!participant.characterId) {
    return participant.characterName;
  }

  return (
    `[${participant.characterName}]` +
    `(https://zkillboard.com/character/${participant.characterId}/)`
  );
}

function participantLine(participant) {
  const organisation = participant.allianceId
    ? `${participant.corporationName} / ${participant.allianceName}`
    : participant.corporationName;

  return (
    `• ${characterText(participant)} — ` +
    `${activityLabel(participant.activityType)} — ` +
    `${participant.shipName}\n  ${organisation}`
  );
}

function formatMatchedParticipants(participants) {
  if (!Array.isArray(participants) || participants.length === 0) {
    return null;
  }

  const maximumShown = 12;
  const shown = participants.slice(0, maximumShown);
  let value = shown.map(participantLine).join("\n");

  if (participants.length > maximumShown) {
    value += `\n• …and ${participants.length - maximumShown} more`;
  }

  return truncate(value);
}

function embedColour(activity) {
  if (
    activity.matchedParticipants.some(
      (participant) => participant.activityType === "LOSS"
    )
  ) {
    return 0xd83c3e;
  }

  if (
    activity.matchedParticipants.some(
      (participant) => participant.activityType === "FINAL BLOW"
    )
  ) {
    return 0xf1c40f;
  }

  if (activity.matchedParticipants.length > 0) {
    return 0x3ba55d;
  }

  return 0x3498db;
}

export async function postRuleWebhook(activity) {
  const webhookUrl = new URL(activity.rule.webhook);
  webhookUrl.searchParams.set("wait", "true");

  const zkillUrl = `https://zkillboard.com/kill/${activity.killmailId}/`;
  const singleMatchedCharacter =
    activity.matchedParticipants.length === 1 &&
    activity.matchedParticipants[0].characterId
      ? activity.matchedParticipants[0]
      : null;

  const title = singleMatchedCharacter
    ? `${singleMatchedCharacter.characterName} is active in ` +
      activity.systemName
    : `${activity.rule.name}: activity in ${activity.systemName}`;

  const fields = [
    {
      name: "Filter",
      value: truncate(activity.rule.name),
      inline: true
    },
    {
      name: "Location",
      value:
        `${truncate(activity.systemName, 500)}\n` +
        `${truncate(activity.regionName, 500)}`,
      inline: true
    },
    {
      name: "Kill value",
      value: formatIsk(activity.totalValue),
      inline: true
    },
    {
      name: "Victim",
      value: characterText(activity.victim),
      inline: true
    },
    {
      name: "Ship lost",
      value: truncate(activity.victim?.shipName || "Unknown"),
      inline: true
    },
    {
      name: "Final blow",
      value: activity.finalBlow
        ? `${characterText(activity.finalBlow)}\n${activity.finalBlow.shipName}`
        : "Not supplied",
      inline: true
    }
  ];

  const matchedText = formatMatchedParticipants(
    activity.matchedParticipants
  );

  if (matchedText) {
    fields.push({
      name:
        activity.matchedParticipants.length === 1
          ? "Matched participant"
          : `Matched participants (${activity.matchedParticipants.length})`,
      value: matchedText,
      inline: false
    });
  }

  const embed = {
    title: truncate(title, 256),
    url: zkillUrl,
    color: embedColour(activity),
    description: `[View killmail on zKillboard](${zkillUrl})`,
    fields,
    footer: {
      text:
        `${activity.rule.name} • Killmail ${activity.killmailId} • ` +
        `R2Z2 sequence ${activity.sequenceId}`
    },
    timestamp: new Date(activity.killmailTime).toISOString()
  };

  if (
    Number.isSafeInteger(activity.thumbnailTypeId) &&
    activity.thumbnailTypeId > 0
  ) {
    embed.thumbnail = {
      url:
        `https://images.evetech.net/types/` +
        `${activity.thumbnailTypeId}/render?size=128`
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": config.userAgent
    },
    body: JSON.stringify({
      username: truncate(`zKill • ${activity.rule.name}`, 80),
      allowed_mentions: { parse: [] },
      embeds: [embed]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Discord returned HTTP ${response.status}: ${body.slice(0, 500)}`
    );
  }

  return response.json().catch(() => null);
}
