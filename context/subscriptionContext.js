import React, { createContext, useContext, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const { authenticatedApiFetch } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await authenticatedApiFetch('/api/subscriptions');
      setSubscriptions(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch subscriptions.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedApiFetch]);

  const addSubscription = async ({ thermostat_id, report_type }) => {
    try {
      await authenticatedApiFetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thermostat_id, report_type }),
      });
      fetchSubscriptions();
    } catch (error) {
      if (error.status === 409) {
        Alert.alert('Error', 'This subscription already exists.');
      } else {
        Alert.alert('Error', 'Failed to add subscription.');
      }
      console.error(error);
    }
  };

  const updateSubscription = async (id, is_active) => {
    try {
      await authenticatedApiFetch(`/api/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      });
      setSubscriptions(prev =>
        prev.map(sub => (sub.id === id ? { ...sub, is_active } : sub))
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update subscription.');
      console.error(error);
    }
  };

  const deleteSubscription = async (id) => {
    try {
      await authenticatedApiFetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
      setSubscriptions(prev => prev.filter(sub => sub.id !== id));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete subscription.');
      console.error(error);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptions,
        isLoading,
        fetchSubscriptions,
        addSubscription,
        updateSubscription,
        deleteSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptions = () => useContext(SubscriptionContext);