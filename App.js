import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { HostnameProvider } from './contexts/HostnameContext';
import { ThermostatProvider } from './contexts/ThermostatContext';
import { UserProvider } from './contexts/UserContext';
import { DataRefreshProvider } from './contexts/DataRefreshContext';
import { WeatherProvider } from './contexts/WeatherContext';

// Screens
import LoginScreen from './components/LoginScreen';
import ThermostatSelector from './components/ThermostatSelector';
import UserManagement from './components/UserManagement';
import SubscriptionsScreen from './screens/Settings/SubscriptionsScreen';

const Drawer = createDrawerNavigator();

const AppContent = () => {
    const { token, user } = useAuth();

    if (!token) {
        return <LoginScreen />;
    }

    return (
        <Drawer.Navigator initialRouteName="Thermostats">
            <Drawer.Screen name="Thermostats" component={ThermostatSelector} />
            {/* Add other screens to the drawer */}
            <Drawer.Screen name="Subscriptions" component={SubscriptionsScreen} />
            {user && user.role === 'admin' && (
                 <Drawer.Screen name="User Management" component={UserManagement} />
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
