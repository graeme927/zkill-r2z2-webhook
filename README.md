# zKill R2Z2 Multi-Filter Discord Bot

Consumes zKillboard's R2Z2 stream and routes matching EVE Online killmails to one or more Discord webhooks.

Supported filters:

- character ID or exact character name;
- corporation ID or exact corporation name;
- alliance ID or exact alliance name;
- region ID or exact region name;
- multiple independent rules, each with a separate webhook.

The bot examines the victim and every attacker, so it detects losses, final blows and assists.

## Rule format

Rules are numbered in `.env`:

```env
FILTER_1_NAME=Tracked Pilots
FILTER_1_WEBHOOK=https://discord.com/api/webhooks/...
FILTER_1_CHARACTER_IDS=90783972,1906205970

FILTER_2_NAME=Delve Activity
FILTER_2_WEBHOOK=https://discord.com/api/webhooks/...
FILTER_2_REGION_NAMES=Delve

FILTER_3_NAME=Alliance in Delve
FILTER_3_WEBHOOK=https://discord.com/api/webhooks/...
FILTER_3_ALLIANCE_IDS=YOUR_ALLIANCE_ID
FILTER_3_REGION_NAMES=Delve
```

Add further rules as `FILTER_4_*`, `FILTER_5_*`, and so on. Rule numbers do not need to be consecutive.

## Matching behaviour

Each rule sends at most one Discord message for a given killmail.

Within an individual ID or name list, entries use **OR** matching. For example:

```env
FILTER_1_REGION_NAMES=Delve,Querious
```

matches either region.

Region filters always act as a location constraint. A rule containing an alliance and a region therefore means:

> A victim or attacker from this alliance, in this region.

Participant filters are character, corporation and alliance filters. Their relationship is controlled by:

```env
FILTER_1_PARTICIPANT_MATCH=ANY
```

`ANY` is the default. A participant can match any populated participant category.

```env
FILTER_1_CHARACTER_IDS=123
FILTER_1_CORPORATION_IDS=456
FILTER_1_PARTICIPANT_MATCH=ANY
```

matches character `123` or anyone from corporation `456`.

With `ALL`, the same participant must satisfy every populated participant category:

```env
FILTER_1_CHARACTER_IDS=123
FILTER_1_CORPORATION_IDS=456
FILTER_1_PARTICIPANT_MATCH=ALL
```

matches only when character `123` was in corporation `456` on that killmail.

A rule containing only a region filter matches every killmail in that region.

## Multiple webhooks

Each rule has its own webhook:

```env
FILTER_1_WEBHOOK=https://discord.com/api/webhooks/AAA/AAA
FILTER_2_WEBHOOK=https://discord.com/api/webhooks/BBB/BBB
FILTER_3_WEBHOOK=https://discord.com/api/webhooks/CCC/CCC
```

When one killmail matches several rules, each matching rule sends to its configured webhook. If several rules point to the same webhook, that channel receives one message from each matching rule.

## Setup

```bash
cp .env.example .env
nano .env

docker compose up -d --build --force-recreate
docker logs -f zkill-discord-bot
```

## Upgrading from version 2

The existing `data/state.json` is automatically migrated. The current R2Z2 sequence and activation time are retained, so upgrading does not create a historical flood.

Do not delete `data/state.json` during a normal upgrade.

## Fresh baseline

To intentionally ignore everything before a new activation point:

```bash
docker compose down
rm -f data/state.json
docker compose up -d --build --force-recreate
docker logs -f zkill-discord-bot
```

## Legacy configuration

The previous single-webhook configuration remains supported when no `FILTER_n_WEBHOOK` variables exist:

```env
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
WATCH_CHARACTER_IDS=90783972,1906205970
WATCH_CHARACTER_NAMES=
```

Once any numbered filter webhook is present, numbered rules take precedence.

## Notes

- Names are resolved through ESI during startup and must match the EVE entity name exactly, ignoring letter case.
- IDs are preferred for long-term configuration because names can change.
- R2Z2 can publish an old killmail newly submitted to zKillboard. The bot still rejects killmails whose EVE kill time predates the bot's saved activation time.
- Successfully delivered rule/killmail combinations are stored before processing continues. If one webhook fails, successful webhooks are not duplicated when the sequence is retried.
