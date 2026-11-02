import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { API_BASE_URL, api, parseResource } from "@/services/api";
import type {
  Auditorium,
  Category,
  Director,
  Movie,
  Screening,
  Seat,
  SeatSelection,
  Ticket,
  User,
} from "@/types/cinema";

interface Catalog {
  movies: Movie[];
  categories: Category[];
  directors: Director[];
  auditoriums: Auditorium[];
  screenings: Screening[];
  seats: Seat[];
  tickets: Ticket[];
}

interface CinemaContextValue extends Catalog {
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  user: User | null;
  setUser: (user: User | null) => Promise<void>;
  selection: SeatSelection;
  selectScreening: (id: number) => void;
  toggleSeat: (id: number) => void;
  clearSelection: () => void;
}

const emptyCatalog: Catalog = {
  movies: [],
  categories: [],
  directors: [],
  auditoriums: [],
  screenings: [],
  seats: [],
  tickets: [],
};
const emptySelection: SeatSelection = { screeningId: null, seatIds: [] };
// IDs belong to one backend. Never reuse an identity after switching API URLs.
const profileKey = `cine-elias:visitor-profile:v2:${encodeURIComponent(API_BASE_URL)}`;
const CinemaContext = createContext<CinemaContextValue | null>(null);

export function CinemaProvider({ children }: PropsWithChildren) {
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [status, setStatus] = useState<CinemaContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, updateUser] = useState<User | null>(null);
  const [selection, setSelection] = useState<SeatSelection>(emptySelection);
  const pendingRefresh = useRef<Promise<void> | null>(null);
  const profileGeneration = useRef(0);
  const profileWrites = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);

  const refresh = useCallback((): Promise<void> => {
    if (pendingRefresh.current) return pendingRefresh.current;
    const pending = (async () => {
      try {
        const [
          movies,
          categories,
          directors,
          auditoriums,
          screenings,
          seats,
          tickets,
        ] = await Promise.all([
          api.list("movies"),
          api.list("categories"),
          api.list("directors"),
          api.list("auditoriums"),
          api.list("movie-screenings"),
          api.list("seats"),
          api.list("tickets"),
        ]);
        if (!mounted.current) return;
        const next = {
          movies,
          categories,
          directors,
          auditoriums,
          screenings,
          seats,
          tickets,
        };
        setCatalog(next);
        setSelection((current) => {
          const screening = screenings.find(
            (item) => item.id === current.screeningId,
          );
          if (!screening) return emptySelection;
          const occupied = new Set(
            tickets
              .filter((ticket) => ticket.movie_screening_id === screening.id)
              .map((ticket) => ticket.seat_id),
          );
          return {
            screeningId: screening.id,
            seatIds: current.seatIds.filter(
              (id) =>
                !occupied.has(id) &&
                seats.some(
                  (seat) =>
                    seat.id === id &&
                    seat.auditorium_id === screening.auditorium_id,
                ),
            ),
          };
        });
        setStatus("ready");
        setError(null);
      } catch (cause) {
        if (!mounted.current) return;
        setStatus("error");
        setError(
          cause instanceof Error
            ? cause.message
            : "No pudimos actualizar los datos.",
        );
        // Never retain a confirmable seat selection after a failed availability refresh.
        setSelection((current) => ({ ...current, seatIds: [] }));
      }
    })();
    pendingRefresh.current = pending;
    void pending.finally(() => {
      if (pendingRefresh.current === pending) pendingRefresh.current = null;
    });
    return pending;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    let active = true;
    const generation = profileGeneration.current;
    void AsyncStorage.getItem(profileKey)
      .then((stored) => {
        if (!stored || !active || generation !== profileGeneration.current)
          return;
        try {
          updateUser(parseResource("users", JSON.parse(stored)));
        } catch {
          // Serialize cleanup with saves, so it cannot delete a newly created profile.
          const cleanup = profileWrites.current
            .catch(() => {})
            .then(async () => {
              if (generation === profileGeneration.current)
                await AsyncStorage.removeItem(profileKey);
            });
          profileWrites.current = cleanup;
          void cleanup.catch(() => {});
        }
      })
      .catch(() => {
        /* Profile persistence is optional; the API remains usable. */
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [refresh]);

  const setUser = useCallback(async (next: User | null) => {
    // Store only the returned visitor identity. Passwords are never retained.
    const normalized = next ? parseResource("users", next) : null;
    const generation = ++profileGeneration.current;
    const pending = profileWrites.current
      .catch(() => {})
      .then(async () => {
        if (normalized)
          await AsyncStorage.setItem(profileKey, JSON.stringify(normalized));
        else await AsyncStorage.removeItem(profileKey);
      });
    profileWrites.current = pending;
    await pending;
    if (mounted.current && generation === profileGeneration.current)
      updateUser(normalized);
  }, []);

  const selectScreening = useCallback(
    (id: number) => {
      if (!catalog.screenings.some((item) => item.id === id)) return;
      setSelection((current) =>
        current.screeningId === id ? current : { screeningId: id, seatIds: [] },
      );
    },
    [catalog.screenings],
  );

  const toggleSeat = useCallback(
    (id: number) => {
      if (status !== "ready") return;
      setSelection((current) => {
        const screening = catalog.screenings.find(
          (item) => item.id === current.screeningId,
        );
        const seat = catalog.seats.find((item) => item.id === id);
        if (
          !screening ||
          !seat ||
          seat.auditorium_id !== screening.auditorium_id ||
          Date.parse(screening.date) <= Date.now()
        )
          return current;
        if (
          catalog.tickets.some(
            (item) =>
              item.movie_screening_id === screening.id && item.seat_id === id,
          )
        )
          return current;
        return {
          ...current,
          seatIds: current.seatIds.includes(id)
            ? current.seatIds.filter((seatId) => seatId !== id)
            : [...current.seatIds, id],
        };
      });
    },
    [catalog, status],
  );

  const clearSelection = useCallback(() => setSelection(emptySelection), []);
  const value = useMemo<CinemaContextValue>(
    () => ({
      ...catalog,
      status,
      error,
      refresh,
      user,
      setUser,
      selection,
      selectScreening,
      toggleSeat,
      clearSelection,
    }),
    [
      catalog,
      status,
      error,
      refresh,
      user,
      setUser,
      selection,
      selectScreening,
      toggleSeat,
      clearSelection,
    ],
  );

  return (
    <CinemaContext.Provider value={value}>{children}</CinemaContext.Provider>
  );
}

export function useCinema(): CinemaContextValue {
  const context = useContext(CinemaContext);
  if (!context)
    throw new Error("useCinema debe usarse dentro de CinemaProvider.");
  return context;
}
