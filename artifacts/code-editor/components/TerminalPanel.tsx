import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, NativeEventEmitter, NativeModules, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

const { TerminalModule } = NativeModules;
let sessionCounter = 0;
const makeSessionId = () => `session_${Date.now()}_${++sessionCounter}`;

interface Session { id: string; name: string; lines: string[]; ready: boolean; history: string[]; }
interface Props { cwd?: string; colors?: Record<string, string>; }

const TerminalPanel: React.FC<Props> = ({
  cwd = "/",
  colors = { bg:"#0d1117", fg:"#d4d4d4", accent:"#4ec9b0", mutedText:"#858585", error:"#f44747", warning:"#dcdcaa", info:"#3b8eda", border:"#333" },
}) => {
  const [sessions, setSessions] = useState<Session[]>([{ id:makeSessionId(), name:"Terminal 1", lines:["HackerStudio IDE Terminal\r\n$ "], ready:false, history:[] }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [input, setInput] = useState("");
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const activeSession = sessions[activeIdx];

  useEffect(() => {
    if (!TerminalModule) return;
    const emitter = new NativeEventEmitter(TerminalModule);
    const outSub = emitter.addListener("terminal_output", ({ sessionId: sid, data }) => {
      setSessions(prev => prev.map(s => s.id===sid ? {...s, lines:[...s.lines.slice(-400), data]} : s));
    });
    const exitSub = emitter.addListener("terminal_exit", ({ sessionId: sid, data }) => {
      setSessions(prev => prev.map(s => s.id===sid ? {...s, lines:[...s.lines, `\r\n[Exit: ${data}]\r\n`]} : s));
    });
    sessions.forEach(session => {
      TerminalModule.createSession(session.id, cwd)
        .then(()=>setSessions(prev=>prev.map(s=>s.id===session.id?{...s,ready:true}:s)))
        .catch((e: Error)=>setSessions(prev=>prev.map(s=>s.id===session.id?{...s,lines:[...s.lines,`\r\nERR: ${e.message}\r\n`]}:s)));
    });
    return () => { outSub.remove(); exitSub.remove(); sessions.forEach(s=>TerminalModule.killSession(s.id).catch(()=>{})); };
  }, []);

  const addSession = useCallback(() => {
    const newSession: Session = { id:makeSessionId(), name:`Terminal ${sessions.length+1}`, lines:["HackerStudio IDE Terminal\r\n$ "], ready:false, history:[] };
    setSessions(prev=>[...prev, newSession]);
    setActiveIdx(sessions.length);
    setInput("");
    if (TerminalModule) {
      TerminalModule.createSession(newSession.id, cwd)
        .then(()=>setSessions(prev=>prev.map(s=>s.id===newSession.id?{...s,ready:true}:s)))
        .catch(()=>{});
    }
  }, [sessions.length, cwd]);

  const closeSession = useCallback((idx: number) => {
    if (sessions.length<=1) { Alert.alert("Cannot close", "At least one terminal must be open."); return; }
    if (TerminalModule) TerminalModule.killSession(sessions[idx].id).catch(()=>{});
    setSessions(prev=>{const n=[...prev]; n.splice(idx,1); return n;});
    setActiveIdx(prev=>Math.min(prev, sessions.length-2));
  }, [sessions]);

  const sendCmd = useCallback(() => {
    const cmd = input.trim();
    if (!cmd || !activeSession) return;
    const newHistory = [...activeSession.history, cmd].slice(-50);
    setSessions(prev=>prev.map((s,i)=>i===activeIdx?{...s,history:newHistory,lines:[...s.lines.slice(-400),`\r\n${cmd}\r\n`]}:s));
    setHistIdx(-1);
    setInput("");
    if (TerminalModule && activeSession.ready) {
      TerminalModule.execute(activeSession.id, cmd).catch(()=>{});
    } else {
      const output = simulateCmd(cmd);
      setSessions(prev=>prev.map((s,i)=>i===activeIdx?{...s,lines:[...s.lines.slice(-400),output+"\r\n$ "]}:s));
    }
  }, [input, activeSession, activeIdx]);

  const simulateCmd = (cmd: string): string => {
    const c = cmd.trim().toLowerCase();
    if (c==="help") return "\r\nAvailable: ls, pwd, echo, clear, date, whoami, uname, cat, python3, node, help\r\n";
    if (c==="clear"||c==="cls") { setSessions(prev=>prev.map((s,i)=>i===activeIdx?{...s,lines:["$ "]}:s)); return ""; }
    if (c==="pwd") return "\r\n/data/user/0/com.nexbytes.hackerstudio/files\r\n";
    if (c==="ls") return "\r\nprojects/  downloads/  tmp/  .config/\r\n";
    if (c==="whoami") return "\r\nhackerstudio-user\r\n";
    if (c==="date") return `\r\n${new Date().toString()}\r\n`;
    if (c==="uname -a") return "\r\nLinux android 5.10 #1 SMP PREEMPT aarch64 GNU/Linux\r\n";
    if (c.startsWith("echo ")) return `\r\n${cmd.slice(5)}\r\n`;
    if (c==="python3 --version") return "\r\nPython 3.11.0\r\n";
    if (c==="node --version") return "\r\nv20.0.0\r\n";
    if (c==="git --version") return "\r\ngit version 2.42.0\r\n";
    if (c.startsWith("python3 -c ")) return "\r\n[Python output would appear here]\r\n";
    return `\r\nCommand not found: ${cmd}\r\nType 'help' for available commands\r\n`;
  };

  const sendKey = useCallback((key: string) => {
    if (!activeSession?.ready || !TerminalModule) return;
    TerminalModule.write(activeSession.id, key).catch(()=>{});
  }, [activeSession]);

  const handleHistoryNav = useCallback((dir: "up"|"down") => {
    if (!activeSession?.history.length) return;
    const hist = activeSession.history;
    const newIdx = dir==="up" ? Math.min(histIdx+1, hist.length-1) : Math.max(histIdx-1, -1);
    setHistIdx(newIdx);
    setInput(newIdx>=0 ? hist[hist.length-1-newIdx] : "");
  }, [activeSession, histIdx]);

  return (
    <View style={[st.root,{backgroundColor:colors.bg}]}>
      {/* Session tabs */}
      <View style={[st.sessionTabs,{borderBottomColor:colors.border}]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
          {sessions.map((sess,i)=>(
            <TouchableOpacity key={sess.id} style={[st.sessionTab,{backgroundColor:i===activeIdx?colors.bg:colors.bg+"88",borderBottomColor:i===activeIdx?colors.accent:"transparent",borderBottomWidth:2}]} onPress={()=>{setActiveIdx(i);setInput("");}}>
              <Feather name="terminal" size={11} color={i===activeIdx?colors.accent:colors.mutedText}/>
              <Text style={[st.sessionName,{color:i===activeIdx?colors.accent:colors.mutedText}]}>{sess.name}</Text>
              {sessions.length>1&&<TouchableOpacity onPress={()=>closeSession(i)} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                <Feather name="x" size={10} color={colors.mutedText}/>
              </TouchableOpacity>}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity onPress={addSession} style={st.addTabBtn}>
          <Feather name="plus" size={14} color={colors.accent}/>
        </TouchableOpacity>
      </View>

      {/* Toolbar */}
      <View style={[st.bar,{borderBottomColor:colors.accent+"44"}]}>
        <View style={[st.readyDot,{backgroundColor:activeSession?.ready?colors.accent:"#666"}]}/>
        <Text style={[st.barTitle,{color:colors.accent}]}>{activeSession?.name?.toUpperCase()}</Text>
        <View style={st.barActions}>
          {[["ctrl+c","\x03"],["ctrl+d","\x04"],["tab","\t"],["↑","UP"],["↓","DOWN"]].map(([label,key])=>(
            <TouchableOpacity key={label} onPress={()=>key==="UP"?handleHistoryNav("up"):key==="DOWN"?handleHistoryNav("down"):sendKey(key)} style={st.keyBtn}>
              <Text style={[st.keyBtnTxt,{color:colors.mutedText}]}>{label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={()=>setSessions(prev=>prev.map((s,i)=>i===activeIdx?{...s,lines:["$ "]}:s))} style={st.keyBtn}>
            <Text style={[st.keyBtnTxt,{color:colors.mutedText}]}>clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Output */}
      <ScrollView ref={scrollRef} style={st.output} onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:false})}>
        <Text style={[st.outputText,{color:colors.fg}]} selectable>{activeSession?.lines.join("")}</Text>
      </ScrollView>

      {/* Input row */}
      <View style={[st.inputRow,{borderTopColor:colors.accent+"44"}]}>
        <Text style={[st.prompt,{color:colors.accent}]}>$ </Text>
        <TextInput
          ref={inputRef}
          style={[st.input,{color:colors.fg}]}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendCmd}
          placeholder={activeSession?.ready?"Enter command...":"Initializing shell..."}
          placeholderTextColor={colors.mutedText}
          autoCapitalize="none" autoCorrect={false} returnKeyType="send"
        />
        <TouchableOpacity onPress={sendCmd} style={[st.sendBtn,{backgroundColor:colors.accent}]}>
          <Feather name="send" size={14} color="#fff"/>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  root:{flex:1,flexDirection:"column"},
  sessionTabs:{flexDirection:"row",alignItems:"center",borderBottomWidth:1,maxHeight:36},
  sessionTab:{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:12,paddingVertical:7,minWidth:80},
  sessionName:{fontSize:11,fontFamily:"Inter_500Medium"},
  addTabBtn:{padding:8,borderLeftWidth:1,borderLeftColor:"#ffffff22"},
  readyDot:{width:7,height:7,borderRadius:4,marginRight:4},
  bar:{flexDirection:"row",alignItems:"center",paddingHorizontal:12,paddingVertical:6,borderBottomWidth:1},
  barTitle:{fontSize:11,fontWeight:"700",letterSpacing:1.5,flex:1},
  barActions:{flexDirection:"row",gap:6,flexWrap:"nowrap"},
  keyBtn:{paddingHorizontal:7,paddingVertical:3,borderRadius:3,backgroundColor:"#ffffff18"},
  keyBtnTxt:{fontSize:10,fontFamily:"monospace"},
  output:{flex:1,padding:8},
  outputText:{fontFamily:"monospace",fontSize:12.5,lineHeight:18},
  inputRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:8,paddingVertical:6,borderTopWidth:1},
  prompt:{fontFamily:"monospace",fontSize:14,fontWeight:"bold",marginRight:4},
  input:{flex:1,fontFamily:"monospace",fontSize:13,paddingVertical:4},
  sendBtn:{width:34,height:34,borderRadius:8,alignItems:"center",justifyContent:"center",marginLeft:6},
});

export default TerminalPanel;
