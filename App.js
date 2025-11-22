import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HostnameProvider } from './context/HostnameContext';
import { ThermostatProvider } from './context/ThermostatContext';
import { UserProvider } from './context/UserContext';
import { DataRefreshProvider } from './context/DataRefreshContext';
import { WeatherProvider } from './context/WeatherContext';
import { SubscriptionProvider } from './context/subscriptionContext';

// Screens
import LoginScreen from './components/LoginScreen';
import ThermostatSelector from './components/ThermostatSelector';
import UserManagementScreen from './screens/Settings/UserManagementScreen';
import SubscriptionsScreen from './screens/Settings/SubscriptionsScreen';
import EnergyCostingScreen from './screens/Settings/EnergyCostingScreen';
import EnergyUsageScreen from "./screens/EnergyUsageScreen";

const Drawer = createDrawerNavigator();

const AppContent = () => {
    const { token, tokenInfo } = useAuth();

    if (!token) {
        return <LoginScreen />;
    }

    return (
        <Drawer.Navigator initialRouteName="Thermostats">
            <Drawer.Screen name="Thermostats" component={ThermostatSelector} />
            {/* Add other screens to the drawer */}
            <Drawer.Screen name="Subscriptions" component={SubscriptionsScreen} />
            <Drawer.Screen name="Energy Usage" component={EnergyUsageScreen} />
            {tokenInfo && tokenInfo.role === 'admin' && (
                 <Drawer.Screen name="User Management" component={UserManagementScreen} />
            )}
            {tokenInfo && tokenInfo.role === 'admin' && (
                 <Drawer.Screen name="Energy Management" component={EnergyCostingScreen} />
            )}
        </Drawer.Navigator>
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
                                    <SubscriptionProvider>
                                        <AppContent />
                                    </SubscriptionProvider>
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