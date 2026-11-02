import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { FormField, FormMessage } from "@/components/cinema-form";
import {
  AppText,
  Button,
  Icon,
  PageHeader,
  Screen,
  colors,
} from "@/components/cinema-ui";
import { API_BASE_URL, ApiError, api } from "@/services/api";
import { useCinema } from "@/state/cinema-context";
import type { User } from "@/types/cinema";

export default function AccountScreen() {
  const {
    user,
    setUser,
    selection,
    status,
    error: connectionError,
    refresh,
  } = useCinema();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgetting, setForgetting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createdProfile, setCreatedProfile] = useState<User | null>(null);
  const saving = useRef(false);
  const hasSelection =
    selection.screeningId !== null && selection.seatIds.length > 0;

  async function createProfile() {
    if (saving.current) return;
    if (!createdProfile) {
      if (!name.trim() || name.trim().length > 75)
        return setError("Escribe tu nombre, con un máximo de 75 caracteres.");
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        email.trim().length > 75
      )
        return setError(
          "Escribe un correo electrónico válido, de hasta 75 caracteres.",
        );
      if (!password.length || password.length > 255)
        return setError(
          "La contraseña es obligatoria y admite hasta 255 caracteres.",
        );
    }
    saving.current = true;
    setBusy(true);
    setError(null);
    let profile = createdProfile;
    try {
      if (!profile) {
        const submittedPassword = password;
        setPassword("");
        profile = await api.create("users", {
          name: name.trim(),
          email: email.trim(),
          password: submittedPassword,
        });
        setCreatedProfile(profile);
      }
      await setUser(profile);
      setCreatedProfile(null);
      setName("");
      setEmail("");
    } catch (cause) {
      setError(
        profile
          ? "Tu perfil se creó, pero no pudo guardarse en este dispositivo. Pulsa de nuevo para guardar el mismo perfil."
          : cause instanceof ApiError &&
              (cause.status === 0 || cause.status >= 500)
            ? "No recibimos confirmación del servidor. El perfil podría haberse creado. Revisa la conexión y consulta al cine antes de volver a registrarte; esta API no permite recuperar perfiles mediante inicio de sesión."
            : cause instanceof ApiError && cause.status === 409
              ? "El correo ya está registrado o los datos entraron en conflicto. Esta API no permite iniciar sesión para recuperar un perfil existente. Consulta al cine."
              : cause instanceof Error
                ? cause.message
                : "No pudimos crear tu perfil. Revisa los datos y la conexión.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function forgetProfile() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await setUser(null);
      setForgetting(false);
    } catch {
      setError(
        "No pudimos quitar el perfil del dispositivo. Intenta de nuevo.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function refreshConnection() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Screen>
        <PageHeader title="Mi perfil" subtitle="Tu cuenta de visitante" />

        {user ? (
          <View style={styles.card}>
            <View style={styles.profileHeading}>
              <View style={styles.avatar}>
                <AppText variant="heading" style={{ color: colors.text }}>
                  {user.name.charAt(0).toLocaleUpperCase("es-MX")}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="small" muted>
                  Visitante
                </AppText>
                <AppText variant="heading">{user.name}</AppText>
                <AppText variant="small" muted>
                  {user.email}
                </AppText>
              </View>
            </View>
            <AppText variant="small" muted>
              Tu perfil se guarda en este dispositivo y vincula los boletos
              emitidos a tu nombre.
            </AppText>
            {hasSelection ? (
              <Button
                label="Continuar con mis asientos"
                icon="arrow-right"
                onPress={() => router.push("/summary")}
              />
            ) : null}
            <Button
              label="Ver mis boletos"
              variant="secondary"
              icon="ticket"
              onPress={() => router.navigate("/tickets")}
            />
            {forgetting ? (
              <View style={styles.notice}>
                <AppText variant="small">
                  Al quitar este perfil perderás el acceso a su historial desde
                  la app. Los boletos siguen en el servidor. La API no permite
                  iniciar sesión para recuperarlo.
                </AppText>
                <Button
                  label="Conservar perfil"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => setForgetting(false)}
                />
                <Button
                  label="Quitar de este dispositivo"
                  variant="ghost"
                  loading={busy}
                  onPress={forgetProfile}
                />
              </View>
            ) : (
              <Button
                label="Quitar perfil del dispositivo"
                variant="ghost"
                onPress={() => setForgetting(true)}
              />
            )}
            {error ? <FormMessage message={error} /> : null}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.profileHeading}>
              <View style={styles.outlineAvatar}>
                <Icon name="user" size={24} color={colors.accent} />
              </View>
              <View style={styles.flex}>
                <AppText variant="heading">Crea tu perfil</AppText>
                <AppText variant="small" muted>
                  Guarda tus boletos en un solo lugar.
                </AppText>
              </View>
            </View>
            <FormField
              label="Nombre"
              placeholder="Tu nombre"
              value={name}
              onChangeText={setName}
              maxLength={75}
              autoComplete="name"
              editable={!busy && !createdProfile}
            />
            <FormField
              label="Correo electrónico"
              placeholder="tu@correo.com"
              value={email}
              onChangeText={setEmail}
              maxLength={75}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!busy && !createdProfile}
            />
            <FormField
              label="Contraseña"
              placeholder="Requerida por el servidor"
              hint="Se envía al crear el perfil y no se guarda en el dispositivo."
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              maxLength={255}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              editable={!busy && !createdProfile}
              onSubmitEditing={createProfile}
            />
            {error ? <FormMessage message={error} /> : null}
            <Button
              label={
                createdProfile ? "Guardar perfil creado" : "Crear mi perfil"
              }
              icon="arrow-right"
              loading={busy}
              onPress={createProfile}
            />
            <AppText variant="small" muted>
              La API permite registrar visitantes, pero no ofrece inicio de
              sesión. Este perfil local vincula tus boletos; conserva sus datos
              en este dispositivo.
            </AppText>
          </View>
        )}

        <View style={styles.section}>
          <AppText variant="small" style={styles.sectionLabel}>
            Administración
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir gestión"
            onPress={() => router.push("/manage")}
            style={({ pressed }) => [
              styles.managementRow,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="settings" size={22} color={colors.muted} />
            <View style={styles.flex}>
              <AppText style={styles.rowTitle}>Gestionar catálogo</AppText>
              <AppText variant="small" muted>
                Películas, funciones, salas y asientos
              </AppText>
            </View>
            <Icon name="chevron-right" size={17} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.connection}>
          <View style={styles.connectionTitle}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    status === "ready" && !connectionError
                      ? colors.accent
                      : colors.muted,
                },
              ]}
            />
            <AppText variant="small">
              {status === "loading"
                ? "Conectando con el cine"
                : connectionError
                  ? "Conexión por revisar"
                  : "Conectado con el cine"}
            </AppText>
          </View>
          <AppText variant="small" muted selectable>
            {API_BASE_URL}
          </AppText>
          {connectionError ? (
            <AppText variant="small" style={{ color: colors.danger }}>
              {connectionError}
            </AppText>
          ) : null}
          <Button
            label="Actualizar conexión"
            variant="ghost"
            icon="refresh"
            loading={refreshing}
            onPress={refreshConnection}
          />
        </View>
        <AppText variant="small" muted style={styles.signature}>
          Cine Elías
        </AppText>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 18,
    gap: 16,
  },
  profileHeading: { flexDirection: "row", alignItems: "center", gap: 13 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.action,
  },
  outlineAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  notice: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  section: { gap: 10, marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: "600" },
  managementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    minHeight: 76,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.65 },
  connection: {
    gap: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  connectionTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  signature: { textAlign: "center", marginTop: 4, marginBottom: 12 },
});
