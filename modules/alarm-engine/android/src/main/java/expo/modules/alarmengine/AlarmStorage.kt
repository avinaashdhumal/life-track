package expo.modules.alarmengine

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class NativeAlarm(
    val id: String,
    val triggerTimeMs: Long,
    val title: String,
    val message: String,
    val channelId: String,
    val isFullAlarm: Boolean,
    val soundName: String? = null,
    val snoozeIntervalMinutes: Int = 10,
    val payloadJson: String = "{}"
) {
    fun toJson(): JSONObject {
        val obj = JSONObject()
        obj.put("id", id)
        obj.put("triggerTimeMs", triggerTimeMs)
        obj.put("title", title)
        obj.put("message", message)
        obj.put("channelId", channelId)
        obj.put("isFullAlarm", isFullAlarm)
        obj.put("soundName", soundName ?: "")
        obj.put("snoozeIntervalMinutes", snoozeIntervalMinutes)
        obj.put("payloadJson", payloadJson)
        return obj
    }

    companion object {
        fun fromJson(obj: JSONObject): NativeAlarm {
            return NativeAlarm(
                id = obj.getString("id"),
                triggerTimeMs = obj.getLong("triggerTimeMs"),
                title = obj.getString("title"),
                message = obj.getString("message"),
                channelId = obj.optString("channelId", "medicines"),
                isFullAlarm = obj.optBoolean("isFullAlarm", true),
                soundName = obj.optString("soundName", "").takeIf { it.isNotEmpty() },
                snoozeIntervalMinutes = obj.optInt("snoozeIntervalMinutes", 10),
                payloadJson = obj.optString("payloadJson", "{}")
            )
        }
    }
}

object AlarmStorage {
    private const val PREFS_NAME = "lifetrack_native_alarms"
    private const val KEY_ALARMS = "active_alarms"
    private const val KEY_LAST_FIRED = "last_fired_alarm"
    private const val KEY_ALARM_LOG = "alarm_event_logs"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    @Synchronized
    fun saveAlarm(context: Context, alarm: NativeAlarm) {
        val list = getAllAlarms(context).toMutableList()
        list.removeAll { it.id == alarm.id }
        list.add(alarm)
        saveAll(context, list)
    }

    @Synchronized
    fun removeAlarm(context: Context, id: String) {
        val list = getAllAlarms(context).toMutableList()
        list.removeAll { it.id == id }
        saveAll(context, list)
    }

    @Synchronized
    fun clearAll(context: Context) {
        getPrefs(context).edit().remove(KEY_ALARMS).apply()
    }

    @Synchronized
    fun getAllAlarms(context: Context): List<NativeAlarm> {
        val jsonStr = getPrefs(context).getString(KEY_ALARMS, null) ?: return emptyList()
        val result = mutableListOf<NativeAlarm>()
        try {
            val array = JSONArray(jsonStr)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                result.add(NativeAlarm.fromJson(obj))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return result
    }

    @Synchronized
    private fun saveAll(context: Context, list: List<NativeAlarm>) {
        val array = JSONArray()
        list.forEach { array.put(it.toJson()) }
        getPrefs(context).edit().putString(KEY_ALARMS, array.toString()).apply()
    }

    @Synchronized
    fun setLastFired(context: Context, alarm: NativeAlarm) {
        val json = alarm.toJson().apply {
            put("firedAtMs", System.currentTimeMillis())
        }
        getPrefs(context).edit().putString(KEY_LAST_FIRED, json.toString()).apply()
    }

    @Synchronized
    fun getLastFired(context: Context): String? {
        return getPrefs(context).getString(KEY_LAST_FIRED, null)
    }

    @Synchronized
    fun logEvent(context: Context, alarmId: String, event: String, timestamp: Long) {
        try {
            val existing = getPrefs(context).getString(KEY_ALARM_LOG, "[]")
            val array = JSONArray(existing)
            val logItem = JSONObject().apply {
                put("alarmId", alarmId)
                put("event", event)
                put("timestamp", timestamp)
            }
            array.put(logItem)
            // Keep last 100 events
            val trimmed = if (array.length() > 100) {
                val newArr = JSONArray()
                for (i in (array.length() - 100) until array.length()) {
                    newArr.put(array.get(i))
                }
                newArr
            } else array
            getPrefs(context).edit().putString(KEY_ALARM_LOG, trimmed.toString()).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
