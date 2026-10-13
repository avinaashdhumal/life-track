package expo.modules.alarmengine

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Handler
import android.os.Looper

/** Lists the phone's built-in sounds and plays short previews for the in-app tone picker. */
object ToneHelper {
    private const val PREVIEW_MS = 6_000L

    private var previewPlayer: MediaPlayer? = null
    private val handler = Handler(Looper.getMainLooper())
    private val stopRunnable = Runnable { stopPreview() }

    /** Alarm sounds first, then notification sounds, then ringtones (duplicates removed). */
    fun listTones(context: Context): List<Map<String, String>> {
        val result = mutableListOf<Map<String, String>>()
        val seen = HashSet<String>()
        val types = listOf(
            RingtoneManager.TYPE_ALARM to "alarm",
            RingtoneManager.TYPE_NOTIFICATION to "notification",
            RingtoneManager.TYPE_RINGTONE to "ringtone"
        )
        for ((type, kind) in types) {
            try {
                val manager = RingtoneManager(context)
                manager.setType(type)
                // RingtoneManager owns this cursor; it must not be closed here.
                val cursor = manager.cursor
                while (cursor.moveToNext()) {
                    val title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX) ?: continue
                    val uri = manager.getRingtoneUri(cursor.position)?.toString() ?: continue
                    if (seen.add(uri)) {
                        result.add(mapOf("title" to title, "uri" to uri, "kind" to kind))
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return result
    }

    @Synchronized
    fun preview(context: Context, uri: String): Boolean {
        stopPreview()
        return try {
            previewPlayer = MediaPlayer().apply {
                setDataSource(context.applicationContext, Uri.parse(uri))
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = false
                prepare()
                start()
            }
            handler.postDelayed(stopRunnable, PREVIEW_MS)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            stopPreview()
            false
        }
    }

    @Synchronized
    fun stopPreview() {
        handler.removeCallbacks(stopRunnable)
        try {
            previewPlayer?.stop()
        } catch (e: Exception) {
            // Not started or already stopped
        }
        try {
            previewPlayer?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        previewPlayer = null
    }
}
