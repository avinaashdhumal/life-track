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
        val alarms = AlarmStorage.getAllAlarms(context)

        AlarmStorage.logEvent(context, "SYSTEM", "RESCHEDULE_TRIGGERED_$reasonAction", now)

        for (alarm in alarms) {
            // Only re-schedule alarms that are in the future or within the last 15 minutes grace period
            if (alarm.triggerTimeMs > now - (15 * 60 * 1000L)) {
                // If it was supposed to trigger while the device was off, schedule immediately (+2 seconds)
                val effectiveTrigger = if (alarm.triggerTimeMs < now) now + 2000L else alarm.triggerTimeMs
                val updated = alarm.copy(triggerTimeMs = effectiveTrigger)
                AlarmSchedulerHelper.scheduleExact(context, updated)
            } else {
                // Too old, mark as missed/clean up
                AlarmStorage.removeAlarm(context, alarm.id)
                AlarmStorage.logEvent(context, alarm.id, "EXPIRED_WHILE_OFF", now)
            }
        }
    }
}
