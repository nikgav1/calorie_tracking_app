import axios from 'axios';
import { BACKEND_URL } from '@env'
import jwtStorage from '../utils/jwtStorage';

export const api = axios.create({
  baseURL: BACKEND_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await jwtStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});