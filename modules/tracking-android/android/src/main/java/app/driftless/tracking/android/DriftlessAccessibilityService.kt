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
    private lateinit var wrapReady: WrapReadyOverlay
    private var wrapPromptedThisVisit = false
    private var wrapCheckedAt = 0L
    private var memeDate: String? = null
    private var memeCount: Int? = null
    private lateinit var floatingBadge: FloatingCountBadge
    private var badgeSurface = Surface.UNKNOWN
    private var badgeIdentity = false
    private var badgePackage: String? = null
    private var debugTraceUntil = 0L
    private var debugLastIdentity: String? = null
    private var debugLastShortKey: String? = null
    private val debugTrace = org.json.JSONArray()


    private var pendingScroll = false
    private var pendingScrollPackage: String? = null
    private var lastCallbackUptime = -1L
    @Volatile var isOperational = false
        private set
    private var classifyScheduled = false
    private var lastClassificationUptime = -1L
    private var saltDate: String? = null
    private var salt: ByteArray = ByteArray(0)
    private val versions = HashMap<String, String?>()

    private val classifyTask = Runnable { classifyNow() }
    private val tick = object : Runnable {
        override fun run() {
            if(!isOperational) return
            runCatching { onTick() }.onFailure { onInterrupt() }
            if(isOperational) main.postDelayed(this, TICK_MS)
        }
    }
    private val screenOff = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            if (i.action == Intent.ACTION_SCREEN_OFF) {
                engine.onLeave(SqliteStore.get(this@DriftlessAccessibilityService).account.now()); hideFloatingCount()
                main.removeCallbacks(classifyTask);classifyScheduled=false
                pendingScroll=false;pendingScrollPackage=null;playerTransition.reset();lastPauseToken=null
            }
        }
    }

    override fun onServiceConnected() {
        if(current===this) stop()
        main.removeCallbacksAndMessages(null)
        versions.clear(); playerTransition.reset(); pendingScroll=false; pendingScrollPackage=null
        lastClassificationUptime=-1L
        lastCallbackUptime=-1L; lastPauseToken=null; lastPauseMs=0L; lastGoalCheckMs=0L
        prefs = TrackingPrefs(this)
        floatingBadge = FloatingCountBadge(this)
        memeCard = MemeMilestoneCard(this)
        feedPause = FeedPauseOverlay(this)
        wrapReady = WrapReadyOverlay(this)
        rules = RulesLoader.load(this)
        val store = SqliteStore.get(this)
        val now = SqliteStore.get(this@DriftlessAccessibilityService).account.now()
        store.purgeOlderThan(now - RETENTION_MS, Recorder.localDate(now - RETENTION_MS, SqliteStore.get(this@DriftlessAccessibilityService).account.zone()))
        engine = Engine(store.capturedStore(), rules, zone = store.capturedZone())
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            // System broadcasts still reach a non-exported receiver.
            registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF))
        }
        isOperational=true
        current = this
        main.post(classifyTask)
        main.post(tick)
        lastConnectedMs = now
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (current !== this || event == null || !::engine.isInitialized || !prefs.disclosureAccepted) return
        lastEventMs = SqliteStore.get(this@DriftlessAccessibilityService).account.now()
        val pkg = event.packageName?.toString() ?: return
        if (!engine.isSupported(pkg)) return
        if(event.eventTime>0 && event.eventTime<lastCallbackUptime) return
        if(event.eventTime>0) lastCallbackUptime=event.eventTime
        if(!isOperational) {
            isOperational=true
            main.removeCallbacks(tick);main.post(tick)
        }
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED &&
            (event.eventTime<=0 || android.os.SystemClock.uptimeMillis()-event.eventTime<=app.driftless.tracking.core.ViewCounter.IDENTITY_SETTLE_MS)) {
            pendingScroll = true;pendingScrollPackage=pkg
        }
        // Sample the transition immediately and again after settling. Waiting for only the final
        // frame can miss YouTube's short-lived empty player subtree (no scroll event is emitted).
        // Deduplication remains by item identity and dwell, never by callback frequency.
        val uptime = android.os.SystemClock.uptimeMillis()
        // YouTube can replace its caption/control subtree entirely inside the trailing
        // settle window without a scroll event. Sample fresh roots during the burst too,
        // at most once per frame budget; otherwise that replacement is never observed.
        // Keep one trailing read, not one queued task per callback. Other apps are unchanged.
        val sampleYouTubeBurst = pkg == "com.google.android.youtube" &&
            uptime - lastClassificationUptime >= YOUTUBE_BURST_SAMPLE_MS
        if (!classifyScheduled || sampleYouTubeBurst) {
            classifyNow()
            main.removeCallbacks(classifyTask)
            classifyScheduled = true
            main.postDelayed(classifyTask, if (pkg == "com.google.android.youtube")
                app.driftless.tracking.core.PlayerTransition.IDENTITY_DEBOUNCE_MS else SETTLE_MS)
        }
    }

    private fun classifyNow() {
        main.removeCallbacks(classifyTask)
        classifyScheduled = false
        if(!isOperational) return
        lastClassificationUptime = android.os.SystemClock.uptimeMillis()
        val now = SqliteStore.get(this@DriftlessAccessibilityService).account.now()
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
            pendingScroll = false;pendingScrollPackage=null
            playerTransition.reset();lastPauseToken=null
            return
        }
        val c = classifier.classify(A11yNode(root), appRules, saltFor(now))
        val replaced = playerTransition.observe(pkg, if (pkg == "com.google.android.youtube") c
            else c.copy(identitySignals = emptySet()), now)
        if (::feedPause.isInitialized && feedPause.isShowing) {
            engine.onLeave(now)
            badgeSurface = c.surface; badgeIdentity = c.fingerprint != null; badgePackage = pkg
            maybePause(pkg, now)
            if (!feedPause.isShowing) main.post(classifyTask)
            pendingScroll = false
            return
        }
        if (::wrapReady.isInitialized && wrapReady.isShowing) {
            engine.onLeave(now)
            badgeSurface = c.surface; badgeIdentity = c.fingerprint != null; badgePackage = pkg
            if (c.surface != Surface.SHORT_VIDEO) hideFloatingCount() else maybePause(pkg, now)
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
        engine.onObservation(pkg, versionOf(pkg), c, (pendingScroll && pendingScrollPackage==pkg) || replaced, now)
        if (pkg == "com.google.android.youtube" && c.fingerprint != null && c.fingerprint != debugLastShortKey &&
            (replaced || (pendingScroll && pendingScrollPackage == pkg) || badgeSurface != Surface.SHORT_VIDEO || badgePackage != pkg) &&
            (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            android.util.Log.d("DriftlessTracking", "new short detected itemKey=${c.fingerprint}")
            debugLastShortKey = c.fingerprint
        }
        if (playerTransition.awaitingIdentity) {
            classifyScheduled = true
            main.postDelayed(classifyTask, app.driftless.tracking.core.PlayerTransition.IDENTITY_DEBOUNCE_MS)
        }
        pendingScroll = false
        badgeSurface = c.surface; badgeIdentity = c.fingerprint != null; badgePackage = pkg
        maybePause(pkg, now)
        maybeShowWrap(now)
        updateFloatingCount(now)
    }

    private var lastPauseMs = 0L
    private var lastPauseToken: String? = null
    private fun showPause(pkg:String,reason:String,now:Long) {
        val store=SqliteStore.get(this)
        val token="${store.activeScope()}:${store.account.date()}:$pkg:$reason"
        if(token==lastPauseToken || now-lastPauseMs<PAUSE_COOLDOWN_MS) return
        if (::wrapReady.isInitialized) wrapReady.hide()
        startActivity(Intent(this,PauseActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(PauseActivity.EXTRA_PKG,pkg).putExtra(PauseActivity.EXTRA_REASON,reason)
            .putExtra(PauseActivity.EXTRA_SCOPE,store.activeScope())
            .putExtra(PauseActivity.EXTRA_SHORT_VIDEO,badgeSurface==Surface.SHORT_VIDEO))
        lastPauseMs=now;lastPauseToken=token
    }

    /** Shows Driftless's own pause screen under the current feature-access policy. */
    private fun maybePause(pkg: String, now: Long) {
        runCatching {
            val store=SqliteStore.get(this)
            val accounting=store.account.active()
            val saved = prefs.blockConfig
            if(store.account.shouldPause(pkg,saved,prefs.entitlement,badgeSurface==Surface.SHORT_VIDEO)) {
                showPause(pkg,"ACCOUNT_CREDIT",now)
                feedPause.hide(); return
            }
            val cfg = if(accounting) saved.copy(dailyMinutes=null,feed=saved.feed.copy(enforceGoal=false)) else saved
            if (!cfg.enabled || pkg !in cfg.apps || !app.driftless.tracking.core.FeatureAccess.focusAllowed(prefs.entitlement, now)) {
                feedPause.hide(); return
            }
            val zone = SqliteStore.get(this@DriftlessAccessibilityService).account.zone()
            val at = java.time.Instant.ofEpochMilli(now).atZone(zone)
            val date = at.toLocalDate().toString()
            val rows = if(accounting) store.daily(date) else store.backupDaily(date)
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
                memeCard.hide(); floatingBadge.hide(); wrapReady.hide()
                val pauseScope=store.activeScope()
                val pauseDate=date
                feedPause.show(reason, feedDecision.state.breakUntilMs - now,
                    (cfg.feed.maxBypasses - feedDecision.state.bypasses).coerceAtLeast(0), cfg.feed.bypassMinutes,
                    !validated) {
                    val currentNow = SqliteStore.get(this@DriftlessAccessibilityService).account.now()
                    val currentDate = Recorder.localDate(currentNow, SqliteStore.get(this@DriftlessAccessibilityService).account.zone())
                    val currentCfg = prefs.blockConfig
                    if (store.activeScope()==pauseScope && currentDate==pauseDate && currentCfg.enabled && app.driftless.tracking.core.FeatureAccess.focusAllowed(prefs.entitlement, currentNow)) {
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
            if (d.block && !cfg.feedOnly) showPause(pkg,d.reason!!.name,now)

        }.onFailure { if (::feedPause.isInitialized) feedPause.hide() }
    }

    private fun onTick() {
        if (!::engine.isInitialized) return
        val now = SqliteStore.get(this@DriftlessAccessibilityService).account.now()
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
        maybeShowWrap(now)
        updateFloatingCount(now)
        if (now - lastGoalCheckMs >= GOAL_CHECK_MS) {
            lastGoalCheckMs = now
            runCatching { GoalNotifier.check(this, SqliteStore.get(this), prefs, now) }
            runCatching { CountWidget.update(this) }
        }
    }

    fun changeDataScope(next: String) {
        val action = {
            if (::engine.isInitialized) engine.onLeave(SqliteStore.get(this@DriftlessAccessibilityService).account.now())
            SqliteStore.get(this).selectScope(next)
            engine = Engine(SqliteStore.get(this).capturedStore(), rules, zone = SqliteStore.get(this).capturedZone())
            hideFloatingCount()
            main.removeCallbacks(classifyTask);classifyScheduled=false
            pendingScroll=false;pendingScrollPackage=null;playerTransition.reset()
            lastPauseToken=null;lastPauseMs=0L;lastGoalCheckMs=0L
            saltDate=null
            memeDate = null; memeCount = null
        }
        if (Looper.myLooper() == Looper.getMainLooper()) action() else {
            val done = java.util.concurrent.CountDownLatch(1)
            var failure: Throwable? = null
            main.post { try { action() } catch (e: Throwable) { failure = e } finally { done.countDown() } }
            check(done.await(5, java.util.concurrent.TimeUnit.SECONDS)) { "Scope transition timed out" }
            failure?.let { throw it }
        }
    }

    /** A verified clock anchor may replace an untrusted wall clock. Recreate only this
     * scope's recorder, without selecting/rebinding a dataset from a delayed bridge call. */
    fun refreshAccountClock(expectedScope:String) {
        main.post {
            val store=SqliteStore.get(this)
            if(current!==this || store.activeScope()!=expectedScope || !::engine.isInitialized) return@post
            engine.onLeave(store.account.now())
            engine=Engine(store.capturedStore(),rules,zone=store.capturedZone())
            hideFloatingCount();playerTransition.reset();pendingScroll=false;pendingScrollPackage=null
            lastPauseToken=null;lastPauseMs=0L;lastGoalCheckMs=0L
        }
    }

    /** Bridge calls may arrive on another thread; all WindowManager access stays on main. */
    fun refreshFloatingCount() { main.post { if (::engine.isInitialized) updateFloatingCount(SqliteStore.get(this@DriftlessAccessibilityService).account.now()) } }

    private fun hideFloatingCount() {
        badgeSurface = Surface.UNKNOWN; badgeIdentity = false; badgePackage = null
        if (::floatingBadge.isInitialized) floatingBadge.hide()
        if (::memeCard.isInitialized) memeCard.hide()
        if (::feedPause.isInitialized) feedPause.hide()
        if (::wrapReady.isInitialized) wrapReady.hide()
        wrapPromptedThisVisit = false; wrapCheckedAt = 0L
    }

    private fun maybeShowWrap(now: Long) {
        if (!::wrapReady.isInitialized || wrapReady.isShowing || wrapPromptedThisVisit ||
            feedPause.isShowing || memeCard.isShowing || !prefs.disclosureAccepted ||
            badgeSurface != Surface.SHORT_VIDEO || !badgeIdentity) return
        val pkg = badgePackage ?: return
        if (pkg !in rules.apps || rootInActiveWindow?.packageName?.toString() != pkg ||
            !getSystemService(PowerManager::class.java).isInteractive ||
            getSystemService(KeyguardManager::class.java).isKeyguardLocked ||
            (lastPauseMs > 0 && now - lastPauseMs < PAUSE_COOLDOWN_MS) ||
            (wrapCheckedAt > 0 && now - wrapCheckedAt < GOAL_CHECK_MS)) return
        wrapCheckedAt = now
        runCatching {
            val store = SqliteStore.get(this)
            val wrap = WrapReady.next(store, rules.apps.keys, prefs) ?: return
            val scope = store.activeScope()
            if (wrapReady.show(wrap) {
                // A delayed overlay tap must never open a different account's recap.
                if (store.activeScope() == scope) {
                    val uri = android.net.Uri.Builder().scheme("scrollsnooze").authority("")
                        .path("/wrapped").appendQueryParameter("period", wrap.period)
                        .appendQueryParameter("end", wrap.end).build()
                    runCatching {
                        startActivity(Intent(Intent.ACTION_VIEW, uri).setPackage(packageName)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                }
            }) {
                prefs.markWrapShown(wrap)
                wrapPromptedThisVisit = true
                floatingBadge.hide()
                engine.onLeave(now)
            }
        }
    }

    private fun updateFloatingCount(now: Long) {
        if (!::floatingBadge.isInitialized) return
        if ((::feedPause.isInitialized && feedPause.isShowing) ||
            (::wrapReady.isInitialized && wrapReady.isShowing)) { floatingBadge.hide(); return }
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
        val today = Recorder.localDate(now, SqliteStore.get(this@DriftlessAccessibilityService).account.zone())
        // One daily allowance covers Reels and Shorts together across app switches.
        val rows = SqliteStore.get(this).daily(today).filter { it.pkg in rules.apps }
        val store=SqliteStore.get(this)
        val measurement=store.personalMeasurement(today,rules.apps.keys)["views"] as? Number
        val value=measurement?.toLong()?.coerceIn(0,Int.MAX_VALUE.toLong())?.toInt() ?: 0
        val validated = isValidatedVersion(rules.apps.getValue(pkg), versionOf(pkg)) && rows
            .filter { it.views > 0 }.all { isValidatedVersion(rules.apps.getValue(it.pkg), versionOf(it.pkg)) }
        val limit = (if(store.account.active()) store.account.goalLimits() else prefs.limits).filter { it.metric == "views" && it.dailyLimit > 0 }.minOfOrNull { it.dailyLimit }
        val badge = countBadgeValue(measurement,validated,badgeIdentity,limit).let {
            if(measurement!=null && store.account.active()) it.copy(status="Account total") else it
        }
        if (!prefs.memeCardsEnabled) memeCard.hide()
        if (badgeIdentity && measurement!=null) {
            val milestone = app.driftless.tracking.core.nextMemeMilestone(
                memeDate, memeCount, today, value, prefs.shownMemeMilestone(today))
            memeDate = today; memeCount = value
            if (milestone != null && prefs.memeCardsEnabled && !memeCard.isShowing) {
                val locales = resources.configuration.locales
                val language = app.driftless.tracking.core.MemeLanguages.resolve(
                    (0 until locales.size()).map { locales[it].language })
                if (memeCard.show(badge,milestone,language, shorts = pkg == "com.google.android.youtube") {
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
        val d = Recorder.localDate(now, SqliteStore.get(this@DriftlessAccessibilityService).account.zone())
        if (d != saltDate) {
            salt = Fingerprint.dailySalt(prefs.installSecret, d)
            saltDate = d
        }
        return salt
    }

    private var versionsCheckedAt=0L
    private fun versionOf(pkg: String): String? {
        val now=android.os.SystemClock.elapsedRealtime()
        if(now-versionsCheckedAt>=60_000 || now<versionsCheckedAt) {versions.clear();versionsCheckedAt=now}
        return versions.getOrPut(pkg) { Health.appVersion(this,pkg) }
    }

    override fun onInterrupt() {
        isOperational=false
        main.removeCallbacks(classifyTask);main.removeCallbacks(tick);classifyScheduled=false
        pendingScroll=false;pendingScrollPackage=null;playerTransition.reset()
        hideFloatingCount()
        if (::engine.isInitialized) engine.onLeave(SqliteStore.get(this@DriftlessAccessibilityService).account.now())
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
        isOperational=false
        classifyScheduled=false;pendingScroll=false;pendingScrollPackage=null;playerTransition.reset()
        hideFloatingCount()
        main.removeCallbacksAndMessages(null)
        if (::engine.isInitialized) engine.onLeave(SqliteStore.get(this@DriftlessAccessibilityService).account.now())
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
        if (SqliteStore.get(this@DriftlessAccessibilityService).account.now() - request.lastModified() > 120_000L) { request.delete(); return }
        if (!prefs.disclosureAccepted) { request.delete(); return }
        val json = captureStructure() ?: return
        runCatching {
            val out = java.io.File(cacheDir, "exports/driftless-player-structure.json")
            out.parentFile?.mkdirs(); out.writeText(json); lastCaptureFile = out; request.delete()
            debugTraceUntil = SqliteStore.get(this@DriftlessAccessibilityService).account.now() + 60_000L
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
        /** Cap event-driven root traversals during YouTube content-change bursts (~31/s). */
        const val YOUTUBE_BURST_SAMPLE_MS = 32L
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
