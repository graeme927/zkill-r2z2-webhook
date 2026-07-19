# zKill R2Z2 Discord Webhook Bot

A lightweight Discord webhook service that monitors the zKillboard R2Z2 killmail stream and posts filtered EVE Online activity directly into Discord.

Supports:

- Character filtering
- Corporation filtering
- Alliance filtering
- Region filtering
- Multiple filter rules
- Different Discord webhooks for different rules
- Loss, final blow and assist detection
- Persistent duplicate prevention
- Docker deployment
- Clean Discord embeds

---

# Features

- Reads the live zKillboard R2Z2 killmail stream
- Checks the victim and every attacker
- Detects losses, final blows and assists
- Filters by character, corporation, alliance and region
- Supports multiple independent filter rules
- Sends each filter rule to its own Discord webhook
- Prevents duplicate posts across restarts
- Resolves names, ships, systems and regions through ESI
- Saves the current stream position in `data/state.json`
- Docker-first deployment

---

# Requirements

- A Linux server or VPS
- Git
- Docker
- Docker Compose
- A Discord webhook URL

You do not need to install Node.js or run `npm install` manually when using Docker.

---

# Installation

## 1. Install Git and Docker

Update the server:

```bash
sudo apt update
sudo apt upgrade -y
```

Install Git and curl:

```bash
sudo apt install -y git curl
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Enable Docker:

```bash
sudo systemctl enable --now docker
```

Add your user to the Docker group:

```bash
sudo usermod -aG docker $USER
```

Log out and reconnect so the group change takes effect:

```bash
exit
```

After reconnecting, confirm Docker is installed:

```bash
docker --version
docker compose version
```

---

## 2. Clone the Repository

```bash
git clone https://github.com/graeme927/zkill-r2z2-webhook.git
```

Move into the project directory:

```bash
cd zkill-r2z2-webhook
```

---

## 3. Configure the Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit it:

```bash
nano .env
```

A basic character filter looks like this:

```env
FILTER_1_NAME=Tracked Pilots
FILTER_1_ENABLED=true
FILTER_1_WEBHOOK=https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
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

Set a descriptive user agent near the bottom of the file:

```env
USER_AGENT=My-zKill-R2Z2-Bot/3.0 contact@example.com
```

The remaining defaults can normally stay unchanged:

```env
ESI_COMPATIBILITY_DATE=
R2Z2_SUCCESS_DELAY_MS=100
R2Z2_IDLE_DELAY_MS=6000
REQUEST_ERROR_DELAY_MS=15000
DEBUG=false
```

Save and close nano:

```text
Ctrl+O
Enter
Ctrl+X
```

Do not add spaces around the `=` sign.

Correct:

```env
FILTER_1_ENABLED=true
```

Incorrect:

```env
FILTER_1_ENABLED = true
```

---

## 4. Create the Data Directory

```bash
mkdir -p data
```

The bot stores its persistent state in:

```text
data/state.json
```

---

## 5. Build and Start

```bash
docker compose up --build -d
```

The Docker image installs the required Node dependency automatically.

You do not need to run:

```bash
npm install
```

---

## 6. View the Logs

```bash
docker logs -f zkill-discord-bot
```

A successful startup should look similar to:

```text
===================================
zKILL R2Z2 MULTI-FILTER BOT
Rules: 1
  [1] Tracked Pilots: 2 character(s) (participant ANY)
Next sequence: 123456789
===================================
```

When the bot reaches the live end of the stream:

```text
[WAIT] No sequence 123456789 yet; waiting for new killmails.
```

When a filter matches:

```text
[POSTED] ASSIST 137100000 • MajorJenkins in C-J6MT • Harpy
```

Press `Ctrl+C` to stop following the logs.

The container continues running.

---

# Creating a Discord Webhook

In Discord:

1. Open the channel where messages should be posted.
2. Open **Edit Channel**.
3. Open **Integrations**.
4. Open **Webhooks**.
5. Create a new webhook.
6. Copy the webhook URL.
7. Paste it into `FILTER_n_WEBHOOK`.

Example:

```env
FILTER_1_WEBHOOK=https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
```

Treat webhook URLs as passwords.

---

# Environment Variables

## Filter Variables

| Variable | Required | Description |
|---|---:|---|
| `FILTER_n_NAME` | Yes | Name shown for the rule |
| `FILTER_n_ENABLED` | Yes | Enables or disables the rule |
| `FILTER_n_WEBHOOK` | Yes | Discord webhook for the rule |
| `FILTER_n_PARTICIPANT_MATCH` | No | `ANY` or `ALL` |
| `FILTER_n_CHARACTER_IDS` | No | Comma-separated character IDs |
| `FILTER_n_CHARACTER_NAMES` | No | Comma-separated character names |
| `FILTER_n_CORPORATION_IDS` | No | Comma-separated corporation IDs |
| `FILTER_n_CORPORATION_NAMES` | No | Comma-separated corporation names |
| `FILTER_n_ALLIANCE_IDS` | No | Comma-separated alliance IDs |
| `FILTER_n_ALLIANCE_NAMES` | No | Comma-separated alliance names |
| `FILTER_n_REGION_IDS` | No | Comma-separated region IDs |
| `FILTER_n_REGION_NAMES` | No | Comma-separated region names |

