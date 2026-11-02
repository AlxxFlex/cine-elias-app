import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { AppText, Pill, colors } from "@/components/cinema-ui";

type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
};

export function FormField({ label, hint, style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <AppText variant="small" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        underlineColorAndroid="transparent"
        {...props}
        style={[styles.input, props.multiline && styles.multiline, style]}
      />
      {hint ? (
        <AppText variant="small" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function FormChoices({
  label,
  options,
  value,
  onChange,
  optionalLabel,
  disabled = false,
}: {
  label: string;
  options: { id: number; name: string }[];
  value: string;
  onChange: (value: string) => void;
  optionalLabel?: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="small" style={styles.label}>
        {label}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.choices}
      >
        {optionalLabel ? (
          <Pill
            label={optionalLabel}
            selected={!value}
            onPress={disabled ? undefined : () => onChange("")}
          />
        ) : null}
        {options.map((option) => (
          <Pill
            key={option.id}
            label={option.name}
            selected={value === String(option.id)}
            onPress={disabled ? undefined : () => onChange(String(option.id))}
          />
        ))}
      </ScrollView>
      {!options.length ? (
        <AppText variant="small" muted>
          Agrega primero un registro en esta categoría.
        </AppText>
      ) : null}
    </View>
  );
}

export function FormMessage({
  message,
  success = false,
}: {
  message: string;
  success?: boolean;
}) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.message, success && styles.success]}
    >
      <AppText
        variant="small"
        style={{ color: success ? "#92C78D" : colors.danger }}
      >
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 13, lineHeight: 19, fontWeight: "500" },
  input: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 15,
    paddingVertical: 14,
    minHeight: 52,
    borderRadius: 8,
    fontSize: 15,
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  choices: { gap: 8, paddingVertical: 2 },
  message: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#2B1C1C",
    borderWidth: 1,
    borderColor: "#624040",
  },
  success: { backgroundColor: "#1C2318", borderColor: "#414E34" },
});
