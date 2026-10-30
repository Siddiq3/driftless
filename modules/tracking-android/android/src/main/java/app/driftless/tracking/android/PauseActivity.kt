package app.driftless.tracking.android

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import app.driftless.tracking.core.BlockPolicy

/**
 * Driftless's own full-screen pause (D-013). It is a normal activity, not an overlay: the user can
 * always leave it (Back, Home, Recents), switch the counter off in Settings, or snooze.
 * It never covers system UI or Driftless itself.
 */
class PauseActivity : Activity() {
    private var ownerScope=""
    private var ownerDate=""
    private val main=android.os.Handler(android.os.Looper.getMainLooper())
    private val refresh=object:Runnable {
        override fun run() {
            val store=SqliteStore.get(this@PauseActivity)
            if(store.activeScope()!=ownerScope || store.account.date()!=ownerDate) {finish();return}
            val pkg=intent.getStringExtra(EXTRA_PKG).orEmpty()
            val reason=intent.getStringExtra(EXTRA_REASON)
            if(reason=="ACCOUNT_CREDIT") {
                val prefs=TrackingPrefs(this@PauseActivity)
                if(!store.account.shouldPause(pkg,prefs.blockConfig,prefs.entitlement,
                    intent.getBooleanExtra(EXTRA_SHORT_VIDEO,true))) {finish();return}
            } else {
                val prefs=TrackingPrefs(this@PauseActivity)
                val saved=prefs.blockConfig
                val cfg=if(store.account.active()) saved.copy(dailyMinutes=null) else saved
                val at=java.time.Instant.ofEpochMilli(store.account.now()).atZone(store.account.zone())
                val row=store.backupDaily(ownerDate).firstOrNull {it.pkg==pkg}
                val minutes=row?.let {(maxOf(it.usageMs,it.surfaceMs+it.unknownMs)/60000).toInt()}
                if(!BlockPolicy.decide(pkg,cfg,prefs.entitlement,minutes,at.dayOfWeek.value,at.hour*60+at.minute,prefs.snoozedUntil(pkg),store.account.now()).block) {finish();return}
            }
            main.postDelayed(this,DriftlessAccessibilityService.TICK_MS)
        }
    }

    override fun onResume() {
        super.onResume()
        if(SqliteStore.get(this).activeScope()!=ownerScope) {finish();return}
        main.removeCallbacks(refresh);main.postDelayed(refresh,DriftlessAccessibilityService.TICK_MS)
    }

    override fun onPause() {
        main.removeCallbacks(refresh)
        super.onPause()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        renderPause()
    }

    override fun onNewIntent(next: Intent) {
        super.onNewIntent(next)
        setIntent(next)
        main.removeCallbacks(refresh)
        renderPause()
        if (!isFinishing) main.postDelayed(refresh,DriftlessAccessibilityService.TICK_MS)
    }

    private fun renderPause() {
        val pkg = intent.getStringExtra(EXTRA_PKG).orEmpty()
        val reason = intent.getStringExtra(EXTRA_REASON).orEmpty()
        val prefs = TrackingPrefs(this)
        val store=SqliteStore.get(this)
        ownerScope=intent.getStringExtra(EXTRA_SCOPE) ?: store.activeScope()
        ownerDate=store.account.date()
        if(ownerScope!=store.activeScope()) {finish();return}
        if(reason=="ACCOUNT_CREDIT" && !store.account.shouldPause(pkg,prefs.blockConfig,prefs.entitlement,
            intent.getBooleanExtra(EXTRA_SHORT_VIDEO,true))) {finish();return}
        val renderScope=ownerScope
        val renderDate=ownerDate
        val label = RulesLoader.load(this).apps[pkg]?.label ?: "this app"

        @Suppress("DEPRECATION")
        window.apply {
            statusBarColor = PauseStyle.indigo
            navigationBarColor = PauseStyle.background
        }
        val surface = PauseSurface(this)
        val account = reason == "ACCOUNT_CREDIT"
        val scheduled = reason == "SCHEDULE"
        val snoozesLeft = BlockPolicy.MAX_SNOOZES_PER_DAY - prefs.snoozesToday()
        surface.present(
            state = if (account) "Allowance needs a refresh" else if (scheduled) "Focus time" else "Daily limit reached",
            title = if (account) "Let’s reconnect." else if (scheduled) "Your offline moment." else "Less feed. More you.",
            body = if (account) "Your account allowance is used or needs a refresh. Open ScrollSnooze to check your available time."
                else if (scheduled) "You set this time aside. $label can wait."
                else "You’ve reached your daily app limit. Make a little room for the rest of your day.",
            explanation = if (account) "Account credit is exhausted or cannot be verified. Reconnect to refresh your reserved allowance. Other offline devices may hold reserved credit. Credit follows your fixed account timezone: ${store.account.zone().id}. Reconnect after the account day changes. Usage continues to be recorded."
                else if (scheduled) "Your focus schedule is active for $label. Home and Back are always available. Manage pauses in ScrollSnooze or Android Accessibility settings. Media may keep playing underneath."
                else "Your daily app-minute limit is reached. Limits reset on the next local day. Home and Back are always available. Manage pauses in ScrollSnooze or Android Accessibility settings. Media may keep playing underneath.",
        )
        surface.action("Leave feed", primary = true) { goHome() }
        if (snoozesLeft > 0 && !account) {
            surface.action("5 more minutes · $snoozesLeft left today") {
                if (!isFinishing && store.activeScope() == renderScope && store.account.date() == renderDate && prefs.snoozesToday() < BlockPolicy.MAX_SNOOZES_PER_DAY) {
                    prefs.snooze(pkg, store.account.now() + BlockPolicy.SNOOZE_MS)
                    finish()
                }
            }
        }
        surface.action("Open ScrollSnooze") {
            packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
            finish()
        }
        setContentView(surface)
    }

    @Deprecated("Back leaves the blocked app, like Leave feed.")
    override fun onBackPressed() {
        goHome()
    }

    private fun goHome() {
        startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }

    companion object {
        const val EXTRA_SHORT_VIDEO = "short_video"
        const val EXTRA_SCOPE = "scope"
        const val EXTRA_PKG = "pkg"
        const val EXTRA_REASON = "reason"
    }
}
