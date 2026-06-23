import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useIDE } from "@/context/IDEContext";

interface Props { onBack: () => void; }

const JUNK_PATTERNS = [
  /^\s*(\/\/|#)\s*(test|temp|debug|yafa|todo|fixme|hack|xxx|wtf|shit|crap|remove|delete\s+this|cleanup|old|deprecated|useless|garbage|junk|dummy|placeholder|stub|sample)\s*$/i,
  /^\s*(\/\/|#)\s*(console\.log\(|print\(|debug\()/i,
];

export default function CladPlugin({ onBack }: Props) {
  const { colors, currentProject, openFiles, updateFileContent } = useIDE();
  const [scanning, setScanning] = useState(false);
  const [issues, setIssues] = useState<{fileId:string;fileName:string;line:number;content:string;type:string}[]>([]);
  const [cleaned, setCleaned] = useState(false);
  const waveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(waveAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(waveAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);

  const handleScan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScanning(true);
    setCleaned(false);
    await new Promise(r => setTimeout(r, 600));
    const found: typeof issues = [];
    const files = currentProject?.files ?? [];
    for (const file of files) {
      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (JUNK_PATTERNS.some(p => p.test(lines[i]))) {
          found.push({ fileId:file.id, fileName:file.name, line:i+1, content:lines[i].trim(), type:"Junk comment" });
        }
      }
    }
    const blankFiles = files.filter(f => (f.content.match(/\n{3,}/g)?.length ?? 0) > 1);
    for (const f of blankFiles) found.push({ fileId:f.id, fileName:f.name, line:0, content:"Multiple extra blank lines", type:"Whitespace" });
    setIssues(found);
    setScanning(false);
  };

  const handleClean = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const files = currentProject?.files ?? [];
    for (const file of files) {
      const lines = file.content.split("\n");
      const cleaned: string[] = [];
      let blanks = 0;
      for (const line of lines) {
        if (JUNK_PATTERNS.some(p => p.test(line))) continue;
        if (line.trim() === "") { blanks++; if (blanks <= 1) cleaned.push(line); }
        else { blanks = 0; cleaned.push(line); }
      }
      updateFileContent(file.id, cleaned.join("\n"));
    }
    setIssues([]);
    setCleaned(true);
  };

  const waveTranslate = waveAnim.interpolate({ inputRange:[0,1], outputRange:[-4,4] });

  return (
    <View style={[s.container, { backgroundColor: colors.sidebar }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Feather name="arrow-left" size={18} color={colors.accent}/></TouchableOpacity>
        <Animated.View style={{ transform:[{translateX:waveTranslate}] }}><Feather name="zap" size={14} color={colors.accentPurple}/></Animated.View>
        <Text style={[s.title, { color: colors.mutedText }]}>CLAD CODE CLEANER</Text>
      </View>

      <ScrollView style={{flex:1}} contentContainerStyle={{padding:16,gap:16}}>
        <Animated.View style={[s.heroCard, { backgroundColor:colors.accentPurple+"15", borderColor:colors.accentPurple+"44", transform:[{scale:pulseAnim}] }]}>
          <Feather name="zap" size={32} color={colors.accentPurple}/>
          <Text style={[s.heroTitle, { color:colors.text }]}>Clad Code Cleaner</Text>
          <Text style={[s.heroSub, { color:colors.mutedText }]}>Remove junk comments, debug lines, and extra whitespace from your codebase automatically with a wave animation effect.</Text>
          <View style={[s.tagRow]}>
            {["Junk Comments","Debug Lines","Extra Blanks","Auto-Fix"].map(tag=>(
              <View key={tag} style={[s.tag, {backgroundColor:colors.accentPurple+"22"}]}>
                <Text style={[s.tagTxt, {color:colors.accentPurple}]}>{tag}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <TouchableOpacity style={[s.scanBtn, {backgroundColor:scanning?colors.muted:colors.accentPurple}]} onPress={handleScan} disabled={scanning}>
          <Feather name={scanning?"loader":"search"} size={16} color={scanning?colors.mutedText:"#fff"}/>
          <Text style={[s.scanBtnTxt, {color:scanning?colors.mutedText:"#fff"}]}>{scanning?"Scanning...":"Scan Codebase"}</Text>
        </TouchableOpacity>

        {issues.length > 0 && !cleaned && (
          <>
            <View style={[s.issueHeader]}>
              <Feather name="alert-triangle" size={14} color={colors.warning}/>
              <Text style={[s.issueCount, {color:colors.warning}]}>{issues.length} issue{issues.length!==1?"s":""} found</Text>
              <TouchableOpacity style={[s.cleanBtn, {backgroundColor:colors.accentPurple}]} onPress={handleClean}>
                <Feather name="zap" size={13} color="#fff"/>
                <Text style={s.cleanBtnTxt}>Fix All</Text>
              </TouchableOpacity>
            </View>
            {issues.map((issue,i) => (
              <View key={i} style={[s.issueCard, {backgroundColor:colors.card??colors.muted, borderColor:colors.border}]}>
                <View style={[s.issueIcon, {backgroundColor:colors.warning+"22"}]}><Feather name="alert-triangle" size={14} color={colors.warning}/></View>
                <View style={{flex:1}}>
                  <View style={s.issueTop}>
                    <Text style={[s.issueName, {color:colors.text}]}>{issue.fileName}</Text>
                    {issue.line > 0 && <Text style={[s.issueLine, {color:colors.mutedText}]}>line {issue.line}</Text>}
                    <View style={[s.issueTypeBadge, {backgroundColor:colors.warning+"22"}]}><Text style={[s.issueTypeText, {color:colors.warning}]}>{issue.type}</Text></View>
                  </View>
                  <Text style={[s.issueContent, {color:colors.mutedText}]} numberOfLines={2}>{issue.content}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {issues.length === 0 && !scanning && !cleaned && (
          <View style={s.empty}>
            <Feather name="check-circle" size={32} color={colors.mutedText}/>
            <Text style={[s.emptyTxt, {color:colors.mutedText}]}>Scan to find junk code</Text>
          </View>
        )}

        {cleaned && (
          <View style={[s.successCard, {backgroundColor:colors.success+"15", borderColor:colors.success+"44"}]}>
            <Feather name="check-circle" size={28} color={colors.success}/>
            <Text style={[s.successTxt, {color:colors.success}]}>Code cleaned successfully!</Text>
            <Text style={[s.successSub, {color:colors.mutedText}]}>All junk comments and extra whitespace removed.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:{flex:1}, header:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:12,paddingVertical:10,borderBottomWidth:1},
  backBtn:{padding:4}, title:{fontSize:11,fontFamily:"Inter_600SemiBold",letterSpacing:1,flex:1},
  heroCard:{borderRadius:12,borderWidth:1,padding:16,alignItems:"center",gap:8},
  heroTitle:{fontSize:18,fontFamily:"Inter_700Bold"},
  heroSub:{fontSize:12,fontFamily:"Inter_400Regular",textAlign:"center",lineHeight:18},
  tagRow:{flexDirection:"row",flexWrap:"wrap",gap:6,justifyContent:"center",marginTop:4},
  tag:{paddingHorizontal:8,paddingVertical:3,borderRadius:12},
  tagTxt:{fontSize:10,fontFamily:"Inter_500Medium"},
  scanBtn:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,paddingVertical:13,borderRadius:10},
  scanBtnTxt:{fontSize:15,fontFamily:"Inter_600SemiBold",color:"#fff"},
  issueHeader:{flexDirection:"row",alignItems:"center",gap:8},
  issueCount:{flex:1,fontSize:13,fontFamily:"Inter_600SemiBold"},
  cleanBtn:{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:10,paddingVertical:6,borderRadius:8},
  cleanBtnTxt:{color:"#fff",fontSize:12,fontFamily:"Inter_600SemiBold"},
  issueCard:{flexDirection:"row",alignItems:"flex-start",gap:10,borderRadius:10,borderWidth:1,padding:10},
  issueIcon:{width:30,height:30,borderRadius:6,alignItems:"center",justifyContent:"center"},
  issueTop:{flexDirection:"row",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3},
  issueName:{fontSize:12,fontFamily:"Inter_600SemiBold"},
  issueLine:{fontSize:11,fontFamily:"monospace"},
  issueTypeBadge:{paddingHorizontal:5,paddingVertical:2,borderRadius:4},
  issueTypeText:{fontSize:10,fontFamily:"Inter_500Medium"},
  issueContent:{fontSize:11,fontFamily:"monospace"},
  empty:{alignItems:"center",paddingTop:32,gap:10},
  emptyTxt:{fontSize:14,fontFamily:"Inter_500Medium"},
  successCard:{borderRadius:12,borderWidth:1,padding:20,alignItems:"center",gap:8},
  successTxt:{fontSize:16,fontFamily:"Inter_700Bold"},
  successSub:{fontSize:12,fontFamily:"Inter_400Regular"},
});
