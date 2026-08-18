# zKill R2Z2 Discord Webhook Bot

A small Docker bot that watches the live zKillboard R2Z2 feed and sends matching killmails to Discord.

You can track:

- specific characters;
- corporations;
- alliances;
- regions;
- **kills only**, **losses only**, or **both**;
- multiple completely separate filters, each with its own Discord webhook.

The bot also remembers where it is in the R2Z2 stream, so restarts do not normally cause duplicate or historical posts.

---

## Quick start

If Docker is already installed, this is the whole install:

```bash
git clone https://github.com/graeme927/zkill-r2z2-webhook.git
cd zkill-r2z2-webhook

cp .env.example .env
nano .env

mkdir -p data

docker compose up -d --build
docker logs -f zkill-discord-bot
```

The important part is the `.env` file. That is where you tell the bot **what to watch** and **where to post it**.

---

# 1. What you need

You need:

- a Linux server or VPS;
- Git;
- Docker and Docker Compose;
- at least one Discord webhook.

You **do not** need to install Node.js or run `npm install` yourself when using Docker.

### Installing Docker on Ubuntu/Debian

If Docker is not already installed:

```bash
sudo apt update
sudo apt install -y git curl

curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker

sudo usermod -aG docker $USER
```

Log out and back in after the last command.

Then check:

```bash
docker --version
docker compose version
```

---

# 2. Download the bot

```bash
git clone https://github.com/graeme927/zkill-r2z2-webhook.git
cd zkill-r2z2-webhook
```

Create your private configuration:

```bash
cp .env.example .env
nano .env
```

Never put your real Discord webhook in `.env.example`. Use `.env`.

---

# 3. Create your first filter

A filter is simply a numbered block in `.env`.

This example watches two characters and posts **both their kills and losses**:

```env
FILTER_1_NAME=Tracked Pilots
FILTER_1_ENABLED=true
FILTER_1_WEBHOOK=https://discord.com/api/webhooks/YOUR_WEBHOOK

FILTER_1_ACTIVITY=BOTH
FILTER_1_PARTICIPANT_MATCH=ANY

FILTER_1_CHARACTER_IDS=90783972,1906205970
FILTER_1_CHARACTER_NAMES=

FILTER_1_CORPORATION_IDS=
FILTER_1_CORPORATION_NAMES=

FILTER_1_ALLIANCE_IDS=
FILTER_1_ALLIANCE_NAMES=

FILTER_1_REGION_IDS=
FILTER_1_REGION_NAMES=
```

That is enough for a working character tracker.

---

# 4. Choose kills, losses, or both

Each filter now has:

```env
FILTER_1_ACTIVITY=BOTH
```

Valid options are:

| Value | What it means |
|---|---|
| `BOTH` | Show the tracked entity as an attacker **or** victim |
| `KILLS` | Only show killmails where the tracked entity is an attacker |
| `LOSSES` | Only show killmails where the tracked entity is the victim |

### Example: losses only

```env
FILTER_2_NAME=Titan Loss Watch
FILTER_2_ENABLED=true
FILTER_2_WEBHOOK=https://discord.com/api/webhooks/YOUR_WEBHOOK

FILTER_2_ACTIVITY=LOSSES
FILTER_2_PARTICIPANT_MATCH=ANY

FILTER_2_CHARACTER_IDS=CHARACTER_ID_1,CHARACTER_ID_2
```

### Example: alliance kills only

```env
FILTER_3_NAME=Alliance Kills
FILTER_3_ENABLED=true
FILTER_3_WEBHOOK=https://discord.com/api/webhooks/YOUR_WEBHOOK

FILTER_3_ACTIVITY=KILLS
FILTER_3_PARTICIPANT_MATCH=ANY

FILTER_3_ALLIANCE_IDS=ALLIANCE_ID
```

`KILLS` includes both final blows and assists. If the tracked entity appears anywhere on the attacker side of the killmail, it matches.

---

# 5. Other things you can track

You can use IDs or exact names.

IDs are recommended for permanent rules because names can change.

## Character

```env
FILTER_1_CHARACTER_IDS=90783972,1906205970
```

or:

```env
FILTER_1_CHARACTER_NAMES=Graeme Edwardson,MajorJenkins
```

