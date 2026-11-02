import {
  DarkTheme,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  colors,
  Screen,
  StateView,
  useReducedMotion,
} from "@/components/cinema-ui";
import { CinemaProvider } from "@/state/cinema-context";

export const unstable_settings = { anchor: "(tabs)" };

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <Screen>
        <StateView
          title="Volvamos a intentarlo"
          message="No se pudo mostrar esta pantalla. Tu información en el servidor se conserva."
          actionLabel="Reintentar"
          onAction={() => void retry()}
        />
      </Screen>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const reduced = useReducedMotion();
  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={{
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: colors.bg,
            card: colors.panel,
            primary: colors.text,
            border: colors.border,
          },
        }}
      >
        <CinemaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: reduced ? "none" : "slide_from_right",
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="movie/[id]" />
            <Stack.Screen name="screening/[id]" />
            <Stack.Screen name="summary" />
            <Stack.Screen name="manage" />
          </Stack>
        </CinemaProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
