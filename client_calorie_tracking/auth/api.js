import axios from 'axios';
import jwtStorage from '../utils/jwtStorage';

const BACKEND_URL = "https://my-backend-120228107025.europe-north1.run.app"

export const api = axios.create({
  baseURL: BACKEND_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await jwtStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});