// TODO: Frontend verification of this component could not be completed due to issues running the application.
import React, { useContext } from "react";
import { Alert, Text, View, SafeAreaView, Platform, Button } from "react-native";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ThermostatSelector from "./components/ThermostatSelector";
import EnergyCosting from "./components/EnergyCosting";
import ConsumptionReportScreen from "./screens/ConsumptionReportScreen";
import { HostnameContext, HostnameProvider } from "./context/HostnameContext";
import { useAuth, AuthProvider } from "./context/AuthContext";
import { ThermostatProvider } from "./context/ThermostatContext";
import LoginScreen from "./components/LoginScreen";
import { UserProvider } from './context/UserContext';
import { DataRefreshProvider } from "./context/DataRefreshContext";
import { WeatherProvider } from "./context/WeatherContext";

const Stack = createNativeStackNavigator();

const MainScreen = ({ navigation }) => (
    <SafeAreaView style={{ flex: 1 }}>
        <Button
            title="Go to Consumption Report"
            onPress={() => navigation.navigate('ConsumptionReport')}
        />
        {Platform.OS === "web" ? (
            <>
                <ThermostatSelector />
                <EnergyCosting />
            </>
        ) : (
            <View>
                <ThermostatSelector />
                <EnergyCosting />
            </View>
        )}
    </SafeAreaView>
);

const AppContent = () => {
    const { token } = useAuth();
    const hostname = useContext(HostnameContext);

    return token ? (
        <Stack.Navigator>
            <Stack.Screen name="Main" component={MainScreen} />
            <Stack.Screen name="ConsumptionReport" component={ConsumptionReportScreen} />
        </Stack.Navigator>
    ) : (
        hostname === "Loading..." ? <Text>Loading ...</Text> : <LoginScreen />
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
