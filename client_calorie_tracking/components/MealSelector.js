import React, { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

export default function MealSelector({ value, onChange }) {
  const options = [
    { label: "Breakfast", value: "breakfast" },
    { label: "Lunch", value: "lunch" },
    { label: "Dinner", value: "dinner" },
    { label: "Snacks", value: "snacks" },
  ];
  const [open, setOpen] = useState(false);

  return (
    <View style={{ width: "100%", marginBottom: 8 }}>
      <TouchableOpacity style={styles.mealSelectorButton} onPress={() => setOpen((s) => !s)}>
        <Text>{options.find((o) => o.value === value)?.label ?? "Select meal"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdown}>
          {options.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={styles.dropdownItem}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <Text style={{ fontSize: 16 }}>{o.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.dropdownItem, { backgroundColor: "#eee" }]} onPress={() => setOpen(false)}>
            <Text style={{ color: "#666" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mealSelectorButton: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  dropdown: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
});
