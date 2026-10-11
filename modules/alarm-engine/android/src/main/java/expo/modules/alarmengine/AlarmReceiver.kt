package expo.modules.alarmengine

import android.app.NotificationManager
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
            when (intent.action) {
                "expo.modules.alarmengine.ALARM_TRIGGER" -> {
                    handleAlarmTrigger(context, intent)
                }
                AlarmNotificationHelper.ACTION_TAKEN -> {
                    val alarmId = intent.getStringExtra("ALARM_ID") ?: ""
                    val notifId = intent.getIntExtra("NOTIFICATION_ID", alarmId.hashCode())
                    AlarmStorage.logEvent(context, alarmId, "NOTIFICATION_TAKEN", System.currentTimeMillis())
                    AlarmStorage.removeAlarm(context, alarmId)
                    cancelNotification(context, notifId)
                }
                AlarmNotificationHelper.ACTION_SNOOZE -> {
                    val alarmId = intent.getStringExtra("ALARM_ID") ?: ""
                    val notifId = intent.getIntExtra("NOTIFICATION_ID", alarmId.hashCode())
                    val snoozeMinutes = intent.getIntExtra("SNOOZE_MINUTES", 10)
                    AlarmStorage.logEvent(context, alarmId, "NOTIFICATION_SNOOZED_${snoozeMinutes}M", System.currentTimeMillis())
                    cancelNotification(context, notifId)

                    // Reschedule natively
                    val existing = AlarmStorage.getAllAlarms(context).find { it.id == alarmId }
                    val title = existing?.title ?: "Reminder"
                    val message = existing?.message ?: "Snoozed alarm"
                    val snoozedAlarm = NativeAlarm(
                        id = "$alarmId-snooze",
                        triggerTimeMs = System.currentTimeMillis() + (snoozeMinutes * 60 * 1000L),
                        title = "$title (Snoozed)",
                        message = message,
                        channelId = existing?.channelId ?: AlarmNotificationHelper.CHANNEL_MEDICINES,
                        isFullAlarm = existing?.isFullAlarm ?: true
                    )
                    AlarmSchedulerHelper.scheduleExact(context, snoozedAlarm)
                }
                AlarmNotificationHelper.ACTION_SKIP -> {
                    val alarmId = intent.getStringExtra("ALARM_ID") ?: ""
                    val notifId = intent.getIntExtra("NOTIFICATION_ID", alarmId.hashCode())
                    AlarmStorage.logEvent(context, alarmId, "NOTIFICATION_SKIPPED", System.currentTimeMillis())
                    AlarmStorage.removeAlarm(context, alarmId)
                    cancelNotification(context, notifId)
                }
            }
        } finally {
            wakeLock?.release()
        }
    }

    private fun handleAlarmTrigger(context: Context, intent: Intent) {
        val alarmId = intent.getStringExtra("ALARM_ID") ?: return
        val title = intent.getStringExtra("ALARM_TITLE") ?: "LifeTrack Reminder"
        val message = intent.getStringExtra("ALARM_MESSAGE") ?: "Time for your reminder"
        val channelId = intent.getStringExtra("ALARM_CHANNEL") ?: AlarmNotificationHelper.CHANNEL_MEDICINES
        val isFullAlarm = intent.getBooleanExtra("ALARM_IS_FULL", true)
        val payload = intent.getStringExtra("ALARM_PAYLOAD") ?: "{}"
        val triggerTime = intent.getLongExtra("TRIGGER_TIME", System.currentTimeMillis())

        val alarm = NativeAlarm(
            id = alarmId,
            triggerTimeMs = triggerTime,
            title = title,
            message = message,
            channelId = channelId,
            isFullAlarm = isFullAlarm,
            payloadJson = payload
        )

        // Record fired event in native storage
        AlarmStorage.setLastFired(context, alarm)
        AlarmStorage.logEvent(context, alarmId, "FIRED", System.currentTimeMillis())

        // Post Notification
        val notification = AlarmNotificationHelper.buildAlarmNotification(context, alarm)
        val notificationManager = NotificationManagerCompat.from(context)
        try {
            notificationManager.notify(alarm.id.hashCode(), notification.build())
        } catch (e: SecurityException) {
            e.printStackTrace()
        }

        // If Full Alarm, also directly launch the FullScreenActivity
        if (isFullAlarm) {
            val fullScreenIntent = Intent(context, AlarmFullScreenActivity::class.java).apply {
                putExtra("ALARM_ID", alarm.id)
                putExtra("ALARM_TITLE", alarm.title)
                putExtra("ALARM_MESSAGE", alarm.message)
                putExtra("ALARM_CHANNEL", alarm.channelId)
                putExtra("ALARM_IS_FULL", true)
                putExtra("ALARM_PAYLOAD", alarm.payloadJson)
                setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
            }
            context.startActivity(fullScreenIntent)
        }
    }

    private fun cancelNotification(context: Context, notifId: Int) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        manager?.cancel(notifId)
    }
}
