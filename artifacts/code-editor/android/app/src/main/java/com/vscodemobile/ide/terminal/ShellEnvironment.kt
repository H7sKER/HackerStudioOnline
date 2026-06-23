package com.vscodemobile.ide.terminal

import android.content.Context
import java.io.File

/** Builds the shell environment for terminal sessions. */
object ShellEnvironment {
    fun buildEnv(context: Context, cwd: String): Map<String, String> {
        val prefix = BootstrapInstaller.prefixDir(context).absolutePath
        val home = BootstrapInstaller.homeDir(context).absolutePath
        val tmp = BootstrapInstaller.tmpDir(context).absolutePath
        return mapOf(
            "HOME" to home,
            "PREFIX" to prefix,
            "TMPDIR" to tmp,
            "PATH" to "$prefix/bin:$prefix/sbin:/system/bin:/system/xbin",
            "TERM" to "xterm-256color",
            "COLORTERM" to "truecolor",
            "LANG" to "en_US.UTF-8",
            "SHELL" to resolveShell(prefix),
            "PWD" to cwd,
            "SHLVL" to "1"
        )
    }

    private fun resolveShell(prefix: String): String {
        return listOf("$prefix/bin/bash", "$prefix/bin/sh", "/system/bin/sh")
            .firstOrNull { File(it).canExecute() } ?: "/system/bin/sh"
    }
}
