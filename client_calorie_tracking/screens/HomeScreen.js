import { useContext } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { AuthContext } from '../auth/AuthContext';
import { api } from '../auth/api';
import { useNavigation } from '@react-navigation/native';

export function HomeScreen() {
  const { signOut } = useContext(AuthContext);
  const navigation = useNavigation();

  const fetchData = async () => {
    try {
      const res = await api.get('/protected');
      console.log('Protected data:', res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Button title="Get Protected Data" onPress={fetchData} />
      <Button title="Go to Profile" onPress={() => navigation.navigate('Profile')} />
      <Button title="Sign Out" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 20 }
});