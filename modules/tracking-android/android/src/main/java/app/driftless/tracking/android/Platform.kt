package app.driftless.tracking.android

import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityNodeInfo
import app.driftless.tracking.core.AppRules
import app.driftless.tracking.core.Field
import app.driftless.tracking.core.ItemPart
import app.driftless.tracking.core.RuleSet
import app.driftless.tracking.core.UiNode
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom

/** Loads the bundled, versioned detection rules (assets/driftless_rules.json). */
object RulesLoader {
    const val ASSET = "driftless_rules.json"

    fun load(context: Context): RuleSet =
        parse(context.assets.open(ASSET).bufferedReader().use { it.readText() })

    fun parse(json: String): RuleSet {
        val root = JSONObject(json)
        val apps = root.getJSONArray("apps")
        val map = LinkedHashMap<String, AppRules>()
        for (i in 0 until apps.length()) {
            val a = apps.getJSONObject(i)
            val parts = a.getJSONArray("itemParts")
            val r = AppRules(
                pkg = a.getString("package"),
                label = a.getString("label"),
                surfaceViewIds = a.getJSONArray("surfaceViewIds").strings().toSet(),
                itemParts = (0 until parts.length()).map {
                    val p = parts.getJSONObject(it)
                    ItemPart(
                        p.getString("viewId"),
                        when (p.getString("field")) {
                            "contentDesc" -> Field.CONTENT_DESC
                            "text" -> Field.TEXT
                            "captionText" -> Field.CAPTION_TEXT
                            else -> throw IllegalArgumentException("unknown field ${p.getString("field")}")
                        },
                    )
                },
                adViewIds = a.getJSONArray("adViewIds").strings().toSet(),
                adLabels = a.getJSONArray("adLabels").strings().map { it.lowercase() }.toSet(),
                validatedVersions = a.optJSONArray("validatedVersions")?.strings().orEmpty(),
                captionDescriptionViewIds = a.optJSONArray("captionDescriptionViewIds")?.strings()?.toSet().orEmpty(),
            )
            map[r.pkg] = r
        }
        return RuleSet(root.getInt("version"), map)
    }

    private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }
}

/** Wraps AccessibilityNodeInfo. Children are fetched lazily; text is read only when asked. */
class A11yNode(private val n: AccessibilityNodeInfo) : UiNode {
    override val viewId: String? = n.viewIdResourceName?.substringAfter(":id/")
    override val className: String? get() = n.className?.toString()
    override val contentDesc: String? get() = n.contentDescription?.toString()
    override val text: String? get() = n.text?.toString()
    override val isVisible: Boolean get() = n.isVisibleToUser
    override val childCount: Int get() = n.childCount
    override fun child(i: Int): UiNode? = n.getChild(i)?.let(::A11yNode)
}

/** Small, non-sensitive settings: consent flag and the per-install fingerprint secret. */
class TrackingPrefs(private val context: Context) {
    private fun scoped(key:String):String = "$key|${SqliteStore.get(context).activeScope()}"
    private fun today():String = SqliteStore.get(context).account.date()
    private val p: SharedPreferences =
        context.applicationContext.getSharedPreferences("driftless_tracking", Context.MODE_PRIVATE)

    var disclosureAccepted: Boolean
        get() = p.getBoolean(KEY_CONSENT, false) &&
            p.getInt(KEY_CONSENT_VERSION, 0) == CURRENT_DISCLOSURE_VERSION
        set(v) = p.edit()
            .putBoolean(KEY_CONSENT, v)
            .putInt(KEY_CONSENT_VERSION, if (v) CURRENT_DISCLOSURE_VERSION else 0)
            .putLong(KEY_CONSENT_AT, System.currentTimeMillis())
            .apply()

    var floatingCountEnabled: Boolean
        get() = p.getBoolean("floating_count_enabled", true)
        set(v) = p.edit().putBoolean("floating_count_enabled", v).apply()

    var floatingCountSize: Int
        get() = p.getInt("floating_count_size", 54).coerceIn(40, 80)
        set(v) = p.edit().putInt("floating_count_size", v.coerceIn(40, 80)).apply()

    var floatingCountPausedUntil: Long
        get() = p.getLong("floating_count_paused_until", 0L)
        set(v) = p.edit().putLong("floating_count_paused_until", v).apply()

    var badgeX: Float
        get() = p.getFloat("badge_x", 0.5f)
        set(v) = p.edit().putFloat("badge_x", v.coerceIn(0f, 1f)).apply()
    var badgeY: Float
        get() = p.getFloat("badge_y", 0f)
        set(v) = p.edit().putFloat("badge_y", v.coerceIn(0f, 1f)).apply()

