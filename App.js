import React, { useContext } from "react";
import { Button } from "react-native";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ThermostatSelector from "./components/ThermostatSelector";
import SettingsScreen from "./components/SettingsScreen"; // Import the new screen
import { HostnameContext, HostnameProvider } from "./context/HostnameContext";
import { useAuth, AuthProvider } from "./context/AuthContext";
import { ThermostatProvider } from "./context/ThermostatContext";
import LoginScreen from "./components/LoginScreen";
import { UserProvider } from './context/UserContext';
import { DataRefreshProvider } from "./context/DataRefreshContext";
import { WeatherProvider } from "./context/WeatherContext";

const Stack = createNativeStackNavigator();

const AppContent = () => {
    const { token } = useAuth();
    const hostname = useContext(HostnameContext);

    return token ? (
        <Stack.Navigator>
            <Stack.Screen
                name="Thermostats"
                component={ThermostatSelector}
                options={({ navigation }) => ({
                    headerRight: () => (
                        <Button
                            onPress={() => navigation.navigate('Settings')}
                            title="Settings"
                            color="#0ff"
                        />
                    ),
                })}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
    ) : (
        hostname === "Loading..." ? <Text>Loading...</Text> : <LoginScreen />
    );
};

const App = () => {
  return (
    <NavigationContainer>
      <HostnameProvider>
        <AuthProvider>
          <UserProvider>
            <DataRefreshProvider>
              <WeatherProvider>
                <ThermostatProvider>
                  <AppContent />
                </ThermostatProvider>
              </WeatherProvider>
            </DataRefreshProvider>
          </UserProvider>
        </AuthProvider>
      </HostnameProvider>
    </NavigationContainer>
  );
};

export default App;
