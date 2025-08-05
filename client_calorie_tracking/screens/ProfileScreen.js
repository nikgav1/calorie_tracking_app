import { View, Text, StyleSheet, Button} from 'react-native';
import GoBackButton from '../components/GoBackButton';

export function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <GoBackButton></GoBackButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 20 }
});