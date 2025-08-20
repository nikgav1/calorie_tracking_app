import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function StatBar({ label, value, goal, unit }) {
  const pct = percentLocal(value, goal);
  return (
    <View style={{ marginVertical: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontWeight: "600" }}>{label}</Text>
        <Text>
          {value}
          {unit ? ` ${unit}` : ""} / {goal || 0} {unit}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={{ fontSize: 12, color: "#666" }}>{pct}%</Text>
    </View>
  );
}

function percentLocal(current, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 10,
    backgroundColor: "#eee",
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 6,
  },
  progressFill: {
    height: 10,
    backgroundColor: "#4caf50",
  },
});
