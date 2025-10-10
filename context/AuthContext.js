import React, { createContext, useState, useContext, useEffect } from "react";
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

    const login = async (username, password) => {
        try {
            if (!hostname || hostname === "Loading...") {
                console.log("Waiting for hostname to resolve...");
                return false;
            }
            const data = await apiFetch(`${hostname}/login`, "POST", { username, password });
            try {
                await AsyncStorage.setItem("auth_token", data.token);
            } catch {}
            Logger.debug(JSON.stringify(data, null, 2), 'AuthContext', 'login', 0);
            setToken(data.token);
            const decoded = await apiFetch(`${hostname}/tokenInfo?token=${data.token}`, "GET");
            if (decoded) {
                Logger.error(`Token: ${JSON.stringify(decoded, null, 2)}`, 'AuthContext', 'login');
                Logger.error(`Issued: ${new Date(decoded.iat * 1000).toLocaleString()}`, 'AuthContext', 'login');
                Logger.error(`Expires: ${new Date(decoded.exp * 1000).toLocaleString()}`, 'AuthContext', 'login');
                setTokenInfo(decoded);
            } else {
                throw new Error("Invalid token format");
            }

            return true;
        } catch (error) {
            console.log(`Login failed: ${error.message}`);
            Alert.alert("Login Failed", error.message);
            return false;
        }
    };

    const logout = async () => {
        let token = null;
        try {
             token = await AsyncStorage.getItem("auth_token");
            if (token) {
                // Sending the token in the body to logout. If the token is expired, the server can still process the logout.
                const data = await apiFetch(`${hostname}/logout`, "POST", { token });
            }
            Logger.debug('Clearing Token.', 'AuthContext', 'logout', 0);
            await AsyncStorage.removeItem("auth_token");
        } catch (error) {
            Logger.error(`Clearing Token. Error: ${error.message}`, 'AuthContext', 'logout');
        }
        setToken(null);
        setTokenInfo(null);
        Alert.alert("Logged out", "You have been logged out successfully.");
    };

    const checkUserSession = async () => {
        try {
            const storedToken = await AsyncStorage.getItem("auth_token");
            if (!storedToken) throw new Error("No valid session");

            if (!hostname || hostname === "Loading...") {
                console.log("Waiting for hostname to resolve...");
                return false;
            }

            const data = await apiFetch(`${hostname}/user`, "GET", null, storedToken);
            Logger.debug('Fetching user data.', 'AuthContext', 'checkUserSession', 0);
            if (data && data.token) {
                setToken(data.token);
                const decoded = await apiFetch(`${hostname}/tokenInfo?token=${data.token}`, "GET");
                if (decoded) {
                    setTokenInfo(decoded);
                }
            } else {
                throw new Error("Invalid token format");
            }
        } catch (error) {
            Logger.error(`Clearing Token. Error: ${error.message}`, 'AuthContext', 'checkUserSession');
            try {
                await AsyncStorage.removeItem("auth_token");
            } catch (error) {
                Logger.error(`Clearing Token. Error: ${error.message}`, 'AuthContext', 'checkUserSession');
            }
            setToken(null);
            setTokenInfo(null);
        }
    };

    // Function to update both token and token info
    const updateAuth = async (oldToken, newToken) => {
        if (newToken === oldToken) {
            Logger.warn('No change in token detected.', 'AuthContext', 'updateAuth');
            return;  // No change
        }
        if (newToken) {
            Logger.debug('Updating info with new Token ...', 'AuthContext', 'updateAuth', 2);
            //setToken(newToken);
        } else {
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
                null,
                null,
                null,
                null,
                30000,
                null  // Pass null to prevent infinite recursion
            );
            Logger.debug(`Calling ${hostname}/tokenInfo?token=${oldToken} ... done`, 'AuthContext', 'updateAuth', 2);
            if (decoded) {
                setTokenInfo(decoded);
            }
            Logger.debug(`Updating token info with new token ... done`, 'AuthContext', 'updateAuth', 2);
        } catch (error) {
            console.error(`[AuthContext:updateAuth]: ${new Date().toString()} Error updating token info:`, error);
            Logger.error(`Error updating token info: ${error.message}`, 'AuthContext', 'updateAuth');
        }
    };
    
    return (
        <AuthContext.Provider value={{ token, tokenInfo, updateAuth, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);