package app.driftless.tracking.android

import android.content.Context
import android.content.Intent
import android.os.Looper
import android.os.Message
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.core.Engine
import app.driftless.tracking.core.Surface
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
@Config(sdk=[35])
class ServiceRecoveryTest {
    private val context=ApplicationProvider.getApplicationContext<Context>()
    private val controller=Robolectric.buildService(DriftlessAccessibilityService::class.java)
    private lateinit var service:DriftlessAccessibilityService
    private val pkg="com.instagram.android"
    private fun field(name:String)=DriftlessAccessibilityService::class.java.getDeclaredField(name).apply {isAccessible=true}
    private fun call(name:String,vararg args:Any) {
        val types=args.map {when(it) {is Long -> java.lang.Long.TYPE;else -> it.javaClass}}.toTypedArray()
        DriftlessAccessibilityService::class.java.getDeclaredMethod(name,*types).apply {isAccessible=true}.invoke(service,*args)
    }
    private fun queued(name:String):Int {
        val callback=field(name).get(service)
        val queue=Looper.getMainLooper().queue
        var message=queue.javaClass.getDeclaredField("mMessages").apply {isAccessible=true}.get(queue) as? Message
        val next=Message::class.java.getDeclaredField("next").apply {isAccessible=true}
        var total=0
        while(message!=null) {if(message.callback===callback) total++;message=next.get(message) as? Message}
        return total
    }
    private fun event(time:Long=SystemClock.uptimeMillis(),type:Int=AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,owner:String=pkg)=AccessibilityEvent.obtain(type).apply {packageName=owner;eventTime=time}
    private fun root(owner:String=pkg)=AccessibilityNodeInfo.obtain().apply {packageName=owner;isVisibleToUser=true;viewIdResourceName="$owner:id/clips_viewer_view_pager"}
    @Before fun setup() {
        context.getSharedPreferences("driftless_tracking",Context.MODE_PRIVATE).edit().clear().commit()
        SqliteStore.get(context).selectScope("guest:phase3")
        TrackingPrefs(context).disclosureAccepted=true
        controller.create();service=controller.get();call("onServiceConnected")
        shadowOf(service).setRootInActiveWindow(root())
    }
    @After fun cleanup() {controller.destroy()}
    @Test fun repeatedConnectionHasOneTickOneClassificationAndDestroyRemovesThem() {
        call("onServiceConnected");call("onServiceConnected")
        assertEquals(1,queued("tick"));assertEquals(1,queued("classifyTask"))
        assertTrue(service.isOperational)
        controller.unbind();assertFalse(service.isOperational)
        assertEquals(0,queued("tick"));assertEquals(0,queued("classifyTask"))
        assertNull(DriftlessAccessibilityService.current)
        service.onAccessibilityEvent(event())
        assertFalse(service.isOperational);assertEquals(0,queued("tick"))
    }
    @Test fun interruptionStopsWorkAndANewEventRestartsOnlyOneLoop() {
        service.onInterrupt();service.onInterrupt()
        assertFalse(service.isOperational);assertEquals(0,queued("tick"));assertEquals(0,queued("classifyTask"))
        service.onAccessibilityEvent(event());service.onAccessibilityEvent(event())
        assertTrue(service.isOperational);assertEquals(1,queued("tick"));assertEquals(1,queued("classifyTask"))
    }
    @Test fun periodicSamplingDoesNotLeaveAnOlderSettlingTaskQueued() {
        shadowOf(Looper.getMainLooper()).idle()
        service.onAccessibilityEvent(event());assertEquals(1,queued("classifyTask"))
        call("classifyNow");assertEquals(0,queued("classifyTask"))
        service.onAccessibilityEvent(event());assertEquals(1,queued("classifyTask"))
    }
    @Test fun staleAndCrossAppScrollCannotAuthorizeTheCurrentPlayer() {
        val current=SystemClock.uptimeMillis()
        service.onAccessibilityEvent(event(current+200))
        service.onAccessibilityEvent(event(current+100,AccessibilityEvent.TYPE_VIEW_SCROLLED))
        assertFalse(field("pendingScroll").getBoolean(service))
        // A valid scroll belongs to its source package, never the other supported app.
        service.onAccessibilityEvent(event(current+300,AccessibilityEvent.TYPE_VIEW_SCROLLED,"com.google.android.youtube"))
        call("classifyNow")
        assertFalse(field("pendingScroll").getBoolean(service))
    }
    @Test fun screenOffClearsTransitionAndOverlayStateAndScopeChangeCancelsOldClassification() {
        service.onAccessibilityEvent(event(type=AccessibilityEvent.TYPE_VIEW_SCROLLED))
        context.sendBroadcast(Intent(Intent.ACTION_SCREEN_OFF));shadowOf(Looper.getMainLooper()).idle()
        assertFalse(field("pendingScroll").getBoolean(service))
        assertNull((field("engine").get(service) as Engine).activePackage)
        service.changeDataScope("account:phase3-other")
        assertEquals(0,queued("classifyTask"));assertEquals(Surface.UNKNOWN,field("badgeSurface").get(service))
    }
    @Test fun verifyingANewClockRecreatesOnlyTheCurrentScopesRecorder() {
        val previous=field("engine").get(service)
        service.refreshAccountClock("guest:phase3")
        shadowOf(Looper.getMainLooper()).idle()
        assertNotSame(previous,field("engine").get(service))
        val current=field("engine").get(service)
        service.changeDataScope("account:phase3-clock-fresh")
        val fresh=field("engine").get(service)
        service.refreshAccountClock("guest:phase3")
        shadowOf(Looper.getMainLooper()).idle()
        assertSame(fresh,field("engine").get(service))
        assertEquals("account:phase3-clock-fresh",SqliteStore.get(context).activeScope())
        assertNotSame(current,fresh)
    }
    @Test fun repeatedBlockingCallbacksStartOneActivityUntilTheUserLeavesAndReturns() {
        val now=System.currentTimeMillis()
        call("showPause",pkg,"LIMIT",now)
        assertNotNull(shadowOf(service).nextStartedActivity)
        call("showPause",pkg,"LIMIT",now+10000)
        assertNull(shadowOf(service).nextStartedActivity)
        shadowOf(service).setRootInActiveWindow(root("com.android.settings"));call("classifyNow")
        call("showPause",pkg,"LIMIT",now+20000)
        assertNotNull(shadowOf(service).nextStartedActivity)
    }
    private fun prepareWrapFeed() {
        service.changeDataScope("guest:wrap-service")
        val store = SqliteStore.get(context)
        TrackingPrefs(context).clearWrapHistory()
        store.setUsage(java.time.LocalDate.parse(store.account.date()).minusDays(1).toString(), pkg, 60000)
        field("badgeSurface").set(service, Surface.SHORT_VIDEO)
        field("badgeIdentity").setBoolean(service, true)
        field("badgePackage").set(service, pkg)
        shadowOf(service).setRootInActiveWindow(root())
    }
    @Test fun wrapIsShownOnlyOverARecognizedFeedAndDoesNotRepeatDuringTheVisit() {
        prepareWrapFeed()
        val overlay = field("wrapReady").get(service) as WrapReadyOverlay
        field("badgeSurface").set(service, Surface.OTHER)
        call("maybeShowWrap", System.currentTimeMillis()); assertFalse(overlay.isShowing)
        field("badgeSurface").set(service, Surface.SHORT_VIDEO)
        call("maybeShowWrap", System.currentTimeMillis()); assertTrue(overlay.isShowing)
        overlay.hide()
        call("maybeShowWrap", System.currentTimeMillis() + 60000); assertFalse(overlay.isShowing)
    }
    @Test fun wrapWaitsForFeedPauseAndMemeCardsAndHidesWhenLeavingOrChangingAccount() {
        prepareWrapFeed()
        val overlay = field("wrapReady").get(service) as WrapReadyOverlay
        val pause = field("feedPause").get(service) as FeedPauseOverlay
        pause.show(app.driftless.tracking.core.FeedReason.BREAK, 60000, 0, 5, false) {}
        call("maybeShowWrap", System.currentTimeMillis()); assertFalse(overlay.isShowing)
        pause.hide()
        val meme = field("memeCard").get(service) as MemeMilestoneCard
        assertTrue(meme.show(app.driftless.tracking.core.CountBadgeValue("50", "On this phone"), 50, "en") {})
        call("maybeShowWrap", System.currentTimeMillis()); assertFalse(overlay.isShowing)
        meme.hide()
        call("maybeShowWrap", System.currentTimeMillis()); assertTrue(overlay.isShowing)
        shadowOf(service).setRootInActiveWindow(root("com.android.settings")); call("classifyNow")
        assertFalse(overlay.isShowing)
        overlay.show(ReadyWrap("daily", "2026-10-26")) {}
        service.changeDataScope("guest:wrap-fresh")
        assertFalse(overlay.isShowing)
    }
    @Test fun wrapDoesNotRequireTheFloatingCounterAndDisappearsOnScreenOff() {
        prepareWrapFeed()
        val overlay = field("wrapReady").get(service) as WrapReadyOverlay
        TrackingPrefs(context).floatingCountEnabled = false
        call("maybeShowWrap", System.currentTimeMillis()); assertTrue(overlay.isShowing)
        context.sendBroadcast(Intent(Intent.ACTION_SCREEN_OFF)); shadowOf(Looper.getMainLooper()).idle()
        assertFalse(overlay.isShowing)
    }

