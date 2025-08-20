import axios from "axios";
import jwtStorage from "../utils/jwtStorage";

const BACKEND_URL = "https://my-backend-120228107025.europe-north1.run.app";

export const api = axios.create({
  baseURL: BACKEND_URL,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await jwtStorage.get();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn("Failed to load JWT:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);