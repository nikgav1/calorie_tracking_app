import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  InputAccessoryView,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Formik } from "formik";
import * as Yup from "yup";

import { api } from "../auth/api";
import StatBar from "../components/StatBar";
import MealSelector from "../components/MealSelector";
import EditLogModal from "../components/EditLogModal";
import ManualLogModal from "../components/ManualLogModal";
import { calcCaloriesFromMacros } from "../utils/nutrition";

const GLOBAL_DONE_ACCESSORY = "LOG_CREATE_DONE";

const validationSchema = Yup.object().shape({
  name: Yup.string().required("Name is required").trim().min(2),
  meal: Yup.string().required("Meal is required").trim(),
  protein: Yup.number().typeError("Protein must be a number").min(0).required(),
  fat: Yup.number().typeError("Fat must be a number").min(0).required(),
  carbohydrates: Yup.number().typeError("Carbohydrates must be a number").min(0).required(),
});

export function LogFoodScreen() {
  const [photo, setPhoto] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [userData, setUserData] = useState(null);
  const [todayDay, setTodayDay] = useState(null);
  const [fetchingDay, setFetchingDay] = useState(false);
  const [currentDateParam, setCurrentDateParam] = useState(() => new Date().toISOString());

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [editModalPayload, setEditModalPayload] = useState(null);

  useEffect(() => {
    fetchUserData();
    fetchTodayDay();
  }, []);

  async function fetchUserData() {
    try {
      const res = await api.get("/data/user");
      setUserData(res.data);
    } catch (err) {
      console.error("fetch user failed", err);
      setUserData(null);
    }
  }

  async function fetchTodayDay(dateParam = currentDateParam) {
    setFetchingDay(true);
    try {
      const res = await api.get(`/log/days/${encodeURIComponent(dateParam)}`);
      if (res.status === 204) setTodayDay(null);
      else setTodayDay(res.data.day);
      setCurrentDateParam(dateParam);
    } catch (err) {
      console.error("Failed to fetch day:", err);
      Alert.alert("Failed to load day's data", String(err?.message || err));
    } finally {
      setFetchingDay(false);
    }
  }

  async function openNativeCameraAndHandle() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera permission is required to take a photo.");
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7, exif: false, allowsEditing: false, base64: false });
      if (result && (result.canceled === false || result.cancelled === false) && Array.isArray(result.assets) && result.assets.length > 0 && result.assets[0].uri) {
        setPhoto({ uri: result.assets[0].uri });
        setUploadResult(null);
        setSuccessModalVisible(true);
        return;
      }
      if (result && (result.cancelled === false || result.canceled === false)) {
        const uri = result.uri || (Array.isArray(result.assets) && result.assets[0]?.uri);
        if (uri) {
          setPhoto({ uri });
          setUploadResult(null);
          setSuccessModalVisible(true);
          return;
        }
      }
      Alert.alert("Camera", "No photo captured.");
    } catch (err) {
      console.error("Camera error", err);
      Alert.alert("Camera error", "Could not open camera.");
    }
  }

  async function uploadPhotoWithApi(photoFile) {
    if (!photoFile || !photoFile.uri) {
      Alert.alert("No photo", "No photo to upload");
      return;
    }
    let uri = photoFile.uri;
    try {
      if (Platform.OS === "android" && uri.startsWith("content://")) {
        const filename = `photo_${Date.now()}.jpg`;
        const dest = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
      }
      if (Platform.OS === "android" && !uri.startsWith("file://") && !uri.startsWith("content://")) {
        uri = `file://${uri}`;
      }
      const filename = uri.split("/").pop() || `photo_${Date.now()}.jpg`;
      const ext = /\.(\w+)$/.exec(filename)?.[1] ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";

      const formData = new FormData();
      formData.append("image", { uri, name: filename, type: mimeType });
      formData.append("source", "expo-app");

      setUploading(true);
      const tokenRaw = await (await import("../utils/jwtStorage")).default.get();
      const authHeader = tokenRaw ? (tokenRaw.startsWith("Bearer ") ? tokenRaw : `Bearer ${tokenRaw}`) : null;

      const endpoint = `${api.defaults.baseURL.replace(/\/$/, "")}/api/analyze`;
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: formData,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Server returned ${resp.status}: ${text}`);
      }
      const data = await resp.json();
      let nutritionData = data?.nutritionData ?? data;
      if (typeof nutritionData === "string") {
        try {
          nutritionData = JSON.parse(nutritionData);
        } catch (e) {}
      }
      setUploadResult(nutritionData);
    } catch (err) {
      console.error("upload error", err);
      Alert.alert("Upload failed", String(err?.message || err));
    } finally {
      setUploading(false);
    }
  }

  function openLogModal(meal, log) {
    const payload = {
      meal,
      logId: String(log._id),
      initial: {
        name: log.name ?? "",
        kcal: String(Number(log.ccal || log.kcal || 0)),
        protein: String(Number(log.protein || 0)),
        fat: String(Number(log.fat || 0)),
        carbohydrates: String(Number(log.carbohydrates || 0)),
      },
    };
    setEditModalPayload(payload);
    setLogModalVisible(true);
  }

  function changeDay(delta) {
    try {
      const curr = new Date(currentDateParam);
      const next = new Date(curr.getTime() + delta * 24 * 60 * 60 * 1000);
      const iso = next.toISOString();
      fetchTodayDay(iso);
    } catch (e) {
      console.error("changeDay failed", e);
    }
  }

  function handleAfterLoggingSaved() {
    fetchUserData();
    fetchTodayDay();
  }

  return (
    <SafeAreaView style={styles.centered}>
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

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.navButton} onPress={() => changeDay(-1)}><Text style={styles.navText}>&lt;</Text></TouchableOpacity>
        <Text style={styles.headerDate}>{new Date(currentDateParam).toLocaleDateString()}</Text>
        <TouchableOpacity style={styles.navButton} onPress={() => changeDay(1)}><Text style={styles.navText}>&gt;</Text></TouchableOpacity>
      </View>

      <Text style={styles.title}>Add Meal</Text>

      <View style={{ width: "100%", paddingHorizontal: 8 }}>
        <Text style={styles.sectionTitle}>Today's goals</Text>
        <StatBar label="Calories" value={todayDay?.totals?.ccal ?? 0} goal={userData?.calorie_goal ?? 0} unit="kcal" />
        <StatBar label="Protein" value={todayDay?.totals?.protein ?? 0} goal={userData?.protein_goal ?? 0} unit="g" />
        <StatBar label="Fat" value={todayDay?.totals?.fat ?? 0} goal={userData?.fat_goal ?? 0} unit="g" />
        <StatBar label="Carbs" value={todayDay?.totals?.carbohydrates ?? 0} goal={userData?.carbohydrates_goal ?? 0} unit="g" />
      </View>

      <View style={{ width: "100%", marginTop: 12, flex: 1 }}>
        <Text style={styles.sectionTitle}>Meals</Text>
        {fetchingDay ? (
          <ActivityIndicator />
        ) : (
          <ScrollView style={{ maxHeight: 320 }}>
            {["breakfast", "lunch", "dinner", "snacks"].map((m) => {
              const meal = todayDay ? todayDay[m] : { logs: [], totals: { ccal: 0 } };
              return (
                <View key={m} style={styles.mealBlock}>
                  {/* meal header: left wraps, right fixed */}
                  <View style={styles.mealHeader}>
                    <Text style={styles.mealTitleText} numberOfLines={1} ellipsizeMode="tail">
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                    <Text style={styles.mealTotalText}>{meal.totals?.ccal ?? 0} kcal</Text>
                  </View>

                  {(meal.logs || []).length === 0 ? (
                    <Text style={styles.emptyText}>No logs</Text>
                  ) : (
                    (meal.logs || []).map((l) => (
                      <View key={String(l._id)} style={styles.logRow}>
                        <TouchableOpacity onPress={() => openLogModal(m, l)} style={{ flex: 1 }}>
                          <Text style={styles.logName} numberOfLines={1} ellipsizeMode="tail">
                            {l.name}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.logCals}>{Number(l.ccal || 0)} kcal</Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* big visible buttons row */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.analyzeButton, uploading ? styles.buttonDisabled : null]}
          onPress={openNativeCameraAndHandle}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.analyzeButtonText}>Analyze food</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.manualButton]}
          onPress={() => setManualModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.manualButtonText}>Manual log</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={successModalVisible} transparent animationType="fade" onRequestClose={() => setSuccessModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalContainer}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", alignItems: "center" }} keyboardVerticalOffset={Platform.select({ ios: 80, android: 60 })}>
              <ScrollView contentContainerStyle={[styles.modalContent, { width: "90%" }]} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>Log the food!</Text>

                {!uploadResult && photo ? (
                  <>
                    <Image source={{ uri: photo.uri }} style={{ width: 220, height: 220, marginBottom: 12 }} resizeMode="cover" />
                    <TouchableOpacity style={[styles.modalButton, { width: "100%", marginBottom: 8, backgroundColor: "#999" }]} onPress={() => uploadPhotoWithApi(photo)} disabled={uploading}>
                      {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Upload & Analyze</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, { width: "100%", backgroundColor: "#999" }]} onPress={() => { setSuccessModalVisible(false); setPhoto(null); }} disabled={uploading}>
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : !uploadResult ? (
                  <ActivityIndicator />
                ) : (
                  <Formik
                    enableReinitialize
                    initialValues={{
                      name: uploadResult.name ?? "",
                      meal: uploadResult.meal ?? "breakfast",
                      protein: (uploadResult.protein ?? "").toString(),
                      fat: (uploadResult.fat ?? "").toString(),
                      carbohydrates: (uploadResult.carbohydrates ?? "").toString(),
                    }}
                    validationSchema={validationSchema}
                    onSubmit={async (values, { setSubmitting }) => {
                      setSubmitting(true);
                      try {
                        const normalized = {
                          name: values.name.trim(),
                          protein: Number.parseInt(values.protein || "0", 10) || 0,
                          fat: Number.parseInt(values.fat || "0", 10) || 0,
                          carbohydrates: Number.parseInt(values.carbohydrates || "0", 10) || 0,
                        };
                        const computedKcal = calcCaloriesFromMacros(normalized.protein, normalized.fat, normalized.carbohydrates);
                        const payload = {
                          meal: values.meal,
                          date: new Date().toISOString(),
                          log: {
                            name: normalized.name,
                            ccal: computedKcal,
                            protein: normalized.protein,
                            fat: normalized.fat,
                            carbohydrates: normalized.carbohydrates,
                          },
                        };
                        await api.post("/log/foodLog", payload);
                        setSubmitting(false);
                        setSuccessModalVisible(false);
                        setUploadResult(null);
                        setPhoto(null);
                        handleAfterLoggingSaved();
                        Alert.alert("Saved", "Food logged successfully.");
                      } catch (err) {
                        setSubmitting(false);
                        console.error("Save food error", err);
                        Alert.alert("Save failed", err?.response?.data?.message || String(err?.message || err));
                      }
                    }}
                  >
                    {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isSubmitting, setFieldValue }) => {
                      const computedKcal = calcCaloriesFromMacros(values.protein || 0, values.fat || 0, values.carbohydrates || 0);
                      return (
                        <>
                          <Text style={styles.fieldLabel}>Name</Text>
                          <TextInput style={styles.input} value={values.name} onChangeText={handleChange("name")} onBlur={handleBlur("name")} placeholder="Name" returnKeyType="done" />

                          <MealSelector value={values.meal} onChange={(v) => setFieldValue("meal", v)} />

                          <Text style={styles.fieldLabel}>Kcal (computed)</Text>
                          <View style={[styles.computedRow]}>
                            <Text style={styles.computedText}>{String(computedKcal)} kcal</Text>
                          </View>

                          <Text style={styles.fieldLabel}>Protein (g)</Text>
                          <TextInput style={styles.input} value={values.protein} onChangeText={handleChange("protein")} onBlur={handleBlur("protein")} keyboardType="numeric" returnKeyType="next" />

                          <Text style={styles.fieldLabel}>Fat (g)</Text>
                          <TextInput style={styles.input} value={values.fat} onChangeText={handleChange("fat")} onBlur={handleBlur("fat")} keyboardType="numeric" returnKeyType="next" />

                          <Text style={styles.fieldLabel}>Carbohydrates (g)</Text>
                          <TextInput style={styles.input} value={values.carbohydrates} onChangeText={handleChange("carbohydrates")} onBlur={handleBlur("carbohydrates")} keyboardType="numeric" returnKeyType="done" />

                          <View style={{ flexDirection: "row", width: "100%", justifyContent: "space-between", marginTop: 8 }}>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#999", width: "48%" }]} onPress={() => setSuccessModalVisible(false)} disabled={isSubmitting}><Text style={styles.modalButtonText}>Back</Text></TouchableOpacity>

                            <TouchableOpacity style={[styles.modalButton, { width: "48%", backgroundColor: isSubmitting ? "#66a" : "#007aff" }]} onPress={handleSubmit} disabled={isSubmitting}><Text style={styles.modalButtonText}>{isSubmitting ? <ActivityIndicator color="#fff" /> : "Save"}</Text></TouchableOpacity>
                          </View>
                        </>
                      );
                    }}
                  </Formik>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <EditLogModal visible={logModalVisible} payload={editModalPayload} onClose={() => { setLogModalVisible(false); setEditModalPayload(null); }} onSaved={() => { setLogModalVisible(false); setEditModalPayload(null); fetchTodayDay(); fetchUserData(); }} />

      <ManualLogModal visible={manualModalVisible} onClose={() => setManualModalVisible(false)} onSaved={() => { setManualModalVisible(false); handleAfterLoggingSaved(); }} />
    </SafeAreaView>
  );
}

export default LogFoodScreen;

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16, backgroundColor: "#fff" },
  headerRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, marginBottom: 8 },
  navButton: { padding: 8 },
  navText: { fontSize: 22, fontWeight: "700" },
  headerDate: { fontSize: 16, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  infoBox: { padding: 12, marginVertical: 12, borderRadius: 8, backgroundColor: "#eee", width: "100%" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },

  mealBlock: { paddingVertical: 8, borderTopWidth: 1, borderColor: "#eee", paddingHorizontal: 6 },
  mealHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  mealTitleText: { fontWeight: "700", flex: 1, marginRight: 12, fontSize: 16 },
  mealTotalText: { fontWeight: "700", color: "#666", width: 96, textAlign: "right" },

  mealTitle: { fontWeight: "700", marginBottom: 6 },
  emptyText: { color: "#666", marginLeft: 6 },

  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    borderRadius: 6,
  },
  logName: { fontSize: 15, flex: 1 },
  logCals: { color: "#666", width: 80, textAlign: "right", marginLeft: 8 },

  buttonsRow: { flexDirection: "row", width: "100%", justifyContent: "space-between", marginTop: 12 },
  analyzeButton: {
    flex: 1,
    backgroundColor: "#ff6b00",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    minHeight: 48,
    elevation: 3,
  },
  analyzeButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  buttonDisabled: { opacity: 0.7 },
  manualButton: {
    flex: 1,
    backgroundColor: "#4a4a4a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    minHeight: 48,
    elevation: 2,
  },
  manualButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  primaryButton: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: "#007aff", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "700" },

  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 12, alignItems: "stretch" },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 10 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonText: { color: "#fff", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#ddd", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#fff", marginBottom: 8, minHeight: 44 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 8 },

  computedRow: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#f4f6f8", borderRadius: 8, marginBottom: 8 },
  computedText: { fontSize: 16, fontWeight: "700" },

  accessoryContainer: { backgroundColor: "#f2f2f2", borderTopWidth: 1, borderColor: "#d0d0d0", padding: 6, flexDirection: "row", alignItems: "center" },
  accessoryButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginRight: 8 },
  accessoryButtonText: { color: "#007aff", fontWeight: "700" },
});