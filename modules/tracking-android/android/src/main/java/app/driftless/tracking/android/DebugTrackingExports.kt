package app.driftless.tracking.android

import android.content.Context
import android.content.pm.ApplicationInfo
import expo.modules.kotlin.exception.CodedException
import org.json.JSONObject
import java.io.File

/** Local accuracy-study exports only; account data export uses its separate backend flow. */
internal object DebugTrackingExports {
    private fun requireDebug(ctx: Context) {
        if (ctx.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0)
            throw CodedException("DEBUG_ONLY", "Only available in debug builds", null)
    }

    fun exportSessionLog(ctx: Context, days: Int): Map<String, Any> {
        requireDebug(ctx)
        val since = System.currentTimeMillis() - days.coerceIn(1, 30) * 86_400_000L
        val events = SqliteStore.get(ctx).events(since)
        val dir = File(ctx.cacheDir, "exports").apply { mkdirs() }
        val f = File(dir, "driftless-events-${System.currentTimeMillis()}.jsonl")
        f.bufferedWriter().use { w ->
            for (e in events) {
                w.write(
                    JSONObject()
                        .put("eventId", e.eventId).put("sessionId", e.sessionId).put("seq", e.seq)
                        .put("package", e.pkg).put("kind", e.kind.name.lowercase())
                        .put("itemStartMs", e.itemStartMs).put("countedAtMs", e.countedAtMs)
                        .put("localDate", e.localDate).put("tz", e.tz)
                        .put("ruleVersion", e.ruleVersion).put("appVersion", e.appVersion ?: JSONObject.NULL)
                        .toString(),
                )
                w.newLine()
            }
        }
        return mapOf("uri" to "file://${f.absolutePath}", "count" to events.size)
    }

    fun lastStructureCapture(ctx: Context): String {
        requireDebug(ctx)
        val f = DriftlessAccessibilityService.lastCaptureFile
            ?: throw CodedException("NO_CAPTURE", "No capture yet. Was Reels or Shorts open when the timer ended?", null)
        return "file://${f.absolutePath}"
    }
}
