import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useIDE } from "@/context/IDEContext";

interface Props { onBack: () => void; }

export default function FilesHistoryPlugin({ onBack }: Props) {
  const { colors, projects, deleteProject, renameProject, openProject } = useIDE();
  const [renaming, setRenaming] = useState<string|null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [query, setQuery] = useState("");

  const filtered = (projects ?? []).filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={[s.container, { backgroundColor: colors.sidebar }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Feather name="arrow-left" size={18} color={colors.accent}/></TouchableOpacity>
        <Feather name="clock" size={14} color={colors.mutedText}/>
        <Text style={[s.title, { color: colors.mutedText }]}>FILES HISTORY</Text>
      </View>
      <View style={[s.searchRow, { backgroundColor: colors.input ?? colors.muted, borderColor: colors.border }]}>
        <Feather name="search" size={13} color={colors.mutedText}/>
        <TextInput style={[s.searchInput, { color: colors.text }]} placeholder="Search projects..." placeholderTextColor={colors.mutedText} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false}/>
        {query.length > 0 && <TouchableOpacity onPress={() => setQuery("")}><Feather name="x" size={13} color={colors.mutedText}/></TouchableOpacity>}
      </View>
      {filtered.length === 0 ? (
        <View style={s.empty}><Feather name="folder" size={32} color={colors.mutedText}/><Text style={[s.emptyText, { color: colors.mutedText }]}>No saved projects</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {renaming === item.id ? (
                <View style={s.renameRow}>
                  <TextInput style={[s.renameInput, { color: colors.text, borderColor: colors.accent, backgroundColor: colors.input }]} value={renameVal} onChangeText={setRenameVal} autoFocus onSubmitEditing={() => { renameProject(item.id, renameVal); setRenaming(null); }} returnKeyType="done"/>
                  <TouchableOpacity onPress={() => { renameProject(item.id, renameVal); setRenaming(null); }}><Feather name="check" size={16} color={colors.success}/></TouchableOpacity>
                  <TouchableOpacity onPress={() => setRenaming(null)}><Feather name="x" size={16} color={colors.mutedText}/></TouchableOpacity>
                </View>
              ) : (
                <View style={s.cardBody}>
                  <View style={[s.iconBox, { backgroundColor: colors.accent + "22" }]}><Feather name="folder" size={20} color={colors.accent}/></View>
                  <TouchableOpacity style={s.nameArea} onPress={() => { Haptics.selectionAsync(); openProject(item); }}>
                    <Text style={[s.projName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[s.projMeta, { color: colors.mutedText }]}>{item.files.length} file{item.files.length !== 1 ? "s" : ""} · {item.language}</Text>
                  </TouchableOpacity>
                  <View style={s.actions}>
                    <TouchableOpacity style={s.actionBtn} onPress={() => { setRenaming(item.id); setRenameVal(item.name); }}>
                      <Feather name="edit-2" size={14} color={colors.accent}/>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => Alert.alert("Delete Project", `Delete "${item.name}"?`, [{ text:"Cancel",style:"cancel"},{text:"Delete",style:"destructive",onPress:()=>deleteProject(item.id)}])}>
                      <Feather name="trash-2" size={14} color={colors.error ?? colors.destructive}/>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:{flex:1}, header:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:12,paddingVertical:10,borderBottomWidth:1},
  backBtn:{padding:4}, title:{fontSize:11,fontFamily:"Inter_600SemiBold",letterSpacing:1,flex:1},
  searchRow:{flexDirection:"row",alignItems:"center",gap:8,marginHorizontal:10,marginVertical:8,paddingHorizontal:10,paddingVertical:7,borderRadius:8,borderWidth:1},
  searchInput:{flex:1,fontSize:13,fontFamily:"Inter_400Regular",padding:0},
  empty:{alignItems:"center",justifyContent:"center",paddingTop:60,gap:10},
  emptyText:{fontSize:14,fontFamily:"Inter_500Medium"},
  card:{marginHorizontal:10,marginVertical:4,borderRadius:10,borderWidth:1,overflow:"hidden"},
  cardBody:{flexDirection:"row",alignItems:"center",padding:12,gap:10},
  iconBox:{width:40,height:40,borderRadius:8,alignItems:"center",justifyContent:"center"},
  nameArea:{flex:1},
  projName:{fontSize:14,fontFamily:"Inter_600SemiBold"},
  projMeta:{fontSize:11,fontFamily:"Inter_400Regular",marginTop:2},
  actions:{flexDirection:"row",gap:4},
  actionBtn:{padding:7,borderRadius:6},
  renameRow:{flexDirection:"row",alignItems:"center",gap:8,padding:10},
  renameInput:{flex:1,fontSize:13,fontFamily:"Inter_400Regular",paddingHorizontal:8,paddingVertical:6,borderWidth:1,borderRadius:6},
});
