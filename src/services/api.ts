import Constants from "expo-constants";
import { isDevice } from "expo-device";
import { Platform } from "react-native";

import type { ResourceInput, ResourceMap, ResourceName } from "@/types/cinema";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function defaultBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    try {
      const host = new URL(
        hostUri.includes("://") ? hostUri : `http://${hostUri}`,
      ).hostname;
      // A tunneled Metro hostname does not expose the separate Docker port.
      if (
        host &&
        !host.endsWith(".exp.direct") &&
        !host.endsWith(".expo.dev")
      ) {
        const mapped =
          Platform.OS === "android" &&
          !isDevice &&
          /^(localhost|127\.0\.0\.1)$/.test(host)
            ? "10.0.2.2"
            : host;
        return `http://${mapped}:8000`;
      }
    } catch {
      /* Use the documented platform fallback below. */
    }
  }
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `http://${window.location.hostname || "localhost"}:8000`;
  }
  return `http://${Platform.OS === "android" && !isDevice ? "10.0.2.2" : "localhost"}:8000`;
}

// EXPO_PUBLIC variables are embedded by Metro. Do not put credentials here.
const configuredBase = process.env.EXPO_PUBLIC_API_URL?.trim();
export const API_BASE_URL = (configuredBase || defaultBaseUrl())
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

function assertBaseUrl() {
  try {
    const url = new URL(API_BASE_URL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    throw new ApiError(
      "La URL de la API no es válida. Revisa EXPO_PUBLIC_API_URL.",
    );
  }
}

/** Resolve backend-relative images and development loopback URLs on a phone. */
export function imageUrl(path: string | null | undefined): string | undefined {
  if (!path?.trim()) return undefined;
  try {
    const url = new URL(path.trim(), `${API_BASE_URL}/`);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return undefined;
    if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) {
      const backend = new URL(API_BASE_URL);
      url.protocol = backend.protocol;
      url.hostname = backend.hostname;
      url.port = backend.port;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

const inFlight = new Map<string, Promise<unknown>>();

function errorDetail(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null && "detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .slice(0, 3)
        .map((item: unknown) => {
          if (typeof item !== "object" || item === null || !("msg" in item))
            return "";
          const location =
            "loc" in item && Array.isArray(item.loc)
              ? item.loc.filter((part: unknown) => part !== "body").join(".")
              : "";
          return `${location ? `${location}: ` : ""}${String(item.msg)}`;
        })
        .filter(Boolean);
      if (messages.length) return `Revisa los datos. ${messages.join(" · ")}`;
    }
  }
  if (status === 404) return "Este registro ya no está disponible.";
  if (status === 409)
    return "El registro entra en conflicto con los datos existentes. Actualiza e inténtalo de nuevo.";
  if (status === 422) return "Revisa los campos: algunos datos no son válidos.";
  if (status >= 500)
    return "El servidor no pudo completar la solicitud. Inténtalo de nuevo.";
  return "No se pudo completar la solicitud.";
}

async function request(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  assertBaseUrl();
  const key = `${method} ${path}`;
  if (method === "GET" && inFlight.has(key)) return inFlight.get(key)!;
  const pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const raw = await response.text();
      let payload: unknown;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        throw new ApiError(
          "El servidor devolvió una respuesta que no es JSON.",
          response.status,
        );
      }
      if (!response.ok)
        throw new ApiError(
          errorDetail(payload, response.status),
          response.status,
        );
      return payload;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted)
        throw new ApiError(
          "La API tardó demasiado en responder. Comprueba la conexión.",
        );
      throw new ApiError(
        `No se pudo conectar con la API (${API_BASE_URL}). Comprueba Docker, la red y la URL configurada.`,
      );
    } finally {
      clearTimeout(timeout);
    }
  })();
  if (method === "GET") inFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    if (inFlight.get(key) === pending) inFlight.delete(key);
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("La API devolvió un registro con formato inesperado.");
  return value as Record<string, unknown>;
}

function numberField(value: unknown, field: string, minimum = 1): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new ApiError(`La API devolvió un valor inválido en ${field}.`);
  return value;
}