## Corporation

```env
FILTER_1_CORPORATION_IDS=CORPORATION_ID
```

or:

```env
FILTER_1_CORPORATION_NAMES=Corporation Name
```

## Alliance

```env
FILTER_1_ALLIANCE_IDS=ALLIANCE_ID
```

or:

```env
FILTER_1_ALLIANCE_NAMES=Alliance Name
```

## Region

```env
FILTER_1_REGION_NAMES=Delve
```

Multiple values are comma separated:

```env
FILTER_1_REGION_NAMES=Delve,Querious
```

A region can be used to narrow another filter.

For example, this means:

> Show kills involving this alliance, but only in Delve.

```env
FILTER_1_ACTIVITY=KILLS
FILTER_1_ALLIANCE_IDS=ALLIANCE_ID
FILTER_1_REGION_NAMES=Delve
```

A **region-only** rule watches all killmails in that region, so it must use:

```env
FILTER_1_ACTIVITY=BOTH
```

---

# 6. Multiple filters and multiple webhooks

Add as many numbered filters as you need:

```env
FILTER_1_...
FILTER_2_...
FILTER_3_...
```

Each one can have a completely different webhook.

Example:

```env
# Characters -> one Discord channel
FILTER_1_NAME=Pilot Watchlist
FILTER_1_ENABLED=true
FILTER_1_WEBHOOK=https://discord.com/api/webhooks/AAA/AAA
FILTER_1_ACTIVITY=BOTH
FILTER_1_CHARACTER_IDS=90783972,1906205970

# Alliance losses -> another Discord channel
FILTER_2_NAME=Alliance Losses
FILTER_2_ENABLED=true
FILTER_2_WEBHOOK=https://discord.com/api/webhooks/BBB/BBB
FILTER_2_ACTIVITY=LOSSES
FILTER_2_ALLIANCE_IDS=ALLIANCE_ID

# Corp kills in Delve -> a third Discord channel
FILTER_3_NAME=Delve Corp Kills
FILTER_3_ENABLED=true
FILTER_3_WEBHOOK=https://discord.com/api/webhooks/CCC/CCC
FILTER_3_ACTIVITY=KILLS
FILTER_3_CORPORATION_IDS=CORPORATION_ID
FILTER_3_REGION_NAMES=Delve
```

If the same killmail matches two different filters, both filters can send a message.

---

# 7. What does PARTICIPANT_MATCH do?

For most setups, leave this as:

```env
FILTER_1_PARTICIPANT_MATCH=ANY
```

### ANY

If you configure both:

```env
FILTER_1_CHARACTER_IDS=123
FILTER_1_CORPORATION_IDS=456
```

then `ANY` means:

> character 123 **OR** anyone from corporation 456.

### ALL

```env
FILTER_1_PARTICIPANT_MATCH=ALL
```

means the **same person** must satisfy every populated participant filter.

For example:

```env
FILTER_1_CHARACTER_IDS=123
FILTER_1_CORPORATION_IDS=456
FILTER_1_PARTICIPANT_MATCH=ALL
```

means:

> character 123, but only while they are in corporation 456.

If you are unsure, use `ANY`.

---

# 8. Start the bot

Create the persistent data directory:

```bash
mkdir -p data
```

Build and start:

```bash
docker compose up -d --build
```

Watch the logs:

```bash
docker logs -f zkill-discord-bot
```

A healthy startup looks similar to:

```text
===================================
zKILL R2Z2 MULTI-FILTER BOT
Rules: 2
  [1] MJ Tracking: 2 character(s) (participant ANY, activity BOTH)
  [2] Titan Loss Watch: 8 character(s) (participant ANY, activity LOSSES)
Next sequence: 98970000
===================================
```

When caught up:

```text
[WAIT] No sequence 98970000 yet; waiting for new killmails.
```

When something matches:

```text
[POSTED] 137100000 • MJ Tracking • Turnur • 2 matched participant(s)
```

Press `Ctrl+C` to stop viewing the logs. The bot keeps running.

---

# 9. Discord message behaviour

The embed includes:

- filter name;
- system and region;
- kill value;
- victim;
- ship lost;
- final blow;
- matched tracked participants;
- the ship each matched participant was flying;
- a zKillboard link.

