import AsyncStorage from '@react-native-async-storage/async-storage';

const Logger = require('../components/Logger');

const apiFetch = async (url, method = "GET", body = null, token = null, errorMessage = null, logMessage = null, logoutFn = null, updateAuthFn = null, timeout = 30000) => {
  let logMessageLocal = null;
  const headers = {
    "Content-Type": "application/json",
  };
  const controller = new AbortController(); // Create a new controller
  const signal = controller.signal; // Get the signal object

  if (logMessage) {
    logMessageLocal = Logger.info(logMessage, 'apiFetch', 'apiFetch');
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const timeoutId = setTimeout(() => controller.abort(), timeout);
  let response = null;
  let startTime = Date.now();
  try {
    // Set a timeout to abort the request
    logMessageLocal = Logger.debug(`Fetching URL: ${url} with method: ${method} ...`, 'apiFetch', 'apiFetch', 2); 
    startTime = Date.now();
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal,
    });
    logMessageLocal = Logger.debug(`Fetching URL: ${url} with method: ${method} ... done in ${Date.now() - startTime} ms`, 'apiFetch', 'apiFetch', 2);
    clearTimeout(timeoutId); // Clear timeout if fetch succeeds

    // Sliding session: check for refreshed token
    const refreshedToken = response.headers.get('x-refreshed-token');
    if (refreshedToken && updateAuthFn) {
      logMessageLocal = Logger.info("Received refreshed token from server, updating storage ...", 'apiFetch', 'apiFetch');
      try {
        await AsyncStorage.setItem("auth_token", refreshedToken);
      } catch (error) {
        logMessageLocal = Logger.error(`Error saving refreshed token: ${error.message}`, 'apiFetch', 'apiFetch');
      }

      // Call the provided function
      logMessageLocal = Logger.info("Updating token in memory and DB ...", 'apiFetch', 'apiFetch');
      await updateAuthFn(token, refreshedToken);
    }
  } catch (error) {
    const endTime = Date.now();
    logMessageLocal = Logger.debug(`Fetching URL: ${url} with method: ${method} ... failed in ${endTime - startTime} ms`, 'apiFetch', 'apiFetch', 2);
    clearTimeout(timeoutId); // Clear timeout if fetch fails
    if (error.name === "AbortError") {
      logMessageLocal = Logger.error("Fetch request timed out!", 'apiFetch', 'apiFetch');
      console.error("Fetch request timed out!");
      if (errorMessage) {
        errorMessage = `TimeOut: ${errorMessage}`
      } else {
        errorMessage = `Timeout Error fetching API: ${url}: ${error.message}`;
      }
      throw new Error(errorMessage);
    } else {
      console.error("Error fetching API:", error);
      if (!errorMessage) {
        errorMessage = `Error fetching API: ${url}: ${error.message}`;
      }
      throw new Error(errorMessage || `Error fetching API: ${url}: ${error.message}`);
    }
  }
  
  if (logMessage) {
    logMessageLocal = Logger.info(`${logMessage} - Response status: ${response.status}`, 'apiFetch', 'apiFetch');
  }

  if (response.status === 401) {
    // Token expired or invalid
    // Optionally show a warning here (e.g., toast)
    if (logoutFn) {
      if (logMessage) {
        logMessageLocal = Logger.info(`LOGGING OUT: ${logMessage} - Response status: ${response.status}`, 'apiFetch', 'apiFetch');
      }
      if (errorMessage) {
        console.error(`LOGGING OUT: ${errorMessage}: ${error.error || "Error fetching API"}`);
        logMessageLocal = Logger.error(`LOGGING OUT: ${errorMessage}: ${error.error || "Error fetching API"}`, 'apiFetch', 'apiFetch');
      }
      logoutFn(); // Clear auth state and redirect to login
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 403 && error.error === "Forbidden: Invalid token") {
      // Token expired or invalid
      // Optionally show a warning here (e.g., toast)
      if (logoutFn) logoutFn(); // Clear auth state and redirect to login
      throw new Error("Session expired. Please log in again.");
    }
    if (errorMessage) {
      console.error(`${errorMessage}: ${error.error || "Error fetching API"}`);
      logMessageLocal = Logger.error(`${errorMessage}: ${error.error || "Error fetching API"}`, 'apiFetch', 'apiFetch');
      throw new Error(`${errorMessage}: ${error.error || "Error fetching API"}`);
    }
    throw new Error(error.error || "Something went wrong");
  }

  return response.json();
};

export default apiFetch;