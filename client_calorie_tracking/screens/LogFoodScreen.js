import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { api } from "../auth/api";
import { Formik } from "formik";
import * as Yup from "yup";
import jwtStorage from "../utils/jwtStorage";

export function LogFoodScreen() {
  // photo + upload state
  const [photo, setPhoto] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  // user/day/log state
  const [userData, setUserData] = useState(null);
  const [todayDay, setTodayDay] = useState(null);
  const [fetchingDay, setFetchingDay] = useState(false);
  const [currentDateParam, setCurrentDateParam] = useState(() =>
    new Date().toISOString()
  );

  // modals
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);

  // stable payload for edit modal (created once when opening modal)
  const [editModalPayload, setEditModalPayload] = useState(null);

  // meal selector modal for forms
  const [mealSelectorVisible, setMealSelectorVisible] = useState(false);

  const validationSchema = Yup.object().shape({
    name: Yup.string().required("Name is required").trim().min(2),
    meal: Yup.string().required("Meal is required").trim(),
    kcal: Yup.number()
      .typeError("Kcal must be a number")
      .integer("Kcal must be an integer")
      .min(0)
      .required("Kcal is required"),
    protein: Yup.number()
      .typeError("Protein must be a number")
      .min(0)
      .required(),
    fat: Yup.number().typeError("Fat must be a number").min(0).required(),
    carbohydrates: Yup.number()
      .typeError("Carbohydrates must be a number")
      .min(0)
      .required(),
  });

  useEffect(() => {
    fetchUserData();
    fetchTodayDay();
  }, []);

  async function fetchUserData() {
    try {
      const res = await api.get("/data/user");
      setUserData(res.data);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      setUserData(null);
    }
  }

  async function fetchTodayDay(dateParam = currentDateParam) {
    setFetchingDay(true);
    try {
      const res = await api.get(`/log/days/${encodeURIComponent(dateParam)}`);
      if (res.status === 204) {
        setTodayDay(null);
      } else {
        setTodayDay(res.data.day);
      }
      setCurrentDateParam(dateParam);
    } catch (err) {
      console.error("Failed to fetch day:", err?.response || err);
      Alert.alert("Failed to load day's data", String(err?.message || err));
    } finally {
      setFetchingDay(false);
    }
  }

  // ---------- camera ----------
  async function openNativeCameraAndHandle() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Camera permission is required to take a photo."
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        exif: false,
        allowsEditing: false,
        base64: false,
      });

      if (
        result &&
        (result.canceled === false || result.cancelled === false) &&
        Array.isArray(result.assets) &&
        result.assets.length > 0 &&
        result.assets[0].uri
      ) {
        const assetUri = result.assets[0].uri;
        setPhoto({ uri: assetUri });
        setUploadResult(null);
        setSuccessModalVisible(true);
        return;
      }

      if (result && (result.cancelled === false || result.canceled === false)) {
        const uri =
          result.uri || (Array.isArray(result.assets) && result.assets[0]?.uri);
        if (uri) {
          setPhoto({ uri });
          setUploadResult(null);
          setSuccessModalVisible(true);
          return;
        }
      }

      Alert.alert("Camera", "No photo captured.");
    } catch (err) {
      console.error("Native camera error", err);
      Alert.alert("Camera error", "Could not open camera.");
    }
  }

  // ---------- upload ----------
  async function uploadPhotoWithApi(photoFile) {
    if (!photoFile || !photoFile.uri) {
      Alert.alert("No photo", "No photo to upload");
      return;
    }
    let uri = photoFile.uri;
    console.log("[upload] original uri:", uri);

    if (Platform.OS === "android" && uri.startsWith("content://")) {
      try {
        const filename = `photo_${Date.now()}.jpg`;
        const dest = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
        console.log("[upload] copied to", dest);
      } catch (err) {
        console.warn(
          "copy content uri failed; proceeding with original uri",
          err
        );
      }
    }

    if (
      Platform.OS === "android" &&
      !uri.startsWith("file://") &&
      !uri.startsWith("content://")
    ) {
      uri = `file://${uri}`;
    }

    const filename = uri.split("/").pop() || `photo_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : "jpg";
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";

    const formData = new FormData();
    formData.append("image", {
      uri,
      name: filename,
      type: mimeType,
    });
    formData.append("source", "expo-app");

    const tokenRaw = await jwtStorage.get();
    const authHeader = tokenRaw
      ? tokenRaw.startsWith("Bearer ")
        ? tokenRaw
        : `Bearer ${tokenRaw}`
      : null;

    try {
      setUploading(true);
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

  function handleAfterLoggingSaved() {
    fetchUserData();
    fetchTodayDay();
  }

  // ---------- helpers ----------
  function capitalize(s) {
    try {
      return String(s).charAt(0).toUpperCase() + String(s).slice(1);
    } catch {
      return s;
    }
  }

  // OPEN modal - create a stable payload object and set it once
  function openLogModal(meal, log) {
    const payload = {
      meal,
      logId: String(log._id),
      initial: {
        name: log.name ?? "",
        kcal: String(Number(log.ccal || 0)),
        protein: String(Number(log.protein || 0)),
        fat: String(Number(log.fat || 0)),
        carbohydrates: String(Number(log.carbohydrates || 0)),
      },
    };
    setEditModalPayload(payload); // stable reference for modal
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

  function formatDateDisplay(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString();
    } catch {
      return iso;
    }
  }

  // Inline dropdown meal selector
  function MealSelector({ value, onChange }) {
    const options = [
      { label: "Breakfast", value: "breakfast" },
      { label: "Lunch", value: "lunch" },
      { label: "Dinner", value: "dinner" },
      { label: "Snacks", value: "snacks" },
    ];
    const [open, setOpen] = useState(false);

    return (
      <View style={{ width: "100%", marginBottom: 8 }}>
        <TouchableOpacity
          style={styles.mealSelectorButton}
          onPress={() => setOpen((s) => !s)}
        >
          <Text>
            {options.find((o) => o.value === value)?.label ?? "Select meal"}
          </Text>
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
            <TouchableOpacity
              style={[styles.dropdownItem, { backgroundColor: "#eee" }]}
              onPress={() => setOpen(false)}
            >
              <Text style={{ color: "#666" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Initial UI
  function InitialUI() {
    const totals = todayDay?.totals || {
      ccal: 0,
      protein: 0,
      fat: 0,
      carbohydrates: 0,
    };
    const goals = {
      ccal: userData?.calorie_goal ?? 0,
      protein: userData?.protein_goal ?? 0,
      fat: userData?.fat_goal ?? 0,
      carbohydrates: userData?.carbohydrates_goal ?? 0,
    };

    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => changeDay(-1)}
          >
            <Text style={styles.navText}>&lt;</Text>
          </TouchableOpacity>
          <Text style={styles.headerDate}>
            {formatDateDisplay(currentDateParam)}
          </Text>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => changeDay(1)}
          >
            <Text style={styles.navText}>&gt;</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Add Meal</Text>

        <View style={styles.infoBox}>
          <Text>Calorie Taking App</Text>
        </View>

        <View style={{ width: "100%", paddingHorizontal: 8 }}>
          <Text style={styles.sectionTitle}>Today's goals</Text>
          <StatBar
            label="Calories"
            value={totals.ccal}
            goal={goals.ccal}
            unit="kcal"
          />
          <StatBar
            label="Protein"
            value={totals.protein}
            goal={goals.protein}
            unit="g"
          />
          <StatBar label="Fat" value={totals.fat} goal={goals.fat} unit="g" />
          <StatBar
            label="Carbs"
            value={totals.carbohydrates}
            goal={goals.carbohydrates}
            unit="g"
          />
        </View>

        <View style={{ width: "100%", marginTop: 12, flex: 1 }}>
          <Text style={styles.sectionTitle}>Meals</Text>
          {fetchingDay ? (
            <ActivityIndicator />
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              {["breakfast", "lunch", "dinner", "snacks"].map((m) => {
                const meal = todayDay
                  ? todayDay[m]
                  : { logs: [], totals: { ccal: 0 } };
                return (
                  <View key={m} style={styles.mealBlock}>
                    <Text style={styles.mealTitle}>
                      {capitalize(m)} — {meal.totals?.ccal ?? 0} kcal
                    </Text>
                    {(meal.logs || []).length === 0 ? (
                      <Text style={styles.emptyText}>No logs</Text>
                    ) : (
                      (meal.logs || []).map((l) => (
                        <View key={String(l._id)} style={styles.logRow}>
                          <TouchableOpacity onPress={() => openLogModal(m, l)}>
                            <Text style={styles.logName}>{l.name}</Text>
                          </TouchableOpacity>
                          <Text style={styles.logCals}>
                            {Number(l.ccal || 0)} kcal
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={openNativeCameraAndHandle}
        >
          <Text style={styles.primaryButtonText}>Analyze food</Text>
        </TouchableOpacity>

        <Modal
          visible={successModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSuccessModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Log the food!</Text>

              {!uploadResult && photo ? (
                <>
                  <Image
                    source={{ uri: photo.uri }}
                    style={{ width: 220, height: 220, marginBottom: 12 }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      { width: "100%", marginBottom: 8 },
                    ]}
                    onPress={() => uploadPhotoWithApi(photo)}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalButtonText}>
                        Upload & Analyze
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      { width: "100%", backgroundColor: "#999" },
                    ]}
                    onPress={() => {
                      setSuccessModalVisible(false);
                      setPhoto(null);
                    }}
                    disabled={uploading}
                  >
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
                    kcal: (
                      uploadResult.ccal ??
                      uploadResult.kcal ??
                      ""
                    ).toString(),
                    protein: (uploadResult.protein ?? "").toString(),
                    fat: (uploadResult.fat ?? "").toString(),
                    carbohydrates: (
                      uploadResult.carbohydrates ?? ""
                    ).toString(),
                  }}
                  validationSchema={validationSchema}
                  onSubmit={async (values, { setSubmitting }) => {
                    try {
                      setSubmitting(true);
                      const payload = {
                        meal: values.meal,
                        date: new Date().toISOString(),
                        log: {
                          name: values.name.trim(),
                          ccal: Number.parseInt(values.kcal || "0", 10) || 0,
                          protein:
                            Number.parseFloat(values.protein || "0") || 0,
                          fat: Number.parseFloat(values.fat || "0") || 0,
                          carbohydrates:
                            Number.parseFloat(values.carbohydrates || "0") || 0,
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
                      Alert.alert(
                        "Save failed",
                        err?.response?.data?.message ||
                          String(err?.message || err)
                      );
                    }
                  }}
                >
                  {({
                    handleChange,
                    handleBlur,
                    handleSubmit,
                    values,
                    errors,
                    touched,
                    isSubmitting,
                    isValid,
                    setFieldValue,
                  }) => (
                    <>
                      <TextInput
                        style={[
                          styles.input,
                          { width: "100%", marginBottom: 8 },
                        ]}
                        value={values.name}
                        onChangeText={handleChange("name")}
                        onBlur={handleBlur("name")}
                        placeholder="Name"
                        autoCapitalize="words"
                        returnKeyType="done"
                      />
                      {touched.name && errors.name && (
                        <Text style={{ color: "red", alignSelf: "flex-start" }}>
                          {errors.name}
                        </Text>
                      )}

                      <MealSelector
                        value={values.meal}
                        onChange={(v) => setFieldValue("meal", v)}
                      />

                      <TextInput
                        style={[
                          styles.input,
                          { width: "100%", marginBottom: 8 },
                        ]}
                        value={values.kcal}
                        onChangeText={handleChange("kcal")}
                        onBlur={handleBlur("kcal")}
                        placeholder="Kcal"
                        keyboardType="numeric"
                        returnKeyType="done"
                      />
                      {touched.kcal && errors.kcal && (
                        <Text style={{ color: "red", alignSelf: "flex-start" }}>
                          {errors.kcal}
                        </Text>
                      )}

                      <TextInput
                        style={[
                          styles.input,
                          { width: "100%", marginBottom: 8 },
                        ]}
                        value={values.protein}
                        onChangeText={handleChange("protein")}
                        onBlur={handleBlur("protein")}
                        placeholder="Protein (g)"
                        keyboardType="numeric"
                      />
                      {touched.protein && errors.protein && (
                        <Text style={{ color: "red", alignSelf: "flex-start" }}>
                          {errors.protein}
                        </Text>
                      )}

                      <TextInput
                        style={[
                          styles.input,
                          { width: "100%", marginBottom: 8 },
                        ]}
                        value={values.fat}
                        onChangeText={handleChange("fat")}
                        onBlur={handleBlur("fat")}
                        placeholder="Fat (g)"
                        keyboardType="numeric"
                      />
                      {touched.fat && errors.fat && (
                        <Text style={{ color: "red", alignSelf: "flex-start" }}>
                          {errors.fat}
                        </Text>
                      )}

                      <TextInput
                        style={[
                          styles.input,
                          { width: "100%", marginBottom: 12 },
                        ]}
                        value={values.carbohydrates}
                        onChangeText={handleChange("carbohydrates")}
                        onBlur={handleBlur("carbohydrates")}
                        placeholder="Carbohydrates (g)"
                        keyboardType="numeric"
                      />
                      {touched.carbohydrates && errors.carbohydrates && (
                        <Text style={{ color: "red", alignSelf: "flex-start" }}>
                          {errors.carbohydrates}
                        </Text>
                      )}

                      <View
                        style={{
                          flexDirection: "row",
                          width: "100%",
                          justifyContent: "space-between",
                          marginTop: 8,
                        }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            { backgroundColor: "#999", width: "48%" },
                          ]}
                          onPress={() => setSuccessModalVisible(false)}
                          disabled={isSubmitting}
                        >
                          <Text style={styles.modalButtonText}>Back</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            {
                              width: "48%",
                              backgroundColor: isSubmitting
                                ? "#66a"
                                : "#007aff",
                              opacity: !isValid ? 0.7 : 1,
                            },
                          ]}
                          onPress={handleSubmit}
                          disabled={isSubmitting || !isValid}
                        >
                          {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.modalButtonText}>Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </Formik>
              )}
            </View>
          </View>
        </Modal>

        {/* EDIT modal: isolated component */}
        <EditLogModal
          visible={logModalVisible}
          payload={editModalPayload}
          onClose={() => {
            setLogModalVisible(false);
            setEditModalPayload(null);
          }}
          onSaved={() => {
            setLogModalVisible(false);
            setEditModalPayload(null);
            fetchTodayDay();
            fetchUserData();
          }}
        />
      </SafeAreaView>
    );
  }

  return <InitialUI />;
}

// ---------- Edit modal component (isolated & memoized) ----------
const EditLogModal = React.memo(function EditLogModal({
  visible,
  payload,
  onClose,
  onSaved,
}) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // store original numeric values for delta display
  const originalRef = useRef({ ccal: 0, protein: 0, fat: 0, carbohydrates: 0 });

  useEffect(() => {
    if (visible && payload && payload.initial) {
      // initialize local fields only when modal opens or payload changes
      setName(payload.initial.name ?? "");
      setKcal(payload.initial.kcal ?? "0");
      setProtein(payload.initial.protein ?? "0");
      setFat(payload.initial.fat ?? "0");
      setCarbs(payload.initial.carbohydrates ?? "0");

      originalRef.current = {
        ccal: Number(payload.initial.kcal || 0),
        protein: Number(payload.initial.protein || 0),
        fat: Number(payload.initial.fat || 0),
        carbohydrates: Number(payload.initial.carbohydrates || 0),
      };

      setErrors({});
    }
  }, [visible, payload]);

  if (!visible) return null;

  const renderDelta = (newStr, origVal) => {
    const newVal = newStr === "" ? 0 : Number(newStr);
    const diff = Math.round((newVal - origVal) * 100) / 100;
    if (diff === 0) return <Text style={{ color: "#888" }}>±0</Text>;
    const sign = diff > 0 ? "+" : "";
    const style = diff > 0 ? { color: "#2ecc71" } : { color: "#e67e22" };
    return (
      <Text style={style}>
        {sign}
        {diff}
      </Text>
    );
  };

  const validateAndSave = async () => {
    setSaving(true);
    setErrors({});
    const toValidate = {
      name: (name || "").trim(),
      kcal: kcal !== "" && kcal != null ? Number(kcal) : NaN,
      protein: protein !== "" && protein != null ? Number(protein) : NaN,
      fat: fat !== "" && fat != null ? Number(fat) : NaN,
      carbohydrates: carbs !== "" && carbs != null ? Number(carbs) : NaN,
    };

    const editSchema = Yup.object().shape({
      name: Yup.string().required("Name required"),
      kcal: Yup.number()
        .typeError("Kcal must be a number")
        .integer("Kcal must be an integer")
        .min(0, "Kcal must be >= 0")
        .required("Kcal required"),
      protein: Yup.number()
        .typeError("Protein must be a number")
        .min(0, "Protein must be >= 0")
        .required("Protein required"),
      fat: Yup.number()
        .typeError("Fat must be a number")
        .min(0, "Fat must be >= 0")
        .required("Fat required"),
      carbohydrates: Yup.number()
        .typeError("Carbs must be a number")
        .min(0, "Carbs must be >= 0")
        .required("Carbs required"),
    });

    try {
      await editSchema.validate(toValidate, { abortEarly: false });

      // valid — send to server
      const payloadToSend = {
        name: toValidate.name,
        ccal: Number(toValidate.kcal || 0),
        protein: Number(toValidate.protein || 0),
        fat: Number(toValidate.fat || 0),
        carbohydrates: Number(toValidate.carbohydrates || 0),
      };

      const meal = payload?.meal;
      const logId = payload?.logId;
      if (!meal || !logId) {
        throw new Error("Missing payload identifiers");
      }

      // Use parent's current date on save (parent will refetch). If you want the same date used previously, pass it in payload.
      const dateParam = new Date().toISOString();
      const endpoint = `/log/days/${encodeURIComponent(dateParam)}/${encodeURIComponent(
        meal
      )}/${encodeURIComponent(logId)}`;

      await api.put(endpoint, payloadToSend);

      setSaving(false);
      onSaved && onSaved();
      Alert.alert("Saved", "Log updated");
    } catch (err) {
      setSaving(false);
      if (err.name === "ValidationError" && Array.isArray(err.inner)) {
        const e = {};
        err.inner.forEach((ve) => {
          if (ve.path) e[ve.path] = ve.message;
        });
        setErrors(e);
      } else {
        console.error("Failed to save log", err);
        Alert.alert("Update failed", String(err?.message || err));
      }
    }
  };

  const confirmAndDelete = () => {
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
            const endpoint = `/log/days/${encodeURIComponent(dateParam)}/${encodeURIComponent(
              meal
            )}/${encodeURIComponent(logId)}`;
            await api.delete(endpoint);
            setDeleting(false);
            onSaved && onSaved(); // parent will refetch
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

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { width: "90%" }]}>
          <Text style={styles.modalTitle}>Log details</Text>

          <TextInput
            style={[styles.input, { width: "100%", marginBottom: 8 }]}
            value={name}
            onChangeText={setName}
            editable={!saving && !deleting}
            placeholder="Name"
          />
          {errors.name && (
            <Text style={{ color: "red", alignSelf: "flex-start" }}>
              {errors.name}
            </Text>
          )}

          {/* Kcal row */}
          <View style={{ width: "100%", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "600" }}>Kcal</Text>
              <Text style={{ color: "#666" }}>was: {originalRef.current.ccal}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <TextInput
                style={[styles.input, { flex: 1, width: undefined, marginBottom: 0 }]}
                value={kcal}
                onChangeText={setKcal}
                editable={!saving && !deleting}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <View style={{ width: 56, alignItems: "center", marginLeft: 8 }}>
                {renderDelta(kcal, originalRef.current.ccal)}
              </View>
            </View>
            {errors.kcal && <Text style={{ color: "red", alignSelf: "flex-start" }}>{errors.kcal}</Text>}
          </View>

          {/* Protein row */}
          <View style={{ width: "100%", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "600" }}>Protein (g)</Text>
              <Text style={{ color: "#666" }}>was: {originalRef.current.protein}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <TextInput
                style={[styles.input, { flex: 1, width: undefined, marginBottom: 0 }]}
                value={protein}
                onChangeText={setProtein}
                editable={!saving && !deleting}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <View style={{ width: 56, alignItems: "center", marginLeft: 8 }}>
                {renderDelta(protein, originalRef.current.protein)}
              </View>
            </View>
            {errors.protein && <Text style={{ color: "red", alignSelf: "flex-start" }}>{errors.protein}</Text>}
          </View>

          {/* Fat row */}
          <View style={{ width: "100%", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "600" }}>Fat (g)</Text>
              <Text style={{ color: "#666" }}>was: {originalRef.current.fat}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <TextInput
                style={[styles.input, { flex: 1, width: undefined, marginBottom: 0 }]}
                value={fat}
                onChangeText={setFat}
                editable={!saving && !deleting}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <View style={{ width: 56, alignItems: "center", marginLeft: 8 }}>
                {renderDelta(fat, originalRef.current.fat)}
              </View>
            </View>
            {errors.fat && <Text style={{ color: "red", alignSelf: "flex-start" }}>{errors.fat}</Text>}
          </View>

          {/* Carbs row */}
          <View style={{ width: "100%", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "600" }}>Carbohydrates (g)</Text>
              <Text style={{ color: "#666" }}>was: {originalRef.current.carbohydrates}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <TextInput
                style={[styles.input, { flex: 1, width: undefined, marginBottom: 0 }]}
                value={carbs}
                onChangeText={setCarbs}
                editable={!saving && !deleting}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <View style={{ width: 56, alignItems: "center", marginLeft: 8 }}>
                {renderDelta(carbs, originalRef.current.carbohydrates)}
              </View>
            </View>
            {errors.carbohydrates && <Text style={{ color: "red", alignSelf: "flex-start" }}>{errors.carbohydrates}</Text>}
          </View>

          <View style={{ flexDirection: "row", width: "100%", justifyContent: "space-between", marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#999", width: "30%" }]}
              onPress={() => {
                onClose && onClose();
              }}
              disabled={saving || deleting}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#e74c3c", width: "30%" }]}
              onPress={confirmAndDelete}
              disabled={saving || deleting}
            >
              {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Delete</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#007aff", width: "30%" }]}
              onPress={validateAndSave}
              disabled={saving || deleting}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
},
(prev, next) => {
  const sameVisible = prev.visible === next.visible;
  const sameId = prev?.payload?.logId === next?.payload?.logId;
  return sameVisible && sameId;
});


// Small presentational stat bar
function StatBar({ label, value, goal, unit }) {
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
  },
  headerRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  navButton: { padding: 8 },
  navText: { fontSize: 22, fontWeight: "700" },
  headerDate: { fontSize: 16, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  infoBox: {
    padding: 12,
    marginVertical: 12,
    borderRadius: 8,
    backgroundColor: "#eee",
    width: "100%",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  mealBlock: { paddingVertical: 8, borderTopWidth: 1, borderColor: "#eee" },
  mealTitle: { fontWeight: "700", marginBottom: 6 },
  emptyText: { color: "#666", marginLeft: 6 },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  logName: { fontSize: 15 },
  logCals: { color: "#666" },

  container: { flex: 1, backgroundColor: "#000" },
  smallStatus: {
    position: "absolute",
    top: 8,
    left: 12,
    right: 12,
    color: "#fff",
    zIndex: 10,
  },

  preview: { flex: 1, width: "100%", backgroundColor: "#000", marginTop: 40 },
  bottomRow: {
    height: 100,
    backgroundColor: "#000",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  primaryButton: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#007aff",
    borderRadius: 8,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  // IMPORTANT: make children stretch so width: "100%" works reliably on iOS
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    width: "80%",
    alignItems: "stretch",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 10 },
  modalButton: {
    backgroundColor: "#007aff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonText: { color: "#fff", fontWeight: "700" },

  // Input
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fff",
    // remove hard width here — child layout decides width
    marginBottom: 8,
  },

  // Meal selector
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

  // progress
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
