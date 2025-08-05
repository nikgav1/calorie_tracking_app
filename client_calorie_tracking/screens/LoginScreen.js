import { useContext, useState } from "react";
import { AuthContext } from "../auth/AuthContext";
import { Modal, View, Text, Button, StyleSheet, TextInput } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";

export function LoginScreen() {
  const { signIn } = useContext(AuthContext);
  const [modalVisible, setModalVisible] = useState(false);

  const [name, onChangeName] = useState('');
  const [password, onChangePassword] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Button title="Sign in" onPress={() => setModalVisible(true)} />
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              flex: 1, // Make modal content take full screen
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "white",
              borderRadius: 0, // Remove border radius for full screen
              width: "100%",
              height: "100%",
              padding: 0,
            }}
          >
            <SafeAreaProvider>
              <SafeAreaView style={styles.modalContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    onChangeText={onChangeName}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    value={name}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    onChangeText={onChangePassword}
                    value={password}
                    placeholder="Enter your password"
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                  />
                </View>
                <Button title="Submit" onPress={() => signIn("demo_token")} />
                <Button title="Close" onPress={() => setModalVisible(false)} color="#888" />
              </SafeAreaView>
            </SafeAreaProvider>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, marginBottom: 20 },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 24,
    backgroundColor: "white",
  },
  inputGroup: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    marginLeft: 4,
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
});
