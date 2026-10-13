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
    val payloadJson: String = "{}",
    // Native roll-forward: when this fires, schedule `${seriesPrefix}_${yyyyMMdd}_${seriesSuffix}`
    // `repeatEveryDays` later (local calendar days). Must match the JS planner's id format.
    val repeatEveryDays: Int = 0,
    val repeatUntilMs: Long = 0L,
    val seriesPrefix: String = "",
    val seriesSuffix: String = "",
    val vibrate: Boolean = true,
    // Stop ringing after this many minutes without user action (0 = ring until acted on).
    val autoDismissMinutes: Int = 5,
    // Localized UI text from JS: {"taken","snooze","skip","badge","ok"}.
    val labelsJson: String = "{}",
    // Phone tone (content URI) chosen for this reminder; blank = the channel's default sound.
    val soundUri: String = "",
    // Informational reminder (routine, shift notice): a single OK button instead of Taken/Snooze/Skip.
    val infoOnly: Boolean = false
) {
    fun label(key: String, fallback: String): String {
        return try {
            JSONObject(labelsJson).optString(key, "").ifBlank { fallback }
        } catch (e: Exception) {
            fallback
        }
    }

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
        obj.put("repeatEveryDays", repeatEveryDays)
        obj.put("repeatUntilMs", repeatUntilMs)
        obj.put("seriesPrefix", seriesPrefix)
        obj.put("seriesSuffix", seriesSuffix)
        obj.put("vibrate", vibrate)
        obj.put("autoDismissMinutes", autoDismissMinutes)
        obj.put("labelsJson", labelsJson)
        obj.put("soundUri", soundUri)
        obj.put("infoOnly", infoOnly)
        return obj
    }

    companion object {
        fun fromJson(obj: JSONObject): NativeAlarm {
            return NativeAlarm(
                id = obj.getString("id"),
                triggerTimeMs = obj.getLong("triggerTimeMs"),
                title = obj.optString("title", "Reminder"),
                message = obj.optString("message", ""),
                channelId = obj.optString("channelId", "medicines"),
                isFullAlarm = obj.optBoolean("isFullAlarm", true),
                soundName = obj.optString("soundName", "").takeIf { it.isNotEmpty() },
                snoozeIntervalMinutes = obj.optInt("snoozeIntervalMinutes", 10),
                payloadJson = obj.optString("payloadJson", "{}"),
                repeatEveryDays = obj.optInt("repeatEveryDays", 0),
                repeatUntilMs = obj.optLong("repeatUntilMs", 0L),
                seriesPrefix = obj.optString("seriesPrefix", ""),
                seriesSuffix = obj.optString("seriesSuffix", ""),
                vibrate = obj.optBoolean("vibrate", true),
                autoDismissMinutes = obj.optInt("autoDismissMinutes", 5),
                labelsJson = obj.optString("labelsJson", "{}"),
                soundUri = obj.optString("soundUri", ""),
                infoOnly = obj.optBoolean("infoOnly", false)
            )
        }

        fun fromJsonString(json: String?): NativeAlarm? {
            if (json.isNullOrBlank()) return null
            return try {
                fromJson(JSONObject(json))
            } catch (e: Exception) {
                null
            }
        }
    }
}

object AlarmStorage {
    private const val PREFS_NAME = "lifetrack_native_alarms"
    private const val KEY_ALARMS = "active_alarms"
    private const val KEY_LAST_FIRED = "last_fired_alarm"
    private const val KEY_ALARM_LOG = "alarm_event_logs"
    // Alarms that have rung but not been acted on yet (actions need their details).
    private const val KEY_FIRED = "fired_alarms"
    // Actions taken natively that JS has not applied yet (dose logs, reminder history).
    private const val KEY_PENDING_ACTIONS = "pending_actions"

    private const val MAX_FIRED = 50
    private const val MAX_PENDING_ACTIONS = 500

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // commit() (synchronous) because receivers can be killed right after onReceive returns.
    private fun putString(context: Context, key: String, value: String) {
        getPrefs(context).edit().putString(key, value).commit()
    }

