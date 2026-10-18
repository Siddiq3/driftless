package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
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
 * Never: performs actions on other apps, stores node text, takes screenshots, or sends anything
 * off the device. Counting only runs after the in-app prominent disclosure was accepted.
 */
class DriftlessAccessibilityService : AccessibilityService() {
    private val main = Handler(Looper.getMainLooper())
    private val classifier = Classifier()
    private lateinit var rules: RuleSet
    private lateinit var engine: Engine
    private lateinit var prefs: TrackingPrefs

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
            if (i.action == Intent.ACTION_SCREEN_OFF) engine.onLeave(System.currentTimeMillis())
        }
    }

    override fun onServiceConnected() {
        prefs = TrackingPrefs(this)
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
        // Sample once the screen settles. Deduplication is by item fingerprint (D-007), not by this delay.
        if (!classifyScheduled) {
            classifyScheduled = true
            main.postDelayed(classifyTask, SETTLE_MS)
        }
    }

    private fun classifyNow() {
        classifyScheduled = false
        val now = System.currentTimeMillis()
        val root: AccessibilityNodeInfo? = rootInActiveWindow
        val pkg = root?.packageName?.toString()
        val appRules = pkg?.let { rules.apps[it] }
        if (appRules == null) {
            engine.onLeave(now)
            pendingScroll = false
            return
        }
        val c = classifier.classify(A11yNode(root), appRules, saltFor(now))
        engine.onObservation(pkg, versionOf(pkg), c, pendingScroll, now)
        pendingScroll = false
    }

    private fun onTick() {
        if (!::engine.isInitialized) return
        val now = System.currentTimeMillis()
        if (!prefs.disclosureAccepted) {
            engine.onLeave(now)
            return
        }
        engine.activePackage?.let { active ->
            // Leave detection: only the foreground package name is read here, never content.
            val fg = rootInActiveWindow?.packageName?.toString()
            if (fg != active) engine.onLeave(now)
        }
        engine.onTick(now)
    }

    private fun saltFor(now: Long): ByteArray {
        val d = Recorder.localDate(now, ZoneId.systemDefault())
        if (d != saltDate) {
            salt = Fingerprint.dailySalt(prefs.installSecret, d)
            saltDate = d
        }
        return salt
    }

    private fun versionOf(pkg: String): String? = versions.getOrPut(pkg) { Health.appVersion(this, pkg) }

    override fun onInterrupt() = Unit

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
        const val SETTLE_MS = 300L
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