    var memeCardsEnabled: Boolean
        get() = p.getBoolean("meme_cards_enabled", true)
        set(v) = p.edit().putBoolean("meme_cards_enabled", v).apply()

    fun shownMemeMilestone(date: String): Int =
        if (p.getString("meme_date", null) == date) p.getInt("meme_milestone", 0) else 0

    fun markMemeMilestone(date: String, milestone: Int) {
        p.edit().putString("meme_date", date).putInt("meme_milestone", milestone).commit()
    }

    fun clearMemeHistory() {
        p.edit().remove("meme_date").remove("meme_milestone").remove("meme_language")
            .remove("meme_cards_enabled").apply()
    }

    val installSecret: ByteArray
        @Synchronized get() {
            p.getString(KEY_SECRET, null)?.let { return it.hexToBytes() }
            val b = ByteArray(32).also { SecureRandom().nextBytes(it) }
            p.edit().putString(KEY_SECRET, b.joinToString("") { "%02x".format(it) }).apply()
            return b
        }

    /** Goals mirrored from the app so the service can alert without JS running. */
    var limits: List<app.driftless.tracking.core.Limit>
        get() {
            val raw = p.getString(KEY_LIMITS, null) ?: return emptyList()
            val arr = org.json.JSONArray(raw)
            return (0 until arr.length()).map {
                val o = arr.getJSONObject(it)
                app.driftless.tracking.core.Limit(o.getString("metric"), o.getInt("dailyLimit"))
            }
        }
        set(v) {
            val arr = org.json.JSONArray()
            v.forEach { arr.put(org.json.JSONObject().put("metric", it.metric).put("dailyLimit", it.dailyLimit)) }
            p.edit().putString(KEY_LIMITS, arr.toString()).apply()
        }

    /** Alert keys already sent; only today's are kept. */
    fun sentAlerts(localDate: String): Set<String> =
        p.getStringSet(scoped(KEY_SENT), emptySet())!!.filter { it.startsWith("$localDate|") }.toSet()

    fun markSent(localDate: String, keys: Collection<String>) {
        p.edit().putStringSet(scoped(KEY_SENT), sentAlerts(localDate) + keys).apply()
    }