    private fun readAlarmList(context: Context, key: String): MutableList<NativeAlarm> {
        val jsonStr = getPrefs(context).getString(key, null) ?: return mutableListOf()
        val result = mutableListOf<NativeAlarm>()
        try {
            val array = JSONArray(jsonStr)
            for (i in 0 until array.length()) {
                result.add(NativeAlarm.fromJson(array.getJSONObject(i)))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return result
    }

    private fun writeAlarmList(context: Context, key: String, list: List<NativeAlarm>) {
        val array = JSONArray()
        list.forEach { array.put(it.toJson()) }
        putString(context, key, array.toString())
    }

    // --- Upcoming (scheduled) alarms ---

    @Synchronized
    fun saveAlarm(context: Context, alarm: NativeAlarm) {
        val list = readAlarmList(context, KEY_ALARMS)
        list.removeAll { it.id == alarm.id }
        list.add(alarm)
        writeAlarmList(context, KEY_ALARMS, list)
    }

    @Synchronized
    fun removeAlarm(context: Context, id: String) {
        val list = readAlarmList(context, KEY_ALARMS)
        if (list.removeAll { it.id == id }) {
            writeAlarmList(context, KEY_ALARMS, list)
        }
    }

    @Synchronized
    fun clearAll(context: Context) {
        getPrefs(context).edit().remove(KEY_ALARMS).commit()
    }

    @Synchronized
    fun getAllAlarms(context: Context): List<NativeAlarm> = readAlarmList(context, KEY_ALARMS)

    @Synchronized
    fun getAlarm(context: Context, id: String): NativeAlarm? =
        readAlarmList(context, KEY_ALARMS).find { it.id == id }

    // --- Fired (ringing or waiting for an action) alarms ---

    @Synchronized
    fun addFired(context: Context, alarm: NativeAlarm) {
        val list = readAlarmList(context, KEY_FIRED)
        list.removeAll { it.id == alarm.id }
        list.add(alarm)
        while (list.size > MAX_FIRED) list.removeAt(0)
        writeAlarmList(context, KEY_FIRED, list)
    }

    @Synchronized
    fun getFired(context: Context, id: String): NativeAlarm? =
        readAlarmList(context, KEY_FIRED).find { it.id == id }

    @Synchronized
    fun removeFired(context: Context, id: String) {
        val list = readAlarmList(context, KEY_FIRED)
        if (list.removeAll { it.id == id }) {
            writeAlarmList(context, KEY_FIRED, list)
        }
    }

    // --- Pending actions for JS ---

    @Synchronized
    fun addPendingAction(
        context: Context,
        alarmId: String,
        action: String,
        atMs: Long,
        triggerTimeMs: Long,
        title: String,
        payloadJson: String
    ) {
        try {
            val array = JSONArray(getPrefs(context).getString(KEY_PENDING_ACTIONS, "[]"))
            array.put(JSONObject().apply {
                put("alarmId", alarmId)
                put("action", action)
                put("atMs", atMs)
                put("triggerTimeMs", triggerTimeMs)
                put("title", title)
                put("payloadJson", payloadJson)
            })
            val trimmed = if (array.length() > MAX_PENDING_ACTIONS) {
                val newArr = JSONArray()
                for (i in (array.length() - MAX_PENDING_ACTIONS) until array.length()) {
                    newArr.put(array.get(i))
                }
                newArr
            } else array
            putString(context, KEY_PENDING_ACTIONS, trimmed.toString())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /** Returns all queued actions (oldest first) and clears the queue. */
    @Synchronized
    fun drainPendingActions(context: Context): List<Map<String, Any>> {
        val result = mutableListOf<Map<String, Any>>()
        try {
            val array = JSONArray(getPrefs(context).getString(KEY_PENDING_ACTIONS, "[]"))
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                result.add(
                    mapOf(
                        "alarmId" to obj.optString("alarmId", ""),
                        "action" to obj.optString("action", ""),
                        "atMs" to obj.optLong("atMs", 0L).toDouble(),
                        "triggerTimeMs" to obj.optLong("triggerTimeMs", 0L).toDouble(),
                        "title" to obj.optString("title", ""),
                        "payloadJson" to obj.optString("payloadJson", "{}")
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        putString(context, KEY_PENDING_ACTIONS, "[]")
        return result
    }

    // --- Diagnostics ---

    @Synchronized
    fun setLastFired(context: Context, alarm: NativeAlarm) {
        val json = alarm.toJson().apply {
            put("firedAtMs", System.currentTimeMillis())
        }
        putString(context, KEY_LAST_FIRED, json.toString())
    }

    @Synchronized
    fun getLastFired(context: Context): String? {
        return getPrefs(context).getString(KEY_LAST_FIRED, null)
    }

    @Synchronized
    fun logEvent(context: Context, alarmId: String, event: String, timestamp: Long) {
        try {
            val array = JSONArray(getPrefs(context).getString(KEY_ALARM_LOG, "[]"))
            array.put(JSONObject().apply {
                put("alarmId", alarmId)
                put("event", event)
                put("timestamp", timestamp)
            })
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
