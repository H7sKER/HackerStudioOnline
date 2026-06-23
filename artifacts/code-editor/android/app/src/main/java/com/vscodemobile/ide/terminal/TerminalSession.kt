package com.vscodemobile.ide.terminal

import android.util.Log
import java.io.*

/**
 * Manages a single interactive shell session using ProcessBuilder.
 * Feeds output to the JavaScript layer via the onOutput callback.
 */
class TerminalSession(
    val sessionId: String,
    private val cwd: String,
    private val onOutput: (String) -> Unit,
    private val onExit: (Int) -> Unit
) {
    private val TAG = "TerminalSession"
    private var process: Process? = null
    private var stdinWriter: BufferedWriter? = null
    private var outputThread: Thread? = null
    @Volatile var isAlive: Boolean = false
        private set

    fun start() {
        val shell = resolveShell()
        val pb = ProcessBuilder(shell)
        pb.directory(File(cwd.takeIf { File(it).isDirectory } ?: "/"))
        pb.environment().apply {
            put("TERM", "xterm-256color")
            put("COLORTERM", "truecolor")
            put("LANG", "en_US.UTF-8")
            put("PS1", "$ ")
            put("SHLVL", "1")
        }
        pb.redirectErrorStream(true)

        process = pb.start()
        isAlive = true
        stdinWriter = BufferedWriter(OutputStreamWriter(process!!.outputStream))

        outputThread = Thread {
            try {
                val buf = CharArray(4096)
                val reader = BufferedReader(InputStreamReader(process!!.inputStream))
                var n: Int
                while (reader.read(buf).also { n = it } != -1) {
                    if (n > 0) onOutput(String(buf, 0, n))
                }
            } catch (e: IOException) {
                if (isAlive) Log.w(TAG, "[$sessionId] stream closed: ${e.message}")
            } finally {
                val code = runCatching { process?.waitFor() ?: -1 }.getOrDefault(-1)
                isAlive = false
                onExit(code)
            }
        }.also {
            it.isDaemon = true
            it.name = "terminal-out-$sessionId"
            it.start()
        }
    }

    fun execute(cmd: String) = write("$cmd\n")

    fun write(data: String) {
        try {
            stdinWriter?.write(data)
            stdinWriter?.flush()
        } catch (e: IOException) {
            Log.w(TAG, "[$sessionId] write failed: ${e.message}")
        }
    }

    fun resize(cols: Int, rows: Int) {
        // PTY resize via stty (best-effort on Android)
        try { write("stty cols $cols rows $rows\n") } catch (_: Exception) {}
    }

    fun kill() {
        isAlive = false
        runCatching { stdinWriter?.close() }
        runCatching { process?.destroyForcibly() }
        outputThread?.interrupt()
        process = null
        stdinWriter = null
    }

    private fun resolveShell(): String {
        val candidates = listOf(
            "/data/data/com.vscodemobile.ide/files/usr/bin/bash",
            "/data/data/com.vscodemobile.ide/files/usr/bin/sh",
            "/system/bin/sh",
            "/system/xbin/sh"
        )
        return candidates.firstOrNull { File(it).canExecute() } ?: "/system/bin/sh"
    }
}
