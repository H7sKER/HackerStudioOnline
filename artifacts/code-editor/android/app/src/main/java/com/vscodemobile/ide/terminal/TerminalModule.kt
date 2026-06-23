package com.vscodemobile.ide.terminal

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.ConcurrentHashMap

/**
 * React Native bridge module for the integrated Terminal.
 * Manages multiple TerminalSession instances and bridges I/O to JavaScript.
 */
class TerminalModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TerminalModule"

    private val sessions = ConcurrentHashMap<String, TerminalSession>()

    @ReactMethod
    fun createSession(sessionId: String, cwd: String, promise: Promise) {
        try {
            val session = TerminalSession(
                sessionId = sessionId,
                cwd = cwd,
                onOutput = { text ->
                    sendEvent("terminal_output", sessionId, text)
                },
                onExit = { code ->
                    sendEvent("terminal_exit", sessionId, code.toString())
                    sessions.remove(sessionId)
                }
            )
            sessions[sessionId] = session
            session.start()
            promise.resolve(sessionId)
        } catch (e: Exception) {
            promise.reject("SESSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun execute(sessionId: String, command: String, promise: Promise) {
        val session = sessions[sessionId]
        if (session == null) {
            promise.reject("NO_SESSION", "Session $sessionId not found")
            return
        }
        try {
            session.execute(command)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EXECUTE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun write(sessionId: String, data: String, promise: Promise) {
        val session = sessions[sessionId]
        if (session == null) {
            promise.reject("NO_SESSION", "Session $sessionId not found")
            return
        }
        try {
            session.write(data)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WRITE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun killSession(sessionId: String, promise: Promise) {
        val session = sessions.remove(sessionId)
        try {
            session?.kill()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("KILL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isSessionAlive(sessionId: String, promise: Promise) {
        val session = sessions[sessionId]
        promise.resolve(session?.isAlive ?: false)
    }

    @ReactMethod
    fun listSessions(promise: Promise) {
        val arr = Arguments.createArray()
        sessions.keys.forEach { arr.pushString(it) }
        promise.resolve(arr)
    }

    @ReactMethod
    fun killAllSessions(promise: Promise) {
        sessions.values.forEach { it.kill() }
        sessions.clear()
        promise.resolve(true)
    }

    private fun sendEvent(eventName: String, sessionId: String, data: String) {
        val params = Arguments.createMap().apply {
            putString("sessionId", sessionId)
            putString("data", data)
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        sessions.values.forEach { it.kill() }
        sessions.clear()
    }
}
