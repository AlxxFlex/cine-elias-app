import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

/** Keep time-dependent UI current without impure reads during rendering. */
export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = setInterval(update, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => setNow(Date.now()), 0);
      return () => clearTimeout(timeout);
    }, []),
  );
  return now;
}
