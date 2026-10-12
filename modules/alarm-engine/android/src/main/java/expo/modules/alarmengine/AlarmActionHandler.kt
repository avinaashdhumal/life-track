package expo.modules.alarmengine

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

/**
 * One place that applies a user (or timeout) action to an alarm, whether it came from the
 * notification buttons, the lock-screen activity, or auto-dismiss. Works with JS dead: the result
 * is queued in AlarmStorage's pending actions, and JS applies it (dose log, stock) on next start.
 */
object AlarmActionHandler {
    const val TAKEN = "TAKEN"
    const val SNOOZED = "SNOOZED"
    const val SKIPPED = "SKIPPED"
    const val DISMISSED = "DISMISSED"
    const val MISSED = "MISSED"
    const val FIRED = "FIRED"

    const val SNOOZE_SUFFIX = "_snooze"

    // Broadcast so an open AlarmFullScreenActivity closes when the alarm is handled elsewhere.
    const val ACTION_ALARM_CLOSED = "expo.modules.alarmengine.ALARM_CLOSED"

    fun missedNotificationId(alarmId: String): Int = "$alarmId#missed".hashCode()

    /** A fired alarm waiting for action, or an upcoming one (opened from the status-bar clock). */
    fun resolveAlarm(context: Context, alarmId: String): NativeAlarm? =
        AlarmStorage.getFired(context, alarmId) ?: AlarmStorage.getAlarm(context, alarmId)

    fun handle(context: Context, alarmId: String, action: String, snoozeMinutesOverride: Int? = null) {
        if (alarmId.isBlank()) return
        val now = System.currentTimeMillis()
        val fired = AlarmStorage.getFired(context, alarmId)
        val upcoming = if (fired == null) AlarmStorage.getAlarm(context, alarmId) else null
        val alarm = fired ?: upcoming

        AlarmForegroundService.stopAlarm(context)

        if (upcoming != null && action != MISSED) {
            // Acted on before it rang: cancel it, but keep its series going.
            AlarmSchedulerHelper.cancel(context, alarmId)
            AlarmSchedulerHelper.scheduleNextInSeries(context, upcoming)
        }

        AlarmStorage.logEvent(context, alarmId, action, now)
        AlarmStorage.addPendingAction(
            context,
            alarmId,
            action,
            now,
            alarm?.triggerTimeMs ?: now,
            alarm?.title ?: "",
            alarm?.payloadJson ?: "{}"
        )

        if (action == MISSED) {
            // Stop ringing but leave a silent notification so it can still be marked later.
            cancelNotification(context, alarmId.hashCode())
            if (alarm != null) {
                try {
                    val builder = AlarmNotificationHelper.buildAlarmNotification(
                        context,
                        alarm.copy(isFullAlarm = false),
                        silent = true,
                        notificationId = missedNotificationId(alarmId)
                    )
                    NotificationManagerCompat.from(context).notify(missedNotificationId(alarmId), builder.build())
                } catch (e: SecurityException) {
                    e.printStackTrace()
                }
            }
        } else {
            cancelNotification(context, alarmId.hashCode())
            cancelNotification(context, missedNotificationId(alarmId))
            AlarmStorage.removeFired(context, alarmId)
        }

        if (action == SNOOZED && alarm != null) {
            val minutes = (snoozeMinutesOverride ?: alarm.snoozeIntervalMinutes).coerceAtLeast(1)
            val snoozeId = if (alarmId.endsWith(SNOOZE_SUFFIX)) alarmId else alarmId + SNOOZE_SUFFIX
            val snoozed = alarm.copy(
                id = snoozeId,
                triggerTimeMs = now + minutes * 60_000L,
                repeatEveryDays = 0,
                repeatUntilMs = 0L,
                seriesPrefix = "",
                seriesSuffix = ""
            )
            AlarmSchedulerHelper.scheduleExact(context, snoozed)
        }

        context.sendBroadcast(
            Intent(ACTION_ALARM_CLOSED).apply {
                setPackage(context.packageName)
                putExtra("ALARM_ID", alarmId)
            }
        )
    }

    private fun cancelNotification(context: Context, notifId: Int) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        manager?.cancel(notifId)
    }
}
