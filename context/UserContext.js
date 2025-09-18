import React, { createContext, useContext, useState, useCallback } from 'react';
import apiFetch from '../utils/apiFetch';
import { useAuth } from './AuthContext';
import { HostnameContext } from './HostnameContext';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const { token, logout, updateAuth } = useAuth();
  const hostname = useContext(HostnameContext);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const fetchUsers = useCallback(async () => {
    const data = await apiFetch(`${hostname}/users`, 'GET', null, token, 'Error fetching users', null, logout, updateAuth);
    setUsers(data);
  }, [token, logout, hostname]);

  const fetchRoles = useCallback(async () => {
    const data = await apiFetch(`${hostname}/roles`, 'GET', null, token, 'Error fetching roles', null, logout, updateAuth);
    setRoles(data);
  }, [token, logout, hostname]);

  const addUser = async (form) => {
    await apiFetch(`${hostname}/users`, 'POST', form, token, 'Error adding user', null, logout, updateAuth);
    await fetchUsers();
  };

  const updateUser = async (id, updates) => {
    await apiFetch(`${hostname}/users/${id}`, 'PUT', updates, token, 'Error updating user', null, logout, updateAuth);
    await fetchUsers();
  };

  const disableUser = async (id, enabled) => {
    const enable = enabled ? 1 : 0;
    await apiFetch(`${hostname}/users/${id}/enabled`, 'POST', { enable }, token, 'Error disabling user', null, logout, updateAuth);
    await fetchUsers();
  };

  return (
    <UserContext.Provider value={{
      users, roles, fetchUsers, fetchRoles, addUser, updateUser, disableUser
    }}>
      {children}
    </UserContext.Provider>
  );
};