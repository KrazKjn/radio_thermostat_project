import React, { createContext, useContext, useState, useCallback } from 'react';
import apiFetch from '../utils/apiFetch';
import { useAuth } from './AuthContext';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const { token, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const fetchUsers = useCallback(async () => {
    const data = await apiFetch('localhost', '/users', 'GET', null, token, 'Error fetching users', null, logout);
    setUsers(data);
  }, [token, logout]);

  const fetchRoles = useCallback(async () => {
    const data = await apiFetch('localhost', '/roles', 'GET', null, token, 'Error fetching roles', null, logout);
    setRoles(data);
  }, [token, logout]);

  const addUser = async (form) => {
    await apiFetch('localhost', '/users', 'POST', form, token, 'Error adding user', null, logout);
    await fetchUsers();
  };

  const updateUser = async (id, updates) => {
    await apiFetch('localhost', `/users/${id}`, 'PUT', updates, token, 'Error updating user', null, logout);
    await fetchUsers();
  };

  const disableUser = async (id, enabled) => {
    const enable = enabled ? 1 : 0;
    await apiFetch('localhost', `/users/${id}/enabled`, 'POST', { enable }, token, 'Error disabling user', null, logout);
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