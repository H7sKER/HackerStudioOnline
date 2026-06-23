import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";

const { width, height } = Dimensions.get("window");

interface Props {
  onDone: () => void;
}

export default function SplashAnimation({ onDone }: Props) {
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dotAnim = Animated.loop(
      Animated.stagger(200, [
        Animated.sequence([
          Animated.timing(dot1, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot1, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot2, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot3, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      ])
    );

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.delay(80),
      Animated.timing(subOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(barOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(barWidth, { toValue: width * 0.55, duration: 900, useNativeDriver: false }),
      ]),
      Animated.delay(300),
      Animated.timing(exitOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onDone());

    dotAnim.start();
    return () => { dotAnim.stop(); };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>{"{ }"}</Text>
          </View>
          <View style={styles.glowRing} />
        </Animated.View>

        <Animated.Text style={[styles.appName, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          HackerStudio
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { opacity: subOpacity }]}>
          Professional Mobile IDE
        </Animated.Text>

        <Animated.View style={[styles.barTrack, { opacity: barOpacity }]}>
          <Animated.View style={[styles.barFill, { width: barWidth }]} />
        </Animated.View>

        <Animated.View style={[styles.dots, { opacity: subOpacity }]}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
          ))}
        </Animated.View>

        <Animated.Text style={[styles.versionText, { opacity: subOpacity }]}>
          Version 3.0.0 — Nexbytes
        </Animated.Text>
      </View>

      <View style={styles.grid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={styles.gridLine} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#0d1117", alignItems: "center", justifyContent: "center", zIndex: 9999,
  },
  grid: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 },
  gridLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: "#00ff41" },
  content: { alignItems: "center", gap: 12, zIndex: 1 },
  logoWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  logoBox: {
    width: 90, height: 90, borderRadius: 22, backgroundColor: "#0078d4",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0078d4", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 30, elevation: 20,
  },
  glowRing: {
    position: "absolute", width: 110, height: 110, borderRadius: 30,
    borderWidth: 1, borderColor: "#0078d4" + "55",
  },
  logoText: { fontSize: 32, fontWeight: "900", color: "#ffffff", letterSpacing: -2 },
  appName: { fontSize: 30, fontWeight: "800", color: "#ffffff", letterSpacing: -0.5, marginTop: 8 },
  tagline: { fontSize: 13, color: "#8b949e", fontWeight: "400", letterSpacing: 0.5 },
  barTrack: { width: width * 0.55, height: 3, backgroundColor: "#21262d", borderRadius: 2, marginTop: 20, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#0078d4", borderRadius: 2 },
  dots: { flexDirection: "row", gap: 8, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0078d4" },
  versionText: { fontSize: 11, color: "#484f58", marginTop: 4 },
});
