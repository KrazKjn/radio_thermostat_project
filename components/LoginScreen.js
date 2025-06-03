import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useAuth } from "../context/AuthContext";
import commonStyles from "../styles/commonStyles";

const LoginScreen = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    if (usernameRef.current) {
      usernameRef.current.focus(); // Set focus when component loads
    }
  }, []);

  const handleLogin = async () => {
    await login(username, password);
  };

  return (
    <View style={commonStyles.container}>
      <Text style={commonStyles.header}>Login</Text>
      <TextInput
        ref={usernameRef} // Assign ref
        style={commonStyles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current.focus()}
      />
      <TextInput
        style={commonStyles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        ref={passwordRef}
        onSubmitEditing={handleLogin}
      />
      <View style={commonStyles.saveContainer}>
        <TouchableOpacity onPress={() => handleLogin()} style={commonStyles.saveButton}>
          <Text style={commonStyles.saveText}>Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default LoginScreen;