The image in the top-right uses the ship flown by the **first matched participant**.

If no participant is available, such as a region-only rule, it falls back to the victim's ship.

---

# 10. Changing a filter

Edit:

```bash
nano .env
```

Then recreate the container so it reloads `.env`:

```bash
docker compose up -d --force-recreate
```

You do not normally need a full rebuild just for `.env` changes.

Check the loaded rules:

```bash
docker logs -f zkill-discord-bot
```

---

# 11. Updating the bot

From the project directory:

```bash
git pull
docker compose up -d --build --force-recreate
docker logs -f zkill-discord-bot
```

**Do not delete `data/state.json` when updating.**

That file remembers where the bot is in R2Z2 and which filter/killmail combinations have already been posted.

---

# 12. Updating an existing install manually

If you downloaded a ZIP instead of using `git pull`:

1. Stop the bot:

   ```bash
   docker compose down
   ```

2. Keep these two things from your existing install:

   ```text
   .env
   data/state.json
   ```

3. Replace the project files with the new version.

4. Put your existing `.env` and `data/state.json` back.

5. Rebuild:

   ```bash
   docker compose up -d --build --force-recreate
   ```

6. Check the logs:

   ```bash
   docker logs -f zkill-discord-bot
   ```

Older `.env` files continue to work because `FILTER_n_ACTIVITY` defaults to `BOTH` when it is missing.

---

# 13. Useful commands

### Check status

```bash
docker compose ps
```

### View logs

```bash
docker logs -f zkill-discord-bot
```

### Last 100 log lines

```bash
docker logs --tail 100 zkill-discord-bot
```

### Restart

```bash
docker compose restart
```

### Stop

```bash
docker compose down
```

### Start

```bash
docker compose up -d
```

---

# 14. Resetting the bot

Normally, **do not do this**.

If you deliberately want a completely fresh R2Z2 starting point:

```bash
docker compose down
rm -f data/state.json
docker compose up -d --build
docker logs -f zkill-discord-bot
```

Deleting `state.json` makes the bot forget its previous stream position and posted-message history.

---

# 15. Troubleshooting

## Container immediately exits

```bash
docker logs zkill-discord-bot
```

Common causes:

- webhook missing or invalid;
- no enabled filters;
- typo in an EVE name;
- invalid ID;
- invalid `FILTER_n_ACTIVITY`;
- malformed `.env`.

## `.env` change did nothing

Recreate the container:

```bash
docker compose up -d --force-recreate
```

## Docker permission denied

```bash
sudo usermod -aG docker $USER
```

Then log out and back in.

## Docker build hangs around npm

This version uses the public npm registry in `package-lock.json` and `npm ci`.

To see detailed build output:

```bash
docker compose build --no-cache --progress=plain
```

Test npm from Docker:

```bash
docker run --rm node:22-alpine npm ping
```

## No Discord messages

Temporarily enable:

```env
DEBUG=true
```

Then:

```bash
docker compose up -d --force-recreate
docker logs -f zkill-discord-bot
```

Also check that the rule's `ACTIVITY` is what you intended:

```env
BOTH
KILLS
LOSSES
```

---

# 16. Full filter template

Copy this block when adding another rule:

```env
FILTER_4_NAME=My New Filter
FILTER_4_ENABLED=true
FILTER_4_WEBHOOK=https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN

FILTER_4_ACTIVITY=BOTH
FILTER_4_PARTICIPANT_MATCH=ANY

FILTER_4_CHARACTER_IDS=
FILTER_4_CHARACTER_NAMES=

FILTER_4_CORPORATION_IDS=
FILTER_4_CORPORATION_NAMES=

FILTER_4_ALLIANCE_IDS=
FILTER_4_ALLIANCE_NAMES=

FILTER_4_REGION_IDS=
FILTER_4_REGION_NAMES=
```

At least one character, corporation, alliance, or region filter must contain something.

---

## Credits

Uses:

- zKillboard R2Z2;
- EVE Online ESI;
- Discord webhooks;
- Node.js;
- Docker.

This is an independent community project and is not affiliated with CCP Games, Discord, or zKillboard.
