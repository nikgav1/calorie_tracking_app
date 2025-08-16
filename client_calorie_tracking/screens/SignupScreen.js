import { useRef, useContext, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { AuthContext } from "../auth/AuthContext";
import { api } from "../auth/api";
import GoBackButton from "../components/GoBackButton";
import { getUserOffsetMinutes } from "../utils/time";
import { Formik } from "formik";
import * as Yup from "yup";

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
  (toFloatOr0(protein) * 4) + (toFloatOr0(carbs) * 4) + (toFloatOr0(fat) * 9);

/** Validation */
const validationSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email address").required("Email is required"),
  password: Yup.string().min(8, "Password must be at least 8 characters").required("Password is required"),
  confirmPassword: Yup.string().oneOf([Yup.ref("password")], "Passwords must match").required("Confirm Password is required"),

  age: Yup.number().typeError("Age must be a number").integer("Age must be whole").min(10, "Too young").max(120, "Unrealistic age").required("Age required"),
  sex: Yup.string().oneOf(["male", "female"]).required("Sex required"),
  weight: Yup.number().typeError("Weight must be a number").min(20, "Too low").max(500, "Too high").required("Weight required"),
  height: Yup.number().typeError("Height must be a number").min(50, "Too short").max(300, "Too tall").required("Height required"),
  activityLevel: Yup.string().oneOf(Object.keys(activityMultipliers)).required("Activity level required"),

  protein: Yup.number().typeError("Protein must be a number").min(0, "Cannot be negative").max(500, "Too high").required("Protein required"),
  fat: Yup.number().typeError("Fat must be a number").min(0).max(500).required("Fat required"),
  carbohydrates: Yup.number().typeError("Carbs must be a number").min(0).max(1000).required("Carbs required"),

  ccal: Yup.number().typeError("Calories must be a number").integer("Calories must be whole").positive("Calories must be positive").max(20000, "Calories too high").required("Calories required"),
}).test(
  "macros-within-ccal",
  "Macro calories exceed selected calorie target. Increase calories or lower macros.",
  function (values) {
    if (!values) return true;
    const macroCal = getMacroCalories(values.protein, values.fat, values.carbohydrates);
    return macroCal <= toIntOr0(values.ccal);
  }
);

// Fields required on each step
const STEP_FIELDS = {
  0: ["email", "password", "confirmPassword"],
  1: ["age", "sex", "weight", "height", "activityLevel"],
  2: ["protein", "fat", "carbohydrates", "ccal"],
};

