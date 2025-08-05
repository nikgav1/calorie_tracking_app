import { createContext } from 'react';

export const AuthContext = createContext({
  signIn: (_token) => {},
  signOut: () => {}
});