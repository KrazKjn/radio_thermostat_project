//import { registerRootComponent } from "expo";
import { AppRegistry, Platform } from "react-native";
import App from "./App";
import { name as appName } from "./app.json";

// Web requires a root element
if (Platform.OS === "web") {
  AppRegistry.registerComponent(appName, () => App);
  const rootTag = document.getElementById("root") || document.createElement("div");
  document.body.appendChild(rootTag);
  AppRegistry.runApplication(appName, { initialProps: {}, rootTag });
} else {
  AppRegistry.registerComponent(appName, () => App);
}
/*
AppRegistry.registerComponent(appName, () => App);
if (Platform.OS === "web") {
  AppRegistry.runApplication(appName, {
    initialProps: {},
    rootTag: document.getElementById("root"),
  });
}
*/
//registerRootComponent(App);