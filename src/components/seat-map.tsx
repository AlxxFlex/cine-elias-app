import { memo, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppText, colors } from "@/components/cinema-ui";
import type { Seat } from "@/types/cinema";
import { seatLabel } from "@/utils/format";

type SeatMapProps = {
  seats: Seat[];
  occupiedIds: Set<number>;
  selectedIds: number[];
  disabled?: boolean;
  onToggle: (id: number) => void;
};

export const SeatMap = memo(function SeatMap({
  seats,
  occupiedIds,
  selectedIds,
  disabled,
  onToggle,
}: SeatMapProps) {
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReducedMotion(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    for (const seat of seats) {
      const label = seat.row_label?.trim() || "";
      grouped.set(label, [...(grouped.get(label) ?? []), seat]);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
      .map(([label, rowSeats]) => ({
        label,
        seats: rowSeats.sort(
          (a, b) => a.seat_number - b.seat_number || a.id - b.id,
        ),
      }));
  }, [seats]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.screen} />
      <AppText variant="small" muted style={styles.screenLabel}>
        Pantalla
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.mapContent}
      >
        <View style={styles.map}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <AppText variant="small" muted style={styles.rowLabel}>
                {row.label || "—"}
              </AppText>
              {row.seats.map((seat) => {
                const occupied = occupiedIds.has(seat.id);
                const selected = selectedIds.includes(seat.id);
                return (
                  <Pressable
                    key={seat.id}
                    accessibilityRole="checkbox"
                    aria-checked={selected}
                    accessibilityLabel={`Asiento ${seatLabel(seat)}${occupied ? ", ocupado" : ", disponible"}`}
                    accessibilityState={{
                      checked: selected,
                      disabled: occupied || disabled,
                    }}
                    disabled={occupied || disabled}
                    onPress={() => onToggle(seat.id)}
                    style={({ pressed }) => [
                      styles.seatTarget,
                      !reducedMotion && {
                        transform: [
                          { scale: pressed ? 0.92 : selected ? 1.04 : 1 },
                        ],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.seat,
                        occupied && styles.occupied,
                        selected && styles.selected,
                      ]}
                    >
                      <AppText
                        variant="small"
                        style={[
                          styles.number,
                          occupied && styles.occupiedNumber,
                          selected && styles.selectedNumber,
                        ]}
                      >
                        {occupied ? "×" : seat.seat_number}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
              <AppText variant="small" muted style={styles.rowLabel}>
                {row.label || "—"}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.legend}>
        {(
          [
            ["Disponible", styles.seat],
            ["Tu selección", styles.selected],
            ["Ocupado", styles.occupied],
          ] as const
        ).map(([label, style]) => (
          <View key={label} style={styles.legendItem}>
            <View style={[style, styles.swatch]} />
            <AppText variant="small" muted>
              {label}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="small" muted style={styles.hint}>
        Desliza la sala horizontalmente para ver todos los asientos.
        {rows.some((row) => !row.label)
          ? " — indica asientos sin fila asignada."
          : ""}
      </AppText>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 22,
    gap: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  screen: {
    height: 3,
    width: "72%",
    backgroundColor: "#D0D0D6",
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    alignSelf: "center",
  },
  screenLabel: { textAlign: "center", marginBottom: 10, letterSpacing: 0.2 },
  mapContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  map: { gap: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  rowLabel: { width: 28, textAlign: "center" },
  seatTarget: {
    width: 44,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  seat: {
    height: 34,
    width: 36,
    borderRadius: 6,
    borderBottomWidth: 3,
    borderWidth: 1,
    borderColor: "#69696D",
    backgroundColor: "#323235",
    justifyContent: "center",
    alignItems: "center",
  },
  occupied: { backgroundColor: "#1C1C1F", borderColor: "#303033" },
  selected: { backgroundColor: colors.action, borderColor: colors.accent },
  number: { color: colors.text, fontWeight: "600", fontSize: 12 },
  occupiedNumber: { color: "#66666E", fontSize: 18 },
  selectedNumber: { color: colors.text },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: {
    height: 12,
    width: 12,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 3,
  },
  hint: { textAlign: "center", paddingHorizontal: 20, lineHeight: 20 },
});
