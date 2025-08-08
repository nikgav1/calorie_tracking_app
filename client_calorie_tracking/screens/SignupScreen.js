import { useContext, useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { AuthContext } from "../auth/AuthContext";
import { api } from "../auth/api";
import GoBackButton from "../components/GoBackButton";
import { Formik } from "formik";
import * as Yup from "yup";

export function SignupScreen() {
  const { signIn } = useContext(AuthContext);
  const [serverError, setServerError] = useState("");

  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .email("Invalid email address")
      .required("Email is required"),
    password: Yup.string()
      .min(8, "Password must be at least 8 characters")
      .required("Password is required"),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password")], "Passwords must match")
      .required("Confirm Password is required"),
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Create Account</Text>

        {serverError ? <Text style={styles.errorText}>{serverError}</Text> : null}

        <Formik
          initialValues={{ email: "", password: "", confirmPassword: "" }}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            try {
              await api.post("/auth/signup", {
                email: values.email,
                password: values.password
              })
              await signIn(values.email, values.password)
            } catch (error) {
              setServerError(error.message || "An error occurred during signup");
            }
          }}
        >
          {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isValid }) => (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange("email")}
                  onBlur={handleBlur("email")}
                  value={values.email}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                />
                {touched.email && errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange("password")}
                  onBlur={handleBlur("password")}
                  value={values.password}
                  placeholder="Enter your password"
                  secureTextEntry={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                />
                {touched.password && errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange("confirmPassword")}
                  onBlur={handleBlur("confirmPassword")}
                  value={values.confirmPassword}
                  placeholder="Confirm your password"
                  secureTextEntry={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                />
                {touched.confirmPassword && errors.confirmPassword && (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                )}
              </View>

              <Button
                title="Sign Up"
                onPress={handleSubmit}
                disabled={!isValid}
              />
            </>
          )}
        </Formik>

        <GoBackButton />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "white",
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    fontWeight: "bold",
  },
  inputGroup: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    color: "#333",
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    height: 44,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  errorText: {
    color: "red",
    marginBottom: 10,
    fontSize: 14,
  },
});