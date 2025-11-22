import React, { useRef, useEffect, useState, useContext } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, StyleSheet, Picker, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { UserContext } from '../../context/UserContext';
import commonStyles from "../../styles/commonStyles";

const UserManagementScreen = () => {
  const { tokenInfo } = useAuth();
  const {
    users, roles, fetchUsers, fetchRoles, addUser, updateUser, disableUser
  } = useContext(UserContext);
  const [form, setForm] = useState({ username: '', email: '', password: '', roleId: '' });
  const [textSizeUsername, setTextSizeUsername] = useState(100);
  const [textSizeEmail, setTextSizeEmail] = useState(250);
  const [textSizeRole, setTextSizeRole] = useState(100);
  const [textSizeStatus, setTextSizeStatus] = useState(70);
  const [textSizeActions, setTextSizeActions] = useState(80);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', email: '', enabled: true });
  const [editError, setEditError] = useState('');

  const usernameRef = useRef(null);
  const emailRef = useRef(null);

  // Only show for admin
  if (!tokenInfo || tokenInfo.role !== 'admin') return null;

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  const handleChange = (name, value) => setForm({ ...form, [name]: value });

  const handleAdd = async () => {
    await addUser(form);
    setForm({ username: '', email: '', password: '', roleId: '' });
  };

  const handleUpdate = async (id, updates) => {
    await updateUser(id, updates);
  };

  const handleDisable = async (id, enable) => {
    setEditForm({ ...editForm, enabled: enable });
    //await disableUser(id, enable);
  };

  const handleSort = (field) => {
    // Sorting logic can be implemented here if needed
  }

  const setTextSizeUsername2 = async (ref) => {
    // Usage
    // const width = await getTextWidth(ref.current.innerText, "14px monospace");
    // console.log(`Width of ${ref.current.innerText}: ${width}, textSizeUsername: ${textSizeUsername}`);
    // if (width > textSizeUsername) {
    //   setTextSizeUsername(width);
    // }
  };

  const setTextSizeEmail2 = async (ref) => {
    // const width = await getTextWidth(ref.current.innerText, "14px monospace");
    // if (width > textSizeEmail) {
    //   setTextSizeEmail(width);
    // }
  };

  const getTextWidth = async (text, font) => {
    // Create a temporary canvas element
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    // Apply the font style (e.g., "16px Arial")
    context.font = font;

    // Measure text width
    return context.measureText(text).width + 40;
  }

  const startEdit = (user) => {
    setEditingUserId(user.id);
    setEditForm({ username: user.username, email: user.email, enabled: user.enabled });
    setEditError('');
    setTextSizeActions(140)
  };

  const handleEditChange = (name, value) => {
    setEditForm({ ...editForm, [name]: value });
  };

  const saveEdit = async () => {
    // Check for duplicate username
    if (users.some(u => u.username === editForm.username && u.id !== editingUserId)) {
      setEditError('Username already in use.');
      return;
    }
    await updateUser(editingUserId, editForm);
    setEditingUserId(null);
    setEditForm({ username: '', email: '' });
    setEditError('');
    setTextSizeActions(80);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditForm({ username: '', email: '' });
    setEditError('');
    setTextSizeActions(80);
  };

  const onUsernameLayout = (event) => {
    // const width = event.nativeEvent.layout.width + 40;
    // setTextSizeUsername(prev => (width > prev ? width : prev));
  };

  const onEmailLayout = (event) => {
    // const width = event.nativeEvent.layout.width + 40;
    // setTextSizeEmail(prev => (width > prev ? width : prev));
  };

  const headerStyle = { color: '#007BFF', padding: 8, borderRightWidth: 1, borderColor: '#fff' }; //#fff
  const cellStyle = { color: '#333', padding: 8, borderRightWidth: 1, borderColor: '#ccc' };

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <Text style={commonStyles.headerNetwork}>User Administration</Text>
      <View style={commonStyles.containerSimple}>
        <TextInput
          style={commonStyles.input}
          placeholder="Username"
          value={form.username}
          onChangeText={text => handleChange('username', text)}
        />
        <TextInput
          style={commonStyles.input}
          placeholder="Email"
          value={form.email}
          onChangeText={text => handleChange('email', text)}
        />
        <TextInput
          style={commonStyles.input}
          placeholder="Password"
          secureTextEntry
          value={form.password}
          onChangeText={text => handleChange('password', text)}
        />
        <Picker
          selectedValue={form.roleId}
          style={commonStyles.input}
          onValueChange={value => handleChange('roleId', value)}
        >
          <Picker.Item label="Select Role" value="" />
          {roles.map(role => (
            <Picker.Item key={role.id} label={role.name} value={role.id} />
          ))}
        </Picker>
        <TouchableOpacity style={commonStyles.saveButton} onPress={handleAdd}>
          <Text style={commonStyles.saveText}>Add User</Text>
        </TouchableOpacity>
      </View>
      <View style={[commonStyles.containerSimple, { backgroundColor: '#007BFF' }]}>
        <View key={-1} style={[commonStyles.rowContainer, { backgroundColor: '#f8f9fa', borderRadius: 4, borderBottomWidth: 1, borderColor: '#ccc' }]}>
          <Text ref={usernameRef} style={{ ...headerStyle, width: textSizeUsername, fontWeight: 'bold' }} onPress={() => handleSort('username')} onLayout={event => setTextSizeUsername2(usernameRef)}>Username</Text>
          <Text ref={emailRef} style={{ ...headerStyle, width: textSizeEmail, fontWeight: 'bold' }} onPress={() => handleSort('email')} onLayout={event => setTextSizeEmail2(emailRef)}>Email</Text>
          <Text style={{ ...headerStyle, width: textSizeRole, fontWeight: 'bold' }} onPress={() => handleSort('role')}>Role</Text>
          <Text style={{ ...headerStyle, width: textSizeStatus, fontWeight: 'bold' }} onPress={() => handleSort('status')}>Status</Text>
          <Text style={{ ...headerStyle, width: textSizeActions, fontWeight: 'bold' }} onPress={() => handleSort('actions')}>Actions</Text>
        </View>
        {users.map(user => (
          <View key={user.id} style={commonStyles.rowContainer}>
            {editingUserId === user.id ? (
              <>
                <TextInput
                  ref={usernameRef}
                  style={[commonStyles.input, {width: textSizeUsername}]}
                  value={editForm.username}
                  onChangeText={text => handleEditChange('username', text)}
                  onLayout={onUsernameLayout}
                />
                <TextInput
                  ref={emailRef}
                  style={[commonStyles.input, {width: textSizeEmail}]}
                  value={editForm.email}
                  onChangeText={text => handleEditChange('email', text)}
                  onLayout={onEmailLayout}
                />
                <Picker
                  selectedValue={user.roleId}
                  style={{ textAlign: 'center', width: textSizeRole }}
                  onValueChange={value => handleUpdate(user.id, { roleId: value })}
                >
                  {roles.map(role => (
                    <Picker.Item key={role.id} label={role.name} value={role.id} />
                  ))}
                </Picker>
                <TouchableOpacity
                  style={[commonStyles.button, { textAlign: 'center', width: textSizeStatus }, { backgroundColor:  editForm.enabled ? '#ff0000' : '#008000' }]}
                  onPress={() => handleDisable(user.id, !editForm.enabled)}
                >
                  <Text style={commonStyles.buttonText}>{editForm.enabled ? 'Disable' : 'Enable'}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', width: textSizeActions, padding: 8, borderRadius: 4 }}>
                  <TouchableOpacity onPress={saveEdit} style={commonStyles.usersSaveButton}>
                    <Text style={[commonStyles.saveText, { textAlign: 'center' }]}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelEdit} style={commonStyles.button}>
                    <Text style={[commonStyles.buttonText, { textAlign: 'center' }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text ref={usernameRef} onLayout={onUsernameLayout} style={[cellStyle, {width: textSizeUsername}]}>{user.username}</Text>
                <Text ref={emailRef} onLayout={onEmailLayout} style={[cellStyle, {width: textSizeEmail}]}>{user.email}</Text>
                <Picker
                  selectedValue={user.roleId}
                  style={[{ textAlign: 'center', width: textSizeRole }]}
                  disabled={true} // Disable picker to prevent changes while not editing
                >
                  {roles.map(role => (
                    <Picker.Item key={role.id} label={role.name} value={role.id} />
                  ))}
                </Picker>
                <Text style={[{ textAlign: 'center', width: textSizeStatus }]}>{user.enabled ? 'Enabled' : 'Disabled'}</Text>
                <TouchableOpacity onPress={() => startEdit(user)} style={commonStyles.button}>
                  <Text style={[commonStyles.buttonText, { textAlign: 'center', width: textSizeActions }]}>Edit</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ))}
      </View>
      {editError ? <Text style={commonStyles.errorText}>{editError}</Text> : null}
    </ScrollView>
  );
};

export default UserManagementScreen;