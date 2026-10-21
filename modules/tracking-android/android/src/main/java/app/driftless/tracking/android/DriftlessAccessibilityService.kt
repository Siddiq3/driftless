package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.app.KeyguardManager
import android.os.PowerManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import app.driftless.tracking.core.Surface
import app.driftless.tracking.core.countBadgeValue
import app.driftless.tracking.core.showCountBadge
import app.driftless.tracking.core.isValidatedVersion
import app.driftless.tracking.core.Classifier
import app.driftless.tracking.core.Engine
import app.driftless.tracking.core.Fingerprint
import app.driftless.tracking.core.Recorder
import app.driftless.tracking.core.RuleSet
import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId

/**
 * Counts Reels/Shorts on this device only. Events arrive only for the packages listed in
 * res/xml/driftless_accessibility.xml. For each settled screen it reads a bounded snapshot of the
 * window, keeps a salted one-way code for the current item, and discards everything else.
 *
 * Never: performs automatic actions on other apps, stores node text, takes screenshots, or sends anything
 * off the device. Counting only runs after the in-app prominent disclosure was accepted.
 */
class DriftlessAccessibilityService : AccessibilityService() {
    private val main = Handler(Looper.getMainLooper())
    private val classifier = Classifier()
    private val playerTransition = app.driftless.tracking.core.PlayerTransition()
    private lateinit var rules: RuleSet
    private lateinit var engine: Engine
    private lateinit var prefs: TrackingPrefs

    private lateinit var memeCard: MemeMilestoneCard
    private lateinit var feedPause: FeedPauseOverlay
    private var memeDate: String? = null
    private var memeCount: Int? = null
    private lateinit var floatingBadge: FloatingCountBadge
    private var badgeSurface = Surface.UNKNOWN
    private var badgeIdentity = false
    private var badgePackage: String? = null
    private var debugTraceUntil = 0L
    private var debugLastIdentity: String? = null
    private val debugTrace = org.json.JSONArray()


    private var pendingScroll = false
    private var classifyScheduled = false
    private var saltDate: String? = null
    private var salt: ByteArray = ByteArray(0)
    private val versions = HashMap<String, String?>()

