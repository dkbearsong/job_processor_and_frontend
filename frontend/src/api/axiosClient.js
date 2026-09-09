import axios from 'axios';

const axiosClient = axios.create({
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
});

let sessionTokenPromise = null;

export const initSessionToken = async () => {
  if (!sessionTokenPromise) {
    sessionTokenPromise = (async () => {
      try {
        const response = await axios.get('/api/auth/token');
        const token = response.data.token;
        axiosClient.defaults.headers.common['X-Session-Token'] = token;
        return token;
      } catch (err) {
        console.error('Failed to fetch authentication session token:', err);
        sessionTokenPromise = null;
        throw err;
      }
    })();
  }
  return sessionTokenPromise;
};

axiosClient.interceptors.request.use(async (config) => {
  if (config.url !== '/api/auth/token' && !config.headers['X-Session-Token']) {
    try {
      const token = await initSessionToken();
      if (token) {
        config.headers['X-Session-Token'] = token;
      }
    } catch {
      // Continue, backend will respond with 401 if unauthenticated
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default axiosClient;
