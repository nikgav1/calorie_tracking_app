import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

const JWT_KEY = 'jwt';

const jwtStorage = {
  async set(token) {
    if (isWeb) {
      localStorage.setItem(JWT_KEY, token);
    } else {
      await SecureStore.setItemAsync(JWT_KEY, token);
    }
  },

  async get() {
    if (isWeb) {
      return localStorage.getItem(JWT_KEY);
    } else {
      return await SecureStore.getItemAsync(JWT_KEY);
    }
  },

  async delete() {
    if (isWeb) {
      localStorage.removeItem(JWT_KEY);
    } else {
      await SecureStore.deleteItemAsync(JWT_KEY);
    }
  }
};

export default jwtStorage