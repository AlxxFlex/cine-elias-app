import { Image } from "expo-image";
import { router } from "expo-router";
import {
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { imageUrl } from "@/services/api";
import type { Movie } from "@/types/cinema";
import { colors } from "@/constants/cinema-theme";

export { colors } from "@/constants/cinema-theme";

const paths = {
  "arrow-left": '<path d="m12 5-7 7 7 7M5 12h14"/>',
  "arrow-right": '<path d="m12 5 7 7-7 7M5 12h14"/>',
  "chevron-right": '<path d="m9 5 7 7-7 7"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18M17 3v18M3 8h4m10 0h4M3 16h4m10 0h4"/>',
  ticket:
    '<path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z"/><path stroke-dasharray="2 3" d="M15 5v14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#151515"/><circle cx="15" cy="17" r="3" fill="#151515"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
} as const;
export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 22,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
  return (
    <Image
      source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
    />
  );
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => subscription.remove();
  }, []);
  return reduced;
}

export function AppText({
  variant = "body",
  muted = false,
  style,
  ...props
}: TextProps & {
  variant?: "display" | "title" | "heading" | "body" | "small" | "eyebrow";
  muted?: boolean;
}) {
  return (
    <Text
      accessibilityRole={
        variant === "display" || variant === "title" || variant === "heading"
          ? "header"
          : undefined
      }
      {...props}
      style={[
        styles.text,
        styles[variant],
        muted && { color: colors.muted },
        style,
      ]}
    />
  );
}

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
}: PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.screen, style]}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.screenContent, contentStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fixedContent, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && { opacity: 0.7, transform: [{ scale: reduced ? 1 : 0.98 }] },
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : icon ? (
        <Icon name={icon} color={colors.text} size={19} />
      ) : null}
      <AppText
        style={[
          styles.buttonLabel,
          variant === "primary" && { color: colors.text },
        ]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  name,
  label,
  onPress,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}
    >
      <Icon name={name} />
    </Pressable>
  );
}

export function PageHeader({
  title,
  subtitle,
  back = false,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      {back && (
        <IconButton
          name="arrow-left"
          label="Regresar"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
      )}
      <View style={{ flex: 1, gap: 5 }}>
        <AppText variant="title">{title}</AppText>
        {subtitle && (
          <AppText variant="small" muted>
            {subtitle}
          </AppText>
        )}
      </View>
      {right}
    </View>
  );
}

export function StateView({
  title,
  message,
  icon = "film",
  actionLabel,
  onAction,
  loading = false,
}: {
  title: string;
  message: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <View style={styles.stateIcon}>
        {loading ? (
          <ActivityIndicator color={colors.accent} size="large" />
        ) : (
          <Icon name={icon} size={30} color={colors.accent} />
        )}
      </View>
      <AppText variant="heading" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      <AppText muted style={{ textAlign: "center", maxWidth: 350 }}>
        {message}
      </AppText>
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={{ marginTop: 8 }}
        />
      )}
    </View>
  );
}

export function Pill({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.pillSelected,
        pressed && { opacity: 0.65 },
      ]}
    >
      <AppText
        variant="small"
        style={
          selected
            ? { color: colors.text, fontWeight: "600" }
            : { color: colors.muted }
        }
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function Poster({
  movie,
  style,
}: {
  movie: Movie;
  style?: StyleProp<ViewStyle>;
}) {
  const [failedUri, setFailedUri] = useState<string | undefined>();
  const reduced = useReducedMotion();
  const uri = imageUrl(movie.image);
  return (
    <View style={[styles.poster, style]}>
      {uri && failedUri !== uri ? (
        <Image
          source={{ uri }}
          recyclingKey={String(movie.id)}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={reduced ? 0 : 180}
          onError={() => setFailedUri(uri)}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={`Cartel de ${movie.title}`}
        />
      ) : (
        <View style={styles.posterFallback}>
          <Icon name="film" size={36} color={colors.muted} />
          <AppText variant="small" muted style={{ textAlign: "center" }}>
            {movie.title}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 44,
    gap: 20,
  },
  fixedContent: {
    flex: 1,
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  text: { color: colors.text, fontSize: 15, lineHeight: 23 },
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.9,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  body: { fontSize: 15, lineHeight: 24 },
  small: { fontSize: 13, lineHeight: 19 },
  eyebrow: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  button: {
    minHeight: 52,
    borderRadius: 9,
    paddingHorizontal: 20,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primary: { backgroundColor: colors.action },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: "transparent" },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
  },
  state: {
    paddingVertical: 34,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 14,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  pill: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.panel,
  },
  pillSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  poster: {
    backgroundColor: colors.surface,
    aspectRatio: 2 / 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
    padding: 12,
  },
});
