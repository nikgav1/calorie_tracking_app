import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from './screens/LoginScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { ProfileScreen } from './screens/ProfileScreen.js';
import { SignupScreen } from './screens/SignupScreen.js';
import { AuthContext } from './auth/AuthContext.js';
import { LogFoodScreen } from './screens/LogFoodScreen.js';
import { api } from './auth/api.js';
import jwtStorage from './utils/jwtStorage.js';

const Stack = createStackNavigator();

export default function App() {
  const [userToken, setUserToken] = useState(null);
  const authContext = {
    signIn: async (emailInput, passwordInput) => {
      try {
        const response = await api.post("/auth/login", {
          email: emailInput,
          password: passwordInput
        })

        const { token } = response.data;
        await jwtStorage.set(token)
        setUserToken(token);
      } catch (error) {
        await jwtStorage.delete()
        setUserToken(null)
      }
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
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="LogFood" component={LogFoodScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}