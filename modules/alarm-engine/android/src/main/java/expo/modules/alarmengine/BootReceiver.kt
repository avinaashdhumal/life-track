package expo.modules.alarmengine

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == Intent.ACTION_TIME_CHANGED ||
            action == Intent.ACTION_TIMEZONE_CHANGED
        ) {
            rescheduleAllAlarms(context, action)
        }
    }

    private fun rescheduleAllAlarms(context: Context, reasonAction: String) {
        val now = System.currentTimeMillis()
        val graceMs = 15 * 60 * 1000L
        val alarms = AlarmStorage.getAllAlarms(context)

        AlarmStorage.logEvent(context, "SYSTEM", "RESCHEDULE_TRIGGERED_$reasonAction", now)

        for (alarm in alarms) {
            when {
                alarm.triggerTimeMs > now -> {
                    // Still upcoming: re-register with AlarmManager (registrations don't survive reboot).
                    AlarmSchedulerHelper.scheduleExact(context, alarm)
                }
                alarm.triggerTimeMs > now - graceMs -> {
                    // Due while the phone was off: keep the series on its normal time, then ring now.
                    AlarmSchedulerHelper.scheduleNextInSeries(context, alarm)
                    AlarmSchedulerHelper.scheduleExact(
                        context,
                        alarm.copy(
                            triggerTimeMs = now + 2000L,
                            repeatEveryDays = 0,
                            repeatUntilMs = 0L,
                            seriesPrefix = "",
                            seriesSuffix = ""
                        )
                    )
                }
                else -> {
                    // Too old to ring: record it as missed, but don't let the series die.
                    AlarmSchedulerHelper.scheduleNextInSeries(context, alarm)
                    AlarmStorage.removeAlarm(context, alarm.id)
                    AlarmStorage.logEvent(context, alarm.id, "EXPIRED_WHILE_OFF", now)
                    AlarmStorage.addPendingAction(
                        context,
                        alarm.id,
                        AlarmActionHandler.MISSED,
                        now,
                        alarm.triggerTimeMs,
                        alarm.title,
                        alarm.payloadJson
                    )
                }
            }
        }
    }
}