Replace `n` with the rule number:

```env
FILTER_1_NAME=Tracked Pilots
FILTER_2_NAME=Delve Activity
FILTER_3_NAME=Alliance Activity
```

Rule numbers do not need to be consecutive.

---

## Service Variables

| Variable | Required | Default | Description |
|---|---:|---:|---|
| `USER_AGENT` | Yes | — | Identifies the bot |
| `ESI_COMPATIBILITY_DATE` | No | Empty | Optional ESI compatibility date |
| `R2Z2_SUCCESS_DELAY_MS` | No | `100` | Delay between successful stream requests |
| `R2Z2_IDLE_DELAY_MS` | No | `6000` | Delay when no new sequence exists |
| `REQUEST_ERROR_DELAY_MS` | No | `15000` | Delay after a request error |
| `DEBUG` | No | `false` | Enables additional logging |

---

# Filter Examples

## Character Filter

```env
FILTER_1_NAME=Tracked Pilots
FILTER_1_ENABLED=true
FILTER_1_WEBHOOK=https://discord.com/api/webhooks/AAA/AAA
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

---

## Corporation Filter

```env
FILTER_2_NAME=Corporation Activity
FILTER_2_ENABLED=true
FILTER_2_WEBHOOK=https://discord.com/api/webhooks/BBB/BBB
FILTER_2_PARTICIPANT_MATCH=ANY

FILTER_2_CHARACTER_IDS=
FILTER_2_CHARACTER_NAMES=

FILTER_2_CORPORATION_IDS=CORPORATION_ID
FILTER_2_CORPORATION_NAMES=

FILTER_2_ALLIANCE_IDS=
FILTER_2_ALLIANCE_NAMES=

FILTER_2_REGION_IDS=
FILTER_2_REGION_NAMES=
```

---

## Alliance Filter

```env
FILTER_3_NAME=Alliance Activity
FILTER_3_ENABLED=true
FILTER_3_WEBHOOK=https://discord.com/api/webhooks/CCC/CCC
FILTER_3_PARTICIPANT_MATCH=ANY

FILTER_3_CHARACTER_IDS=
FILTER_3_CHARACTER_NAMES=

FILTER_3_CORPORATION_IDS=
FILTER_3_CORPORATION_NAMES=

FILTER_3_ALLIANCE_IDS=ALLIANCE_ID
FILTER_3_ALLIANCE_NAMES=

FILTER_3_REGION_IDS=
FILTER_3_REGION_NAMES=
```

---

## Region Filter

```env
FILTER_4_NAME=Regional Activity
FILTER_4_ENABLED=true
FILTER_4_WEBHOOK=https://discord.com/api/webhooks/DDD/DDD
FILTER_4_PARTICIPANT_MATCH=ANY

FILTER_4_CHARACTER_IDS=
FILTER_4_CHARACTER_NAMES=

FILTER_4_CORPORATION_IDS=
FILTER_4_CORPORATION_NAMES=

FILTER_4_ALLIANCE_IDS=
FILTER_4_ALLIANCE_NAMES=

FILTER_4_REGION_IDS=
FILTER_4_REGION_NAMES=Delve,Querious
```

---

## Alliance Activity in Delve

```env
FILTER_5_NAME=Alliance Activity in Delve
FILTER_5_ENABLED=true
FILTER_5_WEBHOOK=https://discord.com/api/webhooks/EEE/EEE
FILTER_5_PARTICIPANT_MATCH=ANY

FILTER_5_CHARACTER_IDS=
FILTER_5_CHARACTER_NAMES=

FILTER_5_CORPORATION_IDS=
FILTER_5_CORPORATION_NAMES=

FILTER_5_ALLIANCE_IDS=ALLIANCE_ID
FILTER_5_ALLIANCE_NAMES=

