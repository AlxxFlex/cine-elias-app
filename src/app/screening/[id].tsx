import {
  router,
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  AppText,
  Button,
  colors,
  Icon,
  PageHeader,
  Screen,
  StateView,
} from "@/components/cinema-ui";
import { SeatMap } from "@/components/seat-map";
import { useNow } from "@/hooks/use-now";
import { useCinema } from "@/state/cinema-context";
import { formatDate, formatTime, seatLabel } from "@/utils/format";

export default function ScreeningScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cinema = useCinema();
  const now = useNow();
  const { selectScreening, refresh } = cinema;
  const focused = useIsFocused();
  const screeningId = Number(id);
  const screening = cinema.screenings.find((item) => item.id === screeningId);
  const movie = cinema.movies.find((item) => item.id === screening?.movie_id);
  const auditorium = cinema.auditoriums.find(
    (item) => item.id === screening?.auditorium_id,
  );
  const [refreshing, setRefreshing] = useState(true);
  const seats = useMemo(
    () =>
      cinema.seats.filter(
        (seat) => seat.auditorium_id === screening?.auditorium_id,
      ),
    [cinema.seats, screening?.auditorium_id],
  );
  const occupied = useMemo(
    () =>
      new Set(
        cinema.tickets
          .filter((ticket) => ticket.movie_screening_id === screeningId)
          .map((ticket) => ticket.seat_id),
      ),
    [cinema.tickets, screeningId],
  );
  const selectedIds =
    cinema.selection.screeningId === screeningId
      ? cinema.selection.seatIds
      : [];
  const selectedSeats = seats.filter((seat) => selectedIds.includes(seat.id));
  const expired = !!screening && new Date(screening.date).getTime() <= now;

  useEffect(() => {
    if (focused && Number.isSafeInteger(screeningId) && screeningId > 0)
      selectScreening(screeningId);
  }, [focused, screeningId, selectScreening]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRefreshing(true);
      void refresh().finally(() => {
        if (active) setRefreshing(false);
      });
      return () => {
        active = false;
      };
    }, [refresh]),
  );

  const reload = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen>
      <PageHeader
        title="Elige tu lugar"
        subtitle="Selecciona tus asientos"
        back
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Actualizar disponibilidad"
            onPress={() => {
              void reload();
            }}
            disabled={refreshing}
            style={styles.refresh}
          >
            <Icon name="refresh" size={20} />
          </Pressable>
        }
      />
      {cinema.status === "loading" || refreshing ? (
        <StateView
          loading
          title="Preparando la sala"
          message="Consultando asientos y disponibilidad."
        />
      ) : cinema.error ? (
        <StateView
          title="No pudimos verificar la sala"
          message={cinema.error}
          actionLabel="Reintentar"
          onAction={() => {
            void reload();
          }}
        />
      ) : !screening || !movie ? (
        <StateView
          icon="film"
          title="Función no disponible"
          message="Esta función ya no está en la cartelera."
          actionLabel="Volver a cartelera"
          onAction={() => router.replace("/")}
        />
      ) : (
        <>
          <View style={styles.context}>
            <AppText variant="heading">{movie.title}</AppText>
            <AppText muted>
              {formatDate(screening.date)} · {formatTime(screening.date)}
            </AppText>
            <AppText variant="small" muted>
              {auditorium?.name ?? `Sala #${screening.auditorium_id}`}
            </AppText>
          </View>
          {expired ? (
            <StateView
              icon="clock"
              title="Esta función ya comenzó"
              message="Busca una función próxima para elegir tus asientos."
              actionLabel="Ver película"
              onAction={() =>
                router.replace({
                  pathname: "/movie/[id]",
                  params: { id: movie.id },
                })
              }
            />
          ) : !seats.length ? (
            <StateView
              icon="grid"
              title="La sala aún no tiene asientos"
              message="Los asientos de esta sala todavía no se han cargado. Consulta otra función o completa la sala desde Administración."
            />
          ) : (
            <>
              <View style={styles.available}>
                <View style={styles.dot} />
                <AppText variant="small" muted>
                  {seats.filter((seat) => !occupied.has(seat.id)).length}{" "}
                  lugares disponibles · {seats.length} asientos
                </AppText>
              </View>
              <SeatMap
                seats={seats}
                occupiedIds={occupied}
                selectedIds={selectedIds}
                disabled={refreshing}
                onToggle={cinema.toggleSeat}
              />
              <View style={styles.selection}>
                <AppText variant="small" muted>
                  Asientos seleccionados
                </AppText>
                <AppText variant="heading">
                  {selectedSeats.length
                    ? selectedSeats.map(seatLabel).join(", ")
                    : "Elige tus asientos"}
                </AppText>
                <AppText variant="small" muted>
                  {selectedSeats.length
                    ? `${selectedSeats.length} ${selectedSeats.length === 1 ? "boleto" : "boletos"}`
                    : "Toca un lugar disponible en el mapa."}
                </AppText>
              </View>
              <View style={styles.footer}>
                <AppText variant="small" muted>
                  La selección no bloquea los asientos. Verificaremos su
                  disponibilidad al emitir los boletos.
                </AppText>
                <Button
                  label="Continuar al resumen"
                  icon="arrow-right"
                  onPress={() => router.push("/summary")}
                  disabled={!selectedSeats.length || refreshing}
                />
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  refresh: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.panel,
  },
  context: { gap: 6 },
  available: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  selection: { gap: 6, paddingVertical: 4 },
  footer: {
    gap: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 20,
  },
});
