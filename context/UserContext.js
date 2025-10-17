import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { HostnameContext } from './HostnameContext';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const { authenticatedApiFetch } = useAuth();
  const hostname = useContext(HostnameContext);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const fetchUsers = useCallback(async () => {
    const data = await authenticatedApiFetch(`${hostname}/users`, 'GET', null, 'Error fetching users');
    setUsers(data);
  }, [hostname, authenticatedApiFetch]);

  const fetchRoles = useCallback(async () => {
    const data = await authenticatedApiFetch(`${hostname}/roles`, 'GET', null, 'Error fetching roles');
    setRoles(data);
  }, [hostname, authenticatedApiFetch]);

  const addUser = async (form) => {
    await authenticatedApiFetch(`${hostname}/users`, 'POST', form, 'Error adding user');
    await fetchUsers();
  };

  const updateUser = async (id, updates) => {
    await authenticatedApiFetch(`${hostname}/users/${id}`, 'PUT', updates, 'Error updating user');
    await fetchUsers();
  };

  const disableUser = async (id, enabled) => {
    const enable = enabled ? 1 : 0;
    await authenticatedApiFetch(`${hostname}/users/${id}/enabled`, 'POST', { enable }, 'Error disabling user');
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