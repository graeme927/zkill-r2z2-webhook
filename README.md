## Matching behaviour

### Lists use OR matching

Entries within the same list use OR matching:

```env
FILTER_1_REGION_NAMES=Delve,Querious
```

This matches killmails in either Delve or Querious.

The same applies to lists of characters, corporations and alliances.

### Participant matching

Participant filters are:

- characters;
- corporations;
- alliances.

Their relationship is controlled by `PARTICIPANT_MATCH`.

#### ANY

`ANY` is the default:

```env
FILTER_1_CHARACTER_IDS=123
FILTER_1_CORPORATION_IDS=456
FILTER_1_PARTICIPANT_MATCH=ANY
```

This matches character `123` **or** any participant from corporation `456`.

#### ALL

With `ALL`, the same participant must satisfy every populated participant category:

```env
FILTER_1_CHARACTER_IDS=123
FILTER_1_CORPORATION_IDS=456
FILTER_1_PARTICIPANT_MATCH=ALL
```

This matches only when character `123` belonged to corporation `456` on the killmail.

### Region constraints

Region filters restrict the location of the killmail:

```env
FILTER_1_ALLIANCE_IDS=1354830081
FILTER_1_REGION_NAMES=Delve
```

This means:

> A victim or attacker from the selected alliance, in Delve.

A rule containing only a region filter matches every killmail in that region.

## Multiple webhooks

Every rule can have its own webhook:

```env
FILTER_1_WEBHOOK=https://discord.com/api/webhooks/AAA/AAA
FILTER_2_WEBHOOK=https://discord.com/api/webhooks/BBB/BBB
FILTER_3_WEBHOOK=https://discord.com/api/webhooks/CCC/CCC
```

When one killmail matches several rules, each matching rule sends a message to its configured webhook.

When several rules use the same webhook, that Discord channel receives one message for each matching rule.

## Using names or IDs

Names are resolved through ESI when the bot starts.

Examples:

```env
FILTER_1_CHARACTER_NAMES=Graeme Edwardson,MajorJenkins
FILTER_1_CORPORATION_NAMES=Corporation Name
FILTER_1_ALLIANCE_NAMES=Alliance Name
FILTER_1_REGION_NAMES=Delve,Querious
```

Names must be exact, although letter case is ignored.

IDs are recommended for long-running configurations because an EVE entity can change its name.

## Managing the container

View its status:

```bash
docker compose ps
```

Follow logs:

```bash
docker logs -f zkill-discord-bot
```

Show the most recent 100 log lines:

```bash
docker logs --tail 100 zkill-discord-bot
```

Restart the bot:

```bash
docker compose restart
```

Stop it:

```bash
docker compose down
```

Start it again:

```bash
docker compose up -d
```

## Changing filters

Edit `.env`:

```bash
nano .env
```

Recreate the container so the updated environment variables are loaded:

```bash
docker compose up -d --force-recreate
```

Follow the logs and confirm that the expected rules are listed:

```bash
docker logs -f zkill-discord-bot
```

A full image rebuild is not normally required for `.env` changes.

## Updating the bot

From the repository directory:

```bash
git pull
docker compose down
docker compose up -d --build --force-recreate
docker logs -f zkill-discord-bot
```

Do not delete `data/state.json` during a normal update.

The state file stores the current R2Z2 position and successfully delivered rule/killmail combinations. Keeping it prevents historical messages and duplicates after a restart or upgrade.

## Persistent state

Runtime state is stored in:

```text
data/state.json
```

The Docker Compose configuration mounts the local `data` directory into the container, so state survives container rebuilds and replacements.

Back it up with:

```bash
cp data/state.json data/state.json.backup
```

Restore it with:

```bash
cp data/state.json.backup data/state.json
docker compose restart
```

## Creating a fresh baseline

Use this only when you deliberately want the bot to forget its existing stream position and begin from the current R2Z2 position:

```bash
docker compose down
rm -f data/state.json
docker compose up -d --build --force-recreate
docker logs -f zkill-discord-bot
```

