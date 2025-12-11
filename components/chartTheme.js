// chartTheme.ts
export const getChartColors = (isDarkMode) => ({
  color: isDarkMode ? "#FFFFFF" : "#222",
  colorFn: (opacity = 1) => isDarkMode
    ? `rgba(255, 255, 255, ${opacity})`
    : `rgba(34, 34, 34, ${opacity})`,
  colorBarFn: (opacity = 1) => !isDarkMode
    ? `rgba(0, 255, 255, ${opacity})`
    : `rgba(0, 255, 0, ${opacity})`,
  colorBarHVACFn: (opacity = 1) => !isDarkMode
    ? `rgba(255, 165, 0, ${opacity})`
    : `rgba(255, 255, 0, ${opacity})`,
  colorBarFanFn: (opacity = 1) => !isDarkMode
    ? `rgba(0, 0, 255, ${opacity})`
    : `rgba(70, 70, 255, ${opacity})`,
  labelColor: "#aaa",
  labelColorFn: (opacity = 1) => `rgba(170, 170, 170, ${opacity})`,
  backgroundColor: isDarkMode ? "transparent" : "#222",
  backgroundGradientFrom: isDarkMode ? "#0f0f0f" : "#222",
  backgroundGradientTo: isDarkMode ? "#ffffff" : "#222",
  lineColorCurrentTemp: isDarkMode ? "#0ff" : "#FF0000",
  lineColorTargetTemp: isDarkMode ? "rgba(246, 182, 62, 1)" : "rgba(255, 255, 0, 1)",
  lineColorHVAC: isDarkMode ? "#0ff" : "rgba(79, 79, 255, 1)",
  lineColorHVACCooling: isDarkMode ? "#0ff" : "rgba(79, 79, 255, 1)",
  lineColorHVACHeating: isDarkMode ? "rgba(255, 68, 0, 1)" : "rgba(255, 0, 0, 1)",
  lineColorFan: "#FFA500",
  backgroundBarChartGradientFrom: isDarkMode ? "#b4b2bdff" : "#363538ff",
  backgroundBarChartGradientTo: isDarkMode ? "#7f71beff" : "#241d41ff",
});
