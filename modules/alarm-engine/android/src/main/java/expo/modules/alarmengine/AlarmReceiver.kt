package expo.modules.alarmengine

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import androidx.core.app.NotificationManagerCompat

class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null) return

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "LifeTrack:AlarmWakeLock"
        )
        wakeLock?.acquire(30_000) // Keep awake for up to 30s to dispatch

        try {
            val alarmId = intent.getStringExtra("ALARM_ID") ?: ""
            when (intent.action) {
                "expo.modules.alarmengine.ALARM_TRIGGER" -> handleAlarmTrigger(context, intent)
                AlarmNotificationHelper.ACTION_TAKEN ->
                    AlarmActionHandler.handle(context, alarmId, AlarmActionHandler.TAKEN)
                AlarmNotificationHelper.ACTION_SNOOZE ->
                    AlarmActionHandler.handle(
                        context,
                        alarmId,
                        AlarmActionHandler.SNOOZED,
                        intent.getIntExtra("SNOOZE_MINUTES", 10)
                    )
                AlarmNotificationHelper.ACTION_SKIP ->
                    AlarmActionHandler.handle(context, alarmId, AlarmActionHandler.SKIPPED)
            }
        } finally {
            wakeLock?.let { if (it.isHeld) it.release() }
        }
    }

    private fun handleAlarmTrigger(context: Context, intent: Intent) {
        val alarmId = intent.getStringExtra("ALARM_ID") ?: return
        val now = System.currentTimeMillis()

        // Prefer the stored record (it has the repeat rule, labels, and settings).
        val alarm = AlarmStorage.getAlarm(context, alarmId) ?: NativeAlarm(
            id = alarmId,
            triggerTimeMs = intent.getLongExtra("TRIGGER_TIME", now),
            title = intent.getStringExtra("ALARM_TITLE") ?: "LifeTrack Reminder",
            message = intent.getStringExtra("ALARM_MESSAGE") ?: "",
            channelId = intent.getStringExtra("ALARM_CHANNEL") ?: AlarmNotificationHelper.CHANNEL_MEDICINES,
            isFullAlarm = intent.getBooleanExtra("ALARM_IS_FULL", true),
            payloadJson = intent.getStringExtra("ALARM_PAYLOAD") ?: "{}"
        )

        // It has been delivered: move it from "upcoming" to "fired" and keep its series going.
        AlarmStorage.removeAlarm(context, alarmId)
        AlarmStorage.addFired(context, alarm)
        AlarmStorage.setLastFired(context, alarm)
        AlarmStorage.logEvent(context, alarmId, "FIRED", now)
        AlarmStorage.addPendingAction(
            context, alarmId, AlarmActionHandler.FIRED, now, alarm.triggerTimeMs, alarm.title, alarm.payloadJson
        )
        AlarmSchedulerHelper.scheduleNextInSeries(context, alarm)

        val notification = AlarmNotificationHelper.buildAlarmNotification(context, alarm)
        try {
            NotificationManagerCompat.from(context).notify(alarm.id.hashCode(), notification.build())
        } catch (e: SecurityException) {
            e.printStackTrace()
        }

        if (alarm.isFullAlarm) {
            // The service owns ringing (sound, vibration, auto-dismiss). The full-screen intent on the
            // notification shows the lock-screen UI; this direct start covers the app-in-foreground case.
            AlarmForegroundService.startAlarm(context, alarm)
            val fullScreenIntent = Intent(context, AlarmFullScreenActivity::class.java).apply {
                putExtra("ALARM_ID", alarm.id)
                setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
            }
            try {
                context.startActivity(fullScreenIntent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
