const apiFetch = async (hostname, endpoint, method = "GET", body = null, token = null, errorMessage = null, logMessage = null, logoutFn = null, timeout = 30000) => {
  const headers = {
    "Content-Type": "application/json",
  };
  const controller = new AbortController(); // Create a new controller
  const signal = controller.signal; // Get the signal object

  if (logMessage) {
    console.log(logMessage);
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const timeoutId = setTimeout(() => controller.abort(), timeout);
  let response = null;
  try {
    // Set a timeout to abort the request
    response = await fetch(`http://${hostname}:5000${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal,
    });
    clearTimeout(timeoutId); // Clear timeout if fetch succeeds
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Fetch request timed out!");
      if (errorMessage) {
        errorMessage = `TimeOut: ${errorMessage}`
      } else {
        errorMessage = "Timeout Error fetching API";
      }
      throw new Error(errorMessage);
    } else {
      console.error("Error fetching API:", error);
      if (!errorMessage) {
        errorMessage = "Error fetching API";
      }
      throw new Error(errorMessage || "Error fetching API");
    }
  }
  
  if (logMessage) {
    console.log(`${logMessage} - Response status: ${response.status}`); 
  }

  if (response.status === 401) {
    // Token expired or invalid
    // Optionally show a warning here (e.g., toast)
    if (logoutFn) {
      if (logMessage) {
        console.log(`LOGGING OUT: ${logMessage} - Response status: ${response.status}`); 
      }
      if (errorMessage) {
        console.error(`LOGGING OUT: ${errorMessage}: ${error.error || "Error fetching API"}`);
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
      throw new Error(`${errorMessage}: ${error.error || "Error fetching API"}`);
    }
    throw new Error(error.error || "Something went wrong");
  }

  return response.json();
};

export default apiFetch;