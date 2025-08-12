import { useEffect, useRef, useState } from "react";
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
import { Picker } from "@react-native-picker/picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import { api } from "../auth/api";
import { Formik } from "formik";
import * as Yup from "yup";
import jwtStorage from "../utils/jwtStorage";

export function LogFoodScreen() {
  const cameraRef = useRef(null);

  const [showCamera, setShowCamera] = useState(false);
  const [facing, setFacing] = useState("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [taking, setTaking] = useState(false); // single-capture guard
  const [uploading, setUploading] = useState(false);
  const [userData, setUserData] = useState(null);

  const [photo, setPhoto] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  // Modal control for "add log"
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // State for today's Day document (meals + totals)
  const [todayDay, setTodayDay] = useState(null);
  const [fetchingDay, setFetchingDay] = useState(false);
  const [currentDateParam, setCurrentDateParam] = useState(() =>
    new Date().toISOString()
  );

  // Log detail modal (open when clicking log name)
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [activeLog, setActiveLog] = useState(null); // { meal, log } where log has _id
  const [logSaving, setLogSaving] = useState(false);
  const [logDeleting, setLogDeleting] = useState(false);

  const validationSchema = Yup.object().shape({
    name: Yup.string()
      .required("Name is required")
      .trim()
      .min(2, "Name must be at least 2 characters"),

    meal: Yup.string().required("Meal is required").trim(),

    kcal: Yup.number()
      .typeError("Kcal must be a number")
      .integer("Kcal must be an integer")
      .positive("Kcal must be greater than 0")
      .required("Kcal is required"),

    protein: Yup.number()
      .typeError("Protein must be a number")
      .min(0, "Protein cannot be negative")
      .required("Protein is required"),

    fat: Yup.number()
      .typeError("Fat must be a number")
      .min(0, "Fat cannot be negative")
      .required("Fat is required"),

    carbohydrates: Yup.number()
      .typeError("Carbohydrates must be a number")
      .min(0, "Carbohydrates cannot be negative")
      .required("Carbohydrates are required"),
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
        // Day exists conceptually but has no data yet
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

  // helper to compute percent safely
  function percent(current, goal) {
    if (!goal || goal <= 0) return 0;
    return Math.min(100, Math.round((current / goal) * 100));
  }

  // ---------- Initial UI ----------
  function InitialUI() {
    // derive current totals from todayDay (fallback to zeros)
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
        {/* Top navigation: prev / date / next */}
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

        {/* Goals + progress bars */}
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

        {/* Meals and logs list */}
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
          onPress={async () => {
            if (!permission) {
              await requestPermission();
            }
            if (permission?.granted) {
              setShowCamera(true);
              setIsCameraReady(false);
            } else {
              const p = await requestPermission();
              if (p?.granted) {
                setShowCamera(true);
                setIsCameraReady(false);
              } else {
                Alert.alert(
                  "Permission required",
                  "Camera permission is required to take a photo."
                );
              }
            }
          }}
        >
          <Text style={styles.primaryButtonText}>Analyze food</Text>
        </TouchableOpacity>

        {/* Add-log modal (existing) */}
        <Modal
          visible={successModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSuccessModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Log the food!</Text>

              {!uploadResult ? (
                <ActivityIndicator />
              ) : (
                <Formik
                  enableReinitialize={true}
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

                      // build payload so that meal and date are outside of log
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

                      // adjust endpoint if needed
                      await api.post("/log/foodLog", payload);

                      setSubmitting(false);
                      setSuccessModalVisible(false);
                      // refresh day and totals
                      fetchUserData();
                      fetchTodayDay();
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
                        autoComplete="off"
                        returnKeyType="done"
                      />
                      {touched.name && errors.name && (
                        <Text style={{ color: "red", alignSelf: "flex-start" }}>
                          {errors.name}
                        </Text>
                      )}

                      <View
                        style={{
                          color: "black",
                          width: "100%",
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: "#ddd",
                          borderRadius: 8,
                          overflow: "hidden",
                          backgroundColor: "#fff",
                        }}
                      >
                        <Picker
                          selectedValue={values.meal}
                          onValueChange={(value) =>
                            setFieldValue("meal", value)
                          }
                          mode="dropdown"
                        >
                          <Picker.Item label="Breakfast" value="breakfast" />
                          <Picker.Item label="Lunch" value="lunch" />
                          <Picker.Item label="Dinner" value="dinner" />
                          <Picker.Item label="Snacks" value="snacks" />
                        </Picker>
                      </View>

                      {touched.meal && errors.meal && (
                        <Text style={{ color: "red", alignSelf: "flex-start" }}>
                          {errors.meal}
                        </Text>
                      )}

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
                        autoComplete="off"
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
                        returnKeyType="done"
                        autoComplete="off"
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
                        returnKeyType="done"
                        autoComplete="off"
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
                        returnKeyType="done"
                        autoComplete="off"
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

        {/* Log detail modal (unchanged) */}
        <Modal
          visible={logModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setLogModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { width: "90%" }]}>
              <Text style={styles.modalTitle}>Log details</Text>

              {!activeLog ? (
                <ActivityIndicator />
              ) : (
                <Formik
                  enableReinitialize
                  initialValues={{
                    name: activeLog.log.name || "",
                    kcal: String(activeLog.log.ccal || 0),
                    protein: String(activeLog.log.protein || 0),
                    fat: String(activeLog.log.fat || 0),
                    carbohydrates: String(activeLog.log.carbohydrates || 0),
                  }}
                  validationSchema={Yup.object().shape({
                    name: Yup.string().required("Name required"),
                    kcal: Yup.number().required("Kcal required"),
                    protein: Yup.number().required("Protein required"),
                    fat: Yup.number().required("Fat required"),
                    carbohydrates: Yup.number().required("Carbs required"),
                  })}
                  onSubmit={async (vals) => {
                    setLogSaving(true);
                    try {
                      const dateParam = currentDateParam;
                      const endpoint = `/log/days/${encodeURIComponent(
                        dateParam
                      )}/${encodeURIComponent(
                        activeLog.meal
                      )}/${encodeURIComponent(activeLog.log._id)}`;
                      await api.put(endpoint, {
                        name: vals.name,
                        ccal: Number(vals.kcal),
                        protein: Number(vals.protein),
                        fat: Number(vals.fat),
                        carbohydrates: Number(vals.carbohydrates),
                      });
                      setLogSaving(false);
                      setLogModalVisible(false);
                      fetchTodayDay();
                      fetchUserData();
                      Alert.alert("Saved", "Log updated");
                    } catch (err) {
                      setLogSaving(false);
                      console.error("Failed to update log", err);
                      Alert.alert("Update failed", String(err?.message || err));
                    }
                  }}
                >
                  {({ handleChange, handleBlur, handleSubmit, values }) => (
                    <>
                      <TextInput
                        style={styles.input}
                        value={values.name}
                        onChangeText={handleChange("name")}
                        onBlur={handleBlur("name")}
                      />
                      <TextInput
                        style={styles.input}
                        value={values.kcal}
                        onChangeText={handleChange("kcal")}
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={styles.input}
                        value={values.protein}
                        onChangeText={handleChange("protein")}
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={styles.input}
                        value={values.fat}
                        onChangeText={handleChange("fat")}
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={styles.input}
                        value={values.carbohydrates}
                        onChangeText={handleChange("carbohydrates")}
                        keyboardType="numeric"
                      />

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
                            { backgroundColor: "#999", width: "30%" },
                          ]}
                          onPress={() => setLogModalVisible(false)}
                          disabled={logSaving || logDeleting}
                        >
                          <Text style={styles.modalButtonText}>Close</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            { backgroundColor: "#e74c3c", width: "30%" },
                          ]}
                          onPress={async () => {
                            // delete
                            Alert.alert("Confirm", "Delete this log?", [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: async () => {
                                  try {
                                    setLogDeleting(true);
                                    const dateParam = currentDateParam;
                                    const endpoint = `/log/days/${encodeURIComponent(
                                      dateParam
                                    )}/${encodeURIComponent(
                                      activeLog.meal
                                    )}/${encodeURIComponent(
                                      activeLog.log._id
                                    )}`;
                                    await api.delete(endpoint);
                                    setLogDeleting(false);
                                    setLogModalVisible(false);
                                    fetchTodayDay();
                                    fetchUserData();
                                    Alert.alert("Deleted");
                                  } catch (err) {
                                    setLogDeleting(false);
                                    console.error("Delete failed", err);
                                    Alert.alert(
                                      "Delete failed",
                                      String(err?.message || err)
                                    );
                                  }
                                },
                              },
                            ]);
                          }}
                          disabled={logSaving || logDeleting}
                        >
                          {logDeleting ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.modalButtonText}>Delete</Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            { backgroundColor: "#007aff", width: "30%" },
                          ]}
                          onPress={handleSubmit}
                          disabled={logSaving || logDeleting}
                        >
                          {logSaving ? (
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
      </SafeAreaView>
    );
  }

  // ---------- Camera UI (updated, Android-safe) ----------
  function CameraUI() {
    const toggleFacing = () =>
      setFacing((f) => (f === "back" ? "front" : "back"));

    const onCameraReady = () => {
      // small delay so camera internals settle before allowing capture
      setTimeout(() => setIsCameraReady(true), 120);
    };

    // small helper delay
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    const takePicture = async () => {
      if (!cameraRef.current) {
        console.warn("Camera ref missing");
        return;
      }
      if (!isCameraReady) {
        console.warn("Camera not ready yet.");
        return;
      }
      if (taking) {
        console.warn("Already taking a picture, ignoring duplicate call.");
        return;
      }

      setTaking(true);
      try {
        let result = null;

        // On Android prefer skipping processing first (more reliable on some devices).
        // We'll try up to two attempts with different options.
        const attempts =
          Platform.OS === "android"
            ? [
                { skipProcessing: true, quality: 0.7 },
                { skipProcessing: false, quality: 0.6 },
              ]
            : [
                { skipProcessing: false, quality: 0.8 },
                { skipProcessing: true, quality: 0.7 },
              ];

        for (let i = 0; i < attempts.length; i++) {
          const opts = attempts[i];
          try {
            // slight stagger to avoid concurrency on some devices
            await delay(120 + i * 100);
            // take picture
            const r = await cameraRef.current.takePictureAsync({
              quality: opts.quality,
              skipProcessing: !!opts.skipProcessing,
              // you can add exif:false on android if you want
              // exif: false,
            });

            if (r && r.uri) {
              result = r;
              break;
            }
          } catch (innerErr) {
            console.debug(
              `capture attempt ${i + 1} failed`,
              innerErr?.message || innerErr
            );
            // continue to next attempt
            await delay(150);
          }
        }

        if (!result || !result.uri) {
          throw new Error("Failed to capture image");
        }

        console.log("takePicture success:", result.uri);
        setPhoto(result);
      } catch (err) {
        console.error("takePictureAsync error", err);
        Alert.alert(
          "Camera error",
          `Could not capture image: ${String(
            err?.message ?? err
          )}\n\nTry switching camera (front/back) or lowering resolution in settings.`
        );
      } finally {
        // small delay before allowing another capture
        await delay(200);
        setTaking(false);
      }
    };

    return (
      <View style={styles.container}>
        <Text style={styles.smallStatus}>{String("Camera open")}</Text>

        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          onCameraReady={onCameraReady}
        />

        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>Frame your food</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              setShowCamera(false);
              setPhoto(null);
            }}
          >
            <Text style={styles.controlText}>Close</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleFacing}>
            <Text style={styles.controlText}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePicture}
            disabled={!isCameraReady || taking}
          >
            {taking ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.captureText}>Take</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Upload  ----------
  async function uploadPhotoWithApi(photoFile) {
    if (!photoFile?.uri) {
      Alert.alert("No photo", "No photo to upload");
      return;
    }

    let uri = photoFile.uri;

    // If content on Android, copy to a temporary file in cache first
    if (Platform.OS === "android" && uri.startsWith("content://")) {
      try {
        const filename = uri.split("/").pop() || `photo.jpg`;
        const dest = `${FileSystem.cacheDirectory}${filename}`;
        // copyAsync can handle content
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
      } catch (copyErr) {
        console.warn(
          "Failed to copy content:// URI to cache, will try upload with original URI",
          copyErr
        );
        // fallthrough, attempt upload with original uri
      }
    }

    // Normalize URI for Android (ensure file://)
    if (
      Platform.OS === "android" &&
      !uri.startsWith("file://") &&
      !uri.startsWith("content://")
    ) {
      uri = `file://${uri}`;
    }

    const filename = uri.split("/").pop() || `photo.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : "jpg";
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";

    const form = new FormData();
    // Give { uri, name, type }
    form.append("image", {
      uri,
      name: filename,
      type: mimeType,
    });
    form.append("source", "expo-app");

    try {
      setUploading(true);

      const authHeader = await jwtStorage.get();

      const headers = {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      };

      const response = await api.post("/api/analyze", form, { headers });
      const body = response.data;
      let nutritionData = body?.nutritionData ?? body;
      if (typeof nutritionData === "string") {
        try {
          nutritionData = JSON.parse(nutritionData);
        } catch (e) {}
      }

      handleAfterUpload(nutritionData);
    } catch (err) {
      console.error("upload error", err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        (err?.toString && err.toString()) ||
        "Upload failed";
      Alert.alert("Upload failed", String(message));
    } finally {
      setUploading(false);
    }
  }

  function handleAfterUpload(serverData) {
    setUploadResult(serverData);
    setPhoto(null);
    setShowCamera(false);
    setSuccessModalVisible(true);
  }

  // ---------- helpers ----------
  function capitalize(s) {
    return String(s).charAt(0).toUpperCase() + String(s).slice(1);
  }

  function openLogModal(meal, log) {
    setActiveLog({ meal, log });
    setLogModalVisible(true);
  }

  function changeDay(delta) {
    try {
      const curr = new Date(currentDateParam);
      // add/subtract days in UTC to keep consistent with server normalization
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
      // format like: 2025-08-12 (or use toLocaleDateString for user-friendly)
      return d.toLocaleDateString();
    } catch (e) {
      return iso;
    }
  }

  // ---------- render ----------
  if (showCamera && photo) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.smallStatus}>
          {String("Preview — ready to upload")}
        </Text>
        <Image
          source={{ uri: photo.uri }}
          style={styles.preview}
          resizeMode="contain"
        />
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setPhoto(null)}
          >
            <Text style={styles.controlText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: "#2ecc71" }]}
            onPress={() => uploadPhotoWithApi(photo)}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.controlText}>Upload</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showCamera) return <CameraUI />;

  return <InitialUI />;
}

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

  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  overlayText: { color: "#fff", fontSize: 16 },
  controls: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "space-around",
    flexDirection: "row",
    paddingHorizontal: 20,
  },
  controlButton: {
    backgroundColor: "#333",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  controlText: { color: "#fff", fontWeight: "600" },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureText: { fontWeight: "700", color: "#000" },

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
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 10 },
  modalText: { fontSize: 16, textAlign: "center", marginBottom: 20 },
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
    width: "100%",
    marginBottom: 8,
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
