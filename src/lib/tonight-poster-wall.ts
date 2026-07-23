import { normalizePosterPath } from "@/lib/tmdb";

/** Affiches de secours — affichage immédiat du mur sans attendre le proxy TMDB */
export const FALLBACK_POSTER_PATHS = [
  "/qJ2tW6WMUDux911r6Pg7cbxOnOo.jpg", "/9gk7adHYeDvHkCSEqAvQNLV5Jpu.jpg", "/6ELCZlTA5zlZQvm52vuDDD5YlNY.jpg",
  "/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg", "/8Gxv8gSqFCzlqjeyTV4vv6pHua6.jpg", "/1X7l2bgUxmeBPujGiqHZrtyXdWI.jpg",
  "/5a4JDuFwQ5psXlwOrV2Jkpif26U.jpg", "/iuFNOMDHjPjvftoVsoa5ylMlQVY.jpg", "/7RyHsO4yMXtOk1XIZTlzN2Z0saF.jpg",
  "/7I6VUdPp6F7gJZ6pbA6YzW35VZDC.jpg", "/pB8BM7pdSp6B6Ih7QZ4DrRu3PmR.jpg", "/q6y0Go1tsY1WlCbGCRgs3tFQFdB.jpg",
  "/7c9UVPPiRGXdwKzRReq0g525kva.jpg", "/8Vt6mWEReuy4OfCGauysjPHY5eF.jpg", "/vZloEGZJj6u6WfBTfLg8jXzJ9mL.jpg",
  "/b0PlSFJbDwIFkTcMMFwYANJhIvS.jpg", "/4HodYYKEIsg8DIbNYrChk6L9Rvu.jpg", "/z2y57lt1dkbmjtcZ0NddoyDdYtm.jpg",
  "/tmU7GEvjtQ1CExiqzh25C8T4Lru.jpg", "/kxfKsanpBz8rJFbB6NNZUQGK3CH.jpg", "/6oom5QYQ2yQTMJIbIY6G42TxzW3.jpg",
  "/rSPw7tgCHPcbXtGSmx0AcAqI3R6.jpg", "/7dFZJ2ZJJdcmGyzD8Btp4nng1g9.jpg", "/f89U3ADr1oiB1s7GvdPuViIuQvV.jpg",
  "/v4mhrC0CScIu7DlagWUF0kQB9bU.jpg", "/b9GoIakfbA4AW1J5fGn1OktloO.jpg", "/4Y1WNkd88JXAUdH99v4Y2D1oqF.jpg",
  "/wPUmJMEdbmi9s9Jh4NaQ5zGv1mi.jpg", "/9GBhzXMFjgc77kNRm7hnF3jajj1.jpg", "/ldWIBNr6t0O7WikCwqIsAPjtn3N.jpg",
  "/7gKI9pzHAJBgjfpnK8RNQp8Y3qV.jpg", "/2CAL2433ZeThihM7PFa5hJ1nart.jpg", "/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
  "/7IiTTgloJzvGI1TAYymCBfbLxF.jpg", "/1g0dhYtq4irTY1GPXvft6kZYLj4.jpg", "/sKCr78MPLbWCxjBOc3F3q1Wayqs.jpg",
  "/7lTnXOg0im3NvBcrqmx3xoiBeIn.jpg", "/9PFonBhy4cQy7Jz20NpMygczOkv.jpg", "/AcoiTXW9MHA5PZPjXyFmfnhAPv.jpg",
] as const;

export function extractPosterPaths(results: unknown): string[] {
  if (!Array.isArray(results)) return [];
  return results
    .map((m) => normalizePosterPath((m as { poster_path?: string }).poster_path))
    .filter((p): p is string => !!p);
}

/** Fusionne fallbacks + TMDB sans doublons — le mur reste rempli même si le proxy échoue. */
export function mergePosterPools(...pools: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const pool of pools) {
    for (const raw of pool) {
      const path = normalizePosterPath(raw);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      merged.push(path);
    }
  }
  return merged;
}

export function fallbackPathFor(path: string, attempt: number): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) hash = (hash + path.charCodeAt(i) * (i + 1)) | 0;
  const idx = Math.abs(hash + attempt * 7) % FALLBACK_POSTER_PATHS.length;
  return FALLBACK_POSTER_PATHS[idx];
}

/** Remplace une affiche en échec par un fallback pas déjà visible à l'écran. */
export function pickUnusedPosterPath(
  seed: string,
  attempt: number,
  visible: Iterable<string>,
  pool: readonly string[] = FALLBACK_POSTER_PATHS,
): string {
  const seen = new Set(visible);
  seen.add(seed);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) | 0;
  const start = Math.abs(hash + attempt * 7) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(start + i) % pool.length];
    if (!seen.has(candidate)) return candidate;
  }
  return fallbackPathFor(seed, attempt);
}

/** Mur d'affiches : pool TMDB mélangé (cache API + picks), fallbacks seulement si trop petit. */
export function buildWallColumns(paths: string[], columnCount = 4): string[][] {
  const valid = paths
    .map((p) => normalizePosterPath(p))
    .filter((p): p is string => !!p);
  const pool = valid.length >= 8 ? valid : mergePosterPools([...FALLBACK_POSTER_PATHS], valid);

  const perCol = Math.max(8, Math.ceil(pool.length / columnCount));
  return Array.from({ length: columnCount }, (_, ci) => {
    const items: string[] = [];
    for (let i = 0; i < perCol; i++) {
      let idx = (ci + i * columnCount) % pool.length;
      let path = pool[idx];
      let guard = 0;
      while (items.at(-1) === path && guard < pool.length) {
        idx = (idx + 1) % pool.length;
        path = pool[idx];
        guard++;
      }
      items.push(path);
    }
    const loop = items.map((_, i) => {
      const idx = (ci + (i + items.length) * columnCount + 1) % pool.length;
      return pool[idx];
    });
    return [...items, ...loop];
  });
}
