import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useIDE } from "@/context/IDEContext";
import FilesHistoryPlugin from "./FilesHistoryPlugin";
import CladPlugin from "./CladPlugin";

interface Plugin {
  id: string; name: string; description: string; icon: string; iconColor: string;
  category: string; author: string; version: string; installed: boolean;
  enabled: boolean; rating: number; downloads: string; size: string; tags: string[];
}

const ALL_PLUGINS: Plugin[] = [
  { id:"files-history", name:"Files History", description:"View, rename and delete all your saved projects in one place.", icon:"clock", iconColor:"#58a6ff", category:"Productivity", author:"KIU Studio", version:"1.0.0", installed:true, enabled:true, rating:4.8, downloads:"10K", size:"12KB", tags:["files","history","projects"] },
  { id:"clad", name:"Clad Code Cleaner", description:"Auto-remove junk comments and blank spaces with wave animation.", icon:"zap", iconColor:"#a78bfa", category:"Code Tools", author:"KIU Studio", version:"1.2.0", installed:true, enabled:true, rating:4.9, downloads:"8K", size:"8KB", tags:["clean","comments","format"] },
  { id:"prettier", name:"Prettier", description:"Format your code automatically on save. Supports JS, TS, Python and more.", icon:"align-left", iconColor:"#f59e0b", category:"Formatter", author:"Community", version:"0.9.1", installed:false, enabled:false, rating:4.7, downloads:"50K", size:"45KB", tags:["format","prettier","beautify"] },
  { id:"snippets", name:"Code Snippets", description:"Quickly insert common code patterns with a single tap.", icon:"copy", iconColor:"#34d399", category:"Productivity", author:"Community", version:"1.1.0", installed:false, enabled:false, rating:4.5, downloads:"20K", size:"18KB", tags:["snippets","templates","productivity"] },
  { id:"git-lens", name:"Git Lens", description:"See who changed what and when. Inline blame, history & diff view.", icon:"git-commit", iconColor:"#f97316", category:"Version Control", author:"Community", version:"0.7.0", installed:false, enabled:false, rating:4.6, downloads:"15K", size:"32KB", tags:["git","blame","history"] },
  { id:"bracket-pair", name:"Bracket Pair Colorizer", description:"Colorize matching brackets for better readability.", icon:"code", iconColor:"#60a5fa", category:"Editor", author:"Community", version:"2.0.0", installed:true, enabled:true, rating:4.8, downloads:"80K", size:"6KB", tags:["brackets","colors","editor"] },
  { id:"indent-rainbow", name:"Indent Rainbow", description:"Makes indentation visible with color-coded levels.", icon:"menu", iconColor:"#818cf8", category:"Editor", author:"Community", version:"1.3.0", installed:false, enabled:false, rating:4.4, downloads:"30K", size:"5KB", tags:["indent","color","visual"] },
  { id:"todo-tree", name:"Todo Tree", description:"Highlight and list TODO, FIXME and other comment tags.", icon:"list", iconColor:"#fb923c", category:"Productivity", author:"Community", version:"0.8.0", installed:false, enabled:false, rating:4.5, downloads:"25K", size:"14KB", tags:["todo","fixme","tasks"] },
  { id:"path-intellisense", name:"Path IntelliSense", description:"Auto-completes file paths in your code.", icon:"link", iconColor:"#4ade80", category:"IntelliSense", author:"Community", version:"1.0.0", installed:false, enabled:false, rating:4.6, downloads:"40K", size:"10KB", tags:["path","autocomplete","intellisense"] },
  { id:"error-lens", name:"Error Lens", description:"Inline error and warning messages in the editor.", icon:"alert-triangle", iconColor:"#f87171", category:"Diagnostics", author:"Community", version:"1.5.0", installed:false, enabled:false, rating:4.7, downloads:"35K", size:"9KB", tags:["errors","warnings","diagnostics"] },
  { id:"theme-ocean", name:"Ocean Theme", description:"A relaxing deep-ocean color theme.", icon:"droplet", iconColor:"#38bdf8", category:"Themes", author:"Community", version:"1.0.0", installed:false, enabled:false, rating:4.3, downloads:"12K", size:"4KB", tags:["theme","ocean","blue"] },
  { id:"live-share", name:"Code Share", description:"Share your code session with a URL link.", icon:"share-2", iconColor:"#c084fc", category:"Collaboration", author:"Community", version:"0.5.0", installed:false, enabled:false, rating:4.0, downloads:"5K", size:"22KB", tags:["share","collaboration","link"] },
];

