import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Button,
  TextInput,
  ActivityIndicator,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GoBackButton from "../components/GoBackButton";
import { api } from "../auth/api";

/** Utilities */
const roundInt = (v) => Math.round(v || 0);
const toFloatOr0 = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};
const toIntOr0 = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};

// BMR & activity
const calcBMR = ({ sex, weightKg, heightCm, age }) => {
  const w = toFloatOr0(weightKg);
  const h = toFloatOr0(heightCm);
  const a = toFloatOr0(age);
  if (sex === "male") return 10 * w + 6.25 * h - 5 * a + 5;
  return 10 * w + 6.25 * h - 5 * a - 161;
};

const activityMultipliers = {
  sedentary: 1.2,
  lightly: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

const activityOptions = [
  { key: "sedentary", label: "Sedentary (little/no exercise)" },
  { key: "lightly", label: "Lightly active (1–3d/week)" },
  { key: "moderate", label: "Moderately active (3–5d/week)" },
  { key: "very", label: "Very active (6–7d/week)" },
  { key: "extra", label: "Extra active (physical job/intense)" },
];

const getMacroCalories = (protein, fat, carbs) =>
  toFloatOr0(protein) * 4 + toFloatOr0(carbs) * 4 + toFloatOr0(fat) * 9;

/** Small animated progress bar (kept from signup — optional) */
function ProgressBar({ progress = 0 }) {
  const [containerW, setContainerW] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (containerW <= 0) return;
    const toValue = progress * containerW;
    Animated.timing(anim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, containerW, anim]);

  return (
    <View style={styles.progressWrap} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
      <View style={styles.progressBg}>
        <Animated.View style={[styles.progressFill, { width: anim }]} />
      </View>
    </View>
  );
}

/** Macro presets */
const macroPresets = [
  { key: "balanced", label: "Balanced (30P / 30F / 40C)", p: 0.30, f: 0.30, c: 0.40 },
  { key: "high_protein", label: "High Protein (40P / 25F / 35C)", p: 0.40, f: 0.25, c: 0.35 },
  { key: "low_carb", label: "Low Carb (25P / 35F / 40C)", p: 0.25, f: 0.35, c: 0.40 },
];

