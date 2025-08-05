import axios from 'axios';
import jwtStorage from '../utils/jwtStorage';

export const api = axios.create({
  baseURL: 'https://your-server.com/api',
});

api.interceptors.request.use(async (config) => {
  const token = await jwtStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});