/** Animated progress bar that measures width and animates smoothly */
function ProgressBar({ progress }) {
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

/** InnerForm (multi-step) */
function InnerForm({
  formikProps,
  currentStep,
  setCurrentStep,
  ccalManuallyEditedRef,
  setCcalManuallyEdited,
}) {
  const {
    handleChange,
    handleBlur,
    handleSubmit,
    values,
    errors,
    touched,
    setFieldValue,
    validateForm,
    isSubmitting,
    isValid,
    setFieldTouched,
  } = formikProps;

  // Derived numbers
  const bmr = calcBMR({
    sex: values.sex,
    weightKg: values.weight,
    heightCm: values.height,
    age: values.age,
  });
  const activityMul = activityMultipliers[values.activityLevel] || 1.2;
  const tdee = roundInt(bmr * activityMul);
  const macroCalories = roundInt(getMacroCalories(values.protein, values.fat, values.carbohydrates));

  // Sync ccal with TDEE initially when user hasn't manually edited
  useEffect(() => {
    if (!ccalManuallyEditedRef.current) {
      const target = tdee || 0;
      if (toIntOr0(values.ccal) !== target) {
        setFieldValue("ccal", String(target), false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdee, ccalManuallyEditedRef, values.ccal]);

  const setCcalFromMacros = () => {
    setFieldValue("ccal", String(macroCalories), true);
    setCcalManuallyEdited(true);
  };

  const applyTdeePreset = (pct) => {
    const newCcal = roundInt(tdee * pct);
    setFieldValue("ccal", String(newCcal), true);
    setCcalManuallyEdited(true);
  };

  // Macro presets as percentages (protein, fat, carbs)
  const macroPresets = [
    { key: "balanced", label: "Balanced (30P / 30F / 40C)", p: 0.30, f: 0.30, c: 0.40 },
    { key: "high_protein", label: "High Protein (40P / 25F / 35C)", p: 0.40, f: 0.25, c: 0.35 },
    { key: "low_carb", label: "Low Carb (25P / 35F / 40C)", p: 0.25, f: 0.35, c: 0.40 },
  ];

  // Apply macro preset: convert percentages -> grams based on current calories
  const applyMacroPreset = (pPct, fPct, cPct) => {
    const cals = toIntOr0(values.ccal) || tdee || 0;
    if (cals <= 0) return;
    const pCals = cals * pPct;
    const fCals = cals * fPct;
    const cCals = cals * cPct;
    const pGram = Math.round(pCals / 4);
    const fGram = Math.round(fCals / 9);
    const cGram = Math.round(cCals / 4);
    setFieldValue("protein", String(pGram), true);
    setFieldValue("fat", String(fGram), true);
    setFieldValue("carbohydrates", String(cGram), true);
    setCcalManuallyEdited(true);
  };

  // Per-step validity state
  const [stepValid, setStepValid] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const allErrors = await validateForm();
      const requiredFields = STEP_FIELDS[currentStep] || [];
      const invalid = requiredFields.some((f) => {
        const val = values[f];
        const empty = val === "" || val === null || typeof val === "undefined";
        return empty || !!allErrors[f];
      });
      if (active) setStepValid(!invalid);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, errors, touched, currentStep]);

  const goNext = () => {
    validateForm().then((allErrors) => {
      const requiredFields = STEP_FIELDS[currentStep] || [];
      const invalid = requiredFields.some((f) => {
        const val = values[f];
        const empty = val === "" || val === null || typeof val === "undefined";
        return empty || !!allErrors[f];
      });
      if (!invalid) {
        setCurrentStep((s) => Math.min(2, s + 1));
      } else {
        requiredFields.forEach((f) => setFieldTouched(f, true));
      }
    });
  };

  const goBack = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  // progress for bar: 0..1 (3 steps)
  const progress = (currentStep + 1) / 3;

  return (
    <View style={styles.formInner}>
      <Text style={styles.stepTitle}>Step {currentStep + 1} of 3</Text>

      {/* Progress bar */}
      <ProgressBar progress={progress} />

      {currentStep === 0 && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              onChangeText={handleChange("email")}
              onBlur={handleBlur("email")}
              value={values.email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              // allow autofill only for email
              autoComplete="email"
              textContentType="emailAddress"
              autoCorrect={false}
            />
            {touched.email && errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                onChangeText={handleChange("password")}
                onBlur={handleBlur("password")}
                value={values.password}
                placeholder="Password"
                secureTextEntry
                autoCapitalize="none"
                // allow autofill for password
                autoComplete="password"
                textContentType="password"
                autoCorrect={false}
              />
              {touched.password && errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Confirm</Text>
              <TextInput
                style={styles.input}
                onChangeText={handleChange("confirmPassword")}
                onBlur={handleBlur("confirmPassword")}
                value={values.confirmPassword}
                placeholder="Confirm"
                secureTextEntry
                autoCapitalize="none"
                // disable autocomplete on confirm password as requested
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
              {touched.confirmPassword && errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>
          </View>
        </>
      )}

      {currentStep === 1 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Personal</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                onChangeText={(v) => setFieldValue("age", v)}
                onBlur={handleBlur("age")}
                value={String(values.age)}
                placeholder="Years"
                keyboardType="numeric"
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
              {touched.age && errors.age && <Text style={styles.errorText}>{errors.age}</Text>}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sex</Text>
              <View style={styles.segment}>
                {["male", "female"].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.segmentButton, values.sex === s && styles.segmentButtonActive]}
                    onPress={() => setFieldValue("sex", s)}
                  >
                    <Text style={values.sex === s ? styles.segmentTextActive : styles.segmentText}>
                      {s === "male" ? "Male" : "Female"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {touched.sex && errors.sex && <Text style={styles.errorText}>{errors.sex}</Text>}
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                onChangeText={(v) => setFieldValue("weight", v)}
                onBlur={handleBlur("weight")}
                value={String(values.weight)}
                placeholder="e.g. 70"
                keyboardType="numeric"
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
              {touched.weight && errors.weight && <Text style={styles.errorText}>{errors.weight}</Text>}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                onChangeText={(v) => setFieldValue("height", v)}
                onBlur={handleBlur("height")}
                value={String(values.height)}
                placeholder="e.g. 175"
                keyboardType="numeric"
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
              {touched.height && errors.height && <Text style={styles.errorText}>{errors.height}</Text>}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Activity level</Text>
            {activityOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.activityButton, values.activityLevel === opt.key && styles.activityButtonActive]}
                onPress={() => setFieldValue("activityLevel", opt.key)}
              >
                <Text style={values.activityLevel === opt.key ? styles.activityTextActive : styles.activityText}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
            {touched.activityLevel && errors.activityLevel && <Text style={styles.errorText}>{errors.activityLevel}</Text>}
          </View>
        </>
      )}

      {currentStep === 2 && (
        <>
          <View style={[styles.card, { marginBottom: 12 }]}>
            <Text style={styles.cardTitle}>Calculated (BMR & TDEE)</Text>
            <Text style={styles.cardText}>BMR: {roundInt(bmr)} kcal/day</Text>
            <Text style={styles.cardText}>Maintenance (TDEE): {tdee} kcal/day</Text>
            <Text style={{ marginTop: 10, fontWeight: "700" }}>Calorie goal</Text>

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                onChangeText={(v) => {
                  setCcalManuallyEdited(true);
                  setFieldValue("ccal", v);
                }}
                onBlur={handleBlur("ccal")}
                value={String(values.ccal)}
                placeholder="Enter daily kcal"
                keyboardType="numeric"
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
              <Button title="Set from macros" onPress={setCcalFromMacros} />
            </View>

            {touched.ccal && errors.ccal && <Text style={styles.errorText}>{errors.ccal}</Text>}

            <View style={{ flexDirection: "column", marginTop: 12 }}>
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

          <Text style={styles.sectionTitle}>Macros</Text>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontWeight: "700", marginBottom: 6 }}>Macro presets</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {macroPresets.map((mp) => (
                <TouchableOpacity
                  key={mp.key}
                  style={styles.presetBtn}
                  onPress={() => applyMacroPreset(mp.p, mp.f, mp.c)}
                >
                  <Text style={styles.presetText}>{mp.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {[
            { name: "protein", label: "Protein (g)" },
            { name: "fat", label: "Fat (g)" },
            { name: "carbohydrates", label: "Carbs (g)" },
          ].map((field) => (
            <View key={field.name} style={styles.inputGroup}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                style={styles.input}
                onChangeText={(v) => setFieldValue(field.name, v)}
                onBlur={handleBlur(field.name)}
                value={String(values[field.name])}
                placeholder={`e.g. 120 for ${field.label.toLowerCase()}`}
                keyboardType="numeric"
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
              {touched[field.name] && errors[field.name] && <Text style={styles.errorText}>{errors[field.name]}</Text>}
            </View>
          ))}
        </>
      )}

      <View style={{ flexDirection: "row", marginTop: 18, justifyContent: "space-between" }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {currentStep > 0 ? (
            <Button title="Back" onPress={goBack} />
          ) : (
            <View style={{ height: 40 }} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          {currentStep < 2 ? (
            <Button title="Next" onPress={goNext} disabled={!stepValid} />
          ) : (
            <Button title={isSubmitting ? "Signing up..." : "Sign Up"} onPress={handleSubmit} disabled={!isValid || isSubmitting} />
          )}
        </View>
      </View>
    </View>
  );
}

/** Main screen */
export function SignupScreen() {
  const { signIn } = useContext(AuthContext);
  const [serverError, setServerError] = useState("");
  // track manual edit using a ref to avoid rerenders
  const [ccalManuallyEdited, setCcalManuallyEditedState] = useState(false);
  const ccalManuallyEditedRef = useRef(ccalManuallyEdited);
  const setCcalManuallyEdited = (v) => {
    ccalManuallyEditedRef.current = v;
    setCcalManuallyEditedState(v);
  };

  const [currentStep, setCurrentStep] = useState(0);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Create Account</Text>
            {serverError ? <Text style={styles.errorText}>{serverError}</Text> : null}

            <Formik
              initialValues={{
                email: "",
                password: "",
                confirmPassword: "",
                age: "",
                sex: "male",
                weight: "",
                height: "",
                activityLevel: "sedentary",
                protein: "",
                fat: "",
                carbohydrates: "",
                ccal: "",
              }}
              validationSchema={validationSchema}
              onSubmit={async (values, { setSubmitting }) => {
                setServerError("");
                try {
                  setSubmitting(true);
                  const userOffsetMinutesInput = getUserOffsetMinutes()
                  await api.post("/auth/signup", {
                    email: values.email,
                    password: values.password,
                    age: parseInt(values.age, 10),
                    sex: values.sex,
                    weight: parseFloat(values.weight),
                    height: parseFloat(values.height),
                    activityLevel: values.activityLevel,
                    protein: parseFloat(values.protein),
                    fat: parseFloat(values.fat),
                    carbohydrates: parseFloat(values.carbohydrates),
                    ccal: parseInt(values.ccal, 10),
                    utcOffsetMinutes: userOffsetMinutesInput
                  });
                  await signIn(values.email, values.password);
                } catch (error) {
                  setServerError(error?.response?.data?.message || error?.message || "An error occurred during signup");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {(formikProps) => (
                <InnerForm
                  formikProps={formikProps}
                  currentStep={currentStep}
                  setCurrentStep={setCurrentStep}
                  ccalManuallyEditedRef={ccalManuallyEditedRef}
                  setCcalManuallyEdited={setCcalManuallyEdited}
                />
              )}
            </Formik>

            <View style={{ marginTop: 12 }}>
              <GoBackButton />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/** Styles */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 60, // extra space so last inputs aren't hidden by keyboard
  },
  formInner: {},
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  stepTitle: { textAlign: "center", marginBottom: 12, fontWeight: "700" },

  /* progress */
  progressWrap: { marginBottom: 12, paddingHorizontal: 4 },
  progressBg: {
    height: 6,
    backgroundColor: "#eee",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: "#007bff",
    borderRadius: 6,
    width: 0, // animated
  },

  inputGroup: { marginBottom: 12 },
  label: { fontWeight: "600", marginBottom: 6, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { marginTop: 8, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  card: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f7f7f8",
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 12,
  },
  cardTitle: { fontWeight: "700", marginBottom: 6 },
  cardText: { marginBottom: 4 },
  cardNote: { color: "#666", fontSize: 13 },
  errorText: { color: "red", marginTop: 6 },
  warningText: { color: "#b05a00", marginTop: 6 },
  activityButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8,
  },
  activityButtonActive: {
    backgroundColor: "#007bff22",
    borderColor: "#007bff",
  },
  activityText: { color: "#333" },
  activityTextActive: { color: "#007bff", fontWeight: "700" },
  presetBtn: {
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginRight: 8,
    marginBottom: 8,
  },
  presetText: { fontSize: 13 },
  segment: { flexDirection: "row" },
  segmentButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginRight: 8,
  },
  segmentButtonActive: { backgroundColor: "#007bff22", borderColor: "#007bff" },
  segmentText: { color: "#333" },
  segmentTextActive: { color: "#007bff", fontWeight: "700" },
});
