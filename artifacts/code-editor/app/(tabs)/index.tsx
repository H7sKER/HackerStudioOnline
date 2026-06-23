import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Dimensions, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActivityBar from "@/components/ActivityBar";
import AIPanel from "@/components/AIPanel";
import ArchiveModal from "@/components/ArchiveModal";
import CodeEditor from "@/components/CodeEditor";
import CommandPalette from "@/components/CommandPalette";
import DeviceExplorer from "@/components/DeviceExplorer";
import FileExplorer from "@/components/FileExplorer";
import GitPanel from "@/components/GitPanel";
import PluginPanel from "@/components/PluginPanel";
import SearchPanel from "@/components/SearchPanel";
import SettingsPanel from "@/components/SettingsPanel";
import SplashAnimation from "@/components/SplashAnimation";
import TerminalPanel from "@/components/TerminalPanel";
import { useIDE } from "@/context/IDEContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SIDEBAR_WIDTH = Math.min(270, SCREEN_WIDTH * 0.72);
const TERMINAL_HEIGHT = Math.min(240, SCREEN_HEIGHT * 0.32);

export default function IDEScreen() {
  const {
    activePanel, colors, sidebarOpen, setSidebarOpen,
    terminalOpen,
  } = useIDE();
  const insets = useSafeAreaInsets();
  const [showSplash, setShowSplash] = useState(true);
  const [showPalette, setShowPalette] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showPalette) { setShowPalette(false); return true; }
      if (showArchive) { setShowArchive(false); return true; }
      if (sidebarOpen) { setSidebarOpen(false); return true; }
      return true;
    });
    return () => handler.remove();
  }, [sidebarOpen, setSidebarOpen, showPalette, showArchive]);

  useEffect(() => {
    if (activePanel === "archive") setShowArchive(true);
  }, [activePanel]);

  const renderSidePanel = useCallback(() => {
    switch (activePanel) {
      case "files":    return <FileExplorer />;
      case "device":   return <DeviceExplorer />;
      case "ai":       return <AIPanel />;
      case "git":      return <GitPanel />;
      case "settings": return <SettingsPanel />;
      case "plugins":  return <PluginPanel />;
      case "search":   return <SearchPanel />;
      default:         return null;
    }
  }, [activePanel]);

  const showSide = sidebarOpen && activePanel !== "editor" && activePanel !== "archive";
  const showTerminal = terminalOpen;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Splash screen */}
      {showSplash && <SplashAnimation onDone={() => setShowSplash(false)} />}

      {/* Command palette floating button */}
      <View style={[styles.paletteBar, { backgroundColor: colors.titleBar, borderBottomColor: colors.border }]}>
        <View style={styles.paletteLeft} />
        <View style={[styles.paletteSearch, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onTouchEnd={() => setShowPalette(true)}>
          <View style={{ width: 12, height: 12, opacity: 0.5 }} />
        </View>
        <View style={styles.paletteRight} />
      </View>

      <View style={styles.body}>
        <ActivityBar />
        <View style={styles.workspace}>
          <View style={styles.mainArea}>
            {showSide && (
              <View style={[styles.sidebar, { width: SIDEBAR_WIDTH, backgroundColor: colors.sidebar, borderRightColor: colors.sidebarBorder }]}>
                {renderSidePanel()}
              </View>
            )}
            <View style={styles.fill}>
              <CodeEditor />
              {showTerminal && (
                <View style={[styles.terminal, { height: TERMINAL_HEIGHT, backgroundColor: colors.terminalBg, borderTopColor: colors.border }]}>
                  <TerminalPanel
                    cwd="/"
                    colors={{
                      bg: colors.terminalBg,
                      fg: colors.terminalText,
                      accent: colors.terminalPrompt,
                      mutedText: colors.mutedText,
                      error: colors.terminalError,
                      warning: colors.terminalWarning,
                      info: colors.terminalInfo,
                      border: colors.border,
                    }}
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Command palette modal */}
      <CommandPalette visible={showPalette} onClose={() => setShowPalette(false)} />

      {/* Archive modal */}
      <ArchiveModal visible={showArchive} onClose={() => setShowArchive(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  paletteBar: { height: 0, borderBottomWidth: 0 },
  paletteLeft: { flex: 1 },
  paletteSearch: { flex: 2, height: 24, borderRadius: 4, borderWidth: 1 },
  paletteRight: { flex: 1 },
  body: { flex: 1, flexDirection: "row" },
  workspace: { flex: 1, flexDirection: "row" },
  mainArea: { flex: 1, flexDirection: "row" },
  sidebar: { borderRightWidth: 1 },
  fill: { flex: 1, flexDirection: "column" },
  terminal: { borderTopWidth: 1 },
});
