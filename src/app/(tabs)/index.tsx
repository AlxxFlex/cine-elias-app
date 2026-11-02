import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { BrandLogo } from "@/components/brand-logo";
import {
  AppText,
  Button,
  colors,
  Icon,
  IconButton,
  Pill,
  Poster,
  Screen,
  StateView,
} from "@/components/cinema-ui";
import { useNow } from "@/hooks/use-now";
import { useCinema } from "@/state/cinema-context";
import type { Movie } from "@/types/cinema";
import {
  dayKey,
  fold,
  formatDate,
  formatDuration,
  formatTime,
} from "@/utils/format";

export default function CatalogScreen() {
  const {
    movies,
    categories,
    auditoriums,
    screenings,
    status,
    error,
    refresh,
    selectScreening,
  } = useCinema();
  const { width } = useWindowDimensions();
  const now = useNow();
  const [mode, setMode] = useState<"movies" | "times">("movies");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [onlyScheduled, setOnlyScheduled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const columns =
    mode === "times" ? 1 : width >= 850 ? 4 : width >= 600 ? 3 : 2;
  const contentWidth = Math.min(width, 960) - 40;
  const posterWidth = (contentWidth - (columns - 1) * 16) / columns;
  const upcoming = useMemo(
    () =>
      screenings
        .filter((item) => new Date(item.date).getTime() > now)
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
    [screenings, now],
  );
  const futureMovieIds = useMemo(
    () => new Set(upcoming.map((item) => item.movie_id)),
    [upcoming],
  );
  const matchingMovies = useMemo(
    () =>
      movies.filter(
        (movie) =>
          (!query.trim() || fold(movie.title).includes(fold(query.trim()))) &&
          (categoryId === null || movie.category_id === categoryId),
      ),
    [movies, query, categoryId],
  );
  const matchingMovieIds = new Set(matchingMovies.map((movie) => movie.id));
  const matchingScreenings = upcoming.filter(
    (screening) =>
      matchingMovieIds.has(screening.movie_id) &&
      (roomId === null || screening.auditorium_id === roomId),
  );
  const days = [
    ...new Map(
      matchingScreenings.map((screening) => [
        dayKey(screening.date),
        screening.date,
      ]),
    ).entries(),
  ];
  const activeDay = days.some(([key]) => key === selectedDay)
    ? selectedDay
    : days[0]?.[0];
  const dayScreenings = matchingScreenings.filter(
    (screening) => dayKey(screening.date) === activeDay,
  );
  const scheduledIds = new Set(
    dayScreenings.map((screening) => screening.movie_id),
  );
  const results =
    mode === "times"
      ? matchingMovies.filter((movie) => scheduledIds.has(movie.id))
      : matchingMovies.filter(
          (movie) => !onlyScheduled || futureMovieIds.has(movie.id),
        );
  const openMovie = (movie: Movie) =>
    router.push({ pathname: "/movie/[id]", params: { id: movie.id } });
  const reload = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };
  const metadata = (movie: Movie) =>
    [
      categories.find((category) => category.id === movie.category_id)?.name,
      movie.length !== null ? formatDuration(movie.length) : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <FlatList
        key={`${mode}-${columns}`}
        data={status === "error" ? [] : results}
        numColumns={columns}
        keyExtractor={(movie) => String(movie.id)}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => void reload()}
        contentContainerStyle={styles.content}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brand}>
                <BrandLogo size={36} />
                <View>
                  <AppText style={styles.brandName}>cine elías</AppText>
                </View>
              </View>
              <View style={{ flexDirection: "row" }}>
                <IconButton
                  name={searchOpen ? "close" : "search"}
                  label={searchOpen ? "Cerrar búsqueda" : "Buscar películas"}
                  onPress={() => {
                    setSearchOpen(!searchOpen);
                    if (searchOpen) setQuery("");
                  }}
                />
                <IconButton
                  name="user"
                  label="Abrir mi perfil"
                  onPress={() => router.push("/account")}
                />
              </View>
            </View>
            <View style={styles.modeTabs} accessibilityRole="tablist">
              {(
                [
                  ["movies", "Películas"],
                  ["times", "Horarios"],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: mode === value }}
                  aria-selected={mode === value}
                  onPress={() => setMode(value)}
                  style={[styles.modeTab, mode === value && styles.activeTab]}
                >
                  <AppText
                    style={[
                      styles.tabLabel,
                      mode === value && styles.activeTabLabel,
                    ]}
                  >
                    {label}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <View style={styles.cinemaRow}>
              <View style={styles.cinemaName}>
                <Icon name="film" color={colors.accent} size={19} />
                <AppText style={{ fontWeight: "600", fontSize: 14 }}>
                  {mode === "movies" ? "Cartelera" : "Funciones"}
                </AppText>
              </View>
              <AppText variant="small" muted>
                {results.length}{" "}
                {results.length === 1 ? "película" : "películas"}
              </AppText>
            </View>
            {searchOpen && (
              <View style={styles.search}>
                <Icon name="search" color={colors.muted} size={18} />
                <TextInput
                  accessibilityLabel="Buscar películas"
                  placeholder="Buscar película"
                  placeholderTextColor={colors.muted}
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar búsqueda"
                    onPress={() => setQuery("")}
                    style={styles.clearSearch}
                  >
                    <Icon name="close" size={17} />
                  </Pressable>
                )}
              </View>
            )}
            {movies.length > 0 && (
              <>
                {mode === "movies" ? (
                  <View style={styles.availabilityTabs}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: !onlyScheduled }}
                      onPress={() => setOnlyScheduled(false)}
                      style={styles.availabilityTab}
                    >
                      <AppText
                        style={[
                          styles.availabilityLabel,
                          !onlyScheduled && { color: colors.text },
                        ]}
                      >
                        Todas las películas
                      </AppText>
                      {!onlyScheduled && (
                        <View style={styles.filterUnderline} />
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: onlyScheduled }}
                      onPress={() => setOnlyScheduled(true)}
                      style={styles.availabilityTab}
                    >
                      <AppText
                        style={[
                          styles.availabilityLabel,
                          onlyScheduled && { color: colors.text },
                        ]}
                      >
                        Con funciones
                      </AppText>
                      {onlyScheduled && <View style={styles.filterUnderline} />}
                    </Pressable>
                    {categories.length > 0 && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Filtrar por género"
                        accessibilityState={{ expanded: filtersOpen }}
                        onPress={() => setFiltersOpen(!filtersOpen)}
                        style={{
                          marginLeft: "auto",
                          width: 44,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name="settings"
                          color={
                            categoryId !== null || filtersOpen
                              ? colors.accent
                              : colors.muted
                          }
                          size={19}
                        />
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <>
                    {auditoriums.length > 1 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                      >
                        <Pill
                          label="Todas las salas"
                          selected={roomId === null}
                          onPress={() => setRoomId(null)}
                        />
                        {auditoriums.map((room) => (
                          <Pill
                            key={room.id}
                            label={room.name}
                            selected={roomId === room.id}
                            onPress={() => setRoomId(room.id)}
                          />
                        ))}
                      </ScrollView>
                    )}
                    {days.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                      >
                        {days.map(([key, date]) => (
                          <Pill
                            key={key}
                            label={formatDate(date)}
                            selected={key === activeDay}
                            onPress={() => setSelectedDay(key)}
                          />
                        ))}
                      </ScrollView>
                    )}
                  </>
                )}
                {categories.length > 0 && (filtersOpen || mode === "times") && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.genreRow}
                  >
                    <Pill
                      label="Todos los géneros"
                      selected={categoryId === null}
                      onPress={() => setCategoryId(null)}
                    />
                    {categories.map((category) => (
                      <Pill
                        key={category.id}
                        label={category.name}
                        selected={categoryId === category.id}
                        onPress={() => setCategoryId(category.id)}
                      />
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        }
        renderItem={({ item: movie }) =>
          mode === "movies" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver detalles de ${movie.title}`}
              onPress={() => openMovie(movie)}
              style={({ pressed }) => [
                styles.movie,
                { width: posterWidth, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Poster movie={movie} style={{ width: posterWidth }} />
              <View style={styles.movieMeta}>
                {movie.length !== null && (
                  <View style={styles.duration}>
                    <Icon name="clock" color={colors.muted} size={12} />
                    <AppText variant="small" muted style={{ fontSize: 11 }}>
                      {movie.length} min
                    </AppText>
                  </View>
                )}
                {futureMovieIds.has(movie.id) && (
                  <View style={styles.availableMark}>
                    <AppText style={styles.availableText}>Funciones</AppText>
                  </View>
                )}
              </View>
              <AppText numberOfLines={2} style={styles.movieTitle}>
                {movie.title}
              </AppText>
              {movie.category_id !== null && (
                <AppText variant="small" muted numberOfLines={1}>
                  {categories.find(
                    (category) => category.id === movie.category_id,
                  )?.name ?? "Película"}
                </AppText>
              )}
              <View style={styles.detailLink}>
                <AppText style={styles.detailLabel}>Ver detalle</AppText>
                <Icon name="chevron-right" color={colors.accent} size={14} />
              </View>
            </Pressable>
          ) : (
            <View style={styles.scheduleMovie}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver detalles de ${movie.title}`}
                onPress={() => openMovie(movie)}
                style={styles.scheduleMovieInfo}
              >
                <Poster movie={movie} style={{ width: 76 }} />
                <View style={{ flex: 1, gap: 8 }}>
                  <AppText variant="heading">{movie.title}</AppText>
                  <AppText variant="small" muted>
                    {metadata(movie)}
                  </AppText>
                  <View style={styles.detailLink}>
                    <AppText style={styles.detailLabel}>Ver detalle</AppText>
                    <Icon
                      name="chevron-right"
                      color={colors.accent}
                      size={14}
                    />
                  </View>
                </View>
              </Pressable>
              {[
                ...new Set(
                  dayScreenings
                    .filter((screening) => screening.movie_id === movie.id)
                    .map((screening) => screening.auditorium_id),
                ),
              ].map((auditoriumId) => (
                <View key={auditoriumId} style={styles.room}>
                  <AppText variant="small" muted>
                    {auditoriums.find((room) => room.id === auditoriumId)
                      ?.name ?? `Sala ${auditoriumId}`}
                  </AppText>
                  <View style={styles.timeRow}>
                    {dayScreenings
                      .filter(
                        (screening) =>
                          screening.movie_id === movie.id &&
                          screening.auditorium_id === auditoriumId,
                      )
                      .map((screening) => (
                        <Button
                          key={screening.id}
                          label={formatTime(screening.date)}
                          variant="secondary"
                          style={styles.timeButton}
                          onPress={() => {
                            selectScreening(screening.id);
                            router.push({
                              pathname: "/screening/[id]",
                              params: { id: screening.id },
                            });
                          }}
                        />
                      ))}
                  </View>
                </View>
              ))}
            </View>
          )
        }
        ListEmptyComponent={
          status === "loading" ? (
            <StateView
              loading
              title="Cargando cartelera"
              message="Consultando las películas y funciones del cine."
            />
          ) : status === "error" ? (
            <StateView
              title="No pudimos actualizar la cartelera"
              message={error ?? "Revisa tu conexión e inténtalo de nuevo."}
              icon="refresh"
              actionLabel="Reintentar"
              onAction={() => void reload()}
            />
          ) : movies.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyBrand}>
                <BrandLogo size={82} />
                <AppText style={styles.emptyWordmark}>cine elías</AppText>
              </View>
              <AppText variant="heading" style={{ textAlign: "center" }}>
                Las historias están por llegar
              </AppText>
              <AppText muted style={styles.emptyMessage}>
                Estamos preparando nuestra cartelera. Aquí encontrarás
                películas, horarios y tus próximos lugares favoritos.
              </AppText>
              <Button
                label="Actualizar cartelera"
                icon="refresh"
                onPress={() => void reload()}
                loading={refreshing}
                style={{ alignSelf: "stretch" }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Configurar catálogo"
                onPress={() => router.push("/manage")}
                style={styles.setup}
              >
                <AppText variant="small" muted>
                  Administrar catálogo
                </AppText>
                <Icon name="chevron-right" size={14} color={colors.muted} />
              </Pressable>
            </View>
          ) : (
            <StateView
              title={
                mode === "times"
                  ? "Sin funciones disponibles"
                  : "No encontramos esa película"
              }
              message={
                mode === "times"
                  ? "Prueba otra sala o vuelve más tarde para consultar nuevos horarios."
                  : "Prueba con otro título o cambia los filtros."
              }
              icon={mode === "times" ? "calendar" : "search"}
              actionLabel="Quitar filtros"
              onAction={() => {
                setQuery("");
                setCategoryId(null);
                setRoomId(null);
                setOnlyScheduled(false);
              }}
            />
          )
        }
        ListFooterComponent={
          movies.length > 0 && mode === "times" ? (
            <AppText variant="small" muted style={styles.footer}>
              Horarios en la zona horaria de tu dispositivo.
            </AppText>
          ) : undefined
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    flexGrow: 1,
  },
  header: { gap: 14, paddingBottom: 16 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 55,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandName: {
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -1,
    fontWeight: "800",
  },
  modeTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modeTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 49,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  activeTab: { borderBottomColor: colors.accent },
  tabLabel: { fontWeight: "600", fontSize: 16, color: colors.muted },
  activeTabLabel: { color: colors.text },
  cinemaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 1,
  },
  cinemaName: { flexDirection: "row", alignItems: "center", gap: 9 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.panel,
    paddingLeft: 13,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 13,
    paddingRight: 12,
  },
  clearSearch: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  availabilityTabs: { flexDirection: "row", gap: 22 },
  availabilityTab: { minHeight: 42, justifyContent: "center", gap: 9 },
  availabilityLabel: { fontSize: 13, color: colors.muted },
  filterUnderline: {
    height: 2,
    width: 28,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  genreRow: { gap: 8 },
  filterRow: { gap: 8 },
  gridRow: { gap: 16, alignItems: "flex-start" },
  movie: { marginBottom: 26, gap: 7 },
  movieMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    minHeight: 21,
    marginTop: 3,
  },
  duration: { flexDirection: "row", alignItems: "center", gap: 4 },
  availableMark: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
  },
  availableText: {
    fontSize: 9,
    lineHeight: 16,
    color: "#9DB9FF",
    fontWeight: "600",
  },
  movieTitle: { fontWeight: "600", fontSize: 15, lineHeight: 21 },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 25,
  },
  detailLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },
  scheduleMovie: {
    width: "100%",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: 24,
    marginBottom: 24,
    gap: 18,
  },
  scheduleMovieInfo: { flexDirection: "row", gap: 15, alignItems: "center" },
  room: { gap: 10 },
  timeRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  timeButton: {
    minHeight: 44,
    minWidth: 83,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderColor: "#304D89",
    backgroundColor: colors.accentSoft,
    borderRadius: 7,
  },
  empty: {
    gap: 16,
    paddingTop: 15,
    paddingBottom: 25,
    paddingHorizontal: 12,
    alignItems: "center",
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  emptyBrand: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  emptyWordmark: {
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  emptyMessage: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 23,
    marginBottom: 9,
  },
  setup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 44,
  },
  footer: { textAlign: "center", paddingVertical: 14, fontSize: 11 },
});