    /** Blocking config from the app (Pro). Stored natively so blocking works with the app closed. */
    var blockConfig: app.driftless.tracking.core.BlockConfig
        get() {
            val raw = p.getString(KEY_BLOCK, null) ?: return app.driftless.tracking.core.BlockConfig(false, emptySet(), null, emptyList())
            val o = org.json.JSONObject(raw)
            val apps = o.getJSONArray("apps").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() }
            val sch = o.getJSONArray("schedules").let { a ->
                (0 until a.length()).map {
                    val x = a.getJSONObject(it)
                    val days = x.getJSONArray("days").let { d -> (0 until d.length()).map { i -> d.getInt(i) }.toSet() }
                    app.driftless.tracking.core.Schedule(days, x.getInt("startMinute"), x.getInt("endMinute"))
                }
            }
            return app.driftless.tracking.core.BlockConfig(
                o.getBoolean("enabled"),
                apps,
                if (o.isNull("dailyMinutes")) null else o.getInt("dailyMinutes"),
                sch,
                o.optBoolean("feedOnly", false),
                app.driftless.tracking.core.FeedSettings(
                    o.optBoolean("enforceVideoGoal", false), o.optBoolean("breaksEnabled", false),
                    o.optInt("breakEveryViews", 50).coerceIn(1, 2000), o.optInt("breakMinutes", 5).coerceIn(1, 60),
                    o.optInt("maxBypassesPerDay", 3).coerceIn(0, 10), o.optInt("bypassMinutes", 5).coerceIn(1, 30),
                    o.optBoolean("allowUnvalidatedCounts", false),
                ),
            )
        }
        set(c) {
            val o = org.json.JSONObject()
                .put("enabled", c.enabled)
                .put("apps", org.json.JSONArray(c.apps.toList()))
                .put("dailyMinutes", c.dailyMinutes ?: org.json.JSONObject.NULL)
                .put("feedOnly", c.feedOnly).put("enforceVideoGoal", c.feed.enforceGoal)
                .put("breaksEnabled", c.feed.breaksEnabled).put("breakEveryViews", c.feed.everyViews)
                .put("breakMinutes", c.feed.breakMinutes).put("maxBypassesPerDay", c.feed.maxBypasses)
                .put("bypassMinutes", c.feed.bypassMinutes).put("allowUnvalidatedCounts", c.feed.allowUnvalidated)
                .put(
                    "schedules",
                    org.json.JSONArray().apply {
                        c.schedules.forEach {
                            put(
                                org.json.JSONObject().put("days", org.json.JSONArray(it.days.toList()))
                                    .put("startMinute", it.startMinute).put("endMinute", it.endMinute),
                            )
                        }
                    },
                )
            p.edit().putString(KEY_BLOCK, o.toString()).apply()
        }

    /** Server-verified entitlement cache (never set from user input). */
    var entitlement: app.driftless.tracking.core.CachedEntitlement
        get() = app.driftless.tracking.core.CachedEntitlement(
            p.getBoolean(KEY_PRO, false),
            if (p.contains(KEY_PRO_UNTIL)) p.getLong(KEY_PRO_UNTIL, 0) else null,
        )
        set(e) {
            p.edit().putBoolean(KEY_PRO, e.pro).apply {
                if (e.validUntilMs == null) remove(KEY_PRO_UNTIL) else putLong(KEY_PRO_UNTIL, e.validUntilMs)
            }.apply()
        }

    fun snoozedUntil(pkg: String): Long =
        if(p.getString(scoped(KEY_SNOOZE_DATE),null)==today()) p.getLong(scoped("$KEY_SNOOZE$pkg"),0) else 0

    var feedState: app.driftless.tracking.core.FeedState
        get() {
            val o = runCatching { org.json.JSONObject(p.getString(scoped("feed_pause_state"), "{}")!!) }.getOrDefault(org.json.JSONObject())
            return app.driftless.tracking.core.FeedState(o.optString("date", ""), o.optInt("milestone", 0),
                o.optLong("breakUntil", 0), o.optLong("bypassUntil", 0), o.optInt("bypasses", 0))
        }

        set(s) {
            p.edit().putString(scoped("feed_pause_state"), org.json.JSONObject().put("date", s.date)
                .put("milestone", s.milestone).put("breakUntil", s.breakUntilMs)
                .put("bypassUntil", s.bypassUntilMs).put("bypasses", s.bypasses).toString()).apply()
        }

    fun clearFeedState() { p.edit().remove(scoped("feed_pause_state")).apply() }

    fun snoozesToday(): Int {
        val today = today()
        return if (p.getString(scoped(KEY_SNOOZE_DATE), null) == today) p.getInt(scoped(KEY_SNOOZE_COUNT), 0) else 0
    }

    fun snooze(pkg: String, untilMs: Long) {
        val today = today()
        p.edit().putLong(scoped("$KEY_SNOOZE$pkg"), untilMs).putString(scoped(KEY_SNOOZE_DATE), today)
            .putInt(scoped(KEY_SNOOZE_COUNT), snoozesToday() + 1).apply()
    }

    private fun String.hexToBytes(): ByteArray = ByteArray(length / 2) { substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    companion object {
        private const val CURRENT_DISCLOSURE_VERSION = 2
        private const val KEY_CONSENT = "a11y_disclosure_accepted"
        private const val KEY_CONSENT_AT = "a11y_disclosure_accepted_at"
        private const val KEY_CONSENT_VERSION = "a11y_disclosure_version"
        private const val KEY_SECRET = "fp_install_secret"
        private const val KEY_LIMITS = "goal_limits"
        private const val KEY_SENT = "alerts_sent"
        private const val KEY_BLOCK = "block_config"
        private const val KEY_PRO = "ent_pro"
        private const val KEY_PRO_UNTIL = "ent_valid_until"
        private const val KEY_SNOOZE = "snooze_until_"
        private const val KEY_SNOOZE_DATE = "snooze_date"
        private const val KEY_SNOOZE_COUNT = "snooze_count"
    }
}

object Health {
    fun serviceComponent(context: Context) = ComponentName(context, DriftlessAccessibilityService::class.java)

    /** The user has switched our service on in Settings > Accessibility. */
    fun serviceEnabled(context: Context): Boolean {
        val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        val me = serviceComponent(context)
        return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
    }

    fun appVersion(context: Context, pkg: String): String? = try {
        val pm = context.packageManager
        if (Build.VERSION.SDK_INT >= 33) {
            pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0)).versionName
        } else {
            @Suppress("DEPRECATION")
            pm.getPackageInfo(pkg, 0).versionName
        }
    } catch (_: PackageManager.NameNotFoundException) {
        null
    }
}
