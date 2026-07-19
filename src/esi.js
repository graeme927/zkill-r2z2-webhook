import config from "./config.js";

const nameCache = new Map();
const systemCache = new Map();
const constellationCache = new Map();
const regionCache = new Map();

async function esiRequest(url, options = {}) {
  const compatibilityHeaders = config.esiCompatibilityDate
    ? { "X-Compatibility-Date": config.esiCompatibilityDate }
    : {};

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": config.userAgent,
      ...compatibilityHeaders,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `ESI returned HTTP ${response.status}: ${body.slice(0, 300)}`
    );
  }

  return response.json();
}

function normaliseName(value) {
  return String(value || "").trim().toLocaleLowerCase("en");
}

export async function resolveConfiguredNames(requested) {
  const categories = {
    characters: Array.isArray(requested.characters)
      ? requested.characters
      : [],
    corporations: Array.isArray(requested.corporations)
      ? requested.corporations
      : [],
    alliances: Array.isArray(requested.alliances)
      ? requested.alliances
      : [],
    regions: Array.isArray(requested.regions) ? requested.regions : []
  };

  const allNames = [
    ...categories.characters,
    ...categories.corporations,
    ...categories.alliances,
    ...categories.regions
  ];

  if (allNames.length === 0) {
    return {
      characters: new Map(),
      corporations: new Map(),
      alliances: new Map(),
      regions: new Map()
    };
  }

  const response = await esiRequest(
    "https://esi.evetech.net/latest/universe/ids/?datasource=tranquility",
    {
      method: "POST",
      body: JSON.stringify([...new Set(allNames)])
    }
  );

  function resolveCategory(requestedNames, responseKey) {
    const results = Array.isArray(response?.[responseKey])
      ? response[responseKey]
      : [];
    const byName = new Map(
      results.map((item) => [normaliseName(item.name), item])
    );
    const resolved = new Map();

    for (const requestedName of requestedNames) {
      const item = byName.get(normaliseName(requestedName));

      if (!item) {
        throw new Error(
          `ESI could not resolve ${responseKey.slice(0, -1)} name: ` +
            requestedName
        );
      }

      resolved.set(Number(item.id), item.name);
      nameCache.set(Number(item.id), item.name);
    }

    return resolved;
  }

  return {
    characters: resolveCategory(categories.characters, "characters"),
    corporations: resolveCategory(categories.corporations, "corporations"),
    alliances: resolveCategory(categories.alliances, "alliances"),
    regions: resolveCategory(categories.regions, "regions")
  };
}

export async function resolveNames(ids) {
  const uniqueIds = [
    ...new Set(
      (Array.isArray(ids) ? ids : [])
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    )
  ];

  const unresolved = uniqueIds.filter((id) => !nameCache.has(id));

  for (let index = 0; index < unresolved.length; index += 1000) {
    const batch = unresolved.slice(index, index + 1000);

    if (batch.length === 0) {
      continue;
    }

    const results = await esiRequest(
      "https://esi.evetech.net/latest/universe/names/?datasource=tranquility",
      {
        method: "POST",
        body: JSON.stringify(batch)
      }
    );

    for (const result of Array.isArray(results) ? results : []) {
      nameCache.set(Number(result.id), result.name);
    }
  }

  return new Map(
    uniqueIds.map((id) => [id, nameCache.get(id) || `Unknown (${id})`])
  );
}

export async function getLocation(solarSystemId) {
  const systemId = Number(solarSystemId);

  if (!Number.isSafeInteger(systemId) || systemId <= 0) {
    throw new Error(`Invalid solar-system ID: ${solarSystemId}`);
  }

  if (!systemCache.has(systemId)) {
    systemCache.set(
      systemId,
      await esiRequest(
        `https://esi.evetech.net/latest/universe/systems/${systemId}/` +
          "?datasource=tranquility"
      )
    );
  }

  const system = systemCache.get(systemId);
  const constellationId = Number(system?.constellation_id);

  if (!constellationCache.has(constellationId)) {
    constellationCache.set(
      constellationId,
      await esiRequest(
        `https://esi.evetech.net/latest/universe/constellations/` +
          `${constellationId}/?datasource=tranquility`
      )
    );
  }

  const constellation = constellationCache.get(constellationId);
  const regionId = Number(constellation?.region_id);

  if (!regionCache.has(regionId)) {
    regionCache.set(
      regionId,
      await esiRequest(
        `https://esi.evetech.net/latest/universe/regions/${regionId}/` +
          "?datasource=tranquility"
      )
    );
  }

  const region = regionCache.get(regionId);

  if (region?.name) {
    nameCache.set(regionId, region.name);
  }

  return {
    systemId,
    systemName: system?.name || `Unknown system (${systemId})`,
    regionId,
    regionName: region?.name || `Unknown region (${regionId})`
  };
}
