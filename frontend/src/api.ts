/** Базовый URL API; в dev с Vite-proxy обычно пусто (запросы на тот же origin). */
const apiPrefix = import.meta.env.VITE_API_BASE ?? "";

/** Текст ошибки из тела FastAPI (`detail` строка или массив validation). */
function detailFromBody(body: unknown): string {
  if (!body || typeof body !== "object") return "Ошибка запроса";
  const d = (body as { detail?: unknown }).detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join("; ");
  return "Ошибка запроса";
}

/** fetch + JSON + Bearer из localStorage; кидает Error при !res.ok */
export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const h = new Headers(headers);
  if (json !== undefined) {
    h.set("Content-Type", "application/json");
    (rest as RequestInit).body = JSON.stringify(json);
  }
  const token = localStorage.getItem("access_token");
  if (token) h.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${apiPrefix}${path}`, { ...rest, headers: h });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw new Error(detailFromBody(parsed));
  }
  return parsed as T;
}
