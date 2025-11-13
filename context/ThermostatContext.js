import React, { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext"; // Import the hook
import { useWeather } from "../context/WeatherContext"; // Import the hook
import { HVAC_MODE_OFF, HVAC_MODE_HEAT, HVAC_MODE_COOL, HVAC_MODE_AUTO } from '../constants/hvac_mode'; // Import HVAC modes

const Logger = require('../components/Logger');
const ThermostatContext = createContext();
const CACHE_EXPIRATION = 120; // 120 seconds
const WEATHER_LATITUDE = Number(process.env.WEATHER_LATITUDE) || 29.8238;
const WEATHER_LONGITUDE = Number(process.env.WEATHER_LONGITUDE) || -90.4751;


export const ThermostatProvider = ({ children }) => {
  const { token, authenticatedApiFetch } = useAuth(); // <-- Now available everywhere in this provider
  const { weatherData, setWeatherData, fetchWeather } = useWeather(); // <-- Now available everywhere in this provider
  const [thermostats, setThermostats] = useState({}); // Store multiple thermostats
  const [scannerStatus, setScannerStatus] = useState({}); // Store scanner statuses

  const formatTime = useCallback(({ day, hour, minute }) => {
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const AMPM = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${daysOfWeek[day]}, ${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")} ${AMPM}`;
  }, []);

  const formatCurrentTime = useCallback(() => {
    const now = new Date(Date.now());
    // Adjust day to match your format (0 = Monday, 6 = Sunday)
    const jsDay = now.getDay(); // JS: 0=Sunday, 1=Monday, ..., 6=Saturday
    const day = (jsDay === 0) ? 6 : jsDay - 1; // Convert JS day to your format
    let hour = now.getHours();
    const minute = now.getMinutes();
    return formatTime({ day, hour, minute });
  }, [formatTime]);

  function decodeJwt(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const payload = JSON.parse(atob(parts[1]));
        return payload;
    } catch (e) {
        return null;
    }
  }

  const isTokenExpired = (token) => {
    const payload = decodeJwt(token);
    if (!payload || !payload.exp) return true; // Token is invalid or doesn't have an expiration
    const now = Math.floor(Date.now() / 1000); // current time in seconds
    return now >= payload.exp;
  }

  function isNewerWeekdayTime(current, updated) {
    const weekdays = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday'
    ];

    const parseWeekdayTime = (str) => {
        const [weekday, timePart] = str.split(',').map(s => s.trim());
        if (!weekday || !timePart || !weekdays.includes(weekday)) return NaN;

        const today = new Date();
        const todayIndex = today.getDay();
        const targetIndex = weekdays.indexOf(weekday);
        const offsetDays = (targetIndex - todayIndex + 7) % 7;

        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + offsetDays);

        const fullDateStr = `${targetDate.toDateString()} ${timePart}`;
        const parsed = new Date(fullDateStr);
        return parsed.getTime();
    };

    const updatedTime = parseWeekdayTime(updated);
    const currentTime = parseWeekdayTime(current);

    if (isNaN(updatedTime)) return false;
    if (isNaN(currentTime)) return true;

    return updatedTime > currentTime;
  }

  // Update thermostat state
  const updateThermostatState = useCallback((thermostatIp, updates) => {
    setThermostats((prevState) => {
        const currentState = prevState[thermostatIp] || {};
        const hasChanges = Object.keys(updates).some(
            (key) => currentState[key] !== updates[key]
        );

        if (!hasChanges) {
            return prevState; // No changes, return the current state
        }

        const differences = Object.keys(updates).reduce((diff, key) => {
            const current = currentState[key];
            const updated = updates[key];
            const isFormattedTime = key === 'formattedTime';
            const isDifferent = current !== updated;
            const isGreater = isFormattedTime
                ? isNewerWeekdayTime(current, updated)
                : true;

            if (isDifferent && isGreater) {
                diff[key] = { current, updated };
            }

            return diff;
        }, {});
        Logger.debug(`Differences: ${JSON.stringify(differences, null, 2)}`, 'ThermostatContext', 'updateThermostatState');
        Logger.debug(`Updating thermostat state for IP: ${thermostatIp} with updates: ${JSON.stringify(updates, null, 2)}`, 'ThermostatContext', 'updateThermostatState');

        return {
            ...prevState,
            [thermostatIp]: {
                ...currentState,
                ...updates,
            },
        };
    });
  }, []);

  const updateThermostatName = async (thermostatIp, name, hostname) => {
    try {
      const data = await authenticatedApiFetch(
        `${hostname}/thermostat/name/${thermostatIp}`,
        "POST",
        { name },
        "Failed to update thermostat name",
        "Updating thermostat name..."
      );
      if (data) {
        Logger.info(`Thermostat name updated successfully: ${JSON.stringify(data, null, 2)}`, 'ThermostatContext', 'updateThermostatName');
        updateThermostatState(thermostatIp, {
            thermostatName: name,
            thermostatInfo: {
                ...thermostats[thermostatIp].thermostatInfo,
                name,
            },
        });
      }
    } catch (error) {
      console.error("Error updating thermostat name:", error);
      Logger.error(`Error updating thermostat name: ${error.message}`, 'ThermostatContext', 'updateThermostatName');
      throw new Error("Failed to update thermostat name.");
    }
  };

  const rebootThermostatServer = async (thermostatIp, hostname) => {
    try {
      Logger.info("Rebooting thermostat...", 'ThermostatContext', 'rebootThermostatServer');
      const data = await authenticatedApiFetch(
        `${hostname}/thermostat/reboot/${thermostatIp}`,
        "POST",
        null,
        "Failed to reboot thermostat",
        "Rebooting thermostat..."
      );
      if (data) {
        Logger.info(`Thermostat rebooted successfully: ${JSON.stringify(data, null, 2)}`, 'ThermostatContext', 'rebootThermostatServer');
        updateThermostatState(thermostatIp, {
            thermostatInfo: {
                ...thermostats[thermostatIp].thermostatInfo,
                status: "rebooting",
            },
        });
      }
    } catch (error) {
      console.error("Error rebooting thermostat:", error);
      Logger.error(`Error rebooting thermostat: ${error.message}`, 'ThermostatContext', 'rebootThermostatServer');
      throw new Error("Failed to reboot thermostat.");
    }
  };

  const updateThermostatTargetTemperature = async (thermostatIp, hostname, tempMode, targetTemp) => {
    try {
      const data = await authenticatedApiFetch(
        `${hostname}/tstat/${thermostatIp}`,
        "POST",
        { tmode: tempMode, temperature: targetTemp },
        "Failed to update target temperature",
        "Updating target temperature..."
      );
      if (data) {
        Logger.info(`Target temperature updated successfully: ${JSON.stringify(data, null, 2)}`, 'ThermostatContext', 'updateThermostatTargetTemperature');
        updateThermostatState(thermostatIp, { targetTemp });
      }
    } catch (error) {
      console.error("Error updating target temperature:", error);
      Logger.error(`Error updating target temperature: ${error.message}`, 'ThermostatContext', 'updateThermostatTargetTemperature');
      throw new Error("Failed to update target temperature.");
    }
  };

  const fetchThermostatData = useCallback(async (thermostatIp, hostname, timeout) => {
    if (!hostname || !thermostatIp || thermostatIp === "Loading ...") {
        Logger.warn("Hostname or thermostat IP not available yet!", 'ThermostatContext', 'fetchThermostatData');
        return null;
    }

    try {
        const data = await authenticatedApiFetch(
            `${hostname}/tstat/${thermostatIp}`,
            "GET",
            null,
            "Failed to fetch thermostat data",
            "Fetching thermostat data...",
            timeout || 30000
        );
        if (data) {
            Logger.debug(`ThermostatContext: Fetched thermostat data: ${JSON.stringify(data, null, 2)}`, 'ThermostatContext', 'fetchThermostatData');
            let modelInfo = null;
            let weatherData2 = null;
            //let humidityData = null;
            try {
                // Fetch additional data (model info and name)
                modelInfo = await fetchModelInfo(thermostatIp, hostname);
            } catch (error) {
                console.error("Error fetching model info:", error);
                Logger.error(`Error fetching model info: ${error.message}`, 'ThermostatContext', 'fetchThermostatData');
                // modelInfo stays null
            }
            try {
                weatherData2 = await fetchWeather(WEATHER_LATITUDE, WEATHER_LONGITUDE);
            } catch (error) {
                console.error("Error fetching weather data:", error);
                Logger.error(`Error fetching weather data: ${error.message}`, 'ThermostatContext', 'fetchThermostatData');
            }
            // try {
            //     humidityData = await fetchHumidityData();
            // } catch (error) {
            //     console.error("Error fetching humidity data:", error);
            //     Logger.error(`Error fetching humidity data: ${error.message}`, 'ThermostatContext', 'fetchThermostatData');
            // }

            // Update the context with the fetched data
            // Build the update object
            const updateObj = {
                currentTemp: data.temp,
                humidity: data.humidity,
                targetTemp: data.tmode === HVAC_MODE_COOL ? data.t_cool : data.t_heat || null,
                currentTempMode: data.tmode,
                currentFanMode: data.fmode,
                currentTempState: data.tstate,
                currentFanState: data.fstate,
                currentTime: data.time,
                formattedTime: data.time ? formatTime(data.time) : "Loading...",
                override: data.override,
                hold: data.hold,
                lastUpdated: Date.now(),
            };

            // Only add modelInfo if it exists
            if (modelInfo) {
                updateObj.thermostatInfo = {
                    ip: thermostatIp,
                    model: modelInfo.model,
                    name: modelInfo.name,
                };
                updateObj.thermostatName = modelInfo.name;
            }
            if (weatherData2) {
                const intervals = weatherData2.timelines?.minutely || [];

                if (intervals.length > 0) {
                    const entry = intervals[0]; // Only process the first item as that is the current value
                                                // other values are future predictions
                    if (entry) {
                        updateObj.outdoor_temp = entry.values?.temperature ?? 'N/A';
                        updateObj.cloud_cover = entry.values?.cloudCover ?? 'N/A';
                        updateObj.rainAccumulation = entry.values?.rainAccumulation ?? 'N/A';
                        updateObj.rainIntensity = entry.values?.rainIntensity ?? 'N/A';
                        updateObj.outdoor_humidity = entry.values?.humidity ?? 'N/A';
                    }
                }
            }
            updateThermostatState(thermostatIp, updateObj);

            return data;
        }
    } catch (error) {
        console.error("Error fetching thermostat data:", error);
        Logger.error(`Error fetching thermostat data: ${error.message}`, 'ThermostatContext', 'fetchThermostatData');
        throw new Error("Failed to fetch thermostat data.");
    }
  }, [authenticatedApiFetch, fetchWeather, formatTime, updateThermostatState]);

  const getCurrentTemperature = useCallback(async (thermostatIp, hostname, useCache = true) => {
    try {
        const currentThermostat = thermostats[thermostatIp];

        // Use cached data if it's still fresh
        if (
            useCache &&
            currentThermostat?.lastUpdated &&
            Date.now() - currentThermostat.lastUpdated < 1000 * CACHE_EXPIRATION
        ) {
            Logger.info("Using cached thermostat data.", 'ThermostatContext', 'getCurrentTemperature');
            return currentThermostat;
        } else if (!useCache) {
            Logger.info("Cached data is stale or not used, fetching new data.", 'ThermostatContext', 'getCurrentTemperature');
        }

        // Fetch new data
        const data = await fetchThermostatData(thermostatIp, hostname, 60000);

        return data;
    } catch (error) {
        console.error("Error getting current temperature:", error);
        Logger.error(`Error getting current temperature: ${error.message}`, 'ThermostatContext', 'getCurrentTemperature');
        throw new Error("Failed to get current temperature.");
    }
  }, [thermostats, fetchThermostatData]);

  const fetchModelInfo = async (thermostatIp, hostname) => {
    try {
        const data = await authenticatedApiFetch(
            `${hostname}/thermostat/${thermostatIp}`,
            "GET",
            null,
            "Failed to fetch model info",
            "Fetching model info...",
            60000
        );
        if (data) {
            Logger.debug(`Fetched model info: ${JSON.stringify(data, null, 2)}`, 'ThermostatContext', 'fetchModelInfo');

            // Update the context with the fetched model info
            updateThermostatState(thermostatIp, {
                formattedTime: formatCurrentTime(),
                thermostatName: data.name,
                thermostatInfo: {
                    ...thermostats[thermostatIp]?.thermostatInfo,
                    model: data.model,
                    name: data.name,
                },
            });

            return data;
        }
    } catch (error) {
        console.error("Error fetching model info:", error);
        Logger.error(`Error fetching model info: ${error.message}`, 'ThermostatContext', 'fetchModelInfo');
        throw new Error("Failed to fetch model info.");
    }
  };

  const fetchModelInfoDetailed = async (thermostatIp, hostname) => {
    try {
        const data = await authenticatedApiFetch(
            `${hostname}/thermostat/detailed/${thermostatIp}`,
            "GET",
            null,
            "Failed to fetch detailed model info",
            "Fetching detailed model info..."
        );
        if (data) {
            Logger.debug(`Fetched detailed model info: ${JSON.stringify(data, null, 2)}`, 'ThermostatContext', 'fetchModelInfoDetailed');

            // Update the context with the fetched model info
            updateThermostatState(thermostatIp, {
                formattedTime: formatCurrentTime(),
                thermostatName: data.name,
                thermostatInfo: {
                    ...thermostats[thermostatIp]?.thermostatInfo,
                    model: data.model,
                    name: data.name,
                },
            });

            return data;
        }
    } catch (error) {
        console.error("Error fetching detailed model info:", error);
        Logger.error(`Error fetching detailed model info: ${error.message}`, 'ThermostatContext', 'fetchModelInfoDetailed');
        throw new Error("Failed to fetch detailed model info.");
    }
  };
  
    const fetchModelInfoList = async (ipList, hostname) => {
        try {
            if (!ipList?.length) {
                console.warn("No IP addresses provided.");
                return [];
            }

            const devices = await Promise.all(
                ipList.map(async (ip) => {
                    try {
                        const data = await authenticatedApiFetch(
                            `${hostname}/thermostat/${ip}`,
                            "GET",
                            null,
                            "Error fetching thermostat model information",
                            "Fetching thermostat model information..."
                        );

                        if (data?.model) {
                            updateThermostatState(ip, {
                                formattedTime: formatCurrentTime(),
                                thermostatInfo: {
                                    ip,
                                    model: data.model,
                                    name: data.name,
                                },
                            });
                            return { ip, model: data.model, name: data.name };
                        }
                        return null;
                    } catch (error) {
                        console.error(`Error fetching data for IP ${ip}:`, error);
                        return null;
                    }
                })
            );

            return devices.filter(Boolean);
        } catch (error) {
            console.error("Error fetching model info:", error);
            throw error;
        }
    };
    
    const fetchThermostatName = async (thermostatIp, hostname) => {
    try {
        const data = await authenticatedApiFetch(
            `${hostname}/name/${thermostatIp}`,
            "GET",
            null,
            "Failed to fetch thermostat name",
            "Fetching thermostat name..."
        );
        if (data) {
            console.log("Fetched thermostat name:", data);

            // Update the context with the fetched name
            updateThermostatState(thermostatIp, {
                formattedTime: formatCurrentTime(),
                thermostatName: data.name,
                thermostatInfo: {
                    ...thermostats[thermostatIp]?.thermostatInfo,
                    name: data.name,
                },
            });

            return data;
        }
    } catch (error) {
        console.error("Error fetching thermostat name:", error);
        throw new Error("Failed to fetch thermostat name.");
    }
  };

  const addThermostatInState = (thermostatIp, initialState) => {
    setThermostats((prevState) => ({
      ...prevState,
      [thermostatIp]: initialState,
    }));
  };

  const removeThermostatFromState = (thermostatIp) => {
    setThermostats((prevState) => {
      const newState = { ...prevState };
      delete newState[thermostatIp];
      return newState;
    });
  };

  const updateThermostatTime = async (thermostatIp, hostname) => {
    try {
        const now = new Date();
        now.setSeconds(now.getSeconds() + 10); // Add 10 seconds
        const adjustedDay = (now.getDay() + 6) % 7; // Converts Sunday (0) to 6, Monday (1) to 0, etc.
        const bodyData = {
            time: {
                day: adjustedDay, // Day of the week (0 = Sunday, 1 = Monday, etc.)
                hour: now.getHours(), // Current hour
                minute: now.getMinutes(), // Current minute
            },
        };

        console.log(JSON.stringify(bodyData, null, 2)); // Check the output
        const data = await authenticatedApiFetch(
            `${hostname}/tstat/${thermostatIp}`,
            "POST",
            bodyData,
            "Failed to update thermostat time",
            "Updating thermostat time..."
        );

        if (data) {
            console.log("Thermostat time updated successfully:", data);

            // Update the state with the new time
            updateThermostatState(thermostatIp, {
                formattedTime: formatCurrentTime(),
                currentTime: data.time
            });
        }
    } catch (error) {
        console.error("Error updating thermostat time:", error);
        throw new Error("Failed to update thermostat time.");
    }
  };

  const updateThermostatMode = async (thermostatIp, newMode, hostname) => {
    try {
        const currentThermostat = thermostats[thermostatIp];
        if (currentThermostat?.currentTempMode === newMode) {
            console.log("Thermostat mode is already set to the selected mode.");
            return; // Prevent unnecessary API call if the mode is already set
        }

        // Optimistically update the state
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            currentTempMode: newMode
         });

        // Make the API call to update the mode
        const data = await authenticatedApiFetch(
            `${hostname}/tstat/${thermostatIp}`,
            "POST",
            { tmode: newMode },
            "Error updating thermostat mode",
            "Updating thermostat mode..."
        );

        if (!data || (data && data.success !== 0)) {
            // Revert the state on error
            updateThermostatState(thermostatIp, {
                formattedTime: formatCurrentTime(),
                currentTempMode: currentThermostat?.currentTempMode,
            });
        }
    } catch (error) {
        console.error("Error updating thermostat mode:", error);

        // Revert the state on error
        const currentThermostat = thermostats[thermostatIp];
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            currentTempMode: currentThermostat?.currentTempMode,
        });
    }
  };

  const updateFanMode = async (thermostatIp, newMode, hostname) => {
    try {
        const currentThermostat = thermostats[thermostatIp];
        if (currentThermostat?.currentFanMode === newMode) {
            console.log("Fan mode is already set to the selected mode.");
            return; // Prevent unnecessary API call if the mode is already set
        }

        // Optimistically update the state
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            currentFanMode: newMode
        });

        // Make the API call to update the fan mode
        const data = await authenticatedApiFetch(
            `${hostname}/tstat/${thermostatIp}`,
            "POST",
            { fmode: newMode },
            "Error updating fan mode",
            "Updating fan mode..."
        );

        if (!data || (data && data.success !== 0)) {
            // Revert the state on error
            updateThermostatState(thermostatIp, {
                formattedTime: formatCurrentTime(),
                currentFanMode: currentThermostat?.currentFanMode,
            });
        }
    } catch (error) {
        console.error("Error updating fan mode:", error);

        // Revert the state on error
        const currentThermostat = thermostats[thermostatIp];
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            currentFanMode: currentThermostat?.currentFanMode,
        });
    }
  };

  const updateHoldMode = async (thermostatIp, newMode, hostname) => {
    try {
        const currentThermostat = thermostats[thermostatIp];
        if (currentThermostat?.hold === newMode) {
            console.log("Hold mode is already set to the selected mode.");
            return; // Prevent unnecessary API call if the mode is already set
        }

        // Optimistically update the state
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            hold: newMode
        });

        // Make the API call to update the hold mode
        const data = await authenticatedApiFetch(
            `${hostname}/tstat/${thermostatIp}`,
            "POST",
            { hold: newMode },
            "Error updating hold mode",
            "Updating hold mode..."
        );

        // Update the state with the response
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            hold: newMode
        });
    } catch (error) {
        console.error("Error updating hold mode:", error);

        // Revert the state on error
        const currentThermostat = thermostats[thermostatIp];
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            hold: currentThermostat?.hold
        });
    }
  };

  const updateOverrideMode = async (thermostatIp, newMode, hostname) => {
    try {
        const currentThermostat = thermostats[thermostatIp];
        if (currentThermostat?.override === newMode) {
            console.log("Override mode is already set to the selected mode.");
            return; // Prevent unnecessary API call if the mode is already set
        }

        // Optimistically update the state
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            override: newMode
        });

        // Make the API call to update the override mode
        const data = await authenticatedApiFetch(
            `${hostname}/tstat/${thermostatIp}`,
            "POST",
            { override: newMode },
            "Error updating override mode",
            "Updating override mode..."
        );

        // Update the state with the response
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            override: newMode
        });
    } catch (error) {
        console.error("Error updating override mode:", error);

        // Revert the state on error
        const currentThermostat = thermostats[thermostatIp];
        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            override: currentThermostat?.override
        });
    }
  };

    const fetchSwingValue = async (thermostatIp, hostname) => {
        try {
            const data = await authenticatedApiFetch(
                `${hostname}/tswing/${thermostatIp}`,
                "GET",
                null,
                "Error fetching thermostat swing",
                "Fetching thermostat swing..."
            );

            const swingValue = data?.tswing !== undefined ? -data.tswing : 1.0; // Default to 1.0 if undefined
            updateThermostatState(thermostatIp, {
                formattedTime: formatCurrentTime(),
                swingValue: swingValue ?? "Loading...",                
            });
            return swingValue;
        } catch (error) {
            console.error("Error fetching thermostat swing value:", error);
            throw error;
        }
    };
    
  const updateSwingSetting = async (thermostatIp, value, hostname) => {
    try {
        const valueAPI = -value; // Invert the value for the API
        console.log("Set Swing value:", valueAPI.toFixed(2));

        const data = await authenticatedApiFetch(
            `${hostname}/tswing/${thermostatIp}`,
            "POST",
            { tswing: valueAPI.toFixed(2) },
            "Error updating thermostat swing",
            "Updating thermostat swing..."
        );

        updateThermostatState(thermostatIp, {
            formattedTime: formatCurrentTime(),
            swingValue: value
        });
        console.log("Swing updated:", data);
    } catch (error) {
        console.error("Error updating swing:", error);
        throw error;
    }
  };

  const fetchCachedData = async (thermostatIp, hostname) => {
    try {
        const cachedData = await authenticatedApiFetch(
            `${hostname}/cache/${thermostatIp}`,
            "GET",
            null,
            "Error fetching cached data",
            "Fetching cached thermostat data..."
        );

        if (cachedData && Array.isArray(cachedData)) {
            updateThermostatState(thermostatIp, { cachedData });
            return cachedData;
        } else {
            console.warn("No cached data available.");
            return [];
        }
    } catch (error) {
        console.error("Error fetching cached thermostat data:", error);
        throw error;
    }
  };

  // Start scanner
  const startScanner = async (thermostatIp, hostname, interval = 60000) => {
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/scanner/start/${thermostatIp}`,
            "POST",
            { interval },
            "Failed to start scanner",
            "Starting scanner..."
        );
        console.log(`Scanner started for ${thermostatIp}:`, response);
    } catch (error) {
        console.error(`Error starting scanner for ${thermostatIp}:`, error);
    }
  };

  // Stop scanner
  const stopScanner = async (thermostatIp, hostname) => {
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/scanner/stop/${thermostatIp}`,
            "POST",
            null,
            "Failed to stop scanner",
            "Stopping scanner..."
        );
        console.log(`Scanner stopped for ${thermostatIp}:`, response);
    } catch (error) {
        console.error(`Error stopping scanner for ${thermostatIp}:`, error);
    }
  };

  // Restart scanner
  const restartScanner = async (thermostatIp, hostname, interval = 60000) => {
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/scanner/restart/${thermostatIp}`,
            "POST",
            { interval },
            "Failed to restart scanner",
            "Restarting scanner..."
        );
        console.log(`Scanner restarted for ${thermostatIp}:`, response);
    } catch (error) {
        console.error(`Error restarting scanner for ${thermostatIp}:`, error);
    }
  };

  // Get scanner status
  const getScannerStatus = async (thermostatIp, hostname) => {
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/scanner/status?ip=${thermostatIp}`,
            "GET",
            null,
            "Failed to get scanner status",
            "Getting scanner status..."
        );
        setScannerStatus(response.activeScanners || {});
        console.log("Scanner status:", response);
        return response;
    } catch (error) {
        console.error("Error fetching scanner status:", error);
    }
  };

  // Fetch scanned data
  const fetchScannedData = async (thermostatIp, hostname) => {
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/scanner/data/${thermostatIp}`,
            "GET",
            null,
            "Failed to fetch scanned data",
            "Fetching scanned data..."
        );
        console.log(`Scanned data for ${thermostatIp}:`, response);
        return response.filter(item => item.temp != null);
    } catch (error) {
        const payload = decodeJwt(token);
        if (payload && payload.exp) {
            const now = Math.floor(Date.now() / 1000); // current time in seconds
            const isExpired = now >= payload.exp;
            console.log("Token expires at:", new Date(payload.exp * 1000));
            console.log("Is token expired?", isExpired);
            console.log("Token payload:", payload);
        }
        console.error(`Error fetching scanned data for ${thermostatIp}:`, error);
        return [];
    }    
  };

  // Schedule management functions
  // Fetch schedule for a thermostat
  const getSchedule = async (thermostatIp, hostname, mode) => {
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/schedule/${mode}/${thermostatIp}`,
            "GET",
            null,
            "Error fetching thermostat program schedule",
            "Fetching cached thermostat program schedule..."
        );
        return response;
    } catch (error) {
        console.error("Error fetching schedule:", error);
        throw error;
    }
  };

  // Update a new schedule entry
  const updateSchedule = async (thermostatIp, hostname, mode, scheduleEntry) => {
    try {
        const response = await authenticatedApiFetch(`${hostname}/schedule/${mode}/${thermostatIp}`,
            "POST",
            scheduleEntry,
            "Error fetching thermostat program schedule",
            "Fetching cached thermostat program schedule..."
        );
        console.log("Schedule updated successfully:", response);
        return response;
    } catch (error) {
        console.error("Error adding schedule:", error);
        throw error;
    }
  };

  // Cloud management functions
  // Fetch cloud settings for a thermostat
  const getCloudSettings = async (thermostatIp, hostname) => {
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/cloud/${thermostatIp}`,
            "GET",
            null,
            "Error fetching thermostat cloud settings",
            "Fetching thermostat cloud settings..."
        );
        return response;
    } catch (error) {
        console.error("Error fetching cloud settings:", error);
        throw error;
    }
  };

  // Update a new cloud settings
  const updateCloudSettings = async (thermostatIp, hostname, settings) => {
    try {
        const response = await authenticatedApiFetch(`${hostname}/cloud/${thermostatIp}`,
            "POST",
            settings,
            "Error updating thermostat cloud settings",
            "Updating thermostat cloud settings..."
        );
        console.log("Cloud settings updated successfully:", response);
        return response;
    } catch (error) {
        console.error("Error updating cloud settings:", error);
        throw error;
    }
  };

  const getThermostats = async (hostname) => {
    /* fetch from DB or API */ 
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/thermostats`,
            "GET",
            null,
            "Error fetching thermostats",
            "Fetching thermostats..."
        );
        console.log("Fetched thermostats:", response);
        return response;
    } catch (error) {
        console.log("Error fetching thermostats:", error);
        console.error("Error fetching thermostats:", error);
        throw error;
    }
  };
  
  const addThermostat = async (hostname, thermostat) => {
    try {
        const response = await authenticatedApiFetch(`${hostname}/thermostats`,
            "POST",
            thermostat,
            "Error adding thermostat",
            "Adding thermostat..."
        );
        console.log("Thermostat added successfully:", response);
        return response;
    } catch (error) {
        console.error("Error adding thermostat:", error);
        throw error;
    }
  };

  const updateThermostat = async (hostname, thermostat) => {
    try {
        const response = await authenticatedApiFetch(`${hostname}/thermostats/${thermostat.thermostatInfo.ip}`,
            "PUT",
            thermostat,
            "Error updating thermostat",
            "Updating thermostat..."
        );
        console.log("Thermostat updated successfully:", response);
        return response;
    } catch (error) {
        console.error("Error updating thermostat:", error);
        throw error;
    }
  };

  const disableThermostat = async (hostname, thermostat) => {
    try {
        const response = await authenticatedApiFetch(`${hostname}/thermostats/${thermostat.thermostatInfo.ip}`,
            "DELETE",
            thermostat,
            "Error disabling thermostat",
            "Disabling thermostat..."
        );
        console.log("Thermostat disabled successfully:", response);
        return response;
    } catch (error) {
        console.error("Error disabling thermostat:", error);
        throw error;
    }
  };

  const scanForThermostats = async (hostname, subnet) => {
    /* scan, query, add all found */
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/thermostatscan/${subnet}`,
            "GET",
            null,
            "Error fetching thermostat scan results",
            "Fetching thermostat scan results...",
            120000
        );
        return response;
    } catch (error) {
        console.error("Error fetching scan results:", error);
        throw error;
    }
  };

  const getDailyRuntime = async (thermostatIp, hostname, days = -1) => {
    /* Fetch daily runtime data */ 
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/stats/daily-runtime/${thermostatIp}?days=${days}`,
            "GET",
            null,
            `Error fetching daily runtime data: ${thermostatIp}`,
            `Fetching daily runtime data: ${thermostatIp}...`
        );
        console.log(`Fetched daily runtime data: ${thermostatIp}`, response);
        return response;
    } catch (error) {
        console.log(`Error fetching daily runtime data: ${thermostatIp}`, error);
        console.error(`Error fetching daily runtime data: ${thermostatIp}`, error);
        throw error;
    }
  };
  
  const getHourlyRuntime = async (thermostatIp, hostname, hours = -1) => {
    /* Fetch hourly runtime data */ 
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/stats/hourly-runtime/${thermostatIp}?hours=${hours}`,
            "GET",
            null,
            `Error fetching hourly runtime data: ${thermostatIp}`,
            `Fetching hourly runtime data: ${thermostatIp}...`
        );
        console.log(`Fetched hourly runtime data: ${thermostatIp}`, response);
        return response;
    } catch (error) {
        console.log(`Error fetching hourly runtime data: ${thermostatIp}`, error);
        console.error(`Error fetching hourly runtime data: ${thermostatIp}`, error);
        throw error;
    }
  };
  
  const getHourlyEnv = async (thermostatIp, hostname, hours = -1) => {
    /* Fetch hourly environment data */ 
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/stats/hourly-env/${thermostatIp}?hours=${hours}`,
            "GET",
            null,
            `Error fetching hourly env data: ${thermostatIp}`,
            `Fetching hourly env data: ${thermostatIp}...`
        );
        console.log(`Fetched hourly env data: ${thermostatIp}`, response);
        return response;
    } catch (error) {
        console.log(`Error fetching hourly env data: ${thermostatIp}`, error);
        console.error(`Error fetching hourly env data: ${thermostatIp}`, error);
        throw error;
    }
  };

  const getTempVsRuntime = async (thermostatIp, hostname) => {
    /* Fetch temperature vs runtime data */
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/stats/temp-vs-runtime/${thermostatIp}`,
            "GET",
            null,
            `Error fetching temperature vs runtime data: ${thermostatIp}`,
            `Fetching temperature vs runtime data: ${thermostatIp}...`
        );
        console.log(`Fetched temperature vs runtime data: ${thermostatIp}`, response);
        return response;
    } catch (error) {
        console.log(`Error fetching temperature vs runtime data: ${thermostatIp}`, error);
        console.error(`Error fetching temperature vs runtime data: ${thermostatIp}`, error);
        throw error;
    }
  };

  const getDailyModeRuntime = async (thermostatIp, hostname, days = -1) => {
    /* Fetch daily mode runtime data */
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/stats/daily-mode-runtime/${thermostatIp}?days=${days}`,
            "GET",
            null,
            `Error fetching daily mode runtime data: ${thermostatIp}`,
            `Fetching daily mode runtime data: ${thermostatIp}...`
        );
        console.log(`Fetched daily mode runtime data: ${thermostatIp}`, response);
        return response;
    } catch (error) {
        console.log(`Error fetching daily mode runtime data: ${thermostatIp}`, error);
        console.error(`Error fetching daily mode runtime data: ${thermostatIp}`, error);
        throw error;
    }
  };

  const getFanVsHvacDaily = async (thermostatIp, hostname, days = -1) => {
    /* Fetch fan vs hvac daily data */
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/stats/fan-vs-hvac-daily/${thermostatIp}?days=${days}`,
            "GET",
            null,
            `Error fetching fan vs hvac daily data: ${thermostatIp}`,
            `Fetching fan vs hvac daily data: ${thermostatIp}...`
        );
        console.log(`Fetched fan vs hvac daily data: ${thermostatIp}`, response);
        return response;
    } catch (error) {
        console.log(`Error fetching fan vs hvac daily data: ${thermostatIp}`, error);
        console.error(`Error fetching fan vs hvac daily data: ${thermostatIp}`, error);
        throw error;
    }
  };

  const getDailyCycles = async (thermostatIp, hostname, days = -1) => {
    /* Fetch daily cycles data */
    try {
      const response = await authenticatedApiFetch(
        `${hostname}/thermostat/${thermostatIp}/daily-cycles?days=${days}`,
        "GET",
        null,
        `Error fetching daily cycles data: ${thermostatIp}`,
        `Fetching daily cycles data: ${thermostatIp}...`
      );
      console.log(`Fetched daily cycles data: ${thermostatIp}`, response);
      return response;
    } catch (error) {
      console.log(`Error fetching daily cycles data: ${thermostatIp}`, error);
      console.error(`Error fetching daily cycles data: ${thermostatIp}`, error);
      throw error;
    }
  };

  const getHourlyCycles = async (thermostatIp, hostname, hours = -1) => {
    /* Fetch hourly cycles data */
    try {
      const response = await authenticatedApiFetch(
        `${hostname}/thermostat/${thermostatIp}/hourly-cycles?hours=${hours}`,
        "GET",
        null,
        `Error fetching hourly cycles data: ${thermostatIp}`,
        `Fetching hourly cycles data: ${thermostatIp}...`
      );
      console.log(`Fetched hourly cycles data: ${thermostatIp}`, response);
      return response;
    } catch (error)      {
        console.log(`Error fetching hourly cycles data: ${thermostatIp}`, error);
        console.error(`Error fetching hourly cycles data: ${thermostatIp}`, error);
        throw error;
      }
  };

  const getConsumptionReport = async (thermostatIp, hostname) => {
    try {
        const response = await authenticatedApiFetch(
            `${hostname}/energy/consumption-report/${thermostatIp}`,
            "GET",
            null,
            `Error fetching consumption report: ${thermostatIp}`,
            `Fetching consumption report: ${thermostatIp}...`
        );
        console.log(`Fetched consumption report: ${thermostatIp}`, response);
        return response;
    } catch (error) {
        console.log(`Error fetching consumption report: ${thermostatIp}`, error);
        console.error(`Error fetching consumption report: ${thermostatIp}`, error);
        throw error;
    }
  };

  return (
    <ThermostatContext.Provider
        value={{
            thermostats,
            getThermostats,
            addThermostat,
            updateThermostat,
            disableThermostat,
            scanForThermostats,
            addThermostatInState,
            removeThermostatFromState,
            updateThermostatState,
            fetchThermostatData,
            getCurrentTemperature,
            updateThermostatName,
            rebootThermostatServer,
            updateThermostatTargetTemperature,
            fetchModelInfo,
            fetchModelInfoDetailed,
            fetchModelInfoList,
            fetchThermostatName,
            updateThermostatTime, // Expose the function
            updateThermostatMode, // Expose the function
            updateFanMode, // Expose the function
            updateHoldMode, // Expose the function
            updateOverrideMode, // Expose the function
            fetchSwingValue, // Expose fetchSwingValue
            updateSwingSetting, // Expose updateSwingSetting
            fetchCachedData,
            startScanner,
            stopScanner,
            restartScanner,
            getScannerStatus,
            fetchScannedData,
            scannerStatus,
            formatTime,
            formatCurrentTime,
            isTokenExpired,
            getSchedule,
            updateSchedule,
            getCloudSettings,
            updateCloudSettings,
            getDailyRuntime,
            getHourlyRuntime,
            getHourlyEnv,
            getTempVsRuntime,
            getDailyModeRuntime,
            getFanVsHvacDaily,
            getDailyCycles,
            getHourlyCycles,
            getConsumptionReport,
        }}
    >
        {children}
    </ThermostatContext.Provider>
  );
};

export const useThermostat = () => useContext(ThermostatContext);
