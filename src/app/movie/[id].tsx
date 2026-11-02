import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import {
  AppText,
  Button,
  colors,
  Icon,
  PageHeader,
  Pill,
  Poster,
  Screen,
  StateView,
} from "@/components/cinema-ui";
import { useNow } from "@/hooks/use-now";
import { imageUrl } from "@/services/api";
import { useCinema } from "@/state/cinema-context";
import { dayKey, formatDate, formatDuration, formatTime } from "@/utils/format";

export default function MovieScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    movies,
    directors,
    categories,
    screenings,
    auditoriums,
    status,
    error,
    refresh,
    selectScreening,
  } = useCinema();
  const { width } = useWindowDimensions();
  const now = useNow();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const movie = movies.find((item) => item.id === Number(id));
  const upcoming = useMemo(
    () =>
      screenings
        .filter(
          (item) =>
            item.movie_id === Number(id) && new Date(item.date).getTime() > now,
        )
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
    [screenings, id, now],
  );
  const days = [
    ...new Map(
      upcoming.map((item) => [dayKey(item.date), item.date]),
    ).entries(),
  ];
  const actualDay = days.some(([key]) => key === selectedDay)
    ? selectedDay
    : days[0]?.[0];
  const forDay = upcoming.filter((item) => dayKey(item.date) === actualDay);

  if (status === "loading")
    return (
      <Screen>
        <PageHeader title="Película" back />
        <StateView
          loading
          title="Un momento…"
          message="Estamos consultando los detalles."
        />
      </Screen>
    );
  if (status === "error")
    return (
      <Screen>
        <PageHeader title="Película" back />
        <StateView
          title="No se pudo cargar"
          message={error ?? "Inténtalo de nuevo."}
          actionLabel="Reintentar"
          onAction={() => void refresh()}
        />
      </Screen>
    );
  if (!movie)
    return (
      <Screen>
        <PageHeader title="Película" back />
        <StateView
          title="Película no disponible"
          message="Es posible que ya no forme parte del catálogo."
          actionLabel="Volver a cartelera"
          onAction={() => router.replace("/")}
        />
      </Screen>
    );
  const director = directors.find((item) => item.id === movie.director_id);
  const category = categories.find((item) => item.id === movie.category_id);

  return (
    <Screen>
      <PageHeader title="Detalle de película" back />
      <View
        style={[
          styles.hero,
          width >= 600 && {
            gap: 28,
            padding: 24,
          },
        ]}
      >
        {imageUrl(movie.image) && (
          <Image
            source={{ uri: imageUrl(movie.image) }}
            contentFit="cover"
            cachePolicy="memory-disk"
            style={[StyleSheet.absoluteFill, { opacity: 0.13 }]}
            accessibilityElementsHidden
          />
        )}
        <Poster
          movie={movie}
          style={{
            width: width >= 600 ? 210 : Math.min((width - 72) * 0.44, 155),
            borderRadius: 8,
          }}
        />
        <View style={styles.heroInfo}>
          <AppText
            variant="title"
            style={{
              fontSize: width < 360 ? 21 : 25,
              lineHeight: width < 360 ? 27 : 31,
            }}
          >
            {movie.title}
          </AppText>
          <View style={styles.metadata}>
            {category && (
              <AppText variant="small" muted>
                {category.name}
              </AppText>
            )}
            {movie.length !== null && (
              <View style={styles.metaItem}>
                <Icon name="clock" size={15} color={colors.muted} />
                <AppText variant="small" muted>
                  {formatDuration(movie.length)}
                </AppText>
              </View>
            )}
          </View>
          {director && (
            <View>
              <AppText variant="small" muted>
                Dirección
              </AppText>
              <AppText>{director.name}</AppText>
            </View>
          )}
          {upcoming.length > 0 && (
            <AppText variant="small" style={{ color: colors.text }}>
              {upcoming.length}{" "}
              {upcoming.length === 1
                ? "función disponible"
                : "funciones disponibles"}
            </AppText>
          )}
        </View>
      </View>
      {upcoming[0] && (
        <View style={styles.quickBooking}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="small" muted>
              Próxima función
            </AppText>
            <AppText variant="small">
              {formatDate(upcoming[0].date)} · {formatTime(upcoming[0].date)}
            </AppText>
          </View>
          <Button
            label="Elegir asientos"
            onPress={() => {
              selectScreening(upcoming[0].id);
              router.push({
                pathname: "/screening/[id]",
                params: { id: upcoming[0].id },
              });
            }}
            style={{ minHeight: 46, paddingHorizontal: 16 }}
          />
        </View>
      )}
      <View style={styles.section}>
        <AppText variant="heading">Sinopsis</AppText>
        <AppText muted>
          {movie.movie_summary?.trim() ||
            "La sinopsis de esta película aún no está disponible."}
        </AppText>
      </View>
      <View style={styles.divider} />
      <View style={styles.section}>
        <View style={styles.sectionTitle}>
          <AppText variant="heading">Encuentra tu función</AppText>
          <Icon name="calendar" size={20} color={colors.accent} />
        </View>
        <AppText variant="small" muted>
          Horarios en la zona horaria de tu dispositivo.
        </AppText>
        {upcoming.length === 0 ? (
          <StateView
            icon="calendar"
            title="Sin funciones programadas"
            message="Todavía no hay funciones futuras publicadas para esta película."
            actionLabel="Actualizar horarios"
            onAction={() => void refresh()}
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {days.map(([key, date]) => (
                <Pill
                  key={key}
                  label={formatDate(date)}
                  selected={key === actualDay}
                  onPress={() => setSelectedDay(key)}
                />
              ))}
            </ScrollView>
            {[...new Set(forDay.map((item) => item.auditorium_id))].map(
              (auditoriumId) => (
                <View style={styles.showtimes} key={auditoriumId}>
                  <View style={styles.metaItem}>
                    <Icon name="film" color={colors.muted} size={17} />
                    <AppText>
                      {auditoriums.find((item) => item.id === auditoriumId)
                        ?.name ?? `Sala ${auditoriumId}`}
                    </AppText>
                  </View>
                  <View style={styles.timeButtons}>
                    {forDay
                      .filter((item) => item.auditorium_id === auditoriumId)
                      .map((screening) => (
                        <Button
                          key={screening.id}
                          label={formatTime(screening.date)}
                          variant="secondary"
                          onPress={() => {
                            selectScreening(screening.id);
                            router.push({
                              pathname: "/screening/[id]",
                              params: { id: screening.id },
                            });
                          }}
                          style={styles.timeButton}
                        />
                      ))}
                  </View>
                </View>
              ),
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  quickBooking: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "center",
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    padding: 16,
    backgroundColor: colors.panel,
    borderRadius: 10,
    overflow: "hidden",
  },
  heroInfo: { flex: 1, gap: 13 },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  section: { gap: 14 },
  sectionTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: { height: 1, backgroundColor: colors.border },
  showtimes: {
    gap: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 18,
  },
  timeButton: {
    minWidth: 96,
    minHeight: 46,
    borderRadius: 8,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  timeButtons: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
