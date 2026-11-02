import { useRef, useState, type ComponentRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormChoices, FormField, FormMessage } from "@/components/cinema-form";
import {
  AppText,
  Button,
  Icon,
  PageHeader,
  Pill,
  Screen,
  colors,
} from "@/components/cinema-ui";
import { ApiError, api } from "@/services/api";
import { useCinema } from "@/state/cinema-context";
import type { ResourceInput, ResourceMap } from "@/types/cinema";

type ManagedResource =
  | "movies"
  | "categories"
  | "directors"
  | "auditoriums"
  | "seats"
  | "movie-screenings";
type ManagedRecord = ResourceMap[ManagedResource];
type FormValues = {
  name: string;
  title: string;
  length: string;
  movie_summary: string;
  image: string;
  director_id: string;
  category_id: string;
  auditorium_id: string;
  movie_id: string;
  row_label: string;
  seat_number: string;
  day: string;
  time: string;
};

const resources: { key: ManagedResource; label: string; singular: string }[] = [
  { key: "movies", label: "Películas", singular: "película" },
  { key: "movie-screenings", label: "Funciones", singular: "función" },
  { key: "auditoriums", label: "Salas", singular: "sala" },
  { key: "seats", label: "Asientos", singular: "asiento" },
  { key: "categories", label: "Categorías", singular: "categoría" },
  { key: "directors", label: "Directores", singular: "director" },
];
const emptyForm: FormValues = {
  name: "",
  title: "",
  length: "",
  movie_summary: "",
  image: "",
  director_id: "",
  category_id: "",
  auditorium_id: "",
  movie_id: "",
  row_label: "",
  seat_number: "",
  day: "",
  time: "",
};
const namedLimits = { categories: 25, directors: 50, auditoriums: 75 };

function wholeNumber(value: string, label: string, minimum = 0) {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < minimum)
    throw new Error(
      `${label}: escribe un número entero ${minimum ? "mayor que cero" : "igual o mayor que cero"}.`,
    );
  return number;
}

function screeningDate(day: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time))
    throw new Error(
      "Escribe la fecha como AAAA-MM-DD y la hora como HH:MM, en formato de 24 horas.",
    );
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const parsed = new Date(year, month - 1, date, hours, minutes);
  if (
    year < 1900 ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== date ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  )
    throw new Error(
      "La fecha u hora no es válida. Revisa los datos de la función.",
    );
  return parsed.toISOString();
}

