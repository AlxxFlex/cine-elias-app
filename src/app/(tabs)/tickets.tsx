import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import {
  AppText,
  Button,
  colors,
  Icon,
  PageHeader,
  Poster,
  Screen,
  StateView,
} from "@/components/cinema-ui";
import { useNow } from "@/hooks/use-now";
import { useCinema } from "@/state/cinema-context";
import type { Ticket } from "@/types/cinema";
import { formatDate, formatTime, seatLabel } from "@/utils/format";

export default function TicketsScreen() {
  const cinema = useCinema();
  const now = useNow();
  const { refresh } = cinema;
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const groups = useMemo(() => {
    const grouped = new Map<number, Ticket[]>();
    for (const ticket of cinema.tickets.filter(
      (item) => item.user_id === cinema.user?.id,
    )) {
      grouped.set(ticket.movie_screening_id, [
        ...(grouped.get(ticket.movie_screening_id) ?? []),
        ticket,
      ]);
    }
    return [...grouped.entries()]
      .map(([screeningId, tickets]) => ({ screeningId, tickets }))
      .sort((a, b) => {
        const aDate = cinema.screenings.find(
          (item) => item.id === a.screeningId,
        )?.date;
        const bDate = cinema.screenings.find(
          (item) => item.id === b.screeningId,
        )?.date;
        return (
          (bDate ? new Date(bDate).getTime() : 0) -
          (aDate ? new Date(aDate).getTime() : 0)
        );
      });
  }, [cinema.tickets, cinema.user?.id, cinema.screenings]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
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
    <Screen scroll={false}>
      <FlatList
        data={cinema.user ? groups : []}
        keyExtractor={(item) => String(item.screeningId)}
        refreshing={refreshing}
        onRefresh={() => {
          void reload();
        }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <PageHeader
              title="Mis boletos"
              subtitle="Tus próximas funciones e historial"
            />
            <AppText muted style={styles.intro}>
              Consulta tus asientos y folios de entrada.
            </AppText>
            {cinema.error && (
              <View accessibilityRole="alert" style={styles.error}>
                <AppText variant="small" style={styles.errorText}>
                  {cinema.error}
                </AppText>
                <Button
                  label="Reintentar"
                  variant="ghost"
                  onPress={() => {
                    void reload();
                  }}
                />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          cinema.status === "loading" ? (
            <StateView
              loading
              title="Buscando tus boletos"
              message="Consultando los registros del cine."
            />
          ) : !cinema.user ? (
            <StateView
              icon="ticket"
              title="Tu próxima salida, aquí"
              message="Crea tu perfil de visitante para emitir boletos y consultar los folios registrados desde este dispositivo."
              actionLabel="Crear mi perfil"
              onAction={() => router.push("/account")}
            />
          ) : (
            <StateView
              icon="ticket"
              title="Una buena historia te espera"
              message="Aún no tienes boletos registrados. Explora la cartelera y elige tu siguiente película."
              actionLabel="Explorar cartelera"
              onAction={() => router.navigate("/")}
            />
          )
        }
        renderItem={({ item }) => {
          const screening = cinema.screenings.find(
            (value) => value.id === item.screeningId,
          );
          const movie = cinema.movies.find(
            (value) => value.id === screening?.movie_id,
          );
          const auditorium = cinema.auditoriums.find(
            (value) => value.id === screening?.auditorium_id,
          );
          const past = !!screening && new Date(screening.date).getTime() <= now;
          const isExpanded = expanded === item.screeningId;
          return (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver detalles de ${movie?.title ?? "los boletos"}`}
                accessibilityState={{ expanded: isExpanded }}
                aria-expanded={isExpanded}
                onPress={() =>
                  setExpanded(isExpanded ? null : item.screeningId)
                }
                style={({ pressed }) => [
                  styles.cardPress,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.movieRow}>
                  {movie ? (
                    <Poster movie={movie} style={styles.poster} />
                  ) : (
                    <View style={[styles.poster, styles.placeholder]}>
                      <Icon name="film" size={28} color={colors.muted} />
                    </View>
                  )}
                  <View style={styles.movieInfo}>
                    <AppText
                      variant="small"
                      style={past ? styles.past : styles.upcoming}
                    >
                      {past
                        ? "Función pasada"
                        : screening
                          ? "Próxima función"
                          : "Boletos registrados"}
                    </AppText>
                    <AppText variant="heading">
                      {movie?.title ??
                        `Película de función #${item.screeningId}`}
                    </AppText>
                    <AppText variant="small" muted>
                      {screening
                        ? `${formatDate(screening.date)} · ${formatTime(screening.date)}`
                        : "La función ya no está disponible."}
                    </AppText>
                    <AppText variant="small" muted>
                      {auditorium?.name ??
                        (screening
                          ? `Sala #${screening.auditorium_id}`
                          : "Sala no disponible")}
                    </AppText>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <AppText variant="small" style={styles.seatList}>
                    {item.tickets.length}{" "}
                    {item.tickets.length === 1 ? "boleto" : "boletos"} ·{" "}
                    {item.tickets
                      .map((ticket) => {
                        const seat = cinema.seats.find(
                          (value) => value.id === ticket.seat_id,
                        );
                        return seat
                          ? seatLabel(seat)
                          : `Asiento #${ticket.seat_id}`;
                      })
                      .join(", ")}
                  </AppText>
                  <Icon
                    name={isExpanded ? "close" : "chevron-right"}
                    size={18}
                    color={colors.muted}
                  />
                </View>
              </Pressable>
              {isExpanded && (
                <View style={styles.expanded}>
                  <AppText variant="small" muted>
                    Folios de entrada
                  </AppText>
                  {item.tickets.map((ticket) => {
                    const seat = cinema.seats.find(
                      (value) => value.id === ticket.seat_id,
                    );
                    return (
                      <View key={ticket.id} style={styles.folioRow}>
                        <View style={styles.folioLabel}>
                          <AppText>#{ticket.id}</AppText>
                          <AppText variant="small" muted>
                            {seat
                              ? `Asiento ${seatLabel(seat)}`
                              : `Asiento #${ticket.seat_id}`}
                          </AppText>
                        </View>
                        <AppText variant="small" muted>
                          {ticket.price == null
                            ? "Sin precio registrado"
                            : `Importe: ${ticket.price}`}
                        </AppText>
                      </View>
                    );
                  })}
                  <AppText variant="small" muted>
                    Conserva estos folios para identificar tus boletos. Esta app
                    no procesa pagos.
                  </AppText>
                  {movie && (
                    <Button
                      label="Ver película"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: "/movie/[id]",
                          params: { id: movie.id },
                        })
                      }
                    />
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, gap: 18 },
  intro: { lineHeight: 22, marginBottom: 18 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  cardPress: { padding: 18 },
  pressed: { opacity: 0.75 },
  movieRow: { flexDirection: "row", gap: 16 },
  poster: { width: 76, height: 114, borderRadius: 6 },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  movieInfo: { flex: 1, gap: 7, justifyContent: "center" },
  upcoming: { color: colors.text, fontWeight: "600" },
  past: { color: colors.muted },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  seatList: { flex: 1 },
  expanded: { padding: 18, paddingTop: 0, gap: 16 },
  folioRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  folioLabel: { gap: 4 },
  error: {
    borderWidth: 1,
    borderColor: "#693D3D",
    borderRadius: 8,
    padding: 16,
    gap: 10,
    marginTop: 12,
  },
  errorText: { color: colors.danger },
});
