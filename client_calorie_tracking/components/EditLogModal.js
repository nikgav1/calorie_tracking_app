import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  Alert,
  InputAccessoryView,
} from "react-native";
import * as Yup from "yup";
import { api } from "../auth/api";
import { calcCaloriesFromMacros, normalizeLog } from "../utils/nutrition";

const GLOBAL_DONE_ACCESSORY = "EDIT_LOG_DONE";

const schema = Yup.object().shape({
  name: Yup.string().required("Name required"),
  protein: Yup.number().typeError("Protein must be a number").min(0).required("Protein required"),
  fat: Yup.number().typeError("Fat must be a number").min(0).required("Fat required"),
  carbohydrates: Yup.number().typeError("Carbs must be a number").min(0).required("Carbs required"),
});

export default function EditLogModal({ visible, payload, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});
  const originalRef = useRef({ ccal: 0, protein: 0, fat: 0, carbohydrates: 0 });

  const proteinRef = useRef(null);
  const fatRef = useRef(null);
  const carbsRef = useRef(null);

  useEffect(() => {
    if (visible && payload?.initial) {
      setName(payload.initial.name ?? "");
      setProtein(String(Number(payload.initial.protein || 0)));
      setFat(String(Number(payload.initial.fat || 0)));
      setCarbs(String(Number(payload.initial.carbohydrates || 0)));
      originalRef.current = {
        ccal: Number(payload.initial.kcal || payload.initial.ccal || 0),
        protein: Number(payload.initial.protein || 0),
        fat: Number(payload.initial.fat || 0),
        carbohydrates: Number(payload.initial.carbohydrates || 0),
      };
      setErrors({});
      Keyboard.dismiss();
    }
  }, [visible, payload]);

  if (!visible) return null;

  const renderDelta = (newVal, origVal) => {
    const diff = Number(newVal) - Number(origVal);
    if (!diff) return <Text style={{ color: "#888" }}>±0</Text>;
    const sign = diff > 0 ? "+" : "";
    return <Text style={{ color: diff > 0 ? "#2ecc71" : "#e67e22", fontWeight: "700" }}>{sign}{diff} kcal</Text>;
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const toValidate = {
        name: (name || "").trim(),
        protein: Number.parseInt(protein || "0", 10) || 0,
        fat: Number.parseInt(fat || "0", 10) || 0,
        carbohydrates: Number.parseInt(carbs || "0", 10) || 0,
      };
      await schema.validate(toValidate, { abortEarly: false });

      const normalized = normalizeLog({
        name: toValidate.name,
        protein: toValidate.protein,
        fat: toValidate.fat,
        carbohydrates: toValidate.carbohydrates,
      });

      const meal = payload?.meal;
      const logId = payload?.logId;
      if (!meal || !logId) throw new Error("Missing payload identifiers");

      const dateParam = new Date().toISOString();
      const endpoint = `/log/days/${encodeURIComponent(dateParam)}/${encodeURIComponent(meal)}/${encodeURIComponent(logId)}`;

      await api.put(endpoint, normalized);

      setSaving(false);
      onSaved && onSaved();
      Alert.alert("Saved", "Log updated");
    } catch (err) {
      setSaving(false);
      if (err.name === "ValidationError" && Array.isArray(err.inner)) {
        const e = {};
        err.inner.forEach((ve) => { if (ve.path) e[ve.path] = ve.message; });
        setErrors(e);
      } else {
        console.error("Update failed", err);
        Alert.alert("Update failed", String(err?.message || err));
      }
    }
  };

  const confirmDelete = () => {
    Alert.alert("Confirm", "Delete this log?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            const meal = payload?.meal;
            const logId = payload?.logId;
            if (!meal || !logId) throw new Error("Missing payload identifiers");
            const dateParam = new Date().toISOString();
            const endpoint = `/log/days/${encodeURIComponent(dateParam)}/${encodeURIComponent(meal)}/${encodeURIComponent(logId)}`;
            await api.delete(endpoint);
            setDeleting(false);
            onSaved && onSaved();
            Alert.alert("Deleted");
          } catch (err) {
            setDeleting(false);
            console.error("Delete failed", err);
            Alert.alert("Delete failed", String(err?.message || err));
          }
        },
      },
    ]);
  };

  // computed calories from the current macro inputs (strings allowed)
  const computedKcal = calcCaloriesFromMacros(protein || "0", fat || "0", carbs || "0");

  // numeric display helpers (current shown as integers)
  const displayProtein = Number.parseInt(protein || "0", 10) || 0;
  const displayFat = Number.parseInt(fat || "0", 10) || 0;
  const displayCarbs = Number.parseInt(carbs || "0", 10) || 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose && onClose()}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ width: "100%", alignItems: "center" }}
            keyboardVerticalOffset={Platform.select({ ios: 80, android: 60 })}
          >
            {Platform.OS === "ios" && (
              <InputAccessoryView nativeID={GLOBAL_DONE_ACCESSORY}>
                <View style={styles.accessoryContainer}>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={styles.accessoryButton} onPress={() => Keyboard.dismiss()}>
                    <Text style={styles.accessoryButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </InputAccessoryView>
            )}

            <ScrollView contentContainerStyle={[styles.modalContent, { width: "90%" }]} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Edit log</Text>

              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                editable={!saving && !deleting}
                placeholder="Name"
                returnKeyType="next"
              />

              {/* ---------- Kcal display: CURRENT macros as Text (left), previous + ±ccal (right) ---------- */}
              <View style={{ width: "100%", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "600" }}>Kcal</Text>
                  <Text style={{ color: "#666" }}>was: {originalRef.current.ccal} kcal</Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                  {/* LEFT: computed kcal + current macros (as Text, cheap to render) */}
                  <View style={[styles.computedRow, { flex: 1 }]}>
                    <Text style={styles.computedText}>{String(computedKcal)} kcal</Text>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                      <Text style={styles.macroText}>Protein: <Text style={styles.macroValue}>{displayProtein} g</Text></Text>
                      <Text style={styles.macroTextSmall}>was {originalRef.current.protein} g</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                      <Text style={styles.macroText}>Fat: <Text style={styles.macroValue}>{displayFat} g</Text></Text>
                      <Text style={styles.macroTextSmall}>was {originalRef.current.fat} g</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                      <Text style={styles.macroText}>Carbs: <Text style={styles.macroValue}>{displayCarbs} g</Text></Text>
                      <Text style={styles.macroTextSmall}>was {originalRef.current.carbohydrates} g</Text>
                    </View>
                  </View>

                  <View style={{ width: 88, alignItems: "center", marginLeft: 8 }}>
                    {renderDelta(computedKcal, originalRef.current.ccal)}
                    <Text style={{ fontSize: 12, color: "#666", marginTop: 8 }}>orig {originalRef.current.ccal} kcal</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Protein (g)</Text>
              <View style={styles.rowInput}>
                <TextInput
                  ref={proteinRef}
                  style={[styles.input, { flex: 1 }]}
                  value={String(protein)}
                  onChangeText={setProtein}
                  editable={!saving && !deleting}
                  keyboardType="numeric"
                  returnKeyType="next"
                  inputAccessoryViewID={GLOBAL_DONE_ACCESSORY}
                  onSubmitEditing={() => fatRef.current?.focus?.()}
                />
                {Platform.OS === "android" && (
                  <TouchableOpacity style={styles.inlineDone} onPress={() => Keyboard.dismiss()}>
                    <Text style={styles.inlineDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
              {errors.protein && <Text style={{ color: "red", alignSelf: "flex-start" }}>{errors.protein}</Text>}

              <Text style={styles.fieldLabel}>Fat (g)</Text>
              <View style={styles.rowInput}>
                <TextInput
                  ref={fatRef}
                  style={[styles.input, { flex: 1 }]}
                  value={String(fat)}
                  onChangeText={setFat}
                  editable={!saving && !deleting}
                  keyboardType="numeric"
                  returnKeyType="next"
                  inputAccessoryViewID={GLOBAL_DONE_ACCESSORY}
                  onSubmitEditing={() => carbsRef.current?.focus?.()}
                />
                {Platform.OS === "android" && (
                  <TouchableOpacity style={styles.inlineDone} onPress={() => Keyboard.dismiss()}>
                    <Text style={styles.inlineDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
              {errors.fat && <Text style={{ color: "red", alignSelf: "flex-start" }}>{errors.fat}</Text>}

              <Text style={styles.fieldLabel}>Carbohydrates (g)</Text>
              <View style={styles.rowInput}>
                <TextInput
                  ref={carbsRef}
                  style={[styles.input, { flex: 1 }]}
                  value={String(carbs)}
                  onChangeText={setCarbs}
                  editable={!saving && !deleting}
                  keyboardType="numeric"
                  returnKeyType="done"
                  inputAccessoryViewID={GLOBAL_DONE_ACCESSORY}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                {Platform.OS === "android" && (
                  <TouchableOpacity style={styles.inlineDone} onPress={() => Keyboard.dismiss()}>
                    <Text style={styles.inlineDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
              {errors.carbohydrates && <Text style={{ color: "red", alignSelf: "flex-start" }}>{errors.carbohydrates}</Text>}

              <View style={{ flexDirection: "row", width: "100%", justifyContent: "space-between", marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#999", width: "30%" }]}
                  onPress={() => onClose && onClose()}
                  disabled={saving || deleting}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#e74c3c", width: "30%" }]}
                  onPress={confirmDelete}
                  disabled={saving || deleting}
                >
                  {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Delete</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#007aff", width: "30%" }]}
                  onPress={handleSave}
                  disabled={saving || deleting}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 12, alignItems: "stretch" },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#ddd", paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, backgroundColor: "#fff", marginBottom: 8, minHeight: 44 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonText: { color: "#fff", fontWeight: "700" },
  accessoryContainer: { backgroundColor: "#f2f2f2", borderTopWidth: 1, borderColor: "#d0d0d0", padding: 6, flexDirection: "row", alignItems: "center" },
  accessoryButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginRight: 8 },
  accessoryButtonText: { color: "#007aff", fontWeight: "700" },
  inlineDone: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#ddd", alignItems: "center", justifyContent: "center" },
  inlineDoneText: { fontSize: 14 },
  rowInput: { flexDirection: "row", alignItems: "center", width: "100%" },

  computedRow: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#f4f6f8", borderRadius: 8, marginBottom: 8 },
  computedText: { fontSize: 20, fontWeight: "800" },
  macroText: { fontSize: 13, color: "#333" },
  macroValue: { fontWeight: "700" },
  macroTextSmall: { fontSize: 12, color: "#666" },
});
