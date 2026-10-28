import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "pl.forma.dziennik",
  appName: "FORMA",
  webDir: "dist",
  android: {
    backgroundColor: "#ffffff",
    adjustMarginsForEdgeToEdge: "auto",
    webContentsDebuggingEnabled: false,
  },
};
export default config;
