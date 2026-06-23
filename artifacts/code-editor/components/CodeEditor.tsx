import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert, FlatList, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { type SupportedLanguage, useIDE } from "@/context/IDEContext";

type TT = "keyword"|"string"|"comment"|"number"|"func"|"type"|"operator"|"variable"|"default";
interface Token { text: string; type: TT; }

const KEYWORDS: Record<string, Set<string>> = {
  python: new Set(["def","class","import","from","return","if","elif","else","for","while","in","not","and","or","True","False","None","try","except","finally","with","as","lambda","pass","break","continue","yield","async","await","global","nonlocal","del","raise","assert","is","print","len","range","int","str","float","list","dict","tuple","set","bool","type","super","self","__init__"]),
  javascript: new Set(["function","const","let","var","return","if","else","for","while","in","of","import","export","default","class","extends","new","this","typeof","instanceof","try","catch","finally","throw","async","await","true","false","null","undefined","void","delete","switch","case","break","continue","yield","from","static","get","set","console","Promise","Array","Object","String","Number","Boolean","Math","JSON","Error"]),
  java: new Set(["public","private","protected","class","interface","extends","implements","new","return","if","else","for","while","do","switch","case","break","continue","void","int","long","double","float","boolean","String","null","true","false","static","final","abstract","try","catch","finally","throw","throws","import","package","this","super","instanceof"]),
  rust: new Set(["fn","let","mut","pub","use","mod","struct","enum","impl","trait","type","where","if","else","for","while","loop","match","return","true","false","None","Some","Ok","Err","Vec","String","bool","i32","i64","u32","u64","f32","f64","usize","async","await","move","ref","Box","Arc","Rc"]),
  go: new Set(["func","var","const","type","package","import","return","if","else","for","range","switch","case","break","continue","struct","interface","map","chan","go","select","defer","fallthrough","true","false","nil","make","new","len","cap","append","delete","copy","print","println","error","string","int","bool","byte","rune"]),
  cpp: new Set(["int","long","double","float","char","bool","void","auto","const","static","return","if","else","for","while","do","switch","case","break","continue","class","struct","namespace","using","include","new","delete","public","private","protected","virtual","override","nullptr","true","false","try","catch","throw","template","typename"]),
  bash: new Set(["if","then","else","elif","fi","for","while","do","done","case","in","esac","function","return","exit","echo","read","export","local","source","alias","unset","readonly"]),
};
KEYWORDS.typescript = KEYWORDS.javascript;
KEYWORDS.jsx = KEYWORDS.javascript;
KEYWORDS.tsx = KEYWORDS.typescript;

