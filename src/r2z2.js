import config from "./config.js";

const BASE_URL = "https://r2z2.zkillboard.com/ephemeral";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, { allowNotFound = false } = {}) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "User-Agent": config.userAgent
        },
        signal: AbortSignal.timeout(30000)
      });

      if (response.status === 404 && allowNotFound) {
        return null;
      }

      if (response.status === 403) {
        throw new Error(
          "R2Z2 returned HTTP 403. Check USER_AGENT and ensure the IP " +
            "has not been temporarily rate limited."
        );
      }

      if (response.status === 429) {
        const retryAfterSeconds =
          Number(response.headers.get("retry-after")) || 6;

        console.warn(
          `[R2Z2] Rate limited; waiting ${retryAfterSeconds}s ` +
            `(attempt ${attempt}/5)`
        );

        await sleep(Math.max(retryAfterSeconds * 1000, 6000));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `R2Z2 returned HTTP ${response.status}: ${body.slice(0, 300)}`
        );
      }

      return await response.json();
    } catch (error) {
      if (attempt >= 5) {
        throw error;
      }

      console.warn(
        `[R2Z2] Request failed: ${error.message}; retrying ` +
          `(${attempt}/5)`
      );
      await sleep(2000 * attempt);
    }
  }

  throw new Error("R2Z2 request retry loop ended unexpectedly");
}

export async function fetchCurrentSequence() {
  const data = await request("/sequence.json");
  const sequence = Number(data?.sequence_id ?? data?.sequence);

  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error(
      `R2Z2 sequence.json did not contain a valid sequence: ` +
        JSON.stringify(data)
    );
  }

  return sequence;
}

export async function fetchSequence(sequenceId) {
  if (!Number.isSafeInteger(sequenceId) || sequenceId <= 0) {
    throw new Error(`Invalid R2Z2 sequence ID: ${sequenceId}`);
  }

  return request(`/${sequenceId}.json`, {
    allowNotFound: true
  });
}