const CATEGORIES = ["All", "Productivity", "Code Tools", "Formatter", "Editor", "IntelliSense", "Diagnostics", "Version Control", "Themes", "Collaboration"];

type ViewType = "list"|"detail"|"files-history"|"clad";

export default function PluginPanel() {
  const { colors } = useIDE();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewType>("list");
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin|null>(null);
  const [plugins, setPlugins] = useState<Plugin[]>(ALL_PLUGINS);
  const [category, setCategory] = useState("All");
  const [tab, setTab] = useState<"all"|"installed">("all");

  if (view==="files-history") return <FilesHistoryPlugin onBack={()=>setView("list")}/>;
  if (view==="clad") return <CladPlugin onBack={()=>setView("list")}/>;

  const filtered = plugins.filter(p=>{
    const matchQuery = p.name.toLowerCase().includes(query.toLowerCase()) || p.description.toLowerCase().includes(query.toLowerCase()) || p.tags.some(t=>t.includes(query.toLowerCase()));
    const matchCat = category==="All" || p.category===category;
    const matchTab = tab==="all" || p.installed;
    return matchQuery && matchCat && matchTab;
  });

  const handleInstall = (plugin: Plugin) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPlugins(prev=>prev.map(p=>p.id===plugin.id?{...p,installed:true,enabled:true}:p));
    Alert.alert("Installed", `${plugin.name} v${plugin.version} installed successfully.`);
  };

  const handleToggle = (plugin: Plugin) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlugins(prev=>prev.map(p=>p.id===plugin.id?{...p,enabled:!p.enabled}:p));
  };

  const handleUninstall = (plugin: Plugin) => {
    Alert.alert("Uninstall", `Remove ${plugin.name}?`, [
      {text:"Cancel",style:"cancel"},
      {text:"Uninstall",style:"destructive",onPress:()=>{setPlugins(prev=>prev.map(p=>p.id===plugin.id?{...p,installed:false,enabled:false}:p));setView("list");}},
    ]);
  };

  const handleOpen = (plugin: Plugin) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (plugin.id==="files-history") { setView("files-history"); return; }
    if (plugin.id==="clad") { setView("clad"); return; }
    setSelectedPlugin(plugin);
    setView("detail");
  };

  if (view==="detail"&&selectedPlugin) {
    const p = plugins.find(pl=>pl.id===selectedPlugin.id)??selectedPlugin;
    return (
      <View style={[st.container,{backgroundColor:colors.sidebar}]}>
        <View style={[st.header,{borderBottomColor:colors.border}]}>
          <TouchableOpacity onPress={()=>setView("list")} style={st.backBtn}>
            <Feather name="arrow-left" size={18} color={colors.accent}/>
          </TouchableOpacity>
          <Text style={[st.headerTitle,{color:colors.text}]} numberOfLines={1}>{p.name}</Text>
        </View>
        <ScrollView style={{flex:1}} showsVerticalScrollIndicator={false}>
          <View style={[st.detailCard,{backgroundColor:colors.card,borderColor:colors.border}]}>
            <View style={[st.detailIcon,{backgroundColor:p.iconColor+"22"}]}>
              <Feather name={p.icon as any} size={36} color={p.iconColor}/>
            </View>
            <Text style={[st.detailName,{color:colors.text}]}>{p.name}</Text>
            <Text style={[st.detailAuthor,{color:colors.mutedText}]}>by {p.author} · v{p.version}</Text>
            <View style={st.detailMeta}>
              {[["⭐",p.rating.toString()],["↓",p.downloads],["💾",p.size]].map(([icon,val])=>(
                <View key={icon} style={[st.metaItem,{backgroundColor:colors.muted}]}>
                  <Text style={[st.metaText,{color:colors.mutedText}]}>{icon} {val}</Text>
                </View>
              ))}
            </View>
            <Text style={[st.detailDesc,{color:colors.text}]}>{p.description}</Text>
            <View style={st.tagRow}>
              {p.tags.map(tag=>(
                <View key={tag} style={[st.tag,{backgroundColor:colors.accent+"22"}]}>
                  <Text style={[st.tagText,{color:colors.accent}]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={st.actionRow}>
            {!p.installed ? (
              <TouchableOpacity style={[st.actionBtn,{backgroundColor:colors.accent}]} onPress={()=>handleInstall(p)}>
                <Feather name="download" size={16} color="#fff"/>
                <Text style={st.actionBtnText}>Install</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={[st.actionBtn,{backgroundColor:p.enabled?colors.success:colors.muted}]} onPress={()=>handleToggle(p)}>
                  <Feather name={p.enabled?"toggle-right":"toggle-left"} size={16} color={p.enabled?"#fff":colors.mutedText}/>
                  <Text style={[st.actionBtnText,{color:p.enabled?"#fff":colors.mutedText}]}>{p.enabled?"Enabled":"Disabled"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.actionBtn,{backgroundColor:colors.error+"22",borderWidth:1,borderColor:colors.error+"44"}]} onPress={()=>handleUninstall(p)}>
                  <Feather name="trash-2" size={16} color={colors.error}/>
                  <Text style={[st.actionBtnText,{color:colors.error}]}>Uninstall</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={{height:32}}/>
        </ScrollView>
      </View>
    );
  }

  const installed = plugins.filter(p=>p.installed).length;

  return (
    <View style={[st.container,{backgroundColor:colors.sidebar}]}>
      <View style={[st.header,{borderBottomColor:colors.border}]}>
        <Feather name="package" size={14} color={colors.mutedText}/>
        <Text style={[st.headerTitle,{color:colors.mutedText}]}>PLUGINS</Text>
        <View style={[st.badge,{backgroundColor:colors.accent+"22"}]}>
          <Text style={[st.badgeText,{color:colors.accent}]}>{installed} installed</Text>
        </View>
      </View>

      <View style={[st.searchRow,{backgroundColor:colors.input??colors.muted,borderColor:colors.border}]}>
        <Feather name="search" size={14} color={colors.mutedText}/>
        <TextInput style={[st.searchInput,{color:colors.text}]} placeholder="Search plugins..." placeholderTextColor={colors.mutedText} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false}/>
        {query.length>0&&<TouchableOpacity onPress={()=>setQuery("")}><Feather name="x" size={14} color={colors.mutedText}/></TouchableOpacity>}
      </View>

      <View style={st.tabRow}>
        {(["all","installed"] as const).map(t=>(
          <TouchableOpacity key={t} style={[st.tabBtn,tab===t&&{borderBottomColor:colors.accent,borderBottomWidth:2}]} onPress={()=>setTab(t)}>
            <Text style={[st.tabText,{color:tab===t?colors.accent:colors.mutedText}]}>{t==="all"?"Marketplace":"Installed"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.catBar} contentContainerStyle={{paddingHorizontal:10,gap:6}}>
        {CATEGORIES.map(cat=>(
          <TouchableOpacity key={cat} style={[st.catChip,{backgroundColor:category===cat?colors.accent:colors.muted,borderColor:category===cat?colors.accent:colors.border}]} onPress={()=>setCategory(cat)}>
            <Text style={[st.catText,{color:category===cat?"#fff":colors.mutedText}]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[st.statsLabel,{color:colors.mutedText}]}>{filtered.length} plugin{filtered.length!==1?"s":""}</Text>

      <FlatList data={filtered} keyExtractor={item=>item.id} contentContainerStyle={{paddingBottom:16}}
        renderItem={({item})=>(
          <TouchableOpacity style={[st.card,{backgroundColor:colors.card??colors.muted,borderColor:colors.border}]} onPress={()=>handleOpen(item)} activeOpacity={0.75}>
            <View style={[st.iconBox,{backgroundColor:item.iconColor+"22"}]}>
              <Feather name={item.icon as any} size={22} color={item.iconColor}/>
            </View>
            <View style={st.info}>
              <View style={st.nameRow}>
                <Text style={[st.pluginName,{color:colors.text}]}>{item.name}</Text>
                <View style={[st.catBadge,{backgroundColor:colors.accent+"22"}]}>
                  <Text style={[st.badgeTxt,{color:colors.accent}]}>{item.category}</Text>
                </View>
              </View>
              <Text style={[st.desc,{color:colors.mutedText}]} numberOfLines={2}>{item.description}</Text>
              <View style={st.metaRow}>
                <Text style={[st.meta,{color:colors.mutedText}]}>⭐ {item.rating} · ↓ {item.downloads} · by {item.author}</Text>
                {item.installed&&(
                  <View style={[st.installedTag,{backgroundColor:item.enabled?colors.success+"22":colors.muted}]}>
                    <Text style={[st.installedText,{color:item.enabled?colors.success:colors.mutedText}]}>{item.enabled?"● Active":"○ Disabled"}</Text>
                  </View>
                )}
              </View>
            </View>
            {!item.installed?(
              <TouchableOpacity style={[st.installBtn,{backgroundColor:colors.accent}]} onPress={()=>handleInstall(item)}>
                <Feather name="download" size={12} color="#fff"/>
              </TouchableOpacity>
            ):(
              <Feather name="chevron-right" size={16} color={colors.mutedText}/>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container:{flex:1},
  header:{flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:12,paddingVertical:10,borderBottomWidth:1},
  headerTitle:{fontSize:11,fontFamily:"Inter_600SemiBold",letterSpacing:1,flex:1},
  backBtn:{padding:4},
  badge:{paddingHorizontal:6,paddingVertical:2,borderRadius:10},
  badgeText:{fontSize:10,fontFamily:"Inter_600SemiBold"},
  searchRow:{flexDirection:"row",alignItems:"center",gap:8,marginHorizontal:10,marginVertical:8,paddingHorizontal:10,paddingVertical:8,borderRadius:8,borderWidth:1},
  searchInput:{flex:1,fontSize:13,fontFamily:"Inter_400Regular",padding:0},
  tabRow:{flexDirection:"row",borderBottomWidth:1,borderBottomColor:"#ffffff11",marginHorizontal:10},
  tabBtn:{flex:1,alignItems:"center",paddingVertical:8},
  tabText:{fontSize:12,fontFamily:"Inter_500Medium"},
  catBar:{maxHeight:44,marginVertical:6},
  catChip:{paddingHorizontal:10,paddingVertical:5,borderRadius:20,borderWidth:1},
  catText:{fontSize:11,fontFamily:"Inter_500Medium"},
  statsLabel:{fontSize:11,fontFamily:"Inter_400Regular",paddingHorizontal:12,marginBottom:4},
  card:{flexDirection:"row",alignItems:"center",marginHorizontal:10,marginVertical:4,padding:12,borderRadius:10,borderWidth:1,gap:10},
  iconBox:{width:44,height:44,borderRadius:10,alignItems:"center",justifyContent:"center"},
  info:{flex:1,gap:3},
  nameRow:{flexDirection:"row",alignItems:"center",gap:6},
  pluginName:{fontSize:14,fontFamily:"Inter_700Bold"},
  catBadge:{paddingHorizontal:6,paddingVertical:2,borderRadius:6},
  badgeTxt:{fontSize:10,fontFamily:"Inter_600SemiBold"},
  desc:{fontSize:12,fontFamily:"Inter_400Regular",lineHeight:17},
  metaRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  meta:{fontSize:10,fontFamily:"Inter_400Regular"},
  installedTag:{paddingHorizontal:6,paddingVertical:2,borderRadius:4},
  installedText:{fontSize:10,fontFamily:"Inter_600SemiBold"},
  installBtn:{width:28,height:28,borderRadius:6,alignItems:"center",justifyContent:"center"},
  detailCard:{margin:12,borderRadius:12,borderWidth:1,padding:16,alignItems:"center",gap:8},
  detailIcon:{width:80,height:80,borderRadius:20,alignItems:"center",justifyContent:"center",marginBottom:4},
  detailName:{fontSize:20,fontFamily:"Inter_700Bold"},
  detailAuthor:{fontSize:12,fontFamily:"Inter_400Regular"},
  detailMeta:{flexDirection:"row",gap:8,marginTop:4},
  metaItem:{paddingHorizontal:8,paddingVertical:4,borderRadius:6},
  metaText:{fontSize:11,fontFamily:"Inter_400Regular"},
  detailDesc:{fontSize:13,fontFamily:"Inter_400Regular",textAlign:"center",lineHeight:20,marginTop:8},
  tagRow:{flexDirection:"row",flexWrap:"wrap",gap:6,justifyContent:"center",marginTop:4},
  tag:{paddingHorizontal:8,paddingVertical:3,borderRadius:12},
  tagText:{fontSize:11,fontFamily:"Inter_500Medium"},
  actionRow:{flexDirection:"row",gap:10,marginHorizontal:12,flexWrap:"wrap"},
  actionBtn:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,paddingVertical:12,borderRadius:10,minWidth:120},
  actionBtnText:{fontSize:14,fontFamily:"Inter_600SemiBold",color:"#fff"},
});