const JUNK_PATTERNS = [
  /^\s*#\s*(test|temp|debug|yafa|todo|fixme|hack|xxx|wtf|shit|crap|remove|delete\s+this|cleanup|old|deprecated|useless|garbage|junk|dummy|placeholder|stub|sample)\s*$/i,
  /^\s*(\/\/|#)\s*(test|temp|debug|yafa|tmp)\s*$/i,
  /^\s*\/\/\s*(console\.log\(|print\(|debug\()/i,
];

function detectJunk(content: string): boolean {
  const lines = content.split("\n");
  for (const line of lines) {
    if (JUNK_PATTERNS.some(p => p.test(line))) return true;
  }
  const blankRuns = content.match(/\n{3,}/g);
  if (blankRuns && blankRuns.length > 2) return true;
  return false;
}

function cleanCode(content: string): string {
  const lines = content.split("\n");
  const cleaned: string[] = [];
  let blankCount = 0;
  for (const line of lines) {
    const isJunk = JUNK_PATTERNS.some(p => p.test(line));
    if (isJunk) continue;
    const isBlank = line.trim() === "";
    if (isBlank) {
      blankCount++;
      if (blankCount <= 1) cleaned.push(line);
    } else {
      blankCount = 0;
      cleaned.push(line);
    }
  }
  return cleaned.join("\n");
}

function tokenizeLine(line: string, lang: SupportedLanguage): Token[] {
  const tokens: Token[] = [];
  const kws = KEYWORDS[lang] ?? new Set();
  let i = 0;
  while (i < line.length) {
    if ((lang==="python"||lang==="bash") && line[i]==="#") { tokens.push({text:line.slice(i),type:"comment"}); break; }
    if ((lang==="javascript"||lang==="typescript")&&line[i]==="/"&&line[i+1]==="/") { tokens.push({text:line.slice(i),type:"comment"}); break; }
    if (lang==="css"&&line[i]==="/"&&line[i+1]==="*") { const end=line.indexOf("*/",i+2); const endIdx=end>=0?end+2:line.length; tokens.push({text:line.slice(i,endIdx),type:"comment"}); i=endIdx; continue; }
    if (line[i]==='"'||line[i]==="'"||line[i]==="`") { const q=line[i]; let j=i+1; while(j<line.length&&line[j]!==q){if(line[j]==="\\")j++;j++;} tokens.push({text:line.slice(i,Math.min(j+1,line.length)),type:"string"}); i=Math.min(j+1,line.length); continue; }
    if (/[0-9]/.test(line[i])) { let j=i; while(j<line.length&&/[0-9._xXbBoO]/.test(line[j]))j++; tokens.push({text:line.slice(i,j),type:"number"}); i=j; continue; }
    if (/[a-zA-Z_$]/.test(line[i])) { let j=i; while(j<line.length&&/[a-zA-Z0-9_$]/.test(line[j]))j++; const word=line.slice(i,j); const after=line.slice(j).trimStart(); let tt:TT; if(kws.has(word))tt="keyword"; else if(after.startsWith("("))tt="func"; else if(/^[A-Z]/.test(word))tt="type"; else tt="default"; tokens.push({text:word,type:tt}); i=j; continue; }
    tokens.push({text:line[i],type:"operator"}); i++;
  }
  return tokens;
}

function tokenColor(t: TT, c: any): string {
  switch(t) { case "keyword":return c.keyword; case "string":return c.string; case "comment":return c.comment; case "number":return c.number; case "func":return c.func; case "type":return c.type; case "operator":return c.operator; case "variable":return c.variable; default:return c.text; }
}

function getCompletions(word: string, lang: SupportedLanguage, content: string): string[] {
  if (word.length < 2) return [];
  const langKws = KEYWORDS[lang] ?? new Set<string>();
  const candidates = new Set<string>([...langKws]);
  (content.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g)??[]).forEach(m=>candidates.add(m));
  const lower = word.toLowerCase();
  return [...candidates].filter(c=>c.toLowerCase().startsWith(lower)&&c!==word).slice(0,6);
}

function EditorTabs() {
  const { openFiles, activeFile, closeFile, setActiveFile, colors, fontSize } = useIDE();
  if (openFiles.length===0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tabsBar,{backgroundColor:colors.tab}]}>
      {openFiles.map(f=>{
        const isActive=activeFile?.id===f.id;
        return (
          <TouchableOpacity key={f.id} style={[s.tab,{backgroundColor:isActive?colors.activeTab:colors.tab,borderBottomColor:isActive?colors.activeTabBorder:"transparent",borderBottomWidth:2}]} onPress={()=>setActiveFile(f.id)}>
            <Text style={[s.tabName,{color:isActive?colors.text:colors.mutedText,fontSize:12}]} numberOfLines={1}>{f.modified?"● ":""}{f.name}</Text>
            <TouchableOpacity onPress={()=>closeFile(f.id)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Feather name="x" size={11} color={isActive?colors.mutedText:"transparent"} />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function Breadcrumb({file}:{file:any}) {
  const {currentProject,colors}=useIDE();
  return (
    <View style={[s.breadcrumb,{backgroundColor:colors.titleBar,borderBottomColor:colors.border}]}>
      <Text style={[s.breadText,{color:colors.mutedText}]}>{currentProject?.name??"no-project"}</Text>
      <Feather name="chevron-right" size={11} color={colors.mutedText}/>
      <Text style={[s.breadText,{color:colors.text}]}>{file.name}</Text>
      <View style={[s.langBadge,{backgroundColor:colors.muted}]}>
        <Text style={[s.langText,{color:colors.mutedText}]}>{file.language}</Text>
      </View>
    </View>
  );
}

const LARGE_FILE_THRESHOLD = 300;

export default function CodeEditor() {
  const { activeFile, colors, fontSize, updateFileContent, saveFile,
    toggleTerminal, lineNumbers, wordWrap, autoComplete, minimap, tabSize } = useIDE();
  const [isEditing, setIsEditing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [cursorWord, setCursorWord] = useState("");
  const [hasJunk, setHasJunk] = useState(false);
  const [savingStatus, setSavingStatus] = useState<"idle"|"saving"|"saved">("idle");
  const [showCleanConfirm, setShowCleanConfirm] = useState(false);
  const [foldedLines, setFoldedLines] = useState<Set<number>>(new Set());
  const [findText, setFindText] = useState("");
  const [showFind, setShowFind] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const flatRef = useRef<FlatList>(null);

  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    setSavingStatus("saving");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise(r => setTimeout(r, 10));
    saveFile(activeFile.id);
    setIsEditing(false);
    setSuggestions([]);
    setSavingStatus("saved");
    setTimeout(() => setSavingStatus("idle"), 1800);
  }, [activeFile, saveFile]);

  const handleTextChange = useCallback((text: string) => {
    if (!activeFile) return;
    updateFileContent(activeFile.id, text);
    setHasJunk(detectJunk(text));
    if (autoComplete) {
      const lines = text.split("\n");
      const lastLine = lines[lines.length-1]??"";
      const wordMatch = lastLine.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
      const word = wordMatch?.[0]??"";
      setCursorWord(word);
      setSuggestions(word.length>=2 ? getCompletions(word, activeFile.language, text) : []);
    }
  }, [activeFile, updateFileContent, autoComplete]);

  const applySuggestion = useCallback((suggestion: string) => {
    if (!activeFile) return;
    const content = activeFile.content;
    const idx = content.lastIndexOf(cursorWord);
    if (idx>=0) updateFileContent(activeFile.id, content.slice(0,idx)+suggestion+content.slice(idx+cursorWord.length));
    setSuggestions([]); setCursorWord("");
  }, [activeFile, cursorWord, updateFileContent]);

  const handleClean = useCallback(() => {
    if (!activeFile) return;
    const cleaned = cleanCode(activeFile.content);
    updateFileContent(activeFile.id, cleaned);
    setHasJunk(false);
    setShowCleanConfirm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Clean Code", "Junk comments and extra blank lines removed.");
  }, [activeFile, updateFileContent]);

  const handleOpenFile = useCallback(() => {
    if (!activeFile) return;
    setIsEditing(false);
    setSuggestions([]);
    setHasJunk(detectJunk(activeFile.content));
  }, [activeFile]);

  React.useEffect(() => {
    if (activeFile) setHasJunk(detectJunk(activeFile.content));
  }, [activeFile?.id]);

  const tokenized = useMemo(() => {
    if (!activeFile) return [];
    const lines = activeFile.content.split("\n");
    return lines.map(line => tokenizeLine(line, activeFile.language));
  }, [activeFile?.content, activeFile?.language]);

  const lineCount = useMemo(()=>(activeFile?.content.split("\n").length??0),[activeFile?.content]);
  const isLargeFile = lineCount > LARGE_FILE_THRESHOLD;

  if (!activeFile) {
    return (
      <View style={[s.container,{backgroundColor:colors.background}]}>
        <EditorTabs />
        <View style={s.welcome}>
          <Text style={[s.welcomeApp,{color:colors.accent}]}>{"{ }"}</Text>
          <Text style={[s.welcomeTitle,{color:colors.text}]}>HackerStudio</Text>
          <Text style={[s.welcomeSub,{color:colors.mutedText}]}>Professional Mobile IDE — v3.0</Text>
          <View style={s.welcomeGrid}>
            {[{icon:"copy",label:"Explorer",hint:"Browse files"},{icon:"cpu",label:"AI Agent",hint:"Ask AI"},{icon:"terminal",label:"Terminal",hint:"Run commands"},{icon:"git-branch",label:"Source Control",hint:"Git"},{icon:"search",label:"Search",hint:"Find in project"},{icon:"package",label:"Plugins",hint:"Marketplace"},].map(item=>(
              <View key={item.label} style={[s.welcomeCard,{backgroundColor:colors.card,borderColor:colors.border}]}>
                <Feather name={item.icon as any} size={18} color={colors.accent}/>
                <Text style={[s.welcomeCardLabel,{color:colors.text}]}>{item.label}</Text>
                <Text style={[s.welcomeCardHint,{color:colors.mutedText}]}>{item.hint}</Text>
              </View>
            ))}
          </View>
          <View style={[s.shortcutBar,{backgroundColor:colors.card,borderColor:colors.border}]}>
            <Text style={[s.shortcutTitle,{color:colors.mutedText}]}>KEYBOARD SHORTCUTS</Text>
            {[["Ctrl+P","Command Palette"],["Ctrl+`","Terminal"],["Ctrl+Shift+F","Find in Project"],["Ctrl+,","Settings"],["Ctrl+B","Toggle Sidebar"]].map(([k,v])=>(
              <View key={k} style={s.shortcutRow}>
                <View style={[s.kbd,{backgroundColor:colors.muted,borderColor:colors.border}]}><Text style={[s.kbdText,{color:colors.text}]}>{k}</Text></View>
                <Text style={[s.kbdDesc,{color:colors.mutedText}]}>{v}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container,{backgroundColor:colors.background}]}>
      <EditorTabs />
      <Breadcrumb file={activeFile}/>

      {/* Toolbar */}
      <View style={[s.toolbar,{backgroundColor:colors.titleBar,borderBottomColor:colors.border}]}>
        <View style={s.toolbarLeft}>
          {isEditing ? (
            <TouchableOpacity style={[s.toolBtn,{backgroundColor:colors.success+"22"}]} onPress={handleSave}>
              <Feather name={savingStatus==="saving"?"loader":"save"} size={13} color={colors.success}/>
              <Text style={[s.toolBtnText,{color:colors.success}]}>{savingStatus==="saving"?"Saving...":savingStatus==="saved"?"Saved!":"Save"}</Text>
            </TouchableOpacity>
          ):(
            <TouchableOpacity style={[s.toolBtn,{backgroundColor:colors.accent+"22"}]} onPress={()=>setIsEditing(true)}>
              <Feather name="edit-2" size={13} color={colors.accent}/>
              <Text style={[s.toolBtnText,{color:colors.accent}]}>Edit</Text>
            </TouchableOpacity>
          )}
          {isEditing&&<TouchableOpacity style={[s.toolBtn]} onPress={()=>{setIsEditing(false);setSuggestions([]);}}>
            <Feather name="x" size={13} color={colors.mutedText}/>
            <Text style={[s.toolBtnText,{color:colors.mutedText}]}>Cancel</Text>
          </TouchableOpacity>}
          {hasJunk&&!isEditing&&(
            <TouchableOpacity style={[s.toolBtn,{backgroundColor:colors.warning+"22",borderWidth:1,borderColor:colors.warning+"44"}]} onPress={()=>setShowCleanConfirm(true)}>
              <Feather name="zap" size={13} color={colors.warning}/>
              <Text style={[s.toolBtnText,{color:colors.warning}]}>Clean Code</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.toolBtn,showFind&&{backgroundColor:colors.accent+"22"}]} onPress={()=>setShowFind(v=>!v)}>
            <Feather name="search" size={13} color={showFind?colors.accent:colors.mutedText}/>
          </TouchableOpacity>
        </View>
        <View style={s.toolbarRight}>
          <TouchableOpacity style={s.toolIcon} onPress={toggleTerminal}>
            <Feather name="terminal" size={15} color={colors.mutedText}/>
          </TouchableOpacity>
          {isEditing&&<Text style={[s.insertBadge,{color:colors.warning}]}>INSERT</Text>}
          {isLargeFile&&<Text style={[s.badge,{color:colors.mutedText,backgroundColor:colors.muted}]}>LARGE</Text>}
        </View>
      </View>

      {/* Find bar */}
      {showFind&&(
        <View style={[s.findBar,{backgroundColor:colors.titleBar,borderBottomColor:colors.border}]}>
          <Feather name="search" size={13} color={colors.mutedText}/>
          <TextInput style={[s.findInput,{color:colors.text}]} value={findText} onChangeText={setFindText} placeholder="Find in file..." placeholderTextColor={colors.mutedText} autoCapitalize="none" autoCorrect={false} autoFocus/>
          {findText.length>0&&<Text style={[s.findCount,{color:colors.mutedText}]}>{(activeFile.content.match(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi"))??[]).length} results</Text>}
          <TouchableOpacity onPress={()=>{setShowFind(false);setFindText("");}}><Feather name="x" size={14} color={colors.mutedText}/></TouchableOpacity>
        </View>
      )}

      {/* Clean Code confirm */}
      {showCleanConfirm&&(
        <View style={[s.cleanBanner,{backgroundColor:colors.warning+"11",borderBottomColor:colors.warning+"33"}]}>
          <Feather name="alert-triangle" size={14} color={colors.warning}/>
          <Text style={[s.cleanText,{color:colors.warning}]}>Junk detected — remove debug comments & extra blanks?</Text>
          <TouchableOpacity style={[s.cleanBtn,{backgroundColor:colors.warning}]} onPress={handleClean}>
            <Text style={s.cleanBtnText}>Clean</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>setShowCleanConfirm(false)}>
            <Feather name="x" size={14} color={colors.warning}/>
          </TouchableOpacity>
        </View>
      )}

      {/* IntelliSense */}
      {isEditing&&suggestions.length>0&&(
        <View style={[s.suggestions,{backgroundColor:colors.suggestionBg,borderColor:colors.suggestionBorder}]}>
          {suggestions.map(s2=>(
            <TouchableOpacity key={s2} style={s.suggestionItem} onPress={()=>applySuggestion(s2)}>
              <Feather name="code" size={11} color={colors.suggestionType}/>
              <Text style={[s.suggestionText,{color:colors.suggestionText}]}>{s2}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Editor body */}
      {isEditing ? (
        <View style={s.editArea}>
          <TextInput
            style={[s.editInput,{color:colors.text,fontSize,backgroundColor:colors.background}]}
            value={activeFile.content}
            onChangeText={handleTextChange}
            multiline autoCorrect={false} autoCapitalize="none" spellCheck={false}
            autoFocus textAlignVertical="top" scrollEnabled
          />
        </View>
      ) : isLargeFile ? (
        <View style={{flex:1,flexDirection:"row"}}>
          <FlatList
            ref={flatRef}
            data={tokenized}
            keyExtractor={(_,i)=>String(i)}
            removeClippedSubviews
            maxToRenderPerBatch={30}
            windowSize={10}
            initialNumToRender={40}
            getItemLayout={(_,index)=>({length:fontSize*1.65,offset:fontSize*1.65*index,index})}
            renderItem={({item:lineTokens,index:i})=>(
              <View style={{flexDirection:"row",minHeight:fontSize*1.65,paddingHorizontal:8}}>
                {lineNumbers&&<Text style={[s.lineNum,{color:findText&&tokenized[i]?.some(t=>t.text.includes(findText))?colors.warning:colors.lineNumber,fontSize:fontSize-2,width:38,textAlign:"right",paddingRight:8}]}>{i+1}</Text>}
                <View style={{flexDirection:"row",flexWrap:wordWrap?"wrap":"nowrap",flex:1}}>
                  {lineTokens.map((tok,j)=>(
                    <Text key={j} style={{color:findText&&tok.text.toLowerCase().includes(findText.toLowerCase())?colors.warning:tokenColor(tok.type,colors),fontSize,fontFamily:"monospace",lineHeight:fontSize*1.65,backgroundColor:findText&&tok.text.toLowerCase().includes(findText.toLowerCase())?colors.warning+"33":"transparent"}}>{tok.text}</Text>
                  ))}
                  {lineTokens.length===0&&<Text style={{fontSize,lineHeight:fontSize*1.65}}>{" "}</Text>}
                </View>
              </View>
            )}
          />
          {minimap&&activeFile.content.length>0&&(
            <View style={[s.minimap,{backgroundColor:colors.minimapBg,borderLeftColor:colors.border}]}>
              {activeFile.content.split("\n").slice(0,100).map((line,i)=>(
                <View key={i} style={s.minimapLine}>
                  <View style={[s.minimapContent,{backgroundColor:line.trim()?colors.mutedText+"40":"transparent",width:Math.min(line.length*0.7,50)}]}/>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={{flex:1,flexDirection:"row"}}>
          <ScrollView ref={scrollRef} style={{flex:1}}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={s.codeBody}>
                {lineNumbers&&(
                  <View style={[s.gutter,{borderRightColor:colors.border}]}>
                    {tokenized.map((_,i)=>(
                      <Text key={i} style={[s.lineNum,{color:findText&&tokenized[i]?.some(t=>t.text.includes(findText))?colors.warning:colors.lineNumber,fontSize:fontSize-2}]}>{i+1}</Text>
                    ))}
                  </View>
                )}
                <View style={s.codeLines}>
                  {tokenized.map((lineTokens,i)=>(
                    <View key={i} style={[s.codeLine,{minHeight:fontSize*1.65,backgroundColor:findText&&lineTokens.some(t=>t.text.toLowerCase().includes(findText.toLowerCase()))?colors.warning+"11":"transparent"}]}>
                      {lineTokens.map((tok,j)=>(
                        <Text key={j} style={{color:findText&&tok.text.toLowerCase().includes(findText.toLowerCase())?colors.warning:tokenColor(tok.type,colors),fontSize,fontFamily:"monospace",lineHeight:fontSize*1.65,backgroundColor:findText&&tok.text.toLowerCase().includes(findText.toLowerCase())?colors.warning+"44":"transparent"}}>{tok.text}</Text>
                      ))}
                      {lineTokens.length===0&&<Text style={{fontSize,lineHeight:fontSize*1.65}}>{" "}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </ScrollView>
          {minimap&&activeFile.content.length>0&&(
            <View style={[s.minimap,{backgroundColor:colors.minimapBg,borderLeftColor:colors.border}]}>
              {activeFile.content.split("\n").slice(0,80).map((line,i)=>(
                <View key={i} style={s.minimapLine}>
                  <View style={[s.minimapContent,{backgroundColor:line.trim()?colors.mutedText+"40":"transparent",width:Math.min(line.length*0.7,50)}]}/>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Status bar */}
      <View style={[s.statusBar,{backgroundColor:colors.statusBar}]}>
        <View style={s.statusLeft}>
          <TouchableOpacity onPress={()=>setIsEditing(!isEditing)}>
            <Text style={s.statusText}>{isEditing?"✎ EDITING":"○ READ"}</Text>
          </TouchableOpacity>
          <Text style={s.statusText}>│ {activeFile.language.toUpperCase()}</Text>
          <Text style={s.statusText}>│ Ln {lineCount}</Text>
          <Text style={s.statusText}>│ {(activeFile.content.length/1024).toFixed(1)}KB</Text>
        </View>
        <View style={s.statusRight}>
          {savingStatus==="saving"&&<Text style={[s.statusText,{color:"#ffffff88"}]}>⟳ Saving...</Text>}
          {savingStatus==="saved"&&<Text style={[s.statusText,{color:colors.success+"cc"}]}>✓ Saved</Text>}
          {activeFile.modified&&savingStatus==="idle"&&<Text style={[s.statusText,{color:"#ffd700"}]}>● Modified</Text>}
          <Text style={s.statusText}>UTF-8</Text>
          {isLargeFile&&<Text style={[s.statusText,{color:"#88aa88"}]}>VIRT</Text>}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:{flex:1},
  tabsBar:{maxHeight:36,minHeight:36},
  tab:{flexDirection:"row",alignItems:"center",paddingHorizontal:12,paddingVertical:0,gap:8,height:36,minWidth:80},
  tabName:{fontFamily:"Inter_400Regular",maxWidth:100},
  breadcrumb:{flexDirection:"row",alignItems:"center",paddingHorizontal:12,paddingVertical:5,gap:6,borderBottomWidth:1},
  breadText:{fontSize:12,fontFamily:"Inter_400Regular"},
  langBadge:{paddingHorizontal:5,paddingVertical:2,borderRadius:3,marginLeft:4},
  langText:{fontSize:10,fontFamily:"Inter_500Medium",textTransform:"uppercase"},
  toolbar:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:10,paddingVertical:4,borderBottomWidth:1},
  toolbarLeft:{flexDirection:"row",gap:6},
  toolbarRight:{flexDirection:"row",alignItems:"center",gap:10},
  toolBtn:{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:8,paddingVertical:4,borderRadius:4},
  toolBtnText:{fontSize:12,fontFamily:"Inter_500Medium"},
  toolIcon:{padding:5},
  insertBadge:{fontSize:11,fontFamily:"Inter_600SemiBold",letterSpacing:1},
  badge:{fontSize:10,fontFamily:"Inter_500Medium",paddingHorizontal:5,paddingVertical:2,borderRadius:3},
  findBar:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:10,paddingVertical:6,borderBottomWidth:1},
  findInput:{flex:1,fontSize:13,fontFamily:"Inter_400Regular",padding:0},
  findCount:{fontSize:11,fontFamily:"Inter_400Regular"},
  cleanBanner:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:12,paddingVertical:8,borderBottomWidth:1},
  cleanText:{flex:1,fontSize:12,fontFamily:"Inter_400Regular"},
  cleanBtn:{paddingHorizontal:10,paddingVertical:4,borderRadius:4},
  cleanBtnText:{color:"#000",fontSize:12,fontFamily:"Inter_600SemiBold"},
  suggestions:{position:"absolute",top:36+30+34+28,left:60,right:16,zIndex:100,borderRadius:6,borderWidth:1,maxHeight:180,overflow:"hidden"},
  suggestionItem:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:10,paddingVertical:7},
  suggestionText:{fontSize:13,fontFamily:"monospace"},
  editArea:{flex:1},
  editInput:{flex:1,fontFamily:"monospace",padding:12,textAlignVertical:"top",lineHeight:22},
  codeBody:{flexDirection:"row",minWidth:"100%"},
  gutter:{paddingVertical:8,paddingRight:10,paddingLeft:6,alignItems:"flex-end",borderRightWidth:1,minWidth:44},
  lineNum:{fontFamily:"monospace"},
  codeLines:{padding:8,flex:1},
  codeLine:{flexDirection:"row",flexWrap:"nowrap"},
  minimap:{width:60,borderLeftWidth:1,paddingTop:8,paddingHorizontal:4,overflow:"hidden"},
  minimapLine:{height:3,marginBottom:1,justifyContent:"center"},
  minimapContent:{height:2,borderRadius:1},
  statusBar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:10,paddingVertical:3},
  statusLeft:{flexDirection:"row",gap:8,alignItems:"center"},
  statusRight:{flexDirection:"row",gap:8,alignItems:"center"},
  statusText:{color:"#ffffff",fontSize:11,fontFamily:"Inter_400Regular"},
  welcome:{flex:1,alignItems:"center",justifyContent:"center",padding:24,gap:10},
  welcomeApp:{fontSize:40,fontFamily:"Inter_700Bold"},
  welcomeTitle:{fontSize:22,fontFamily:"Inter_700Bold",marginBottom:4},
  welcomeSub:{fontSize:13,fontFamily:"Inter_400Regular",textAlign:"center",marginBottom:8},
  welcomeGrid:{flexDirection:"row",flexWrap:"wrap",gap:10,justifyContent:"center"},
  welcomeCard:{width:120,alignItems:"center",padding:12,borderRadius:8,gap:6,borderWidth:1},
  welcomeCardLabel:{fontSize:12,fontFamily:"Inter_600SemiBold"},
  welcomeCardHint:{fontSize:10,fontFamily:"Inter_400Regular",textAlign:"center"},
  shortcutBar:{borderRadius:10,borderWidth:1,padding:12,width:"100%",maxWidth:320,marginTop:8},
  shortcutTitle:{fontSize:10,fontFamily:"Inter_600SemiBold",letterSpacing:1,marginBottom:8},
  shortcutRow:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:6},
  kbd:{paddingHorizontal:6,paddingVertical:3,borderRadius:4,borderWidth:1,minWidth:80,alignItems:"center"},
  kbdText:{fontSize:11,fontFamily:"monospace"},
  kbdDesc:{fontSize:12,fontFamily:"Inter_400Regular"},
});
