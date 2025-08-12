import { View, Text, StyleSheet } from 'react-native';
import GoBackButton from '../components/GoBackButton';
import { useEffect, useState } from 'react';
import { api } from '../auth/api';
import { getUserOffsetMinutes } from '../utils/time';

export function ProfileScreen() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/data/user');
        setUserData(response.data);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <View style={styles.container}>
      <Text>{getUserOffsetMinutes()}</Text>
      <Text style={styles.title}>Profile</Text>
      {loading && <Text>Loading...</Text>}
      {!loading && userData && (
        <>
          <Text>Email: {userData.email}</Text>
          <Text>ID: {userData.userId}</Text>
          <Text>Calorie Goal: {userData.calorie_goal}</Text>
        </>
      )}
      <GoBackButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 20 }
});
