package expo.modules.alarmengine

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object AlarmSchedulerHelper {

    fun canScheduleExact(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            alarmManager?.canScheduleExactAlarms() ?: false
        } else {
            true
        }
    }

    fun scheduleExact(context: Context, alarm: NativeAlarm) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = "expo.modules.alarmengine.ALARM_TRIGGER"
            putExtra("ALARM_ID", alarm.id)
            putExtra("ALARM_TITLE", alarm.title)
            putExtra("ALARM_MESSAGE", alarm.message)
            putExtra("ALARM_CHANNEL", alarm.channelId)
            putExtra("ALARM_IS_FULL", alarm.isFullAlarm)
            putExtra("ALARM_PAYLOAD", alarm.payloadJson)
            putExtra("TRIGGER_TIME", alarm.triggerTimeMs)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            alarm.id.hashCode(),
            intent,
            flags
        )

        // Save natively in SharedPreferences so it persists across reboots/kills
        AlarmStorage.saveAlarm(context, alarm)
        AlarmStorage.logEvent(context, alarm.id, "SCHEDULED", System.currentTimeMillis())

        // Use AlarmClockInfo when available (most reliable for waking up device & doze mode bypass)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            val showIntent = Intent(context, AlarmFullScreenActivity::class.java).apply {
                putExtra("ALARM_ID", alarm.id)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val showPendingIntent = PendingIntent.getActivity(
                context,
                alarm.id.hashCode() + 999,
                showIntent,
                flags
            )
            val clockInfo = AlarmManager.AlarmClockInfo(alarm.triggerTimeMs, showPendingIntent)
            alarmManager.setAlarmClock(clockInfo, pendingIntent)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                alarm.triggerTimeMs,
                pendingIntent
            )
        } else {
            alarmManager.setExact(
                AlarmManager.RTC_WAKEUP,
                alarm.triggerTimeMs,
                pendingIntent
            )
        }
    }

    fun cancel(context: Context, alarmId: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = "expo.modules.alarmengine.ALARM_TRIGGER"
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            alarmId.hashCode(),
            intent,
            flags
        )

        alarmManager.cancel(pendingIntent)
        AlarmStorage.removeAlarm(context, alarmId)
        AlarmStorage.logEvent(context, alarmId, "CANCELLED", System.currentTimeMillis())
    }

    fun cancelAll(context: Context) {
        val alarms = AlarmStorage.getAllAlarms(context)
        alarms.forEach { cancel(context, it.id) }
        AlarmStorage.clearAll(context)
    }
}
