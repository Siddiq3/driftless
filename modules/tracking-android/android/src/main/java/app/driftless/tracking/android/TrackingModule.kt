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
        View(GuideVideoView::class) {
            Prop("source") { view: GuideVideoView, source: String -> view.setSource(source) }
            Prop("playing") { view: GuideVideoView, playing: Boolean -> view.setPlaying(playing) }
        }

        Function("floatingCountEnabled") { TrackingPrefs(context).floatingCountEnabled }
        Function("setFloatingCountEnabled") { enabled: Boolean ->
            TrackingPrefs(context).apply {
                floatingCountEnabled = enabled
                if (enabled) floatingCountPausedUntil = 0L
            }
            DriftlessAccessibilityService.current?.refreshFloatingCount()
        }
        Function("floatingCountPreferences") {
            val p = TrackingPrefs(context)
            mapOf("size" to p.floatingCountSize, "pausedUntil" to p.floatingCountPausedUntil)
        }
        Function("setFloatingCountSize") { size: Int ->
            TrackingPrefs(context).floatingCountSize = size
            DriftlessAccessibilityService.current?.refreshFloatingCount()
        }
        Function("resumeFloatingCount") {
            TrackingPrefs(context).floatingCountPausedUntil = 0L
            DriftlessAccessibilityService.current?.refreshFloatingCount()
        }
        Function("memePreferences") {
            val p = TrackingPrefs(context)
            mapOf("enabled" to p.memeCardsEnabled)
        }
        Function("setMemePreferences") { enabled: Boolean, _: String ->
            val p = TrackingPrefs(context)
            p.memeCardsEnabled = enabled
            DriftlessAccessibilityService.current?.refreshFloatingCount()
        }
        Function("widgetSupported") { CountWidget.supported(context) }
        Function("requestCountWidget") { CountWidget.request(context) }
        Function("refreshCountWidget") { CountWidget.update(context) }
        Function("openSupportedApp") { pkg: String ->
            if (pkg !in RulesLoader.load(context).apps.keys) throw CodedException("UNSUPPORTED_APP", "App is not supported", null)
            val launch = context.packageManager.getLaunchIntentForPackage(pkg)
                ?: throw CodedException("NOT_INSTALLED", "App is not installed", null)
            context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        Function("getHealth") {
            val ctx = context
            val rules = RulesLoader.load(ctx)
            val running = DriftlessAccessibilityService.current != null
            val store = SqliteStore.get(ctx)
            val today = Recorder.localDate(System.currentTimeMillis(), ZoneId.systemDefault())
            mapOf(
                "engineVersion" to ENGINE_VERSION,
                "implemented" to true,
                "feedLimitsImplemented" to true,
                "rulesVersion" to rules.version,
                "disclosureAccepted" to TrackingPrefs(ctx).disclosureAccepted,
                "serviceEnabled" to Health.serviceEnabled(ctx),
                "serviceRunning" to running,
                "lastConnectedMs" to DriftlessAccessibilityService.lastConnectedMs.toDouble(),
                "lastEventMs" to DriftlessAccessibilityService.lastEventMs.toDouble(),
                "heartbeatMinutesToday" to store.heartbeatMinutes(today),
                "usageAccessGranted" to UsageReader.granted(ctx),
                "subscriptionRequired" to app.driftless.tracking.core.FeatureAccess.SUBSCRIPTIONS_REQUIRED,
                "blockingEntitled" to app.driftless.tracking.core.BlockPolicy.entitled(
                    TrackingPrefs(ctx).entitlement, System.currentTimeMillis(),
                ),
                "debugBuild" to isDebuggable(ctx),
                "apps" to rules.apps.values.map { r ->
                    val v = Health.appVersion(ctx, r.pkg)
                    mapOf(
                        "package" to r.pkg,
                        "label" to r.label,
                        "installed" to (v != null),
                        "version" to v,
                        "validated" to isValidatedVersion(r, v),
                        "videoDetectionImplemented" to (r.surfaceViewIds.isNotEmpty() && r.itemParts.isNotEmpty()),
                    )
                },
            )
        }

        Function("setDisclosureAccepted") { accepted: Boolean ->
            TrackingPrefs(context).disclosureAccepted = accepted
            DriftlessAccessibilityService.current?.refreshFloatingCount()
        }

        Function("openAccessibilityGuide") {
            if (!TrackingPrefs(context).disclosureAccepted) throw CodedException("CONSENT_REQUIRED", "Read and accept the counting disclosure first", null)
            context.startActivity(Intent(context, AccessibilityGuideActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
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

        Function("getLocalActivityDetails") { from: String, to: String -> WrappedDetails.readLocalActivity(context, from, to) }
        Function("getWrappedDetails") { from: String, to: String -> WrappedDetails.read(context, from, to) }

        Function("getDataRevision") { SqliteStore.get(context).dataRevision().toDouble() }
        Function("getDataScope") { SqliteStore.get(context).activeScope() }
        Function("selectDataScope") { scope: String ->
            val service = DriftlessAccessibilityService.current
            if(service != null) service.changeDataScope(scope) else SqliteStore.get(context).selectScope(scope)
        }
        Function("importGuestScope") { source: String, target: String, legacy: Boolean -> SqliteStore.get(context).importGuest(source, target, legacy) }
        Function("setSourceDevice") { id: String -> SqliteStore.get(context).setSourceDevice(id) }
        Function("mergeSyncedDays") { json: String, scope: String -> SqliteStore.get(context).mergeSynced(json, scope) }
        Function("getPersonalMeasurement") { date: String -> SqliteStore.get(context).personalMeasurement(date, RulesLoader.load(context).apps.keys) }

        Function("getStoredDates") { from: String, to: String -> SqliteStore.get(context).storedDates(from, to) }

        Function("getDaily") { localDate: String? ->
            val ctx = context
            val zone = ZoneId.systemDefault()
            val now = System.currentTimeMillis()
            val d = localDate ?: Recorder.localDate(now, zone)
            val store = SqliteStore.get(ctx)
            val beats = store.heartbeatMinutes(d)
            mapOf(
                "localDate" to d,
                "recordedTz" to store.localMetadata(d)["recordedTz"],
                "measurementStatus" to store.localMetadata(d)["measurementStatus"],
                "usageObserved" to store.localMetadata(d)["usageObserved"],
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

        /** Mirrors enabled goals into native storage so alerts work while the app is closed. */
        Function("setLimits") { limits: List<Map<String, Any>> ->
            TrackingPrefs(context).limits = limits.mapNotNull { m ->
                val metric = m["metric"] as? String ?: return@mapNotNull null
                val limit = (m["dailyLimit"] as? Number)?.toInt() ?: return@mapNotNull null
                app.driftless.tracking.core.Limit(metric, limit)
            }
        }

        /** Runs the goal check now (also runs every minute inside the service). */
        Function("checkGoals") {
            val ctx = context
            GoalNotifier.check(ctx, SqliteStore.get(ctx), TrackingPrefs(ctx))
        }

        /** Saved blocking settings; FeatureAccess controls the current subscription requirement. */
        Function("setBlocking") { c: Map<String, Any?> ->
            @Suppress("UNCHECKED_CAST")
            val schedules = (c["schedules"] as? List<Map<String, Any?>>).orEmpty().map { s ->
                app.driftless.tracking.core.Schedule(
                    (s["days"] as? List<*>).orEmpty().mapNotNull { (it as? Number)?.toInt() }.filter { it in 1..7 }.toSet(),
                    ((s["startMinute"] as? Number)?.toInt() ?: 0).coerceIn(0, 1439),
                    ((s["endMinute"] as? Number)?.toInt() ?: 0).coerceIn(0, 1439),
                )
            }
            val known = RulesLoader.load(context).apps.keys
            TrackingPrefs(context).blockConfig = app.driftless.tracking.core.BlockConfig(
                enabled = c["enabled"] as? Boolean ?: false,
                apps = (c["apps"] as? List<*>).orEmpty().mapNotNull { it as? String }.filter { it in known }.toSet(),
                dailyMinutes = (c["dailyMinutes"] as? Number)?.toInt()?.coerceIn(1, 1440),
                schedules = schedules,
                feedOnly = c["feedOnly"] as? Boolean ?: false,
                feed = app.driftless.tracking.core.FeedSettings(
                    enforceGoal = c["enforceVideoGoal"] as? Boolean ?: false,
                    breaksEnabled = c["breaksEnabled"] as? Boolean ?: false,
                    everyViews = ((c["breakEveryViews"] as? Number)?.toInt() ?: 50).coerceIn(1, 2000),
                    breakMinutes = ((c["breakMinutes"] as? Number)?.toInt() ?: 5).coerceIn(1, 60),
                    maxBypasses = ((c["maxBypassesPerDay"] as? Number)?.toInt() ?: 3).coerceIn(0, 10),
                    bypassMinutes = ((c["bypassMinutes"] as? Number)?.toInt() ?: 5).coerceIn(1, 30),
                    allowUnvalidated = c["allowUnvalidatedCounts"] as? Boolean ?: false,
                ),
            )
        }

        /**
         * Caches the entitlement the app received from the server (GET /v1/me or verify). Used only to
         * decide whether local blocking may run offline; expires on its own (BlockPolicy.validUntil).
         */
        Function("setEntitlement") { tier: String, state: String, expiresAtMs: Double?, verifiedAtMs: Double ->
            val pro = tier == "pro" && (state == "active" || state == "grace")
            TrackingPrefs(context).entitlement = app.driftless.tracking.core.CachedEntitlement(
                pro,
                app.driftless.tracking.core.BlockPolicy.validUntil(expiresAtMs?.toLong(), verifiedAtMs.toLong()),
            )
        }

        Function("wipeLocalData") {
            TrackingPrefs(context).floatingCountEnabled = false
            DriftlessAccessibilityService.current?.refreshFloatingCount()
            TrackingPrefs(context).clearMemeHistory()
            TrackingPrefs(context).clearFeedState()
            SqliteStore.get(context).wipeAll()
            CountWidget.update(context)
        }
    }

    private fun isDebuggable(ctx: Context) = (ctx.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    companion object {
        const val ENGINE_VERSION = 2
    }
}