    @Test fun openingTheReadyCardDeepLinksToItsExactCompletedPeriod() {
        prepareWrapFeed()
        val store = SqliteStore.get(context)
        val expected = WrapReady.next(store, setOf(pkg), TrackingPrefs(context))!!
        call("maybeShowWrap", System.currentTimeMillis())
        val overlay = field("wrapReady").get(service) as WrapReadyOverlay
        val root = WrapReadyOverlay::class.java.getDeclaredField("root").apply { isAccessible = true }.get(overlay) as android.view.View
        fun findButton(view: android.view.View): android.widget.Button? {
            if (view is android.widget.Button && view.text == "See my Wrapped") return view
            if (view is android.view.ViewGroup) for (i in 0 until view.childCount) findButton(view.getChildAt(i))?.let { return it }
            return null
        }
        findButton(root)!!.performClick()
        val intent = shadowOf(service).nextStartedActivity
        assertEquals(Intent.ACTION_VIEW, intent.action)
        assertEquals("scrollsnooze", intent.data!!.scheme)
        assertEquals("/wrapped", intent.data!!.path)
        assertEquals(expected.period, intent.data!!.getQueryParameter("period"))
        assertEquals(expected.end, intent.data!!.getQueryParameter("end"))
        assertEquals(service.packageName, intent.`package`)
        assertFalse(overlay.isShowing)
    }

}
