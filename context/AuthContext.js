import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HostnameContext } from "./HostnameContext";
import apiFetch from "../utils/apiFetch";

const Logger = require('../components/Logger');
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [tokenInfo, setTokenInfo] = useState(null);
    const hostname = useContext(HostnameContext);

    useEffect(() => {
        checkUserSession();
    }, [hostname]);

    const storeAndSetToken = async (newToken, context = 'AuthContext', caller = 'storeAndSetToken') => {
        if (!newToken) {
            Logger.error('Attempted to store null token', context, caller);
            return false;
        }
        try {
            await AsyncStorage.setItem("auth_token", newToken);
            Logger.debug("Token stored in AsyncStorage", context, caller, 2);
            setToken(newToken);
            Logger.debug("Token set in state", context, caller, 2);
            return true;
        } catch (e) {
            console.error("Failed to store token in AsyncStorage", e);
            Logger.error(`Failed to store token in AsyncStorage: ${e.message}`, context, caller);
            return false;
        }
    };

    const resetToken = async () => {
        Logger.debug('Clearing Token ...', 'AuthContext', 'resetToken', 0);
        try {
            await AsyncStorage.removeItem("auth_token");
        } catch (error) {
            Logger.error(`Clearing Token. Error: ${error.message}`, 'AuthContext', 'resetToken');
        }
        setToken(null);
        setTokenInfo(null);
        Logger.debug('Clearing Token ... Done.', 'AuthContext', 'resetToken', 0);
    }

    const login = useCallback(async (username, password) => {
        let logMessage = null;
        try {
            try {
                Logger.debug('Clearing Token.', 'AuthContext', 'login', 0);
                await AsyncStorage.removeItem("auth_token");
            } catch (error) {
                Logger.error(`Clearing Token. Error: ${error.message}`, 'AuthContext', 'login');
            }
            logMessage = Logger.debug("Resolving Hostname...", 'AuthContext', 'login', 2);
            try {
                if (!hostname || hostname === "Loading...") {
                    logMessage = Logger.debug("Waiting for hostname to resolve...", 'AuthContext', 'login', 2);
                    return { success: false, error: "Hostname not resolved" };
                }
            } catch (e) {
                logMessage = Logger.error(`Error occurred while checking hostname: ${e.message}`, 'AuthContext', 'login');
            }
            logMessage = Logger.debug("Login attempt started...", 'AuthContext', 'login', 2);
            let data = null;
            try {
                data = await apiFetch(`${hostname}/login`, "POST", { username, password });
                logMessage = Logger.debug("Login attempt started... done", 'AuthContext', 'login', 2);
            } catch (error) {
                logMessage = Logger.error(`Login attempt failed: ${error.message}`, 'AuthContext', 'login');
                throw error;
            }
            storeAndSetToken(data.token, 'AuthContext', 'login');
            logMessage = Logger.debug("Token set in state", 'AuthContext', 'login', 2);
            const decoded = await apiFetch(`${hostname}/tokenInfo?token=${data.token}`, "GET");
            if (decoded) {
                logMessage = Logger.error(`Token: ${JSON.stringify(decoded, null, 2)}`, 'AuthContext', 'login');
                logMessage = Logger.error(`Issued: ${new Date(decoded.iat * 1000).toLocaleString()}`, 'AuthContext', 'login');
                logMessage = Logger.error(`Expires: ${new Date(decoded.exp * 1000).toLocaleString()}`, 'AuthContext', 'login');
                setTokenInfo(decoded);
            } else {
                throw new Error("Invalid token format");
            }

            return { success: true, error: null, logMessage: logMessage };
        } catch (error) {
            Logger.error(`Login failed: ${error.message}`, 'AuthContext', 'login', 2);
            Alert.alert("Login Failed", error.message);
            return { success: false, error: error.message, logMessage: logMessage};
        }
    }, [hostname, storeAndSetToken]);

    const logout = useCallback(async () => {
        let tokenLocal = null;
        try {
            tokenLocal = await AsyncStorage.getItem("auth_token");
            if (tokenLocal) {
                // Sending the token in the body to logout. If the token is expired, the server can still process the logout.
                Logger.debug('Logging out user on server ...', 'AuthContext', 'logout', 0);
                const data = await apiFetch(`${hostname}/logout`, "POST", { token: tokenLocal });
                Logger.debug('Logging out user on server ... done', 'AuthContext', 'logout', 0);
            }
        } catch (error) {
            Logger.error(`Clearing Token. Error: ${error.message}`, 'AuthContext', 'logout');
        }
        await resetToken();
        Alert.alert("Logged out", "You have been logged out successfully.");
    }, [hostname, resetToken]);

    const checkUserSession = useCallback(async () => {
        try {
            const storedToken = await AsyncStorage.getItem("auth_token");
            if (!storedToken) throw new Error("No valid session");

            if (!hostname || hostname === "Loading...") {
                Logger.debug("Waiting for hostname to resolve...", 'AuthContext', 'checkUserSession', 0);
                return false;
            }

            const data = await apiFetch(`${hostname}/user`, "GET", null, storedToken);
            Logger.debug('Fetching user data.', 'AuthContext', 'checkUserSession', 0);
            if (data && data.token) {
                storeAndSetToken(data.token, 'AuthContext', 'checkUserSession');
                const decoded = await apiFetch(`${hostname}/tokenInfo?token=${data.token}`, "GET");
                if (decoded) {
                    setTokenInfo(decoded);
                }
            } else {
                throw new Error("Invalid token format");
            }
        } catch (error) {
            Logger.error(`Error checking user session. Error: ${error.message}`, 'AuthContext', 'checkUserSession');
            await resetToken();
            return false;
        }
        return true;
    }, [hostname, storeAndSetToken, resetToken]);

    // Function to update both token and token info
    const updateAuth = useCallback(async (oldToken, newToken) => {
        if (newToken === oldToken) {
            Logger.warn('No change in token detected.', 'AuthContext', 'updateAuth');
            return;  // No change
        }
        if (!newToken) {
            Logger.error('New token missing ...', 'AuthContext', 'updateAuth');
        }
        if (oldToken) {
            Logger.debug('Old token provided ...', 'AuthContext', 'updateAuth', 2);
        } else {
            Logger.error('Old token missing ...', 'AuthContext', 'updateAuth');
        }
        try {
            Logger.debug(`Calling ${hostname}/tokenInfo?token=${oldToken} ...`, 'AuthContext', 'updateAuth', 2);
            const decoded = await apiFetch(
                `${hostname}/tokenInfo?token=${oldToken}&newToken=${newToken}`, 
                "GET",
                null,
                oldToken,
                null,
                null,
                null,
                null,
                30000
            );
            Logger.debug(`Calling ${hostname}/tokenInfo?token=${oldToken} ... done`, 'AuthContext', 'updateAuth', 2);
            if (new Date(decoded.exp * 1000) < Date.now()) {
                Logger.error('New token is already expired!', 'AuthContext', 'updateAuth');
            } else {
                storeAndSetToken(newToken, 'AuthContext', 'updateAuth');
                if (decoded) {
                    setTokenInfo(decoded);
                }
                Logger.debug(`Updating token info with new token ... done`, 'AuthContext', 'updateAuth', 2);
            }
        } catch (error) {
            console.error(`[AuthContext:updateAuth]: ${new Date().toString()} Error updating token info:`, error);
            Logger.error(`Error updating token info: ${error.message}`, 'AuthContext', 'updateAuth');
        }
    }, [hostname, storeAndSetToken]);

    const authenticatedApiFetch = useCallback(async (url, method, body, errorMessage, logMessage, timeout) => {
        while (!token) {
            Logger.debug('Waiting for token to load...', 'AuthContext', 'authenticatedApiFetch', 2);
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
        }
        try {
            const decoded = await apiFetch(
                `${hostname}/tokenInfo?token=${token}`, 
                "GET",
                null,
                null,
                null,
                null,
                null,
                null,
                30000
            );
            Logger.debug(`Calling ${hostname}/tokenInfo?token=${token} ... done`, 'AuthContext', 'authenticatedApiFetch', 2);
            if (decoded) {
                if (decoded.exp * 1000 < Date.now()) { // If token expires in less than 5 minutes
                    Logger.info("Token expired, logging out...", 'AuthContext', 'authenticatedApiFetch');
                    Logger.error(`Token: ${Logger.formatJSON(decoded)}`, 'AuthContext', 'authenticatedApiFetch');
                    Logger.error(`Issued: ${new Date(decoded.iat * 1000).toLocaleString()}`, 'AuthContext', 'authenticatedApiFetch');
                    Logger.error(`Expires: ${new Date(decoded.exp * 1000).toLocaleString()}`, 'AuthContext', 'authenticatedApiFetch');
                    await logout();
                    throw new Error("Authentication token expired");
                }
            }
            return await apiFetch(
                url,
                method,
                body,
                token,
                errorMessage,
                logMessage,
                logout,
                updateAuth,
                timeout
            );
        } catch (error) {
            Logger.error(`Error in authenticatedApiFetch: ${error.message}`, 'AuthContext', 'authenticatedApiFetch');
            throw error;
        }
    }, [token, logout, updateAuth]);

    return (
        <AuthContext.Provider value={{ token, tokenInfo, updateAuth, login, logout, authenticatedApiFetch }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);