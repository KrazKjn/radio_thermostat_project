import React, { useState, useEffect, useContext } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Switch, ScrollView } from "react-native";
import { HostnameContext } from "../context/HostnameContext";
import { useAuth } from "../context/AuthContext";
import { useThermostat } from "../context/ThermostatContext";
import Icon from "react-native-vector-icons/Ionicons";
import commonStyles from "../styles/commonStyles";

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const weekends = ["Saturday", "Sunday"];

const ThermostatScheduler = ({ thermostatData }) => {
  const { token } = useAuth();
  const hostname = useContext(HostnameContext);
  const { getSchedule, updateSchedule } = useThermostat();
  const [mode, setMode] = useState("cool"); // Toggle between "cool" and "heat"
  const [applyToAllWeekdays, setApplyToAllWeekdays] = useState(false);
  const defaultSchedule = Array(7).fill(null).map(() => []);
  const [schedule, setSchedule] = useState({ cool: defaultSchedule, heat: defaultSchedule });

  useEffect(() => {
    fetchSchedule();
  }, [thermostatData.thermostatInfo.ip, mode]);

  const fetchSchedule = async () => {
    try {
      if (!thermostatData.thermostatInfo.ip || thermostatData.thermostatInfo.ip === "Loading ...") return;

      const data = await getSchedule(thermostatData.thermostatInfo.ip, hostname, token, mode);
      if (data) {
        const newSchedule = daysOfWeek.map((_, i) =>
          Object.values(data[i] || {}).reduce((acc, _, index, arr) => {
            if (index % 2 === 0) acc.push({ time: arr[index], temp: arr[index + 1] });
            return acc;
          }, []).slice(0, 4)
        );

        setSchedule(prev => ({ ...prev, [mode]: newSchedule }));
        checkWeekdayEquivalence(newSchedule); // Check if weekdays are equivalent
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
    }
  };

  const adjustSetpoint = (dayIndex, entryIndex, type, amount) => {
    setSchedule(prevSchedule => {
      const newSchedule = { ...prevSchedule };

      if (applyToAllWeekdays && dayIndex < 5) {
        newSchedule[mode] = newSchedule[mode].map((day, idx) =>
          idx < 5 ? day.map((entry, i) => (i === entryIndex ? { ...entry, [type]: entry[type] + amount } : entry)) : day
        );
      } else {
        newSchedule[mode][dayIndex] = newSchedule[mode][dayIndex].map((entry, i) =>
          i === entryIndex ? { ...entry, [type]: entry[type] + amount } : entry
        );
      }

      return newSchedule;
    });
  };

  const myUpdateSchedule = async (mode) => {
    try {
        let data = Array(7).fill().map(() => []);
        for (let i = 0; i < schedule[mode].length; i++) {
          let count = 0;
          for (let j = 0; j < schedule[mode][i].length; j++) {
            data[i][count] = schedule[mode][i][j].time;
            data[i][count + 1] = schedule[mode][i][j].temp;
            count+=2;
          }
        }

      const results = await updateSchedule(thermostatData.thermostatInfo.ip, hostname, token, mode, data);
      if (!results) {
        throw new Error("Failed to update schedule");
      }
      alert("Schedule saved successfully!");
    } catch (error) {
      console.error("Error saving schedule:", error);
      alert("Error saving schedule. Please try again.");
    }
  };

  const checkWeekdayEquivalence = (schedule) => {
    const weekdaySchedule = schedule.slice(0, 5); // Extract Monday-Friday schedules

    // Check if all weekday schedules are equal
    const allEqual = weekdaySchedule.every(day => JSON.stringify(day) === JSON.stringify(weekdaySchedule[0]));

    setApplyToAllWeekdays(allEqual);
};

  return (
    <ScrollView style={styles.container}>
      {/* Mode Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity onPress={() => setMode("cool")} style={[styles.tab, mode === "cool" && styles.activeTab]}>
          <Text style={[styles.tabText, mode === "cool" && styles.activeTabText]}>Cool Mode</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode("heat")} style={[styles.tab, mode === "heat" && styles.activeTab]}>
          <Text style={[styles.tabText, mode === "heat" && styles.activeTabText]}>Heat Mode</Text>
        </TouchableOpacity>
      </View>

      {/* Toggle for Weekday Mode */}
      <View style={styles.controls}>
        <Text style={commonStyles.digitalLabel}>Apply to All Weekdays:</Text>
        <Switch value={applyToAllWeekdays} onValueChange={setApplyToAllWeekdays} />
      </View>

      {/* Weekday & Weekend Sections */}
      <View style={styles.scheduleContainer}>
        {/* Weekday Section */}
        <View style={styles.weekdayContainer}>
          <Text style={styles.sectionTitle}>
            <Icon name="calendar-outline" size={22} color="#0ff" /> Weekdays
          </Text>

          {applyToAllWeekdays ? (
            <View style={styles.dayRow}>
              <View style={styles.dayBox}>
                <Text style={styles.dayTitle}>Monday - Friday</Text>
                {schedule[mode][0].map(({ time, temp }, entryIndex) => (
                  <View key={entryIndex} style={styles.setpoint}>
                    {/* Time Adjustment */}
                    <TouchableOpacity onPress={() => adjustSetpoint(0, entryIndex, "time", -30)} style={styles.buttonMinus}>
                      <Text style={styles.buttonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.setpointText}>
                      {`${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`}
                    </Text>
                    <TouchableOpacity onPress={() => adjustSetpoint(0, entryIndex, "time", 30)} style={styles.buttonPlus}>
                      <Text style={styles.buttonText}>+</Text>
                    </TouchableOpacity>

                    {/* Temperature Adjustment */}
                    <TouchableOpacity onPress={() => adjustSetpoint(0, entryIndex, "temp", -1)} style={styles.buttonMinus}>
                      <Text style={styles.buttonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.setpointText}>{temp}°F</Text>
                    <TouchableOpacity onPress={() => adjustSetpoint(0, entryIndex, "temp", 1)} style={styles.buttonPlus}>
                      <Text style={styles.buttonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.dayRow}>
              {weekdays.map((day, dayIndex) => (
                <View key={dayIndex} style={styles.dayBox}>
                  <Text style={styles.dayTitle}>{day}</Text>
                  {schedule[mode][dayIndex].map(({ time, temp }, entryIndex) => (
                    <View key={entryIndex} style={styles.setpoint}>
                      {/* Time Adjustment */}
                      <TouchableOpacity onPress={() => adjustSetpoint(dayIndex, entryIndex, "time", -30)} style={styles.buttonMinus}>
                        <Text style={styles.buttonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.setpointText}>
                        {`${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`}
                      </Text>
                      <TouchableOpacity onPress={() => adjustSetpoint(dayIndex, entryIndex, "time", 30)} style={styles.buttonPlus}>
                        <Text style={styles.buttonText}>+</Text>
                      </TouchableOpacity>

                      {/* Temperature Adjustment */}
                      <TouchableOpacity onPress={() => adjustSetpoint(dayIndex, entryIndex, "temp", -1)} style={styles.buttonMinus}>
                        <Text style={styles.buttonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.setpointText}>{temp}°F</Text>
                      <TouchableOpacity onPress={() => adjustSetpoint(dayIndex, entryIndex, "temp", 1)} style={styles.buttonPlus}>
                        <Text style={styles.buttonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Weekend Section */}
        <View style={styles.weekendContainer}>
          <Text style={styles.sectionTitle}>
            <Icon name="calendar-outline" size={22} color="#0ff" /> Weekend
          </Text>

          <View style={styles.dayRow}>
            {weekends.map((day, dayIndex) => (
              <View key={dayIndex} style={styles.dayBox}>
                <Text style={styles.dayTitle}>{day}</Text>
                {schedule[mode][dayIndex + 5].map(({ time, temp }, entryIndex) => (
                  <View key={entryIndex} style={styles.setpoint}>
                    {/* Time Adjustment */}
                    <TouchableOpacity onPress={() => adjustSetpoint(dayIndex + 5, entryIndex, "time", -30)} style={styles.buttonMinus}>
                      <Text style={styles.buttonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.setpointText}>
                      {`${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`}
                    </Text>
                    <TouchableOpacity onPress={() => adjustSetpoint(dayIndex + 5, entryIndex, "time", 30)} style={styles.buttonPlus}>
                      <Text style={styles.buttonText}>+</Text>
                    </TouchableOpacity>

                    {/* Temperature Adjustment */}
                    <TouchableOpacity onPress={() => adjustSetpoint(dayIndex + 5, entryIndex, "temp", -1)} style={styles.buttonMinus}>
                      <Text style={styles.buttonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.setpointText}>{temp}°F</Text>
                    <TouchableOpacity onPress={() => adjustSetpoint(dayIndex + 5, entryIndex, "temp", 1)} style={styles.buttonPlus}>
                      <Text style={styles.buttonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Save Button */}
      <View style={styles.saveContainer}>
        <TouchableOpacity onPress={() => myUpdateSchedule(mode)} style={styles.saveButton}>
          <Text style={styles.saveText}>Save Schedule</Text>
        </TouchableOpacity>
      </View>

      { /* New Mode Schedule Overview Section */ }
      {/* (false) && (
        <>
        <View style={[commonStyles.digitalCard, { margin: 16 }]}>
          <Text style={commonStyles.digitalLabel}>
            <Icon name="calendar-outline" size={22} color="#0ff" /> Schedule Overview
          </Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {schedule[mode].map((daySchedule, dayIndex) => (
              <View key={dayIndex} style={[commonStyles.digitalRowCenter, { justifyContent: "space-between", backgroundColor: dayIndex % 2 === 0 ? "#222" : "#262b2e", borderRadius: 8, marginVertical: 4, paddingVertical: 8, paddingHorizontal: 12 }]}>
                <Text style={commonStyles.digitalButtonText}>{daysOfWeek[dayIndex]}</Text>
                {daySchedule.length > 0 ? (
                  daySchedule.map(({ time, temp }, entryIndex) => (
                    <View key={entryIndex} style={styles.setpoint}>
                      <Text style={styles.setpointText}>
                        {`${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`}
                      </Text>
                      <Text style={styles.setpointText}>{temp}°F</Text>
                    </View>
                  ))
                ) : (
                  <Text style={commonStyles.digitalButtonText}>No schedule</Text>
                )}
                <TouchableOpacity>
                  <Icon name="create-outline" size={20} color="#0ff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[commonStyles.digitalButton, { marginTop: 16 }]}>
            <Icon name="add-circle-outline" size={22} color="#0ff" />
            <Text style={commonStyles.digitalButtonText}>Add Schedule</Text>
          </TouchableOpacity>
        </View>
        </>
      )*/}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "transparent" },
  tabContainer: { flexDirection: "row", marginBottom: 15, justifyContent: "center" },
  tab: { flex: 1, alignItems: "center", padding: 10, borderRadius: 6, backgroundColor: "#ddd", marginHorizontal: 5 },
  activeTab: { backgroundColor: "#007BFF" },
  tabText: { fontSize: 16, fontWeight: "bold", color: "#333" },
  activeTabText: { color: "#fff" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  toggleLabel: { fontSize: 16, fontWeight: "bold" },
  scheduleContainer: { marginTop: 10 },
  weekdayContainer: {
    backgroundColor: "transparent",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  weekendContainer: {
    backgroundColor: "transparent",
    padding: 15,
    borderRadius: 10, // ✅ Rounded edges for section
    marginBottom: 15,
  },

  // ✅ Added missing styles
  sectionTitle: {
    color: "#aaa",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  setpoint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    marginVertical: 5,
  },
  setpointText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F5F5F5",
    paddingHorizontal: 10,
  },
  buttonText: { fontSize: 16, fontWeight: "bold", color: "#fff", textAlign: "center" },

  // Adjusted layout for days
  dayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center", // ✅ Keeps items centered
    gap: 15,
  },
  dayBox: {
    backgroundColor: "#444444",
    padding: 10,
    borderRadius: 10, // ✅ Rounded edges for each day
    boxShadowColor: "#000",
    boxShadowOpacity: 0.1,
    boxShadowOffset: { width: 0, height: 4 },
    boxShadowRadius: 5,
    elevation: 5, // ✅ Shadows for a modern UI
  },
  dayColumn: { alignItems: "center", marginBottom: 10 },
  dayTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#007BFF",
    textAlign: "center",
    marginBottom: 5,
  },

  // Style for +/- Buttons
  buttonMinus: {
    backgroundColor: "#FF4D4D",
    padding: 6,
    borderRadius: 6,
  },
  buttonPlus: {
    backgroundColor: "#4CAF50",
    padding: 6,
    borderRadius: 6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },

  saveContainer: {
    alignItems: "center",
    marginVertical: 15,
  },
  saveButton: {
    backgroundColor: "#007BFF",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  saveText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
});

export default ThermostatScheduler;