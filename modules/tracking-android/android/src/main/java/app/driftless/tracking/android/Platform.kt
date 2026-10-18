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
                            else -> throw IllegalArgumentException("unknown field ${p.getString("field")}")
                        },
                    )
                },
                adViewIds = a.getJSONArray("adViewIds").strings().toSet(),
                adLabels = a.getJSONArray("adLabels").strings().map { it.lowercase() }.toSet(),
                validatedVersions = a.getJSONArray("validatedVersions").strings(),
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
class TrackingPrefs(context: Context) {
    private val p: SharedPreferences =
        context.applicationContext.getSharedPreferences("driftless_tracking", Context.MODE_PRIVATE)

    var disclosureAccepted: Boolean
        get() = p.getBoolean(KEY_CONSENT, false)
        set(v) = p.edit().putBoolean(KEY_CONSENT, v).putLong(KEY_CONSENT_AT, System.currentTimeMillis()).apply()

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
        p.getStringSet(KEY_SENT, emptySet())!!.filter { it.startsWith("$localDate|") }.toSet()

    fun markSent(localDate: String, keys: Collection<String>) {
        p.edit().putStringSet(KEY_SENT, sentAlerts(localDate) + keys).apply()
    }

    private fun String.hexToBytes(): ByteArray = ByteArray(length / 2) { substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    companion object {
        private const val KEY_CONSENT = "a11y_disclosure_accepted"
        private const val KEY_CONSENT_AT = "a11y_disclosure_accepted_at"
        private const val KEY_SECRET = "fp_install_secret"
        private const val KEY_LIMITS = "goal_limits"
        private const val KEY_SENT = "alerts_sent"
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
