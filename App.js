import React, { useContext } from "react";
import { Alert, Text, View, SafeAreaView, Platform } from "react-native";
import ThermostatSelector from "./components/ThermostatSelector";
import { HostnameContext, HostnameProvider } from "./context/HostnameContext";
import { useAuth, AuthProvider } from "./context/AuthContext";
import { ThermostatProvider } from "./context/ThermostatContext";
import LoginScreen from "./components/LoginScreen";
import { UserProvider } from './context/UserContext';
import { DataRefreshProvider } from "./context/DataRefreshContext";
import { WeatherProvider } from "./context/WeatherContext";

const showAlert = () => {
  if (Platform.OS === "web") {
    alert("Notice: This is a simple alert!"); // Standard browser alert
  } else {
    Alert.alert("Notice", "This is a simple alert!"); // Native alert
  }
};

const AppContent = () => {
    const { token } = useAuth();
    const hostname = useContext(HostnameContext);

    // Render login if not authenticated, otherwise render your app
    return token ? (
        <SafeAreaView style={{ flex: 1 }}>
              {Platform.OS === "web" ? (
                  <>
                      <ThermostatSelector />
                  </>
              ) : (
                  <View>
                      <ThermostatSelector />
                  </View>
              )}
        </SafeAreaView>
    ) : (
        hostname === "Loading..." ? <Text>Loading ...</Text> : <LoginScreen />
    );
};

const App = () => {
  const hostname = useContext(HostnameContext);

  return (
    <HostnameProvider>
      <AuthProvider>
        <UserProvider>
          <WeatherProvider>
            <ThermostatProvider>
              <DataRefreshProvider>
                <AppContent />
              </DataRefreshProvider>
            </ThermostatProvider>
            </WeatherProvider>
        </UserProvider>
      </AuthProvider>
    </HostnameProvider>
  );
};

export default App;