function editForm(item: ManagedRecord): FormValues {
  const form = { ...emptyForm };
  for (const key of Object.keys(form) as (keyof FormValues)[]) {
    if (key in item)
      form[key] = String(
        (item as unknown as Record<string, unknown>)[key] ?? "",
      );
  }
  if ("date" in item) {
    const date = new Date(item.date);
    const pad = (number: number) => String(number).padStart(2, "0");
    form.day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    form.time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return form;
}

export default function ManageScreen() {
  const cinema = useCinema();
  const insets = useSafeAreaInsets();
  const [resource, setResource] = useState<ManagedResource>("movies");
  const [form, setForm] = useState<FormValues>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<ManagedRecord | null>(
    null,
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const saving = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const definition = resources.find((entry) => entry.key === resource)!;
  const collections = {
    movies: cinema.movies,
    categories: cinema.categories,
    directors: cinema.directors,
    auditoriums: cinema.auditoriums,
    seats: cinema.seats,
    "movie-screenings": cinema.screenings,
  };
  const items: ManagedRecord[] = collections[resource];
  const named =
    resource === "categories" ||
    resource === "directors" ||
    resource === "auditoriums";

  function field(key: keyof FormValues) {
    return {
      value: form[key],
      onChangeText: (value: string) =>
        setForm((previous) => ({ ...previous, [key]: value })),
      editable: !busy,
    };
  }

  function chooseResource(value: ManagedResource) {
    if (saving.current) return;
    setResource(value);
    setForm({ ...emptyForm });
    setEditingId(null);
    setEditingRecord(null);
    setEditorOpen(false);
    setVisibleCount(20);
    setError(null);
    setSuccess(null);
  }

  function openEditor(item?: ManagedRecord) {
    if (saving.current) return;
    setEditingId(item?.id ?? null);
    setEditingRecord(item ?? null);
    setForm(item ? editForm(item) : { ...emptyForm });
    setEditorOpen(true);
    setError(null);
    setSuccess(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function persist<R extends ManagedResource>(
    name: R,
    payload: ResourceInput<R>,
  ) {
    return editingId === null
      ? api.create(name, payload)
      : api.update(name, editingId, payload);
  }

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (
        resource === "categories" ||
        resource === "directors" ||
        resource === "auditoriums"
      ) {
        const name = form.name.trim();
        const limit = namedLimits[resource];
        if (!name || name.length > limit)
          throw new Error(
            `Escribe un nombre de entre 1 y ${limit} caracteres.`,
          );
        await persist(resource, { name });
      } else if (resource === "movies") {
        const title = form.title.trim();
        if (!title || title.length > 75)
          throw new Error("Escribe un título de entre 1 y 75 caracteres.");
        if (
          form.movie_summary.trim().length > 255 ||
          form.image.trim().length > 255
        )
          throw new Error(
            "La sinopsis y la imagen admiten hasta 255 caracteres cada una.",
          );
        if (form.image.trim() && !/^(https?:\/\/|\/)/i.test(form.image.trim()))
          throw new Error(
            "Usa una URL de imagen http(s) o una ruta del servidor que comience con /.",
          );
        const directorId = form.director_id
          ? wholeNumber(form.director_id, "Director", 1)
          : null;
        const categoryId = form.category_id
          ? wholeNumber(form.category_id, "Categoría", 1)
          : null;
        if (
          directorId !== null &&
          !cinema.directors.some((item) => item.id === directorId)
        )
          throw new Error("Selecciona un director disponible.");
        if (
          categoryId !== null &&
          !cinema.categories.some((item) => item.id === categoryId)
        )
          throw new Error("Selecciona una categoría disponible.");
        await persist("movies", {
          title,
          director_id: directorId,
          category_id: categoryId,
          length: form.length ? wholeNumber(form.length, "Duración") : null,
          movie_summary: form.movie_summary.trim() || null,
          image: form.image.trim() || null,
        });
      } else if (resource === "seats") {
        const auditoriumId = wholeNumber(form.auditorium_id, "Sala", 1);
        const seatNumber = wholeNumber(form.seat_number, "Número del asiento");
        const rowLabel = form.row_label.trim() || null;
        if (!cinema.auditoriums.some((item) => item.id === auditoriumId))
          throw new Error("Selecciona una sala disponible.");
        if (rowLabel && rowLabel.length > 2)
          throw new Error("La fila admite hasta 2 caracteres.");
        if (
          cinema.seats.some(
            (item) =>
              item.id !== editingId &&
              item.auditorium_id === auditoriumId &&
              (item.row_label ?? "") === (rowLabel ?? "") &&
              item.seat_number === seatNumber,
          )
        )
          throw new Error(
            "Ya existe un asiento con esa fila y número en la sala.",
          );
        if (editingId !== null) {
          const [currentSeat, currentTickets] = await Promise.all([
            api.get("seats", editingId),
            api.list("tickets"),
          ]);
          if (
            currentSeat.auditorium_id !== auditoriumId &&
            currentTickets.some((ticket) => ticket.seat_id === editingId)
          )
            throw new Error(
              "Este asiento tiene boletos emitidos y no se puede mover a otra sala. Crea un asiento nuevo en la sala correspondiente.",
            );
        }
        await persist("seats", {
          auditorium_id: auditoriumId,
          seat_number: seatNumber,
          row_label: rowLabel,
        });
      } else {
        const movieId = wholeNumber(form.movie_id, "Película", 1);
        const auditoriumId = wholeNumber(form.auditorium_id, "Sala", 1);
        if (!cinema.movies.some((item) => item.id === movieId))
          throw new Error("Selecciona una película disponible.");
        if (!cinema.auditoriums.some((item) => item.id === auditoriumId))
          throw new Error("Selecciona una sala disponible.");
        const originalForm =
          editingRecord && "date" in editingRecord
            ? editForm(editingRecord)
            : null;
        // Keep the server timestamp, including seconds and offset, when the
        // minute-precision inputs were not changed by the operator.
        const date =
          editingRecord &&
          "date" in editingRecord &&
          originalForm?.day === form.day.trim() &&
          originalForm.time === form.time.trim()
            ? editingRecord.date
            : screeningDate(form.day.trim(), form.time.trim());
        if (editingId !== null) {
          const [currentScreening, currentTickets] = await Promise.all([
            api.get("movie-screenings", editingId),
            api.list("tickets"),
          ]);
          if (
            currentTickets.some(
              (ticket) => ticket.movie_screening_id === editingId,
            ) &&
            (currentScreening.movie_id !== movieId ||
              currentScreening.auditorium_id !== auditoriumId ||
              Date.parse(currentScreening.date) !== Date.parse(date))
          )
            throw new Error(
              "Esta función tiene boletos emitidos. No se puede cambiar su película, sala ni horario. Crea una función nueva para conservar los datos de esos boletos.",
            );
        }
        await persist("movie-screenings", {
          movie_id: movieId,
          auditorium_id: auditoriumId,
          date,
        });
      }
      setSuccess(
        editingId === null
          ? "Registro creado en el servidor."
          : "Cambios guardados en el servidor.",
      );
      setForm({ ...emptyForm });
      setEditingId(null);
      setEditingRecord(null);
      setEditorOpen(false);
      await cinema.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)
          ? "No recibimos confirmación del servidor. El cambio podría haberse guardado. Actualiza el catálogo y revisa los registros antes de volver a guardar."
          : cause instanceof Error
            ? cause.message
            : "No pudimos guardar el registro. Revisa los datos y la conexión.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function refresh() {
    if (refreshing || saving.current) return;
    setRefreshing(true);
    try {
      await cinema.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  function recordTitle(item: ManagedRecord) {
    if ("title" in item) return item.title;
    if ("name" in item) return item.name;
    if ("seat_number" in item)
      return `${item.row_label ? `${item.row_label} · ` : ""}Asiento ${item.seat_number}`;
    return (
      cinema.movies.find((movie) => movie.id === item.movie_id)?.title ??
      `Película #${item.movie_id}`
    );
  }

  function recordSubtitle(item: ManagedRecord) {
    if ("date" in item)
      return `${new Date(item.date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} · ${cinema.auditoriums.find((room) => room.id === item.auditorium_id)?.name ?? `Sala #${item.auditorium_id}`}`;
    if ("seat_number" in item)
      return (
        cinema.auditoriums.find((room) => room.id === item.auditorium_id)
          ?.name ?? `Sala #${item.auditorium_id}`
      );
    if ("title" in item)
      return (
        [
          cinema.categories.find((category) => category.id === item.category_id)
            ?.name,
          item.length === null ? null : `${item.length} min`,
        ]
          .filter(Boolean)
          .join(" · ") || `ID ${item.id}`
      );
    return `ID ${item.id}`;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Screen scroll={false}>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(30, insets.bottom + 20) },
          ]}
        >
          <PageHeader
            title="Gestión del cine"
            subtitle="Tu catálogo, conectado de principio a fin."
            back
          />
          <View style={styles.intro}>
            <Icon name="settings" size={20} color={colors.accent} />
            <AppText variant="small" muted style={styles.flex}>
              Los cambios se guardan en el servidor. Para comenzar, agrega
              categorías, directores y salas; después películas, asientos y
              funciones.
            </AppText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {resources.map((item) => (
              <Pill
                key={item.key}
                label={item.label}
                selected={item.key === resource}
                onPress={busy ? undefined : () => chooseResource(item.key)}
              />
            ))}
          </ScrollView>
          {cinema.error ? (
            <View style={styles.notice}>
              <FormMessage message={cinema.error} />
              <Button
                label="Reintentar conexión"
                variant="secondary"
                icon="refresh"
                loading={refreshing}
                onPress={refresh}
              />
            </View>
          ) : null}
          {success ? <FormMessage message={success} success /> : null}
          {error && !editorOpen ? <FormMessage message={error} /> : null}

          {editorOpen ? (
            <View style={styles.editor}>
              <View style={styles.editorTitle}>
                <AppText variant="heading" style={styles.flex}>
                  {editingId === null ? "Agregar" : "Editar"}{" "}
                  {definition.singular}
                </AppText>
                {editingId !== null ? (
                  <AppText variant="small" muted>
                    #{editingId}
                  </AppText>
                ) : null}
              </View>
              {named ? (
                <FormField
                  label="Nombre"
                  placeholder={`Nombre de ${definition.singular}`}
                  maxLength={namedLimits[resource as keyof typeof namedLimits]}
                  {...field("name")}
                />
              ) : null}
              {resource === "movies" ? (
                <>
                  <FormField
                    label="Título"
                    placeholder="Título de la película"
                    maxLength={75}
                    {...field("title")}
                  />
                  <FormField
                    label="Sinopsis · opcional"
                    placeholder="Una breve descripción de la historia"
                    maxLength={255}
                    multiline
                    {...field("movie_summary")}
                  />
                  <FormField
                    label="Duración en minutos · opcional"
                    placeholder="Ej. 120"
                    keyboardType="number-pad"
                    {...field("length")}
                  />
                  <FormChoices
                    label="Categoría · opcional"
                    options={cinema.categories}
                    value={form.category_id}
                    onChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        category_id: value,
                      }))
                    }
                    optionalLabel="Sin categoría"
                    disabled={busy}
                  />
                  <FormChoices
                    label="Director · opcional"
                    options={cinema.directors}
                    value={form.director_id}
                    onChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        director_id: value,
                      }))
                    }
                    optionalLabel="Sin director"
                    disabled={busy}
                  />
                  <FormField
                    label="URL del póster · opcional"
                    placeholder="https://…"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    maxLength={255}
                    {...field("image")}
                  />
                </>
              ) : null}
              {resource === "movie-screenings" ? (
                <FormChoices
                  label="Película"
                  options={cinema.movies.map((item) => ({
                    id: item.id,
                    name: item.title,
                  }))}
                  value={form.movie_id}
                  onChange={(value) =>
                    setForm((previous) => ({ ...previous, movie_id: value }))
                  }
                  disabled={busy}
                />
              ) : null}
              {resource === "seats" || resource === "movie-screenings" ? (
                <FormChoices
                  label="Sala"
                  options={cinema.auditoriums}
                  value={form.auditorium_id}
                  onChange={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      auditorium_id: value,
                    }))
                  }
                  disabled={busy}
                />
              ) : null}
              {resource === "seats" ? (
                <>
                  <FormField
                    label="Fila · opcional"
                    placeholder="Ej. A"
                    maxLength={2}
                    autoCapitalize="characters"
                    {...field("row_label")}
                  />
                  <FormField
                    label="Número del asiento"
                    placeholder="Ej. 1"
                    keyboardType="number-pad"
                    {...field("seat_number")}
                  />
                  <AppText variant="small" muted>
                    Cada asiento pertenece a una sala. Su ocupación se consulta
                    por función.
                  </AppText>
                </>
              ) : null}
              {resource === "movie-screenings" ? (
                <>
                  <FormField
                    label="Fecha · AAAA-MM-DD"
                    placeholder="2026-12-20"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    {...field("day")}
                  />
                  <FormField
                    label="Hora · HH:MM"
                    placeholder="19:30"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    hint="Formato de 24 horas. Se utiliza la zona horaria de este dispositivo y se envía al servidor en ISO 8601."
                    {...field("time")}
                  />
                </>
              ) : null}
              {error ? <FormMessage message={error} /> : null}
              <Button
                label={
                  editingId === null ? "Crear registro" : "Guardar cambios"
                }
                icon="check"
                loading={busy}
                onPress={save}
              />
              <Button
                label="Cancelar"
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  setEditorOpen(false);
                  setEditingId(null);
                  setEditingRecord(null);
                  setError(null);
                }}
              />
            </View>
          ) : (
            <Button
              label={`Agregar ${definition.singular}`}
              icon="plus"
              disabled={cinema.status === "loading"}
              onPress={() => openEditor()}
            />
          )}

          <View style={styles.listTitle}>
            <AppText variant="heading">{definition.label}</AppText>
            <AppText variant="small" muted>
              {items.length} {items.length === 1 ? "registro" : "registros"}
            </AppText>
          </View>
          {cinema.status === "loading" ? (
            <AppText muted>Cargando los registros del cine…</AppText>
          ) : !items.length ? (
            <View style={styles.empty}>
              <Icon name="grid" size={30} color={colors.muted} />
              <AppText variant="heading">Todo empieza aquí</AppText>
              <AppText variant="small" muted style={styles.center}>
                Todavía no hay registros en esta sección. Agrega los datos de tu
                cine para mostrarlos en la app.
              </AppText>
            </View>
          ) : (
            <View style={styles.list}>
              {items.slice(0, visibleCount).map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${recordTitle(item)}`}
                  disabled={busy}
                  onPress={() => openEditor(item)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.flex}>
                    <AppText style={styles.rowTitle}>
                      {recordTitle(item)}
                    </AppText>
                    <AppText variant="small" muted>
                      {recordSubtitle(item)}
                    </AppText>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          )}
          {items.length > visibleCount ? (
            <Button
              label="Mostrar más registros"
              variant="ghost"
              onPress={() => setVisibleCount((count) => count + 20)}
            />
          ) : null}
          <Button
            label="Actualizar catálogo"
            variant="ghost"
            icon="refresh"
            loading={refreshing}
            disabled={busy}
            onPress={refresh}
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { gap: 18, paddingBottom: 30 },
  intro: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    padding: 17,
    backgroundColor: colors.panel,
    borderRadius: 16,
  },
  tabs: { gap: 8, paddingVertical: 3 },
  notice: { gap: 12 },
  editor: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    backgroundColor: colors.panel,
    gap: 20,
  },
  editorTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  listTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: "hidden",
  },
  row: {
    padding: 18,
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.panel,
  },
  rowTitle: { fontWeight: "600", marginBottom: 5 },
  pressed: { backgroundColor: colors.surface },
  empty: {
    paddingVertical: 35,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    gap: 14,
  },
  center: { textAlign: "center", maxWidth: 300 },
});
