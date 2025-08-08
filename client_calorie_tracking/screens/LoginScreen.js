import { useContext, useState } from "react";
import { AuthContext } from "../auth/AuthContext";
import { Modal, View, Text, Button, StyleSheet, TextInput } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Formik } from "formik";
import * as Yup from "yup";

export function LoginScreen() {
  const { signIn } = useContext(AuthContext);
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);

  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .email("Invalid email address")
      .required("Email is required"),
    password: Yup.string().required("Password is required"),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Button title="Sign in" onPress={() => setModalVisible(true)} />
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <SafeAreaProvider>
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.modalContent}>
                <Formik
                  initialValues={{ email: "", password: "" }}
                  validationSchema={validationSchema}
                  onSubmit={async (values) => {
                    await signIn(values.email, values.password);
                  }}
                >
                  {({
                    handleChange,
                    handleBlur,
                    handleSubmit,
                    values,
                    errors,
                    touched,
                  }) => (
                    <View style={styles.formContainer}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter your email"
                          placeholderTextColor="#666"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          textContentType="emailAddress"
                          onChangeText={handleChange("email")}
                          onBlur={handleBlur("email")}
                          value={values.email}
                        />
                        {touched.email && errors.email && (
                          <Text style={styles.errorText}>{errors.email}</Text>
                        )}
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter your password"
                          placeholderTextColor="#666"
                          secureTextEntry={true}
                          autoCapitalize="none"
                          autoCorrect={false}
                          textContentType="password"
                          onChangeText={handleChange("password")}
                          onBlur={handleBlur("password")}
                          value={values.password}
                        />
                        {touched.password && errors.password && (
                          <Text style={styles.errorText}>
                            {errors.password}
                          </Text>
                        )}
                      </View>
                      <View style={styles.buttonContainer}>
                        <Button title="Submit" onPress={handleSubmit} />
                      </View>
                    </View>
                  )}
                </Formik>
                <View style={styles.buttonContainer}>
                  <Button
                    title="Close"
                    onPress={() => setModalVisible(false)}
                    color="#888"
                  />
                </View>
                <Text style={styles.title}>No Account?</Text>
                <Text
                  style={styles.link}
                  onPress={() => {
                    setModalVisible(false);
                    navigation.navigate("Signup");
                  }}
                >
                  Sign Up
                </Text>
              </View>
            </SafeAreaView>
          </SafeAreaProvider>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  link: {
    fontSize: 18,
    color: "#007AFF",
    marginBottom: 20,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  safeArea: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "stretch", // ← allow children to stretch horizontally
  },
  modalContent: {
    width: "90%", // 90% of screen width
    maxWidth: 400, // caps width on large devices
    paddingHorizontal: 10,
    alignItems: "center", // ← children fill this container
    justifyContent: "center",
  },
  formContainer: {
    width: "100%",
    marginBottom: 20,
    alignItems: "center", // ← children fill this container
    justifyContent: "center",
  },
  inputGroup: {
    width: "100%",
    marginBottom: 16,
    alignItems: "center", // ← children fill this container
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    color: "#333",
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "white",
    color: "black",
    alignSelf: "stretch",
  },
  errorText: {
    color: "red",
    fontSize: 14,
    marginTop: 4,
  },
  buttonContainer: {
    width: "100%",
    marginBottom: 16,
  },
});
