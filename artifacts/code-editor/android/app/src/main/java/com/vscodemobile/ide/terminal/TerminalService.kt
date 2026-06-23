package com.vscodemobile.ide.terminal

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.vscodemobile.ide.MainActivity
import java.util.concurrent.ConcurrentHashMap

class TerminalService : Service() {
    private val TAG = "TerminalService"
    private val NOTIFICATION_ID = 1001
    private val CHANNEL_ID = "code_editor_terminal_channel"
    private val binder = LocalBinder()
    val sessions = ConcurrentHashMap<String, TerminalSession>()

    inner class LocalBinder : Binder() {
        val service: TerminalService get() = this@TerminalService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_STICKY

    override fun onDestroy() {
        sessions.values.forEach { it.kill() }
        sessions.clear()
        super.onDestroy()
    }

    fun createSession(id: String, cwd: String, onOut: (String)->Unit, onExit: (Int)->Unit): TerminalSession {
        sessions[id]?.kill()
        val s = TerminalSession(id, cwd, onOut) { code ->
            sessions.remove(id)
            updateNotification()
            onExit(code)
        }
        sessions[id] = s
        s.start()
        updateNotification()
        return s
    }

    fun killSession(id: String) {
        sessions.remove(id)?.kill()
        updateNotification()
    }

    fun killAll() {
        sessions.values.forEach { it.kill() }
        sessions.clear()
        stopForeground(true)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "Terminal Sessions", NotificationManager.IMPORTANCE_LOW)
            ch.setSound(null, null)
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
    }

    private fun buildNotification(): Notification {
        val pi = PendingIntent.getActivity(this, 0,
            Intent(this, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP },
            PendingIntent.FLAG_IMMUTABLE)
        val n = sessions.size
        val text = if (n == 0) "Ready" else "$n session${if (n == 1) "" else "s"} active"
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Code Editor Terminal")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setContentIntent(pi).setOngoing(true).setShowWhen(false).build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("Code Editor Terminal")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setContentIntent(pi).setOngoing(true).build()
        }
    }

    private fun updateNotification() {
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIFICATION_ID, buildNotification())
    }
}
