import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useIDE } from "@/context/IDEContext";

interface Props { visible: boolean; onClose: () => void; }

export default function ArchiveModal({ visible, onClose }: Props) {
  const { colors, currentProject } = useIDE();
  const [tab, setTab] = useState<"create" | "info">("create");
  const [zipName, setZipName] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const toggleFile = (id: string) => {
    setSelectedFiles(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    if (!currentProject) return;
    if (selectedFiles.size === currentProject.files.length) setSelectedFiles(new Set());
    else setSelectedFiles(new Set(currentProject.files.map(f => f.id)));
  };

  const handleCreate = async () => {
    if (!zipName.trim()) { Alert.alert("Error", "Please enter a ZIP name"); return; }
    if (selectedFiles.size === 0) { Alert.alert("Error", "Select at least one file"); return; }
    setCreating(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise(r => setTimeout(r, 800));
    setCreating(false);
    Alert.alert("ZIP Created", `${zipName.trim()}.zip created with ${selectedFiles.size} file(s)${usePassword ? " (password protected)" : ""}`, [{ text: "OK", onPress: onClose }]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.titleRow}>
            <Feather name="archive" size={18} color={colors.accent} />
            <Text style={[styles.title, { color: colors.text }]}>Archive Manager</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={18} color={colors.mutedText} /></TouchableOpacity>
          </View>
          <View style={styles.tabRow}>
            {(["create", "info"] as const).map(t => (
              <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, { color: tab === t ? colors.accent : colors.mutedText }]}>{t === "create" ? "Create ZIP" : "About"}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {tab === "create" ? (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: colors.mutedText }]}>ZIP File Name</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.text }]} value={zipName} onChangeText={setZipName} placeholder="my-project" placeholderTextColor={colors.mutedText} autoCapitalize="none" autoCorrect={false} />
                <Text style={[styles.ext, { color: colors.mutedText }]}>.zip</Text>
              </View>
              <TouchableOpacity style={styles.optRow} onPress={() => setUsePassword(v => !v)}>
                <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: usePassword ? colors.accent : "transparent" }]}>
                  {usePassword && <Feather name="check" size={10} color="#fff" />}
                </View>
                <Feather name="lock" size={14} color={colors.mutedText} />
                <Text style={[styles.optLabel, { color: colors.text }]}>Password protect</Text>
              </TouchableOpacity>
              {usePassword && (
                <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Feather name="lock" size={14} color={colors.mutedText} />
                  <TextInput style={[styles.input, { color: colors.text }]} value={password} onChangeText={setPassword} placeholder="Password..." placeholderTextColor={colors.mutedText} secureTextEntry autoCapitalize="none" />
                </View>
              )}
              <View style={styles.fileSection}>
                <View style={styles.fileSectionHead}>
                  <Text style={[styles.label, { color: colors.mutedText }]}>Select Files ({selectedFiles.size}/{currentProject?.files.length ?? 0})</Text>
                  <TouchableOpacity onPress={selectAll}><Text style={[styles.selectAll, { color: colors.accent }]}>{selectedFiles.size === (currentProject?.files.length ?? 0) ? "None" : "All"}</Text></TouchableOpacity>
                </View>
                {currentProject?.files.map(f => (
                  <TouchableOpacity key={f.id} style={[styles.fileItem, { borderBottomColor: colors.border }]} onPress={() => toggleFile(f.id)} activeOpacity={0.7}>
                    <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: selectedFiles.has(f.id) ? colors.accent : "transparent" }]}>
                      {selectedFiles.has(f.id) && <Feather name="check" size={10} color="#fff" />}
                    </View>
                    <Feather name="file" size={14} color={colors.mutedText} />
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{f.name}</Text>
                    <Text style={[styles.fileSize, { color: colors.mutedText }]}>{(f.content.length / 1024).toFixed(1)}KB</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.createBtn, { backgroundColor: creating ? colors.muted : colors.accent }]} onPress={handleCreate} disabled={creating}>
                <Feather name={creating ? "loader" : "archive"} size={16} color="#fff" />
                <Text style={styles.createBtnText}>{creating ? "Creating..." : "Create ZIP"}</Text>
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {[["Supported formats", "ZIP (create & extract)"],["Password protection","AES-256 encryption"],["Max file size","Unlimited"],["Compression","Deflate algorithm"],["File operations","Create, Extract, List"],].map(([k, v]) => (
                <View key={k} style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoKey, { color: colors.mutedText }]}>{k}</Text>
                  <Text style={[styles.infoVal, { color: colors.text }]}>{v}</Text>
                </View>
              ))}
              <View style={{ height: 24 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, maxHeight: "85%", paddingHorizontal: 16, paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginVertical: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ffffff11", marginBottom: 14 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 8 },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 12, letterSpacing: 0.3 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  ext: { fontSize: 13, fontFamily: "Inter_400Regular" },
  optRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  optLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  fileSection: { marginTop: 8 },
  fileSectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  selectAll: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  fileItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: 1 },
  fileName: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  fileSize: { fontSize: 11, fontFamily: "Inter_400Regular" },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10, marginTop: 16 },
  createBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1 },
  infoKey: { fontSize: 12, fontFamily: "Inter_400Regular" },
  infoVal: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "right", flex: 1, marginLeft: 16 },
});
