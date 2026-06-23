package com.vscodemobile.ide.terminal

import android.app.AlertDialog
import android.app.ProgressDialog
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

/**
 * Installs the Linux bootstrap packages (bash, coreutils, python, git, etc.)
 * into the app's private data directory on first launch.
 * Architecture-aware: downloads the correct ABI bootstrap ZIP from termux-packages.
 */
object BootstrapInstaller {
    private const val TAG = "BootstrapInstaller"
    private const val BASE_URL = "https://github.com/termux/termux-packages/releases/latest/download"

    fun isInstalled(context: Context): Boolean {
        val bash = File(prefixDir(context), "bin/bash")
        return bash.exists() && bash.canExecute()
    }

    fun setupIfNeeded(context: Context, onComplete: () -> Unit) {
        if (isInstalled(context)) {
            onComplete()
            return
        }
        install(context, onComplete)
    }

    private fun install(context: Context, onComplete: () -> Unit) {
        val abi = detectAbi()
        val zipName = "bootstrap-$abi.zip"
        val url = "$BASE_URL/$zipName"
        Log.i(TAG, "Installing bootstrap for ABI=$abi from $url")

        Thread {
            try {
                ensureDirectories(context)
                val zipBytes = download(url) { progress ->
                    Log.d(TAG, "Download progress: $progress%")
                }
                extract(context, zipBytes)
                writeProfile(context)
                Log.i(TAG, "Bootstrap installed successfully")
                Handler(Looper.getMainLooper()).post(onComplete)
            } catch (e: Exception) {
                Log.e(TAG, "Bootstrap install failed: ${e.message}", e)
                // Fallback: still call onComplete so app isn't stuck
                Handler(Looper.getMainLooper()).post(onComplete)
            }
        }.also { it.isDaemon = true; it.name = "bootstrap-installer"; it.start() }
    }

    private fun detectAbi(): String {
        val supported = android.os.Build.SUPPORTED_ABIS
        return when {
            supported.contains("arm64-v8a")   -> "aarch64"
            supported.contains("armeabi-v7a") -> "arm"
            supported.contains("x86_64")       -> "x86_64"
            supported.contains("x86")          -> "i686"
            else                               -> "aarch64"
        }
    }

    private fun download(urlStr: String, onProgress: (Int) -> Unit): ByteArray {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.connectTimeout = 30_000
        conn.readTimeout = 60_000
        conn.connect()
        val total = conn.contentLength
        val buf = ByteArrayOutputStream()
        val chunk = ByteArray(8192)
        var read = 0L
        conn.inputStream.use { ins ->
            var n: Int
            while (ins.read(chunk).also { n = it } != -1) {
                buf.write(chunk, 0, n)
                read += n
                if (total > 0) onProgress((read * 100 / total).toInt())
            }
        }
        return buf.toByteArray()
    }

    private fun extract(context: Context, zipBytes: ByteArray) {
        val staging = stagingDir(context)
        val prefix = prefixDir(context)
        staging.mkdirs()
        val symlinks = mutableListOf<Pair<String, String>>()

        ZipInputStream(ByteArrayInputStream(zipBytes)).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                if (entry.name == "SYMLINKS.txt") {
                    zis.bufferedReader().forEachLine { line ->
                        val parts = line.split("←")
                        if (parts.size == 2) symlinks.add(parts[0] to parts[1])
                    }
                } else {
                    val target = File(staging, entry.name)
                    if (entry.isDirectory) {
                        target.mkdirs()
                    } else {
                        target.parentFile?.mkdirs()
                        FileOutputStream(target).use { out -> zis.copyTo(out) }
                        if (entry.name.startsWith("bin/") || entry.name.startsWith("libexec/")) {
                            target.setExecutable(true, false)
                        }
                    }
                }
                entry = zis.nextEntry
            }
        }

        // Apply symlinks
        for ((src, dstRel) in symlinks) {
            val dst = File(prefix.parent, dstRel)
            dst.parentFile?.mkdirs()
            runCatching {
                android.system.Os.symlink(src, dst.absolutePath)
            }
        }

        // Move staging → prefix
        if (!staging.renameTo(prefix)) {
            staging.copyRecursively(prefix, overwrite = true)
            staging.deleteRecursively()
        }
    }

    private fun writeProfile(context: Context) {
        val home = homeDir(context)
        val prefix = prefixDir(context)
        File(home, ".bashrc").writeText("""
            |export HOME=${home.absolutePath}
            |export PREFIX=${prefix.absolutePath}
            |export PATH=${"$"}{PREFIX}/bin:${"$"}{PREFIX}/sbin:/system/bin:/system/xbin
            |export TMPDIR=${context.filesDir.absolutePath}/tmp
            |export TERM=xterm-256color
            |export COLORTERM=truecolor
            |export LANG=en_US.UTF-8
            |export PS1='\[\033[1;32m\]\u@code-editor\[\033[0m\]:\[\033[1;34m\]\w\[\033[0m\]\$ '
            |alias ls='ls --color=auto'
            |alias ll='ls -la'
        """.trimMargin())
        File(home, ".profile").writeText("[ -f \"\$HOME/.bashrc\" ] && source \"\$HOME/.bashrc\"\n")
    }

    private fun ensureDirectories(context: Context) {
        listOf(homeDir(context), prefixDir(context).parentFile!!, tmpDir(context)).forEach { it.mkdirs() }
    }

    fun prefixDir(context: Context) = File(context.filesDir, "usr")
    fun homeDir(context: Context) = File(context.filesDir, "home")
    fun tmpDir(context: Context) = File(context.filesDir, "tmp")
    private fun stagingDir(context: Context) = File(context.filesDir, "usr-staging")
}
