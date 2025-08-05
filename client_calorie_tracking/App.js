import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from './screens/LoginScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { ProfileScreen } from './screens/ProfileScreen.js';
import { AuthContext } from './auth/AuthContext.js';
import jwtStorage from './utils/jwtStorage.js';

const Stack = createStackNavigator();

export default function App() {
  const [userToken, setUserToken] = useState(null);
  const authContext = {
    signIn: async (token) => {
      await jwtStorage.set(token)
      setUserToken(token);
    },
    signOut: async () => {
      await jwtStorage.delete()
      setUserToken(null);
    }
  };

  useEffect(() => {
    const loadToken = async () => {
      const token = await jwtStorage.get()
      setUserToken(token);
    };
    loadToken();
  }, []);

  return (
    <AuthContext.Provider value={authContext}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {userToken == null ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}