import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, FlatList, Modal, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useIDE } from "@/context/IDEContext";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: string;
  iconColor?: string;
  category: string;
  action: () => void;
  shortcut?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CommandPalette({ visible, onClose }: Props) {
  const {
    colors, setActivePanel, toggleTerminal, toggleSidebar,
    setTheme, setFontSize, fontSize, activeFile,
    setWordWrap, wordWrap, setLineNumbers, lineNumbers,
    setAutoComplete, autoComplete, setMinimap, minimap,
    createProject, openFiles, setActiveFile, closeFile,
  } = useIDE();

  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      setQuery("");
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start(() => inputRef.current?.focus());
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start();
      slideAnim.setValue(-20);
    }
  }, [visible]);

  const commands: Command[] = useMemo(() => [
    { id: "files", label: "Open Explorer", description: "View project files", icon: "copy", category: "View", shortcut: "Ctrl+Shift+E", action: () => { setActivePanel("files"); onClose(); } },
    { id: "terminal", label: "Toggle Terminal", description: "Open/close terminal panel", icon: "terminal", category: "View", shortcut: "Ctrl+`", action: () => { toggleTerminal(); onClose(); } },
    { id: "ai", label: "Open AI Agent", description: "Chat with AI assistant", icon: "cpu", category: "View", shortcut: "Ctrl+Shift+A", action: () => { setActivePanel("ai"); onClose(); } },
    { id: "git", label: "Source Control", description: "View Git panel", icon: "git-branch", category: "View", shortcut: "Ctrl+Shift+G", action: () => { setActivePanel("git"); onClose(); } },
    { id: "plugins", label: "Plugin Manager", description: "Manage IDE plugins", icon: "package", category: "View", action: () => { setActivePanel("plugins"); onClose(); } },
    { id: "settings", label: "Open Settings", description: "Configure IDE settings", icon: "settings", category: "Preferences", shortcut: "Ctrl+,", action: () => { setActivePanel("settings"); onClose(); } },
    { id: "search", label: "Search in Project", description: "Find text across files", icon: "search", category: "Edit", shortcut: "Ctrl+Shift+F", action: () => { setActivePanel("search" as any); onClose(); } },
    { id: "theme-dark", label: "Theme: Dark+", icon: "moon", category: "Preferences", action: () => { setTheme("dark"); onClose(); } },
    { id: "theme-light", label: "Theme: Light", icon: "sun", category: "Preferences", action: () => { setTheme("light"); onClose(); } },
    { id: "theme-hacker", label: "Theme: Hacker Green", icon: "terminal", iconColor: "#00ff41", category: "Preferences", action: () => { setTheme("hacker"); onClose(); } },
    { id: "theme-midnight", label: "Theme: Midnight Blue", icon: "moon", iconColor: "#6e9ef5", category: "Preferences", action: () => { setTheme("midnight" as any); onClose(); } },
    { id: "theme-monokai", label: "Theme: Monokai Pro", icon: "moon", iconColor: "#f92672", category: "Preferences", action: () => { setTheme("monokai" as any); onClose(); } },
    { id: "font-decrease", label: "Decrease Font Size", description: `Current: ${fontSize}px`, icon: "minus", category: "Editor", action: () => { setFontSize(Math.max(10, fontSize - 1)); onClose(); } },
    { id: "font-increase", label: "Increase Font Size", description: `Current: ${fontSize}px`, icon: "plus", category: "Editor", action: () => { setFontSize(Math.min(24, fontSize + 1)); onClose(); } },
    { id: "toggle-wrap", label: wordWrap ? "Disable Word Wrap" : "Enable Word Wrap", icon: "align-left", category: "Editor", action: () => { setWordWrap(!wordWrap); onClose(); } },
    { id: "toggle-nums", label: lineNumbers ? "Hide Line Numbers" : "Show Line Numbers", icon: "hash", category: "Editor", action: () => { setLineNumbers(!lineNumbers); onClose(); } },
    { id: "toggle-ac", label: autoComplete ? "Disable Auto Complete" : "Enable Auto Complete", icon: "zap", category: "Editor", action: () => { setAutoComplete(!autoComplete); onClose(); } },
    { id: "toggle-minimap", label: minimap ? "Hide Minimap" : "Show Minimap", icon: "map", category: "Editor", action: () => { setMinimap(!minimap); onClose(); } },
    { id: "sidebar-toggle", label: "Toggle Sidebar", icon: "sidebar", category: "View", shortcut: "Ctrl+B", action: () => { toggleSidebar(); onClose(); } },
    ...openFiles.map(f => ({
      id: `open-${f.id}`, label: `Switch to: ${f.name}`, description: f.path,
      icon: "file", category: "Files",
      action: () => { setActiveFile(f.id); setActivePanel("editor" as any); onClose(); }
    })),
    ...openFiles.map(f => ({
      id: `close-${f.id}`, label: `Close: ${f.name}`, icon: "x",
      category: "Files",
      action: () => { closeFile(f.id); onClose(); }
    })),
  ], [colors, fontSize, wordWrap, lineNumbers, autoComplete, minimap, openFiles]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 20);
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.description?.toLowerCase().includes(q)) ||
      c.category.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [query, commands]);

  const handleSelect = useCallback((cmd: Command) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cmd.action();
  }, []);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[styles.palette, { backgroundColor: colors.card, borderColor: colors.border, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.inputRow, { borderBottomColor: colors.border, backgroundColor: colors.input }]}>
            <Feather name="terminal" size={16} color={colors.accent} />
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Type a command or search..."
              placeholderTextColor={colors.mutedText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={16} color={colors.mutedText} />
            </TouchableOpacity>
          </View>

          {query.length === 0 && (
            <Text style={[styles.hint, { color: colors.mutedText }]}>
              Recent commands and actions — start typing to filter
            </Text>
          )}

          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            style={{ maxHeight: 360 }}
            keyboardShouldPersistTaps="always"
            renderItem={({ item, index }) => {
              const catChange = index === 0 || filtered[index - 1]?.category !== item.category;
              return (
                <>
                  {catChange && (
                    <Text style={[styles.category, { color: colors.mutedText }]}>{item.category}</Text>
                  )}
                  <TouchableOpacity
                    style={[styles.item, { borderBottomColor: colors.border + "44" }]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: (item.iconColor ?? colors.accent) + "22" }]}>
                      <Feather name={item.icon as any} size={15} color={item.iconColor ?? colors.accent} />
                    </View>
                    <View style={styles.info}>
                      <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
                      {item.description && (
                        <Text style={[styles.desc, { color: colors.mutedText }]} numberOfLines={1}>{item.description}</Text>
                      )}
                    </View>
                    {item.shortcut && (
                      <View style={[styles.shortcut, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.shortcutText, { color: colors.mutedText }]}>{item.shortcut}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              );
            }}
          />

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Text style={[styles.footerText, { color: colors.mutedText }]}>↑↓ navigate  ↵ select  Esc close</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-start", paddingTop: 60, paddingHorizontal: 16 },
  palette: { borderRadius: 12, borderWidth: 1, overflow: "hidden", maxHeight: 520, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 4 },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", paddingHorizontal: 14, paddingVertical: 6 },
  category: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, paddingHorizontal: 14, paddingVertical: 5, textTransform: "uppercase" },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1 },
  iconBox: { width: 30, height: 30, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  desc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  shortcut: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  shortcutText: { fontSize: 10, fontFamily: "monospace" },
  footer: { paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, alignItems: "center" },
  footerText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