FILTER_5_REGION_IDS=
FILTER_5_REGION_NAMES=Delve
```

---

# Matching Behaviour

## Lists Use OR Matching

```env
FILTER_1_REGION_NAMES=Delve,Querious
```

This matches Delve or Querious.

The same applies to character, corporation and alliance lists.

---

## Participant Match: ANY

```env
FILTER_1_CHARACTER_IDS=123
FILTER_1_CORPORATION_IDS=456
FILTER_1_PARTICIPANT_MATCH=ANY
```

This matches:

- character `123`; or
- any victim or attacker from corporation `456`.

---

## Participant Match: ALL

```env
FILTER_1_CHARACTER_IDS=123
FILTER_1_CORPORATION_IDS=456
FILTER_1_PARTICIPANT_MATCH=ALL
```

This matches only when the same participant:

- is character `123`; and
- belongs to corporation `456`.

---

## Region Filters

Region filters restrict the location of the rule.

```env
FILTER_1_ALLIANCE_IDS=1354830081
FILTER_1_REGION_NAMES=Delve
```

This matches activity involving the alliance, but only in Delve.

A rule containing only a region filter matches every killmail in that region.

---

# Multiple Webhooks

Each filter can use a different webhook:

```env
FILTER_1_WEBHOOK=https://discord.com/api/webhooks/AAA/AAA
FILTER_2_WEBHOOK=https://discord.com/api/webhooks/BBB/BBB
FILTER_3_WEBHOOK=https://discord.com/api/webhooks/CCC/CCC
```

When one killmail matches several rules, each matching rule sends a message to its own webhook.

If several matching rules use the same webhook, that channel receives one message from each matching rule.

---

# Running

Build and start:

```bash
docker compose up --build -d
```

View logs:

```bash
docker logs -f zkill-discord-bot
```

Stop:

```bash
docker compose down
```

Restart:

```bash
docker compose restart
```

Check status:

```bash
docker compose ps
```

---

# Changing Filters

Edit `.env`:

```bash
nano .env
```

Recreate the container:

```bash
docker compose up -d --force-recreate
```

Check the logs:

```bash
docker logs -f zkill-discord-bot
```

A full rebuild is not normally required for `.env` changes.

---

# Updating

Move into the project directory:

```bash
cd zkill-r2z2-webhook
```

Pull the latest code:

```bash
git pull
```

Rebuild and recreate:

```bash
docker compose up --build -d --force-recreate
```

View the logs:

```bash
docker logs -f zkill-discord-bot
```

Do not delete `data/state.json` during a normal update.

---

# Data Persistence

State is stored in:

```text
data/state.json
```

This contains:

- the current R2Z2 sequence;
- the activation time;
- delivered rule and killmail combinations.

The `data` directory is mounted into the container, so state survives rebuilds.

Delete the state only when deliberately resetting the bot.

---

# Resetting

Stop the bot:

```bash
docker compose down
```

Delete the state:

```bash
rm -f data/state.json
```

Start again:

```bash
docker compose up --build -d
```

View the logs:

```bash
docker logs -f zkill-discord-bot
```

This creates a new baseline at the current R2Z2 position.

---

# Project Structure

```text
.
├── src/
│   ├── config.js
│   ├── discord.js
│   ├── esi.js
│   ├── filters.js
│   ├── index.js
│   ├── r2z2.js
│   └── state.js
│
├── data/
│   └── state.json
│
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── .env.example
└── README.md
```

---

# Running Without Docker

Docker is recommended.

To run directly, install Node.js 22 and then:

```bash
git clone https://github.com/graeme927/zkill-r2z2-webhook.git
cd zkill-r2z2-webhook
cp .env.example .env
nano .env
npm install --omit=dev --no-audit --no-fund
npm start
```

---

# Troubleshooting

## Docker Permission Error

```bash
sudo usermod -aG docker $USER
```

Log out and reconnect.

---

## Container Exits Immediately

```bash
docker logs zkill-discord-bot
```

Check for:

- missing webhook;
- no enabled filter;
- invalid `.env` formatting;
- invalid EVE IDs or names.

---

## `.env` Changes Are Not Loading

```bash
docker compose up -d --force-recreate
```

---

## Docker Build Is Slow

```bash
docker compose build --no-cache --progress=plain
```

Test npm from Docker:

```bash
docker run --rm node:22-alpine npm ping
```

---

## State File Permission Error

```bash
mkdir -p data
chmod u+rwx data
docker compose up -d --force-recreate
```

---

## No Discord Messages

Check:

- the filter is enabled;
- the webhook is valid;
- the participant matches the rule;
- the region restriction matches;
- the bot is at the live R2Z2 position;
- the killmail happened after activation.

Enable debug logging:

```env
DEBUG=true
```

Recreate and inspect:

```bash
docker compose up -d --force-recreate
docker logs -f zkill-discord-bot
```

---

## Duplicate Messages

Do not delete:

```text
data/state.json
```

Also check whether several enabled filters match the same killmail and use the same webhook.

---

# Credits

Built using:

- zKillboard R2Z2
- EVE Online ESI
- Discord Webhooks
- Node.js
- Docker

---

# Disclaimer

This is an independent community project and is not affiliated with CCP Games, Discord or zKillboard.
