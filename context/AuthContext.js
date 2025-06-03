import React, { createContext, useState, useContext, useEffect } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HostnameContext } from "./HostnameContext";
import apiFetch from "../utils/apiFetch";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
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
            const data = await apiFetch(hostname, "/login", "POST", { username, password });
            await AsyncStorage.setItem("auth_token", data.token);
            setToken(data.token);
            return true;
        } catch (error) {
            console.log(`Login failed: ${error.message}`);
            Alert.alert("Login Failed", error.message);
            return false;
        }
    };

    const logout = async () => {
        await AsyncStorage.removeItem("auth_token");
        setToken(null);
    };

    const checkUserSession = async () => {
        try {
            const storedToken = await AsyncStorage.getItem("auth_token");
            if (!storedToken) throw new Error("No valid session");

            if (!hostname || hostname === "Loading...") {
                console.log("Waiting for hostname to resolve...");
                return false;
            }

            const data = await apiFetch(hostname, "/user", "GET", null, storedToken);
            setToken(storedToken);
        } catch (error) {
            setToken(null);
        }
    };

    return (
        <AuthContext.Provider value={{ token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);