function textField(value: unknown, field: string): string {
  if (typeof value !== "string")
    throw new ApiError(`La API devolvió un valor inválido en ${field}.`);
  return value;
}

function nullableText(value: unknown, field: string): string | null {
  return value == null ? null : textField(value, field);
}

function nullableNumber(
  value: unknown,
  field: string,
  minimum = 1,
): number | null {
  return value == null ? null : numberField(value, field, minimum);
}

export function parseResource<R extends ResourceName>(
  resource: R,
  value: unknown,
): ResourceMap[R] {
  const row = record(value);
  const id = numberField(row.id, "id");
  let parsed: ResourceMap[ResourceName];
  switch (resource) {
    case "movies":
      parsed = {
        id,
        title: textField(row.title, "title"),
        director_id: nullableNumber(row.director_id, "director_id"),
        category_id: nullableNumber(row.category_id, "category_id"),
        length: nullableNumber(row.length, "length", 0),
        movie_summary: nullableText(row.movie_summary, "movie_summary"),
        image: nullableText(row.image, "image"),
      };
      break;
    case "movie-screenings": {
      const date = textField(row.date, "date");
      if (Number.isNaN(Date.parse(date)))
        throw new ApiError("La API devolvió una fecha de función inválida.");
      parsed = {
        id,
        date,
        movie_id: numberField(row.movie_id, "movie_id"),
        auditorium_id: numberField(row.auditorium_id, "auditorium_id"),
      };
      break;
    }
    case "seats":
      parsed = {
        id,
        seat_number: numberField(row.seat_number, "seat_number", 0),
        row_label: nullableText(row.row_label, "row_label"),
        auditorium_id: numberField(row.auditorium_id, "auditorium_id"),
      };
      break;
    case "tickets": {
      if (
        row.price != null &&
        typeof row.price !== "string" &&
        typeof row.price !== "number"
      )
        throw new ApiError("La API devolvió un precio inválido.");
      const price = row.price == null ? null : String(row.price);
      if (
        price !== null &&
        (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) > 999999.99)
      )
        throw new ApiError("La API devolvió un precio inválido.");
      parsed = {
        id,
        user_id: numberField(row.user_id, "user_id"),
        seat_id: numberField(row.seat_id, "seat_id"),
        movie_screening_id: numberField(
          row.movie_screening_id,
          "movie_screening_id",
        ),
        price,
      };
      break;
    }
    case "users":
      parsed = {
        id,
        name: textField(row.name, "name"),
        email: textField(row.email, "email"),
      };
      break;
    default:
      parsed = { id, name: textField(row.name, "name") };
  }
  return parsed as ResourceMap[R];
}

function validId(id: number) {
  numberField(id, "id");
  return id;
}

export const api = {
  async list<R extends ResourceName>(resource: R): Promise<ResourceMap[R][]> {
    const items = new Map<number, ResourceMap[R]>();
    let skip = 0;
    for (;;) {
      const payload = await request(`/api/${resource}?skip=${skip}&limit=100`);
      if (!Array.isArray(payload))
        throw new ApiError("La API devolvió una lista con formato inesperado.");
      const page = payload.map((item: unknown) =>
        parseResource(resource, item),
      );
      const before = items.size;
      for (const item of page) items.set(item.id, item);
      if (page.length < 100) return [...items.values()];
      if (items.size === before)
        throw new ApiError(
          "La paginación de la API no avanzó. No se mostrarán datos incompletos.",
        );
      skip += page.length;
    }
  },
  async get<R extends ResourceName>(
    resource: R,
    id: number,
  ): Promise<ResourceMap[R]> {
    return parseResource(
      resource,
      await request(`/api/${resource}/${validId(id)}`),
    );
  },
  async create<R extends ResourceName>(
    resource: R,
    body: ResourceInput<R>,
  ): Promise<ResourceMap[R]> {
    return parseResource(
      resource,
      await request(`/api/${resource}`, "POST", body),
    );
  },
  async update<R extends ResourceName>(
    resource: R,
    id: number,
    body: ResourceInput<R>,
  ): Promise<ResourceMap[R]> {
    return parseResource(
      resource,
      await request(`/api/${resource}/${validId(id)}`, "PUT", body),
    );
  },
};