    private val classifyTask = Runnable { classifyNow() }
    private val tick = object : Runnable {
        override fun run() {
            onTick()
            main.postDelayed(this, TICK_MS)
        }
    }
    private val screenOff = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            if (i.action == Intent.ACTION_SCREEN_OFF) {
                engine.onLeave(System.currentTimeMillis()); hideFloatingCount()
            }
        }
    }

    override fun onServiceConnected() {
        prefs = TrackingPrefs(this)
        floatingBadge = FloatingCountBadge(this)
        memeCard = MemeMilestoneCard(this)
        feedPause = FeedPauseOverlay(this)
        rules = RulesLoader.load(this)
        val store = SqliteStore.get(this)
        val now = System.currentTimeMillis()
        store.purgeOlderThan(now - RETENTION_MS, Recorder.localDate(now - RETENTION_MS, ZoneId.systemDefault()))
        engine = Engine(store, rules)
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            // System broadcasts still reach a non-exported receiver.
            registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF))
        }
        main.post(classifyTask)
        main.post(tick)
        current = this
        lastConnectedMs = now
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || !::engine.isInitialized || !prefs.disclosureAccepted) return
        lastEventMs = System.currentTimeMillis()
        val pkg = event.packageName?.toString() ?: return
        if (!engine.isSupported(pkg)) return
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) pendingScroll = true
        // Sample the transition immediately and again after settling. Waiting for only the final
        // frame can miss YouTube's short-lived empty player subtree (no scroll event is emitted).
        // Deduplication remains by item identity and dwell, never by callback frequency.
        if (!classifyScheduled) {
            classifyNow()
            classifyScheduled = true
            main.postDelayed(classifyTask, SETTLE_MS)
        }
    }

    private fun classifyNow() {
        classifyScheduled = false
        val now = System.currentTimeMillis()
        if (!::engine.isInitialized || !prefs.disclosureAccepted ||
            !getSystemService(PowerManager::class.java).isInteractive ||
            getSystemService(KeyguardManager::class.java).isKeyguardLocked) {
            if (::engine.isInitialized) engine.onLeave(now)
            hideFloatingCount()
            return
        }
        val root: AccessibilityNodeInfo? = rootInActiveWindow
        val pkg = root?.packageName?.toString()
        val appRules = pkg?.let { rules.apps[it] }
        if (appRules == null) {
            engine.onLeave(now)
            hideFloatingCount()
            pendingScroll = false
            return
        }
        val c = classifier.classify(A11yNode(root), appRules, saltFor(now))
        val replaced = playerTransition.observe(pkg, c, now)
        if (::feedPause.isInitialized && feedPause.isShowing) {
            engine.onLeave(now)
            badgeSurface = c.surface; badgeIdentity = c.fingerprint != null; badgePackage = pkg
            maybePause(pkg, now)
            if (!feedPause.isShowing) main.post(classifyTask)
            pendingScroll = false
            return
        }
        if (::memeCard.isInitialized && memeCard.isShowing) {
            engine.onLeave(now)
            if (c.surface != Surface.SHORT_VIDEO) hideFloatingCount()
            pendingScroll = false
            return
        }
        if (now < debugTraceUntil && debugTrace.length() < 120) {
            debugTrace.put(JSONObject().put("atMs",now).put("surface",c.surface.name)
                .put("identityPresent",c.fingerprint != null).put("identityChanged",c.fingerprint != debugLastIdentity)
                .put("scrolled",pendingScroll).put("playerReplaced",replaced).put("itemContainerPresent",c.itemContainerPresent).put("ad",c.isAd).put("nodesVisited",c.nodesVisited))
            debugLastIdentity = c.fingerprint
            runCatching { java.io.File(cacheDir,"exports/driftless-counter-trace.json").writeText(debugTrace.toString()) }
        }
        engine.onObservation(pkg, versionOf(pkg), c, pendingScroll || replaced, now)
        pendingScroll = false
        badgeSurface = c.surface; badgeIdentity = c.fingerprint != null; badgePackage = pkg
        updateFloatingCount(now)
        maybePause(pkg, now)
    }

    private var lastPauseMs = 0L

    /** Pro blocking: shows Driftless's own pause screen. Fails open on any error. */
    private fun maybePause(pkg: String, now: Long) {
        runCatching {
            val cfg = prefs.blockConfig
            if (!cfg.enabled || pkg !in cfg.apps || !app.driftless.tracking.core.BlockPolicy.entitled(prefs.entitlement, now)) {
                feedPause.hide(); return
            }
            val zone = ZoneId.systemDefault()
            val at = java.time.Instant.ofEpochMilli(now).atZone(zone)
            val date = at.toLocalDate().toString()
            val rows = SqliteStore.get(this).daily(date)
            val row = rows.firstOrNull { it.pkg == pkg }
            val count = rows.filter { it.pkg in rules.apps }.sumOf { it.views }
            val validated = rules.apps[pkg]?.let { isValidatedVersion(it, versionOf(pkg)) } == true &&
                rows.filter { it.views > 0 }.all { r -> rules.apps[r.pkg]?.let { isValidatedVersion(it, versionOf(r.pkg)) } == true }
            val goal = prefs.limits.filter { it.metric == "views" && it.dailyLimit > 0 }.minOfOrNull { it.dailyLimit }
            val feedDecision = app.driftless.tracking.core.FeedLimitPolicy.evaluate(cfg.feed, prefs.feedState,
                date, now, count, goal, badgeSurface, validated, true)
            if (feedDecision.state != prefs.feedState) prefs.feedState = feedDecision.state
            val minutes = row?.let { (maxOf(it.usageMs, it.surfaceMs + it.unknownMs) / 60_000L).toInt() }
            val d = app.driftless.tracking.core.BlockPolicy.decide(
                pkg, cfg, prefs.entitlement, minutes, at.dayOfWeek.value, at.hour * 60 + at.minute,
                prefs.snoozedUntil(pkg), now,
            )
            val bypassed = feedDecision.state.date == date && feedDecision.state.bypassUntilMs > now
            val scopedReason = if (cfg.feedOnly && badgeSurface == Surface.SHORT_VIDEO &&
                (validated || cfg.feed.allowUnvalidated) && d.block && !bypassed) {
                if (d.reason == app.driftless.tracking.core.BlockReason.SCHEDULE) app.driftless.tracking.core.FeedReason.SCHEDULE
                else app.driftless.tracking.core.FeedReason.APP_LIMIT
            } else null
            val reason = feedDecision.reason ?: scopedReason
            if (reason != null) {
                memeCard.hide(); floatingBadge.hide()
                feedPause.show(reason, feedDecision.state.breakUntilMs - now,
                    (cfg.feed.maxBypasses - feedDecision.state.bypasses).coerceAtLeast(0), cfg.feed.bypassMinutes,
                    !validated) {
                    val currentNow = System.currentTimeMillis()
                    val currentDate = Recorder.localDate(currentNow, ZoneId.systemDefault())
                    val currentCfg = prefs.blockConfig
                    if (currentCfg.enabled && app.driftless.tracking.core.BlockPolicy.entitled(prefs.entitlement, currentNow)) {
                        app.driftless.tracking.core.FeedLimitPolicy.bypass(currentCfg.feed, prefs.feedState, currentDate, currentNow)?.let {
                            prefs.feedState = it; feedPause.hide()
                            main.post(classifyTask)
                        }
                    }
                }
                engine.onLeave(now)
                return
            }
            feedPause.hide()
            if (d.block && !cfg.feedOnly && now - lastPauseMs >= PAUSE_COOLDOWN_MS) {
                lastPauseMs = now
                startActivity(
                    Intent(this, PauseActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        .putExtra(PauseActivity.EXTRA_PKG, pkg)
                        .putExtra(PauseActivity.EXTRA_REASON, d.reason?.name),
                )
            }
        }.onFailure { if (::feedPause.isInitialized) feedPause.hide() }
    }

    private fun onTick() {
        if (!::engine.isInitialized) return
        val now = System.currentTimeMillis()
        captureRequestedDebugStructure()
        if (!prefs.disclosureAccepted) {
            engine.onLeave(now)
            hideFloatingCount()
            return
        }
        // Re-entry and overlay dismissal may produce no supported-package event. Always refresh
        // foreground classification on the tick instead of trusting the previous feed state.
        classifyNow()
        if (::feedPause.isInitialized && feedPause.isShowing) { engine.onTick(now); return }
        engine.activePackage?.let { active ->
            // Leave detection: only the foreground package name is read here, never content.
            val fg = rootInActiveWindow?.packageName?.toString()
            if (fg != active) { engine.onLeave(now); hideFloatingCount() } else maybePause(active, now)
        }
        engine.onTick(now)
        engine.activePackage?.let { maybePause(it, now) }
        updateFloatingCount(now)
        if (now - lastGoalCheckMs >= GOAL_CHECK_MS) {
            lastGoalCheckMs = now
            runCatching { GoalNotifier.check(this, SqliteStore.get(this), prefs, now) }
            runCatching { CountWidget.update(this) }
        }
    }

    /** Bridge calls may arrive on another thread; all WindowManager access stays on main. */
    fun refreshFloatingCount() { main.post { if (::engine.isInitialized) updateFloatingCount(System.currentTimeMillis()) } }

    private fun hideFloatingCount() {
        badgeSurface = Surface.UNKNOWN; badgeIdentity = false; badgePackage = null
        if (::floatingBadge.isInitialized) floatingBadge.hide()
        if (::memeCard.isInitialized) memeCard.hide()
        if (::feedPause.isInitialized) feedPause.hide()
    }

    private fun updateFloatingCount(now: Long) {
        if (!::floatingBadge.isInitialized) return
        if (::feedPause.isInitialized && feedPause.isShowing) { floatingBadge.hide(); return }
        val pkg = badgePackage
        val foreground = rootInActiveWindow?.packageName?.toString()
        val power = getSystemService(PowerManager::class.java)
        val keyguard = getSystemService(KeyguardManager::class.java)
        if (!showCountBadge(prefs.floatingCountEnabled && now >= prefs.floatingCountPausedUntil, prefs.disclosureAccepted, power.isInteractive,
                keyguard.isKeyguardLocked, pkg != null && foreground == pkg, badgeSurface)) {
            floatingBadge.hide(); memeCard.hide(); return
        }
        if (pkg == null) return floatingBadge.hide()
        if (rules.apps[pkg] == null) return floatingBadge.hide()
        val today = Recorder.localDate(now, ZoneId.systemDefault())
        // One daily allowance covers Reels and Shorts together across app switches.
        val rows = SqliteStore.get(this).daily(today).filter { it.pkg in rules.apps }
        val value = rows.sumOf { it.views }
        val validated = isValidatedVersion(rules.apps.getValue(pkg), versionOf(pkg)) && rows
            .filter { it.views > 0 }.all { isValidatedVersion(rules.apps.getValue(it.pkg), versionOf(it.pkg)) }
        val limit = prefs.limits.filter { it.metric == "views" && it.dailyLimit > 0 }.minOfOrNull { it.dailyLimit }
        val badge = countBadgeValue(value, validated, badgeIdentity, limit)
        if (!prefs.memeCardsEnabled) memeCard.hide()
        if (badgeIdentity) {
            val milestone = app.driftless.tracking.core.nextMemeMilestone(
                memeDate, memeCount, today, value, prefs.shownMemeMilestone(today))
            memeDate = today; memeCount = value
            if (milestone != null && prefs.memeCardsEnabled && !memeCard.isShowing) {
                val locales = resources.configuration.locales
                val language = app.driftless.tracking.core.MemeLanguages.resolve(
                    (0 until locales.size()).map { locales[it].language })
                if (memeCard.show(badge,milestone,language) {
                    packageManager.getLaunchIntentForPackage(packageName)?.let {
                        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(it)
                    }
                }) {
                    prefs.markMemeMilestone(today,milestone)
                    engine.onLeave(now)
                }
            }
        }
        if (memeCard.isShowing) floatingBadge.hide() else floatingBadge.show(badge)
    }

    private var lastGoalCheckMs = 0L

    private fun saltFor(now: Long): ByteArray {
        val d = Recorder.localDate(now, ZoneId.systemDefault())
        if (d != saltDate) {
            salt = Fingerprint.dailySalt(prefs.installSecret, d)
            saltDate = d
        }
        return salt
    }

    private fun versionOf(pkg: String): String? = versions.getOrPut(pkg) { Health.appVersion(this, pkg) }

    override fun onInterrupt() {
        hideFloatingCount()
        if (::engine.isInitialized) engine.onLeave(System.currentTimeMillis())
    }

    override fun onDestroy() {
        stop()
        super.onDestroy()
    }

    override fun onUnbind(intent: Intent?): Boolean {
        stop()
        return super.onUnbind(intent)
    }

    private fun stop() {
        if (current !== this) return
        hideFloatingCount()
        main.removeCallbacksAndMessages(null)
        if (::engine.isInitialized) engine.onLeave(System.currentTimeMillis())
        runCatching { unregisterReceiver(screenOff) }
        current = null
    }

    /**
     * Debug builds only: structure of the current supported-app window for authoring rules.
     * Contains view ids and class names only — no text, no descriptions.
     */
    fun captureStructure(): String? {
        val root = rootInActiveWindow ?: return null
        val pkg = root.packageName?.toString() ?: return null
        if (!::engine.isInitialized || !engine.isSupported(pkg)) return null
        var budget = 800
        fun walk(n: AccessibilityNodeInfo, depth: Int): JSONObject {
            budget--
            val o = JSONObject()
            n.viewIdResourceName?.let { o.put("id", it.substringAfter(":id/")) }
            o.put("cls", n.className?.toString()?.substringAfterLast('.'))
            o.put("vis", n.isVisibleToUser)
            o.put("scroll", n.isScrollable)
            o.put("hasDesc", !n.contentDescription.isNullOrEmpty())
            o.put("hasText", !n.text.isNullOrEmpty())
            if (depth < 40 && budget > 0) {
                val kids = JSONArray()
                for (i in 0 until n.childCount) {
                    if (budget <= 0) break
                    n.getChild(i)?.let { kids.put(walk(it, depth + 1)) }
                }
                if (kids.length() > 0) o.put("kids", kids)
            }
            return o
        }
        return JSONObject().put("package", pkg).put("appVersion", versionOf(pkg)).put("tree", walk(root, 0)).toString()
    }

    /** One text-free capture requested through an app-private debug marker, never in release. */
    private fun captureRequestedDebugStructure() {
        if (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE == 0) return
        val request = java.io.File(cacheDir, "capture-player-request")
        if (!request.exists()) return
        if (System.currentTimeMillis() - request.lastModified() > 120_000L) { request.delete(); return }
        if (!prefs.disclosureAccepted) { request.delete(); return }
        val json = captureStructure() ?: return
        runCatching {
            val out = java.io.File(cacheDir, "exports/driftless-player-structure.json")
            out.parentFile?.mkdirs(); out.writeText(json); lastCaptureFile = out; request.delete()
            debugTraceUntil = System.currentTimeMillis() + 60_000L
            debugLastIdentity = null
            while (debugTrace.length() > 0) debugTrace.remove(0)
            java.io.File(cacheDir,"exports/driftless-counter-trace.json").writeText("[]")
        }
    }

    /** Debug builds: capture the supported app's structure after [delayMs] and save it to [out]. */
    fun scheduleStructureCapture(delayMs: Long, out: java.io.File) {
        main.postDelayed({
            captureStructure()?.let { json ->
                out.parentFile?.mkdirs()
                out.writeText(json)
                lastCaptureFile = out
            }
        }, delayMs)
    }

    companion object {
        @Volatile var lastCaptureFile: java.io.File? = null
            private set
        const val TICK_MS = 2_000L
        const val GOAL_CHECK_MS = 60_000L
        const val PAUSE_COOLDOWN_MS = 3_000L
        const val SETTLE_MS = 100L
        const val RETENTION_MS = 30L * 24 * 3600 * 1000

        /** The bound instance, if Android is currently running the service. */
        @Volatile var current: DriftlessAccessibilityService? = null
            private set
        @Volatile var lastConnectedMs: Long = 0
            private set
        @Volatile var lastEventMs: Long = 0
            private set
    }
}
