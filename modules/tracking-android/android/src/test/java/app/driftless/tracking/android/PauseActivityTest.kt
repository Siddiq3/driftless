package app.driftless.tracking.android

import android.content.Context
import android.content.Intent
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.core.BlockPolicy
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class PauseActivityTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val pkg = "com.google.android.youtube"

    @Before fun reset() {
        context.getSharedPreferences("driftless_tracking", Context.MODE_PRIVATE).edit().clear().commit()
        val store=SqliteStore.get(context);store.selectScope("guest:phase3-pause")
        store.setUsage(store.account.date(),pkg,60000)
        TrackingPrefs(context).blockConfig=app.driftless.tracking.core.BlockConfig(true,setOf(pkg),1,emptyList())
    }
    @After fun cleanup() { context.getSharedPreferences("driftless_tracking", Context.MODE_PRIVATE).edit().clear().commit() }

    private fun views(view: View): List<View> = listOf(view) +
        if (view is ViewGroup) (0 until view.childCount).flatMap { views(view.getChildAt(it)) } else emptyList()
    private fun find(activity: PauseActivity, prefix: String) = views(activity.window.decorView)
        .filterIsInstance<TextView>().first { it.text.startsWith(prefix) }
    private fun launch(reason: String = "LIMIT") = Robolectric.buildActivity(PauseActivity::class.java,
        Intent(context, PauseActivity::class.java).putExtra(PauseActivity.EXTRA_PKG, pkg).putExtra(PauseActivity.EXTRA_REASON, reason)).setup()

    @Test fun systemInsetsAreReplacedOnWindowChangesWithoutAccumulatingPadding() {
        val controller = launch()
        val scroller = views(controller.get().window.decorView).filterIsInstance<android.widget.ScrollView>().single()
        fun apply(top: Int, bottom: Int) {
            scroller.dispatchApplyWindowInsets(android.view.WindowInsets.Builder()
                .setInsets(android.view.WindowInsets.Type.systemBars(), android.graphics.Insets.of(12, top, 12, bottom))
                .build())
        }
        apply(32, 24)
        assertEquals(32, scroller.paddingTop)
        assertEquals(24, scroller.paddingBottom)
        assertEquals(12, scroller.paddingLeft)
        apply(24, 48)
        assertEquals(24, scroller.paddingTop)
        assertEquals(48, scroller.paddingBottom)
        controller.pause().stop().destroy()
    }

    @Test fun bypassStillGrantsExactlyFiveMinutesAndConsumesOneDailyUse() {
        val controller = launch()
        val activity = controller.get()
        val before = System.currentTimeMillis()
        find(activity, "5 more minutes").performClick()
        val prefs = TrackingPrefs(context)
        assertEquals(1, prefs.snoozesToday())
        assertTrue(prefs.snoozedUntil(pkg) >= before + BlockPolicy.SNOOZE_MS)
        assertTrue(prefs.snoozedUntil(pkg) <= System.currentTimeMillis() + BlockPolicy.SNOOZE_MS)
        assertTrue(activity.isFinishing)
        controller.pause().stop().destroy()
    }

    @Test fun leaveFeedReturnsHomeWithoutConsumingBypass() {
        val controller = launch()
        val activity = controller.get()
        find(activity, "Leave feed").performClick()
        assertEquals(Intent.ACTION_MAIN, shadowOf(activity).nextStartedActivity.action)
        assertEquals(0, TrackingPrefs(context).snoozesToday())
        assertTrue(activity.isFinishing)
        controller.pause().stop().destroy()
    }

    @Test fun scheduleUsesScheduleExplanationAndExhaustedBypassesStayUnavailable() {
        repeat(BlockPolicy.MAX_SNOOZES_PER_DAY) { TrackingPrefs(context).snooze(pkg, System.currentTimeMillis()) }
        val controller = launch("SCHEDULE")
        val activity = controller.get()
        find(activity, "Your focus schedule is active")
        assertFalse(views(activity.window.decorView).filterIsInstance<TextView>().any { it.text.startsWith("5 more minutes") })
        controller.pause().stop().destroy()
    }
    @Test fun changingASelectedRuleToDisabledDismissesTheOldPauseOnTheNextCheck() {
        val prefs=TrackingPrefs(context)
        prefs.blockConfig=app.driftless.tracking.core.BlockConfig(true,setOf(pkg),0,emptyList())
        val store=SqliteStore.get(context);store.setUsage(store.account.date(),pkg,60000)
        val controller=launch()
        prefs.blockConfig=prefs.blockConfig.copy(enabled=false)
        shadowOf(android.os.Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(2))
        assertTrue(controller.get().isFinishing)
        controller.pause().stop().destroy()
    }
    @Test fun staleBypassButtonCannotChangeAnotherIncarnationOrConsumeTwoUses() {
        val store=SqliteStore.get(context);store.selectScope("account:phase3-original")
        store.setUsage(store.account.date(),pkg,60000)
        val controller=launch();val button=find(controller.get(),"5 more minutes")
        store.selectScope("account:phase3-fresh");button.performClick()
        assertEquals(0,TrackingPrefs(context).snoozesToday())
        store.selectScope("account:phase3-original");button.performClick();button.performClick()
        assertEquals(1,TrackingPrefs(context).snoozesToday())
        controller.pause().stop().destroy()
    }
    @Test fun detachedButtonFromAnOlderIntentCannotSnoozeTheNewAccount() {
        val store=SqliteStore.get(context);store.selectScope("account:phase3-old-intent")
        val controller=launch();val detached=find(controller.get(),"5 more minutes")
        store.selectScope("account:phase3-new-intent")
        controller.newIntent(Intent(context,PauseActivity::class.java).putExtra(PauseActivity.EXTRA_PKG,pkg).putExtra(PauseActivity.EXTRA_REASON,"LIMIT"))
        detached.performClick()
        assertEquals(0,TrackingPrefs(context).snoozesToday())
        controller.pause().stop().destroy()
    }
    @Test fun singleTaskIntentReplacesOldBypassUiWithAccountCreditRecovery() {
        val controller=launch()
        val store=SqliteStore.get(context)
        val scope="account:phase3-credit"
        store.selectScope(scope)
        store.account.install("""{"policy":{"incarnation":"phase3-credit","tz":"UTC","activeFromMs":0,"rev":1,"policies":[{"effectiveDate":"2020-01-01","limits":{"minutes":60000}}]}}""",scope)
        controller.newIntent(Intent(context,PauseActivity::class.java).putExtra(PauseActivity.EXTRA_PKG,pkg).putExtra(PauseActivity.EXTRA_REASON,"ACCOUNT_CREDIT"))
        find(controller.get(),"Account credit is exhausted")
        assertFalse(controller.get().isFinishing)
        assertFalse(views(controller.get().window.decorView).filterIsInstance<TextView>().any {it.text.startsWith("5 more minutes")})
        val prefs=TrackingPrefs(context)
        prefs.blockConfig=prefs.blockConfig.copy(enabled=false)
        shadowOf(android.os.Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(2))
        assertTrue(controller.get().isFinishing)
        controller.pause().stop().destroy()
    }
}