export function ProfileScreen() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Local form state (matching backend field names)
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("male");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activity_level, setActivityLevel] = useState("sedentary");
  const [protein_goal, setProteinGoal] = useState("");
  const [fat_goal, setFatGoal] = useState("");
  const [carbohydrates_goal, setCarbsGoal] = useState("");
  const [calorie_goal, setCalorieGoal] = useState("");

  // ccal manual edit tracking
  const [ccalManuallyEdited, setCcalManuallyEditedState] = useState(false);
  const ccalManuallyEditedRef = useRef(ccalManuallyEdited);
  const setCcalManuallyEdited = (v) => {
    ccalManuallyEditedRef.current = v;
    setCcalManuallyEditedState(v);
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get("/data/user");
        const u = res.data;
        setUserData(u);

        setAge(u.age != null ? String(u.age) : "");
        setSex(u.sex || "male");
        setWeight(u.weight != null ? String(u.weight) : "");
        setHeight(u.height != null ? String(u.height) : "");
        setActivityLevel(u.activityLevel || u.activity_level || "sedentary");
        setProteinGoal(u.protein_goal != null ? String(u.protein_goal) : "");
        setFatGoal(u.fat_goal != null ? String(u.fat_goal) : "");
        setCarbsGoal(u.carbohydrates_goal != null ? String(u.carbohydrates_goal) : "");
        setCalorieGoal(u.calorie_goal != null ? String(u.calorie_goal) : "");
      } catch (err) {
        console.error("Failed to fetch user:", err);
        Alert.alert("Error", "Failed to fetch user data");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Derived numbers (BMR/TDEE/macros) — use the stored (goal) macro numbers
  const bmr = calcBMR({
    sex,
    weightKg: weight,
    heightCm: height,
    age,
  });

  const activityMul = activityMultipliers[activity_level] || 1.2;
  const tdee = roundInt(bmr * activityMul);

  const macroCalories = roundInt(getMacroCalories(protein_goal, fat_goal, carbohydrates_goal));

  // sync calorie_goal with TDEE until user manually edits
  useEffect(() => {
    if (!ccalManuallyEditedRef.current) {
      const target = tdee || 0;
      if (toIntOr0(calorie_goal) !== target) {
        setCalorieGoal(String(target));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdee, ccalManuallyEditedRef, calorie_goal]);

  const setCalorieFromMacros = () => {
    setCalorieGoal(String(macroCalories));
    setCcalManuallyEdited(true);
  };

  const applyTdeePreset = (pct) => {
    const newCcal = roundInt(tdee * pct);
    setCalorieGoal(String(newCcal));
    setCcalManuallyEdited(true);
  };

  const applyMacroPreset = (pPct, fPct, cPct) => {
    const cals = toIntOr0(calorie_goal) || tdee || 0;
    if (cals <= 0) return;
    const pCals = cals * pPct;
    const fCals = cals * fPct;
    const cCals = cals * cPct;
    const pGram = Math.round(pCals / 4);
    const fGram = Math.round(fCals / 9);
    const cGram = Math.round(cCals / 4);
    setProteinGoal(String(pGram));
    setFatGoal(String(fGram));
    setCarbsGoal(String(cGram));
    setCcalManuallyEdited(true);
  };

  const validateBeforeSave = () => {
    if (!age || Number.isNaN(Number(age)) || Number(age) < 10 || Number(age) > 120) {
      Alert.alert("Validation", "Please enter a valid age (10–120).");
      return false;
    }
    if (!["male", "female"].includes(sex)) {
      Alert.alert("Validation", "Please select sex.");
      return false;
    }
    if (!weight || isNaN(Number(weight)) || Number(weight) < 20 || Number(weight) > 500) {
      Alert.alert("Validation", "Enter valid weight (20–500 kg).");
      return false;
    }
    if (!height || isNaN(Number(height)) || Number(height) < 50 || Number(height) > 300) {
      Alert.alert("Validation", "Enter valid height (50–300 cm).");
      return false;
    }
    if (!Object.keys(activityMultipliers).includes(activity_level)) {
      Alert.alert("Validation", "Select activity level.");
      return false;
    }
    if (isNaN(Number(protein_goal)) || Number(protein_goal) < 0 || Number(protein_goal) > 500) {
      Alert.alert("Validation", "Enter valid protein (0–500 g).");
      return false;
    }
    if (isNaN(Number(fat_goal)) || Number(fat_goal) < 0 || Number(fat_goal) > 500) {
      Alert.alert("Validation", "Enter valid fat (0–500 g).");
      return false;
    }
    if (isNaN(Number(carbohydrates_goal)) || Number(carbohydrates_goal) < 0 || Number(carbohydrates_goal) > 1000) {
      Alert.alert("Validation", "Enter valid carbs (0–1000 g).");
      return false;
    }
    if (!calorie_goal || isNaN(Number(calorie_goal)) || Number(calorie_goal) <= 0 || Number(calorie_goal) > 20000) {
      Alert.alert("Validation", "Enter valid daily calories.");
      return false;
    }
    const macroCal = getMacroCalories(protein_goal, fat_goal, carbohydrates_goal);
    if (macroCal > toIntOr0(calorie_goal)) {
      Alert.alert("Validation", "Macro calories exceed calorie goal. Lower macros or increase cals.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateBeforeSave()) return;

    const payload = {
      age: parseInt(age, 10),
      sex,
      weight: parseFloat(weight),
      height: parseFloat(height),
      activity_level,
      protein_goal: parseFloat(protein_goal),
      fat_goal: parseFloat(fat_goal),
      carbohydrates_goal: parseFloat(carbohydrates_goal),
      calorie_goal: parseInt(calorie_goal, 10),
    };

    setSaving(true);
    try {
      const res = await api.put("/data/user", payload); // keep /data/user if router is mounted at /data
      if (res?.data) {
        setUserData(res.data);
        // reflect server-canonical fields back to local
        setAge(res.data.age != null ? String(res.data.age) : String(payload.age));
        setSex(res.data.sex || payload.sex);
        setWeight(res.data.weight != null ? String(res.data.weight) : String(payload.weight));
        setHeight(res.data.height != null ? String(res.data.height) : String(payload.height));
        setActivityLevel(res.data.activityLevel || res.data.activity_level || payload.activity_level);
        setProteinGoal(res.data.protein_goal != null ? String(res.data.protein_goal) : String(payload.protein_goal));
        setFatGoal(res.data.fat_goal != null ? String(res.data.fat_goal) : String(payload.fat_goal));
        setCarbsGoal(res.data.carbohydrates_goal != null ? String(res.data.carbohydrates_goal) : String(payload.carbohydrates_goal));
        setCalorieGoal(res.data.calorie_goal != null ? String(res.data.calorie_goal) : String(payload.calorie_goal));
      } else {
        setUserData((prev) => ({ ...prev, ...payload }));
      }
      setModalVisible(false);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (err) {
      console.error("Failed to save profile:", err);
      Alert.alert("Error", err?.response?.data?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Profile</Text>

        {userData ? (
          <View style={styles.info}>
            <Text style={styles.row}>Email: {userData.email}</Text>
            <Text style={styles.row}>Calorie Goal: {userData.calorie_goal ?? "—"}</Text>
            <Text style={styles.row}>Protein Goal: {userData.protein_goal ?? "—"}</Text>
            <Text style={styles.row}>Fat Goal: {userData.fat_goal ?? "—"}</Text>
            <Text style={styles.row}>Carbohydrates Goal: {userData.carbohydrates_goal ?? "—"}</Text>
            <Text style={styles.row}>Weight: {userData.weight ?? "—"} kg</Text>
            <Text style={styles.row}>Height: {userData.height ?? "—"} cm</Text>
            <Text style={styles.row}>Activity Level: {userData.activityLevel ?? userData.activity_level ?? "—"}</Text>
          </View>
        ) : (
          <Text>No user data</Text>
        )}

        <View style={styles.buttons}>
          <Button title="Edit Macros & Body" onPress={() => setModalVisible(true)} />
          <View style={{ height: 8 }} />
          <GoBackButton />
        </View>

        <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)} transparent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalView}>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ width: "100%" }}>
                <Text style={styles.modalTitle}>Edit Body & Macros</Text>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Calculated (BMR & TDEE)</Text>
                  <Text style={styles.cardText}>BMR: {roundInt(bmr)} kcal/day</Text>
                  <Text style={styles.cardText}>Maintenance (TDEE): {tdee} kcal/day</Text>

                  <Text style={{ marginTop: 10, fontWeight: "700" }}>Calories</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 8 }]}
                      onChangeText={(v) => {
                        setCcalManuallyEdited(true);
                        setCalorieGoal(v);
                      }}
                      value={String(calorie_goal)}
                      placeholder="Enter daily kcal"
                      keyboardType="numeric"
                      autoCapitalize="none"
                      autoComplete="off"
                      textContentType="none"
                      autoCorrect={false}
                    />
                    <Button title="Set from macros" onPress={setCalorieFromMacros} />
                  </View>

                  <View style={{ marginTop: 8 }}>
                    <TouchableOpacity style={styles.presetBtn} onPress={() => applyTdeePreset(0.80)}>
                      <Text style={styles.presetText}>Lose weight (-20%)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.presetBtn} onPress={() => applyTdeePreset(0.90)}>
                      <Text style={styles.presetText}>Lose slightly (-10%)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.presetBtn} onPress={() => applyTdeePreset(1.0)}>
                      <Text style={styles.presetText}>Maintain</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.presetBtn} onPress={() => applyTdeePreset(1.10)}>
                      <Text style={styles.presetText}>Gain (+10%)</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={styles.sectionTitle}>Personal</Text>

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Age</Text>
                      <TextInput style={styles.input} onChangeText={setAge} value={String(age)} placeholder="Years" keyboardType="numeric" autoCapitalize="none" autoComplete="off" textContentType="none" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Sex</Text>
                      <View style={styles.segment}>
                        {["male", "female"].map((s) => (
                          <TouchableOpacity key={s} style={[styles.segmentButton, sex === s && styles.segmentButtonActive]} onPress={() => setSex(s)}>
                            <Text style={sex === s ? styles.segmentTextActive : styles.segmentText}>{s === "male" ? "Male" : "Female"}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Weight (kg)</Text>
                      <TextInput style={styles.input} onChangeText={setWeight} value={String(weight)} placeholder="e.g. 70" keyboardType="numeric" autoCapitalize="none" autoComplete="off" textContentType="none" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Height (cm)</Text>
                      <TextInput style={styles.input} onChangeText={setHeight} value={String(height)} placeholder="e.g. 175" keyboardType="numeric" autoCapitalize="none" autoComplete="off" textContentType="none" />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Activity level</Text>
                    {activityOptions.map((opt) => (
                      <TouchableOpacity key={opt.key} style={[styles.activityButton, activity_level === opt.key && styles.activityButtonActive]} onPress={() => setActivityLevel(opt.key)}>
                        <Text style={activity_level === opt.key ? styles.activityTextActive : styles.activityText}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={styles.sectionTitle}>Macros</Text>

                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontWeight: "700", marginBottom: 6 }}>Macro presets</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      {macroPresets.map((mp) => (
                        <TouchableOpacity key={mp.key} style={styles.presetBtn} onPress={() => applyMacroPreset(mp.p, mp.f, mp.c)}>
                          <Text style={styles.presetText}>{mp.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {[
                    { label: "Protein (g)", value: protein_goal, setter: setProteinGoal },
                    { label: "Fat (g)", value: fat_goal, setter: setFatGoal },
                    { label: "Carbs (g)", value: carbohydrates_goal, setter: setCarbsGoal },
                  ].map((field, idx) => (
                    <View key={idx} style={styles.inputGroup}>
                      <Text style={styles.label}>{field.label}</Text>
                      <TextInput style={styles.input} onChangeText={field.setter} value={String(field.value)} placeholder={`e.g. 120 for ${field.label.toLowerCase()}`} keyboardType="numeric" autoCapitalize="none" autoComplete="off" textContentType="none" autoCorrect={false} />
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: "row", marginTop: 18, justifyContent: "space-between" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Pressable style={[styles.modalButton, styles.closeButton]} onPress={() => setModalVisible(false)}>
                      <Text style={styles.modalButtonText}>Close</Text>
                    </Pressable>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Pressable style={[styles.modalButton, styles.saveButton]} onPress={handleSave} disabled={saving}>
                      {saving ? <ActivityIndicator /> : <Text style={styles.modalButtonText}>Save</Text>}
                    </Pressable>
                  </View>
                </View>

                <View style={{ height: 16 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Styles (unchanged from previous) */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContainer: { padding: 20, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  title: { fontSize: 24, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  info: { width: "100%", paddingHorizontal: 8, marginBottom: 12 },
  row: { fontSize: 16, marginVertical: 6 },

  buttons: { width: "100%", marginTop: 12, alignItems: "center" },

  /* modal */
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.35)" },
  modalView: { width: "100%", maxWidth: 720, backgroundColor: "white", borderRadius: 12, padding: 16, elevation: 8 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },

  inputGroup: { marginBottom: 12 },
  label: { fontWeight: "600", marginBottom: 6, color: "#333" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 12, height: 44, backgroundColor: "#fff" },

  sectionTitle: { marginTop: 8, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  card: { padding: 12, borderRadius: 10, backgroundColor: "#f7f7f8", borderWidth: 1, borderColor: "#eee", marginBottom: 12 },
  cardTitle: { fontWeight: "700", marginBottom: 6 },
  cardText: { marginBottom: 4 },

  activityButton: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ddd", marginBottom: 8 },
  activityButtonActive: { backgroundColor: "#007bff22", borderColor: "#007bff" },
  activityText: { color: "#333" },
  activityTextActive: { color: "#007bff", fontWeight: "700" },

  presetBtn: { padding: 8, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#ddd", marginRight: 8, marginBottom: 8 },
  presetText: { fontSize: 13 },

  segment: { flexDirection: "row" },
  segmentButton: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#ddd", marginRight: 8 },
  segmentButtonActive: { backgroundColor: "#007bff22", borderColor: "#007bff" },
  segmentText: { color: "#333" },
  segmentTextActive: { color: "#007bff", fontWeight: "700" },

  modalButton: { paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  saveButton: { backgroundColor: "#1b8ef3" },
  closeButton: { backgroundColor: "#888" },
  modalButtonText: { color: "white", fontWeight: "600" },

  /* small progress */
  progressWrap: { marginBottom: 12, paddingHorizontal: 4 },
  progressBg: { height: 6, backgroundColor: "#eee", borderRadius: 6, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: "#007bff", borderRadius: 6, width: 0 },
});
