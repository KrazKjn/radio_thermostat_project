import React from "react";
import { View, Text } from "react-native";
import ThermostatScanner from "./ThermostatScanner";
import MyIpHostName from "./MyIpHostName";
import commonStyles from "../styles/commonStyles";
import CloudSettings from "./CloudSettings"; // Assuming you have a CloudSettings component

const OptionsInfo = ({ thermostat }) => {

  return (
    <View style={commonStyles.digitalCard}>
      <Text style={commonStyles.digitalLabel}>Options & Information</Text>
      <View style={commonStyles.digitalRowCenter}>
        <MyIpHostName />
      </View>
      <View style={commonStyles.digitalRowCenter}>
        <ThermostatScanner />
      </View>
      <View style={commonStyles.digitalRowCenter}>
        <CloudSettings thermostat={thermostat} />
      </View>
    </View>
  );
};

export default OptionsInfo;