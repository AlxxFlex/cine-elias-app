import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, Icon } from "@/components/cinema-ui";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 15,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarIconStyle: { width: 24, height: 24 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Cartelera",
          tabBarIcon: ({ color }) => (
            <Icon name="film" color={String(color)} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Mis boletos",
          tabBarIcon: ({ color }) => (
            <Icon name="ticket" color={String(color)} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Mi perfil",
          tabBarIcon: ({ color }) => (
            <Icon name="user" color={String(color)} size={23} />
          ),
        }}
      />
    </Tabs>
  );
}
