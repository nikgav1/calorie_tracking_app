import { createContext } from 'react';

export const AuthContext = createContext({
  signIn: async (email, password) => {},
  signOut: () => {}
});