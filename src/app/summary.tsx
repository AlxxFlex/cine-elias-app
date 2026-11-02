import { router, usePreventRemove } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

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
import { api, ApiError } from "@/services/api";
import { useCinema } from "@/state/cinema-context";
import type { Ticket } from "@/types/cinema";
import { formatDate, formatTime, seatLabel } from "@/utils/format";

function screeningHasStarted(date: string) {
  return Date.parse(date) <= Date.now();
}

export default function SummaryScreen() {
  const cinema = useCinema();
  const now = useNow();
  const [flow, setFlow] = useState(() => {
    const initialScreening = cinema.screenings.find(
      (item) => item.id === cinema.selection.screeningId,
    );
    return {
      screeningId: cinema.selection.screeningId,
      seatIds: [...cinema.selection.seatIds],
      movieId: initialScreening?.movie_id,
      auditoriumId: initialScreening?.auditorium_id,
      date: initialScreening?.date,
      userId: cinema.user?.id ?? null,
      userName: cinema.user?.name ?? "",
      userEmail: cinema.user?.email ?? null,
    };
  });
  const screening = cinema.screenings.find(
    (item) => item.id === flow.screeningId,
  );
  const movie = cinema.movies.find((item) => item.id === screening?.movie_id);
  const auditorium = cinema.auditoriums.find(
    (item) => item.id === screening?.auditorium_id,
  );
  const selectedSeats = cinema.seats.filter((seat) =>
    flow.seatIds.includes(seat.id),
  );
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<Ticket[]>([]);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInProgress = useRef(false);
  const issuedRef = useRef<Ticket[]>([]);
  usePreventRemove(submitting);
  const profileChanged =
    flow.userId !== null &&
    (cinema.user?.id !== flow.userId || cinema.user?.email !== flow.userEmail);

  const confirm = async () => {
    if (
      requestInProgress.current ||
      !cinema.user ||
      !screening ||
      !flow.seatIds.length
    )
      return;
    if (
      flow.userId !== null &&
      (cinema.user.id !== flow.userId || cinema.user.email !== flow.userEmail)
    ) {
      setError(
        "El perfil de visitante cambió. Regresa a la sala y revisa la selección para el nuevo perfil. Los folios ya emitidos siguen asociados al perfil original.",
      );
      return;
    }
    const issuingUser = cinema.user;
    if (flow.userId === null)
      setFlow((current) => ({
        ...current,
        userId: issuingUser.id,
        userName: issuingUser.name,
        userEmail: issuingUser.email,
      }));
    requestInProgress.current = true;
    setSubmitting(true);
    setError(null);
    const userId = cinema.user.id;
    let latestIssued = issuedRef.current.filter(
      (ticket) => ticket.user_id === userId,
    );
    try {
      const [currentScreening, currentSeats, currentTickets, currentUser] =
        await Promise.all([
          api.get("movie-screenings", screening.id),
          api.list("seats"),
          api.list("tickets"),
          api.get("users", userId),
        ]);
      if (currentUser.email !== (flow.userEmail ?? issuingUser.email)) {
        throw new Error(
          "El perfil registrado en el servidor cambió. No se emitieron más boletos; revisa tu perfil antes de continuar.",
        );
      }
      if (
        currentScreening.movie_id !== flow.movieId ||
        currentScreening.auditorium_id !== flow.auditoriumId ||
        Date.parse(currentScreening.date) !== Date.parse(flow.date ?? "")
      ) {
        throw new Error(
          "La función cambió de película, sala u horario. Regresa a la sala para revisar los datos y elegir tus asientos.",
        );
      }
      if (screeningHasStarted(currentScreening.date))
        throw new Error("Esta función ya comenzó. Selecciona otro horario.");
      const validSeatIds = new Set(
        currentSeats
          .filter(
            (seat) => seat.auditorium_id === currentScreening.auditorium_id,
          )
          .map((seat) => seat.id),
      );
      if (flow.seatIds.some((seatId) => !validSeatIds.has(seatId)))
        throw new Error(
          "La distribución de la sala cambió. Regresa al mapa para revisar tus asientos.",
        );
      const taken = currentTickets.filter(
        (ticket) =>
          ticket.movie_screening_id === screening.id &&
          flow.seatIds.includes(ticket.seat_id),
      );
      // A prior request can succeed on the server even if its response never reaches the device.
      // Reconcile those tickets before retrying, without posting them a second time.
      for (const ticket of taken.filter((item) => item.user_id === userId)) {
        if (!latestIssued.some((item) => item.id === ticket.id))
          latestIssued.push(ticket);
      }
      issuedRef.current = latestIssued;
      setIssued(latestIssued);
      const unavailable = taken.filter((ticket) => ticket.user_id !== userId);
      if (unavailable.length) {
        const labels = unavailable.map((ticket) => {
          const seat = currentSeats.find((item) => item.id === ticket.seat_id);
          return seat ? seatLabel(seat) : `#${ticket.seat_id}`;
        });
        throw new Error(
          `Los asientos ${labels.join(", ")} ya están ocupados. Regresa a la sala para cambiar tu selección.`,
        );
      }
      for (const seatId of flow.seatIds) {
        if (latestIssued.some((ticket) => ticket.seat_id === seatId)) continue;
        const ticket = await api.create("tickets", {
          user_id: userId,
          seat_id: seatId,
          movie_screening_id: screening.id,
          price: null,
        });
        latestIssued = [...latestIssued, ticket];
        issuedRef.current = latestIssued;
        setIssued(latestIssued);
      }
      setCompleted(true);
      cinema.clearSelection();
    } catch (cause) {
      const message =
        cause instanceof ApiError && cause.status === 409
          ? "El servidor detectó un conflicto al emitir un boleto. Regresa a la sala para actualizar la disponibilidad y revisar tu selección."
          : cause instanceof Error
            ? cause.message
            : "No pudimos emitir tus boletos. Intenta de nuevo.";
      setError(
        latestIssued.length
          ? `${latestIssued.length} de ${flow.seatIds.length} boletos ya fueron emitidos y están en Mis boletos. ${message} Al reintentar se consultarán los folios existentes antes de continuar.`
          : `${message} Si hubo un problema de conexión, al reintentar verificaremos primero si el boleto ya fue emitido.`,
      );
    } finally {
      await cinema.refresh();
      setSubmitting(false);
      requestInProgress.current = false;
    }
  };

  if (!screening || !movie || !flow.seatIds.length) {
    return (
      <Screen>
        <PageHeader title="Tu selección" back />
        <StateView
          icon="ticket"
          title="Todavía no hay una selección"
          message="Elige una película, una función y tus lugares favoritos para continuar."
          actionLabel="Explorar cartelera"
          onAction={() => router.replace("/")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        title={completed ? "Boletos emitidos" : "Resumen de boletos"}
        subtitle={
          completed
            ? "Emisión confirmada"
            : "Revisa tu selección antes de continuar"
        }
        back={!submitting && !completed}
      />
      {completed ? (
        <>
          <View style={styles.successIcon}>
            <Icon name="check" size={28} color={colors.text} />
          </View>
          <AppText variant="title" style={styles.successTitle}>
            El plan está listo.
          </AppText>
          <AppText muted style={styles.successText}>
            {issued.length}{" "}
            {issued.length === 1 ? "boleto registrado" : "boletos registrados"}{" "}
            a nombre de {flow.userName} en Cine Elías. Puedes consultar tus
            folios en Mis boletos con ese perfil.
          </AppText>
        </>
      ) : (
        <AppText muted style={styles.intro}>
          Estos son los detalles de tu función.
        </AppText>
      )}
      <View style={styles.ticket}>
        <View style={styles.movieRow}>
          <Poster movie={movie} style={styles.poster} />
          <View style={styles.movieInfo}>
            <AppText variant="small" muted>
              Cine Elías
            </AppText>
            <AppText variant="heading">{movie.title}</AppText>
            <AppText variant="small" muted>
              {auditorium?.name ?? `Sala #${screening.auditorium_id}`}
            </AppText>
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.details}>
          <Detail label="Fecha" value={formatDate(screening.date)} />
          <Detail label="Horario" value={formatTime(screening.date)} />
          <Detail
            label="Asientos"
            value={
              selectedSeats.map(seatLabel).join(", ") ||
              flow.seatIds.map((id) => `#${id}`).join(", ")
            }
          />
          <Detail label="Boletos" value={String(flow.seatIds.length)} />
          <Detail label="Precio por boleto" value="No publicado" />
          <Detail label="Importe total" value="No disponible" />
        </View>
        {issued.length > 0 && (
          <View style={styles.folios}>
            <AppText variant="small" muted>
              Folios registrados
            </AppText>
            <AppText>
              {issued.map((ticket) => `#${ticket.id}`).join(" · ")}
            </AppText>
          </View>
        )}
      </View>
      {completed ? (
        <View style={styles.actions}>
          <Button
            label="Ver mis boletos"
            icon="ticket"
            loading={submitting}
            disabled={submitting}
            onPress={() => router.replace("/tickets")}
          />
          <Button
            label="Volver a cartelera"
            variant="secondary"
            disabled={submitting}
            onPress={() => router.replace("/")}
          />
        </View>
      ) : (
        <>
          <View style={styles.notice}>
            <Icon name="ticket" size={20} color={colors.muted} />
            <AppText variant="small" muted style={styles.noticeText}>
              La función no tiene una tarifa publicada. Se emitirán los boletos
              sin precio registrado y sin cobro desde esta app.
            </AppText>
          </View>
          {error && (
            <View accessibilityRole="alert" style={styles.error}>
              <AppText style={styles.errorText}>{error}</AppText>
            </View>
          )}
          {cinema.user ? (
            <View style={styles.actions}>
              <AppText variant="small" muted>
                Boletos a nombre de {cinema.user.name}
              </AppText>
              {profileChanged && (
                <AppText variant="small" style={styles.errorText}>
                  El perfil cambió. Regresa a la sala para revisar la selección
                  con tu nuevo perfil. Los folios anteriores pertenecen a{" "}
                  {flow.userName}.
                </AppText>
              )}
              <Button
                label={
                  issued.length
                    ? "Continuar emisión pendiente"
                    : "Emitir boletos"
                }
                icon="ticket"
                loading={submitting}
                disabled={
                  submitting ||
                  profileChanged ||
                  new Date(screening.date).getTime() <= now
                }
                onPress={() => {
                  void confirm();
                }}
              />
              {new Date(screening.date).getTime() <= now && (
                <AppText variant="small" muted>
                  La función ya comenzó. Selecciona otro horario.
                </AppText>
              )}
              <Button
                label="Modificar asientos"
                variant="ghost"
                disabled={submitting}
                onPress={() =>
                  router.replace({
                    pathname: "/screening/[id]",
                    params: { id: screening.id },
                  })
                }
              />
            </View>
          ) : (
            <View style={styles.actions}>
              <AppText variant="small" muted>
                Crea un perfil de visitante para asociar los boletos. Tu
                selección se conservará al volver.
              </AppText>
              <Button
                label="Crear mi perfil"
                icon="user"
                onPress={() => router.push("/account")}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="small" muted style={styles.detailLabel}>
        {label}
      </AppText>
      <AppText style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { lineHeight: 22 },
  ticket: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 18,
  },
  movieRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  poster: { width: 78, height: 117, borderRadius: 6 },
  movieInfo: { flex: 1, gap: 8 },
  separator: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    marginVertical: 20,
  },
  details: { gap: 14 },
  detail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  detailLabel: { flexShrink: 1, paddingTop: 2 },
  detailValue: { flex: 1, textAlign: "right", fontWeight: "500" },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  noticeText: { flex: 1, lineHeight: 21 },
  actions: { gap: 12 },
  error: {
    borderRadius: 8,
    padding: 14,
    backgroundColor: "#2C1B1B",
    borderWidth: 1,
    borderColor: "#693D3D",
  },
  errorText: { color: colors.danger, lineHeight: 23 },
  folios: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.action,
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: { fontSize: 25, lineHeight: 31 },
  successText: { lineHeight: 23 },
});
