import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { colors, fonts, radius, spacing } from "../lib/theme";
import { EyebrowLabel } from "./EyebrowLabel";

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

export function LastWateredField({ value, onChange, disabled = false }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [draftDate, setDraftDate] = useState(new Date());
  const selectedDate = value ? new Date(value) : null;
  const isToday = selectedDate?.toDateString() === new Date().toDateString();

  function openPicker() {
    const date = selectedDate ?? new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: date,
        mode: "date",
        maximumDate: new Date(),
        onValueChange: (_, chosenDate) => onChange(chosenDate.toISOString()),
      });
    } else {
      setDraftDate(date);
      setShowPicker(true);
    }
  }

  return (
    <View style={styles.field}>
      <EyebrowLabel>Last watered</EyebrowLabel>
      <View style={styles.choices}>
        {[
          { label: "Today", selected: !!isToday, action: () => onChange(new Date().toISOString()) },
          { label: "A few days", selected: !!selectedDate && !isToday, action: openPicker },
          { label: "Not sure", selected: !selectedDate, action: () => onChange(null) },
        ].map(({ label, selected, action }) => (
          <Pressable
            key={label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={action}
            style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {selectedDate && !isToday && (
        <Text style={styles.date}>{selectedDate.toLocaleDateString()}</Text>
      )}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.heading}>When did you last water it?</Text>
            {showPicker && (
              <DateTimePicker
                value={draftDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onValueChange={(_, date) => setDraftDate(date)}
              />
            )}
            <Pressable style={[styles.chip, styles.selected]} onPress={() => {
              onChange(draftDate.toISOString());
              setShowPicker(false);
            }}>
              <Text style={[styles.label, styles.selectedLabel]}>Use this date</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => setShowPicker(false)}>
              <Text style={styles.label}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.base },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    minHeight: 44, paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    justifyContent: "center", alignItems: "center", borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.forest, borderColor: colors.forest },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.hankenMedium, fontSize: 15, color: colors.bark },
  selectedLabel: { color: colors.paper },
  date: { fontFamily: fonts.monoRegular, fontSize: 14, color: colors.bark, marginTop: spacing.sm },
  backdrop: { flex: 1, justifyContent: "center", padding: spacing.gutter, backgroundColor: "#00000066" },
  sheet: { backgroundColor: colors.paper, padding: spacing.base, borderRadius: radius.lg, gap: spacing.sm },
  heading: { fontFamily: fonts.spectralMedium, fontSize: 22, color: colors.ink },
});
