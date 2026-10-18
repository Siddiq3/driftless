package app.driftless.tracking.android

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.provider.Settings
import app.driftless.tracking.core.Recorder
import app.driftless.tracking.core.UsageMath
import app.driftless.tracking.core.isValidatedVersion
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File
import java.time.ZoneId

/**
 * JS bridge. Reads from the native store; the native engine counts with or without JS running.
 */
class TrackingModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw CodedException("NO_CONTEXT", "React context unavailable", null)

    override fun definition() = ModuleDefinition {
        Name("DriftlessTracking")

        Function("getHealth") {
            val ctx = context
            val rules = RulesLoader.load(ctx)
            val running = DriftlessAccessibilityService.current != null
            val store = SqliteStore.get(ctx)
            val today = Recorder.localDate(System.currentTimeMillis(), ZoneId.systemDefault())
            mapOf(
                "engineVersion" to ENGINE_VERSION,
                "implemented" to true,
                "rulesVersion" to rules.version,
                "disclosureAccepted" to TrackingPrefs(ctx).disclosureAccepted,
                "serviceEnabled" to Health.serviceEnabled(ctx),
                "serviceRunning" to running,
                "lastConnectedMs" to DriftlessAccessibilityService.lastConnectedMs.toDouble(),
                "lastEventMs" to DriftlessAccessibilityService.lastEventMs.toDouble(),
                "heartbeatMinutesToday" to store.heartbeatMinutes(today),
                "usageAccessGranted" to UsageReader.granted(ctx),
                "debugBuild" to isDebuggable(ctx),
                "apps" to rules.apps.values.map { r ->
                    val v = Health.appVersion(ctx, r.pkg)
                    mapOf(
                        "package" to r.pkg,
                        "label" to r.label,
                        "installed" to (v != null),
                        "version" to v,
                        "validated" to isValidatedVersion(r, v),
                    )
                },
            )
        }

        Function("setDisclosureAccepted") { accepted: Boolean ->
            TrackingPrefs(context).disclosureAccepted = accepted
        }

        Function("openAccessibilitySettings") {
            context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }

        Function("openUsageAccessSettings") {
            context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }

        /** Recomputes UsageStats minutes for the last [days] days. Returns rows written (0 = no access). */
        Function("refreshUsage") { days: Int ->
            val ctx = context
            UsageReader.refresh(ctx, SqliteStore.get(ctx), RulesLoader.load(ctx).apps.keys, days)
        }

        Function("getDaily") { localDate: String? ->
            val ctx = context
            val zone = ZoneId.systemDefault()
            val now = System.currentTimeMillis()
            val d = localDate ?: Recorder.localDate(now, zone)
            val store = SqliteStore.get(ctx)
            val beats = store.heartbeatMinutes(d)
            mapOf(
                "localDate" to d,
                "heartbeatMinutes" to beats,
                "coverage" to UsageMath.coverage(beats, d, zone, now),
                "apps" to store.daily(d).map {
                    mapOf(
                        "package" to it.pkg,
                        "views" to it.views,
                        "adViews" to it.adViews,
                        "surfaceMs" to it.surfaceMs.toDouble(),
                        "unknownMs" to it.unknownMs.toDouble(),
                        "usageMs" to it.usageMs.toDouble(),
                    )
                },
            )
        }

        /** Writes counted events of the last [days] days as JSON Lines for the accuracy scorer. */
        Function("exportSessionLog") { days: Int ->
            val ctx = context
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
            mapOf("uri" to "file://${f.absolutePath}", "count" to events.size)
        }

        /**
         * Debug builds only: in [delayMs] the service records the view-id/class structure (no text)
         * of the open supported app. Switch to Reels/Shorts, wait, come back, then call
         * lastStructureCapture().
         */
        Function("scheduleStructureCapture") { delayMs: Int ->
            val ctx = context
            if (!isDebuggable(ctx)) throw CodedException("DEBUG_ONLY", "Only available in debug builds", null)
            val svc = DriftlessAccessibilityService.current
                ?: throw CodedException("NOT_RUNNING", "Turn on the counter in Accessibility settings first", null)
            val f = File(File(ctx.cacheDir, "exports"), "driftless-structure-${System.currentTimeMillis()}.json")
            svc.scheduleStructureCapture(delayMs.toLong().coerceIn(1_000, 30_000), f)
        }

        Function("lastStructureCapture") {
            val f = DriftlessAccessibilityService.lastCaptureFile
                ?: throw CodedException("NO_CAPTURE", "No capture yet. Was Reels or Shorts open when the timer ended?", null)
            "file://${f.absolutePath}"
        }

        Function("wipeLocalData") {
            SqliteStore.get(context).wipeAll()
        }
    }

    private fun isDebuggable(ctx: Context) = (ctx.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    companion object {
        const val ENGINE_VERSION = 1
    }
}
