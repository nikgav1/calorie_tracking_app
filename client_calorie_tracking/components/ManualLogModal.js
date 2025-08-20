// src/components/ManualLogModal.js
import React, { useRef } from "react";
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
import { Formik } from "formik";
import * as Yup from "yup";
import MealSelector from "./MealSelector";
import { api } from "../auth/api";
import { calcCaloriesFromMacros, normalizeLog } from "../utils/nutrition";

const GLOBAL_DONE_ACCESSORY = "MANUAL_LOG_DONE";

const schema = Yup.object().shape({
  name: Yup.string().required("Name is required").trim().min(2),
  meal: Yup.string().required("Meal is required").trim(),
  protein: Yup.number().typeError("Protein must be a number").min(0).required(),
  fat: Yup.number().typeError("Fat must be a number").min(0).required(),
  carbohydrates: Yup.number().typeError("Carbs must be a number").min(0).required(),
});

export default function ManualLogModal({ visible, onClose, onSaved }) {
  const proteinRef = useRef(null);
  const fatRef = useRef(null);
  const carbsRef = useRef(null);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose && onClose()}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View style={styles.modalContainer}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", alignItems: "center" }} keyboardVerticalOffset={Platform.select({ ios: 80, android: 60 })}>
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
              <Text style={styles.modalTitle}>Manual Log</Text>

              <Formik
                initialValues={{ name: "", meal: "breakfast", protein: "", fat: "", carbohydrates: "" }}
                validationSchema={schema}
                onSubmit={async (values, { setSubmitting }) => {
                  setSubmitting(true);
                  try {
                    const normalized = normalizeLog({
                      name: values.name,
                      protein: values.protein,
                      fat: values.fat,
                      carbohydrates: values.carbohydrates,
                    });
                    const payload = {
                      meal: values.meal,
                      date: new Date().toISOString(),
                      log: normalized,
                    };
                    await api.post("/log/foodLog", payload);
                    setSubmitting(false);
                    onSaved && onSaved();
                    onClose && onClose();
                    Alert.alert("Saved", "Manual log saved.");
                  } catch (err) {
                    setSubmitting(false);
                    console.error("Manual save failed", err);
                    Alert.alert("Save failed", String(err?.message || err));
                  }
                }}
              >
                {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isSubmitting, setFieldValue }) => {
                  const computedKcal = calcCaloriesFromMacros(values.protein || 0, values.fat || 0, values.carbohydrates || 0);
                  return (
                    <>
                      <Text style={styles.fieldLabel}>Name</Text>
                      <TextInput style={styles.input} value={values.name} onChangeText={handleChange("name")} onBlur={handleBlur("name")} placeholder="Name" returnKeyType="next" />

                      <MealSelector value={values.meal} onChange={(v) => setFieldValue("meal", v)} />

                      <Text style={styles.fieldLabel}>Kcal (computed)</Text>
                      {/* display as Text to avoid input lag */}
                      <View style={styles.computedRow}><Text style={styles.computedText}>{String(computedKcal)} kcal</Text></View>

                      <Text style={styles.fieldLabel}>Protein (g)</Text>
                      <TextInput ref={proteinRef} style={styles.input} value={values.protein} onChangeText={handleChange("protein")} keyboardType="numeric" returnKeyType="next" onSubmitEditing={() => fatRef.current?.focus?.()} inputAccessoryViewID={GLOBAL_DONE_ACCESSORY} />

                      <Text style={styles.fieldLabel}>Fat (g)</Text>
                      <TextInput ref={fatRef} style={styles.input} value={values.fat} onChangeText={handleChange("fat")} keyboardType="numeric" returnKeyType="next" onSubmitEditing={() => carbsRef.current?.focus?.()} inputAccessoryViewID={GLOBAL_DONE_ACCESSORY} />

                      <Text style={styles.fieldLabel}>Carbohydrates (g)</Text>
                      <TextInput ref={carbsRef} style={styles.input} value={values.carbohydrates} onChangeText={handleChange("carbohydrates")} keyboardType="numeric" returnKeyType="done" inputAccessoryViewID={GLOBAL_DONE_ACCESSORY} />

                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
                        <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#999", width: "48%" }]} onPress={() => { onClose && onClose(); }} disabled={isSubmitting}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>

                        <TouchableOpacity style={[styles.modalButton, { width: "48%", backgroundColor: "#007aff" }]} onPress={handleSubmit} disabled={isSubmitting}>{isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Save</Text>}</TouchableOpacity>
                      </View>
                    </>
                  );
                }}
              </Formik>
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
  computedRow: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#f4f6f8", borderRadius: 8, marginBottom: 8 },
  computedText: { fontSize: 16, fontWeight: "700" },
});
