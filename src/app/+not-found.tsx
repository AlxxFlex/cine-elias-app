import { router } from "expo-router";
import { Screen, StateView } from "@/components/cinema-ui";
export default function NotFound() {
  return (
    <Screen>
      <StateView
        title="Esta función no existe"
        message="Regresa a la cartelera para encontrar tu próxima película."
        actionLabel="Ir a cartelera"
        onAction={() => router.replace("/")}
      />
    </Screen>
  );
}