The bot will establish a new activation time and will not intentionally backfill older activity.

## Upgrading from version 2

The version 3 bot automatically migrates the existing version 2 `data/state.json`.

The existing R2Z2 sequence and activation time are retained, so upgrading should not produce a historical flood.

Do not remove `data/state.json` during the upgrade.

## Legacy single-webhook configuration

The older single-webhook configuration remains supported when no numbered `FILTER_n_WEBHOOK` variables are configured:

```env
DISCORD_WEBHOOK=https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
WATCH_CHARACTER_IDS=90783972,1906205970
WATCH_CHARACTER_NAMES=
```

Once any numbered filter webhook is present, numbered filter rules take precedence.

## Running without Docker

Docker is recommended, but the bot can also run directly with Node.js 22.

Install Node.js 22 and Git, then clone the repository:

```bash
git clone https://github.com/graeme927/zkill-r2z2-webhook.git
cd zkill-r2z2-webhook
```

Create and edit the configuration:

```bash
cp .env.example .env
nano .env
```

Install the production dependency:

```bash
npm install --omit=dev --no-audit --no-fund
```

Start the bot:

```bash
npm start
```

When running without Docker, use a process manager or system service if the bot must restart automatically after a crash or server reboot.

## Troubleshooting

### The container starts and immediately exits

Check the logs:

```bash
docker logs zkill-discord-bot
```

Common causes include:

- an invalid or missing webhook;
- no enabled filter rules;
- invalid IDs or names;
- a malformed `.env` value;
- an older file left over from a previous version.

### Changes to `.env` are not appearing

Recreate the container:

```bash
docker compose up -d --force-recreate
```

Confirm the loaded value when necessary:

```bash
docker exec zkill-discord-bot printenv FILTER_1_ENABLED
```

### Docker build is slow during npm install

Show detailed build output:

```bash
docker compose build --no-cache --progress=plain
```

Test npm connectivity from Docker:

```bash
docker run --rm node:22-alpine npm ping
```

The Dockerfile already disables npm audit and funding checks during the production install.

### Permission error for `data/state.json`

Ensure the data directory exists and is writable:

```bash
mkdir -p data
chmod u+rwx data
```

Then recreate the container:

```bash
docker compose up -d --force-recreate
```

Avoid using `chmod 777` unless it is only a temporary diagnostic measure.

### No Discord messages are appearing

Check that:

1. the rule is enabled;
2. its webhook is valid;
3. the filter actually matches the victim or an attacker;
4. region restrictions match the killmail location;
5. the bot has reached the live end of R2Z2;
6. the killmail occurred after the saved activation time.

Enable additional logging:

```env
DEBUG=true
```

Then recreate the container:

```bash
docker compose up -d --force-recreate
docker logs -f zkill-discord-bot
```

### Webhook messages appear more than once

Do not delete `data/state.json` during normal operation.

Also check whether several rules match the same activity and point to the same Discord webhook. Each matching rule is intentionally allowed to send its own message.

## Security

- Never commit `.env` to Git.
- Treat Discord webhook URLs as secrets.
- Regenerate a webhook immediately if it is exposed.
- Keep `data/state.json` out of public issue reports when it contains information you do not want to share.
- Keep Docker and the host operating system updated.

## Uninstall

Stop and remove the container and network:

```bash
docker compose down
```

Remove the project:

```bash
cd ..
rm -rf zkill-r2z2-webhook
```

Docker images can be removed separately when no longer required:

```bash
docker image prune
```

## Notes

- R2Z2 can publish an older killmail that was newly submitted to zKillboard.
- The bot rejects killmails whose EVE kill time predates its saved activation time.
- Successfully delivered rule/killmail combinations are saved before processing continues.
- If one webhook fails, successful webhook deliveries are not duplicated when the sequence is retried.
- A character's ship is shown when the full killmail supplies a ship type for that participant.

## Disclaimer

This project is an independent community tool and is not affiliated with CCP Games or zKillboard.
