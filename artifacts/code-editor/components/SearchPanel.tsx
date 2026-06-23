import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList, Modal, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useIDE } from "@/context/IDEContext";

interface SearchResult {
  fileId: string;
  fileName: string;
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export default function SearchPanel() {
  const { currentProject, colors, openFile, setActivePanel } = useIDE();
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [replaceConfirm, setReplaceConfirm] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const results = useMemo(() => {
    if (!query.trim() || !currentProject) return [];
    try {
      let flags = "g" + (caseSensitive ? "" : "i");
      let pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (wholeWord && !useRegex) pattern = `\\b${pattern}\\b`;
      const regex = new RegExp(pattern, flags);

      const found: SearchResult[] = [];
      for (const file of currentProject.files) {
        const lines = file.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let match;
          while ((match = regex.exec(line)) !== null) {
            found.push({
              fileId: file.id,
              fileName: file.name,
              filePath: file.path,
              lineNumber: i + 1,
              lineContent: line,
              matchStart: match.index,
              matchEnd: match.index + match[0].length,
            });
            if (!flags.includes("g")) break;
          }
          regex.lastIndex = 0;
          if (found.length >= 500) break;
        }
        if (found.length >= 500) break;
      }
      return found;
    } catch {
      return [];
    }
  }, [query, currentProject, caseSensitive, wholeWord, useRegex]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      if (!groups[r.fileId]) groups[r.fileId] = [];
      groups[r.fileId].push(r);
    }
    return Object.entries(groups);
  }, [results]);

  const toggleFile = useCallback((fileId: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      next.has(fileId) ? next.delete(fileId) : next.add(fileId);
      return next;
    });
  }, []);

  const handleResultPress = useCallback((result: SearchResult) => {
    Haptics.selectionAsync();
    const file = currentProject?.files.find(f => f.id === result.fileId);
    if (file) { openFile(file); setActivePanel("editor" as any); }
  }, [currentProject, openFile, setActivePanel]);

  const highlightMatch = (line: string, start: number, end: number) => {
    const before = line.slice(0, start);
    const match = line.slice(start, end);
    const after = line.slice(end);
    const maxLen = 60;
    const trimBefore = before.length > 20 ? "..." + before.slice(-20) : before;
    return { before: trimBefore, match, after: after.slice(0, maxLen - match.length) };
  };

  const totalMatches = results.length;
  const totalFiles = groupedResults.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.sidebar }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Feather name="search" size={14} color={colors.mutedText} />
        <Text style={[styles.headerTitle, { color: colors.mutedText }]}>SEARCH</Text>
        <TouchableOpacity
          style={[styles.replaceToggle, showReplace && { backgroundColor: colors.accent + "22" }]}
          onPress={() => setShowReplace(v => !v)}
        >
          <Feather name="edit-2" size={12} color={showReplace ? colors.accent : colors.mutedText} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchArea}>
        <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Feather name="search" size={13} color={colors.mutedText} />
          <TextInput
            style={[styles.textInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search in project..."
            placeholderTextColor={colors.mutedText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Feather name="x" size={13} color={colors.mutedText} />
            </TouchableOpacity>
          )}
        </View>

        {showReplace && (
          <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border, marginTop: 4 }]}>
            <Feather name="edit-2" size={13} color={colors.mutedText} />
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              value={replaceText}
              onChangeText={setReplaceText}
              placeholder="Replace with..."
              placeholderTextColor={colors.mutedText}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        <View style={styles.optionRow}>
          {[
            { label: "Aa", active: caseSensitive, onPress: () => setCaseSensitive(v => !v), hint: "Case sensitive" },
            { label: "\\b", active: wholeWord, onPress: () => setWholeWord(v => !v), hint: "Whole word" },
            { label: ".*", active: useRegex, onPress: () => setUseRegex(v => !v), hint: "Regex" },
          ].map(opt => (
            <TouchableOpacity
              key={opt.label}
              style={[styles.optBtn, { backgroundColor: opt.active ? colors.accent + "33" : colors.muted, borderColor: opt.active ? colors.accent : colors.border }]}
              onPress={opt.onPress}
            >
              <Text style={[styles.optBtnText, { color: opt.active ? colors.accent : colors.mutedText }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          {showReplace && replaceText && results.length > 0 && (
            <TouchableOpacity style={[styles.replaceAllBtn, { backgroundColor: colors.warning + "22", borderColor: colors.warning }]}>
              <Text style={[styles.replaceAllText, { color: colors.warning }]}>Replace All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {query.length > 0 && (
        <View style={[styles.stats, { borderBottomColor: colors.border }]}>
          <Text style={[styles.statsText, { color: colors.mutedText }]}>
            {totalMatches === 0 ? "No results found" : `${totalMatches} result${totalMatches !== 1 ? "s" : ""} in ${totalFiles} file${totalFiles !== 1 ? "s" : ""}`}
          </Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {groupedResults.map(([fileId, fileResults]) => {
          const isExpanded = !expandedFiles.has(fileId);
          const { fileName, filePath } = fileResults[0];
          return (
            <View key={fileId}>
              <TouchableOpacity
                style={[styles.fileHeader, { borderBottomColor: colors.border }]}
                onPress={() => toggleFile(fileId)}
                activeOpacity={0.7}
              >
                <Feather name={isExpanded ? "chevron-down" : "chevron-right"} size={12} color={colors.mutedText} />
                <Feather name="file" size={13} color={colors.accent} />
                <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{fileName}</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.accent + "22" }]}>
                  <Text style={[styles.countText, { color: colors.accent }]}>{fileResults.length}</Text>
                </View>
              </TouchableOpacity>
              {isExpanded && fileResults.slice(0, 20).map((result, i) => {
                const { before, match, after } = highlightMatch(result.lineContent.trim(), result.matchStart, result.matchEnd);
                return (
                  <TouchableOpacity
                    key={`${fileId}-${i}`}
                    style={[styles.resultRow, { borderBottomColor: colors.border + "44" }]}
                    onPress={() => handleResultPress(result)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.lineNum, { color: colors.mutedText }]}>{result.lineNumber}</Text>
                    <Text style={styles.lineContent} numberOfLines={1}>
                      <Text style={{ color: colors.mutedText, fontFamily: "monospace", fontSize: 12 }}>{before}</Text>
                      <Text style={{ color: colors.warning, fontFamily: "monospace", fontSize: 12, backgroundColor: colors.warning + "33" }}>{match}</Text>
                      <Text style={{ color: colors.mutedText, fontFamily: "monospace", fontSize: 12 }}>{after}</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {isExpanded && fileResults.length > 20 && (
                <Text style={[styles.moreText, { color: colors.mutedText }]}>+{fileResults.length - 20} more results</Text>
              )}
            </View>
          );
        })}
        {!currentProject && (
          <View style={styles.empty}>
            <Feather name="folder" size={32} color={colors.mutedText} />
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>Open a project to search</Text>
          </View>
        )}
        {currentProject && query.length === 0 && (
          <View style={styles.empty}>
            <Feather name="search" size={32} color={colors.mutedText} />
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>Type to search in project</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedText }]}>Searches across all {currentProject.files.length} files</Text>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, flex: 1 },
  replaceToggle: { padding: 4, borderRadius: 4 },
  searchArea: { padding: 10 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, borderWidth: 1 },
  textInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  optionRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  optBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  optBtnText: { fontSize: 11, fontFamily: "monospace" },
  replaceAllBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, marginLeft: "auto" },
  replaceAllText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stats: { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1 },
  statsText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  fileHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1 },
  fileName: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  countBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 10 },
  countText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 5, borderBottomWidth: 1 },
  lineNum: { fontSize: 11, fontFamily: "monospace", width: 28, textAlign: "right" },
  lineContent: { flex: 1 },
  moreText: { fontSize: 11, fontFamily: "Inter_400Regular", paddingHorizontal: 14, paddingVertical: 6 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
