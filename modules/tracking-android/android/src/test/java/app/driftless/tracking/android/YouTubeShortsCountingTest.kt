package app.driftless.tracking.android

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode
import org.robolectric.shadows.ShadowSystemClock
import java.time.Duration
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[35])
@LooperMode(LooperMode.Mode.PAUSED)
class YouTubeShortsCountingTest {
    private val context=ApplicationProvider.getApplicationContext<Context>()
    private val controller=Robolectric.buildService(DriftlessAccessibilityService::class.java)
    private lateinit var service:DriftlessAccessibilityService
    private lateinit var store:SqliteStore
    private val yt="com.google.android.youtube"
    private fun node(id:String?=null,text:String?=null,desc:String?=null,cls:String="android.view.ViewGroup",pkg:String=yt,vararg children:AccessibilityNodeInfo):AccessibilityNodeInfo {
        val n=AccessibilityNodeInfo.obtain().apply {
            packageName=pkg;isVisibleToUser=true;className=cls
            if(id!=null) viewIdResourceName="$pkg:id/$id"
            this.text=text;contentDescription=desc
        }
        children.forEach {shadowOf(n).addChild(it)}
        return n
    }
    private fun player(caption:String?,controls:Boolean=true,likes:String="Like 10") = node("reel_recycler",children=*arrayOf(
        node("reel_player_page_container",children=*listOfNotNull(
            caption?.let {node("metapanel",desc=it)},
            if(controls) node("like",desc=likes,cls="android.widget.Button") else null,
        ).toTypedArray())))
    private fun root(n:AccessibilityNodeInfo) {shadowOf(service).setRootInActiveWindow(n)}
    private fun call(name:String) {DriftlessAccessibilityService::class.java.getDeclaredMethod(name).apply {isAccessible=true}.invoke(service)}
    private fun move(ms:Long) {ShadowSystemClock.advanceBy(Duration.ofMillis(ms))}
    private fun event(owner:String=yt,type:Int=AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,time:Long=SystemClock.uptimeMillis()) {
        service.onAccessibilityEvent(AccessibilityEvent.obtain(type).apply {packageName=owner;eventTime=time})
    }
    private fun count():Int=store.events(0).count {it.pkg==yt}
    private fun first() {root(player("Short A"));call("classifyNow");move(2000);call("onTick");assertEquals(1,count())}
    private fun swipe(next:String) {
        event() // old frame starts the burst and schedules a settled read
        move(40);root(player(null,false));event()
        move(40);root(player(next));event()
        move(200);call("classifyNow");move(1800);call("onTick")
    }
    @Before fun setup() {
        store=SqliteStore.get(context);store.selectScope("guest:yt-${UUID.randomUUID()}")
        Settings.Global.putInt(context.contentResolver,Settings.Global.BOOT_COUNT,1)
        store.account.save("clock",JSONObject().put("server",1793001600000L).put("elapsed",SystemClock.elapsedRealtime()).put("boot",1))
        val prefs=TrackingPrefs(context);prefs.disclosureAccepted=true;prefs.floatingCountEnabled=false
        controller.create();service=controller.get();call("onServiceConnected")
    }
    @After fun cleanup() {controller.destroy()}
    @Test fun transientReplacementInsideTheSettlingBurstCountsBAndCInOneSession() {
        first();swipe("Short B");assertEquals(2,count());swipe("Short C");assertEquals(3,count())
        repeat(20) {event()};move(2000);call("onTick");assertEquals(3,count())
    }
    @Test fun captionAndControlEditsWithoutReplacementNeverBecomeExtraViews() {
        first()
        repeat(5) {i->move(40);root(player("Caption revision $i",likes="Like ${20+i}"));event();move(2000);call("onTick")}
        assertEquals(1,count())
    }
    @Test fun unknownMetadataAndLoadingFramesNeverInventAView() {
        first();event();move(40);root(player(null,false));event();move(40);root(player(null,true));event()
        move(2500);call("onTick");assertEquals(1,count())
    }
    @Test fun sqliteEventsDailyMeasurementAndReplayAgreeAfterThreeShorts() {
        first();swipe("Short B");swipe("Short C")
        val events=store.events(0).filter {it.pkg==yt}
        assertEquals(3,events.size);assertEquals(3,events.map {it.eventId}.toSet().size)
        assertEquals(listOf(1,2,3),events.map {it.seq});assertEquals(1,events.map {it.sessionId}.toSet().size)
        val date=events.first().localDate
        assertEquals(3,store.daily(date).filter {it.pkg==yt}.sumOf {it.views})
        assertEquals(3,store.personalMeasurement(date,setOf(yt))["views"])
        assertFalse(store.recordView(events.first()));assertFalse(store.recordView(events.first().copy(eventId="replay-new-id")))
        assertEquals(3,count())
    }
    @Test fun homeNormalVideoCommentsAndAppReentryDoNotRecountRecentShorts() {
        first();swipe("Short B")
        for(screen in listOf("home","watch_player","comments")) {
            root(node(screen));move(40);event();move(2000);call("onTick")
            root(player("Short B"));move(40);event();move(2000);call("onTick")
        }
        assertEquals(2,count())
        root(node("launcher",pkg="com.android.launcher"));call("classifyNow");move(1000)
        root(player("Short C"));event();move(2000);call("onTick");assertEquals(3,count())
        repeat(10) {event()};move(2000);call("onTick");assertEquals(3,count())
    }
    @Test fun staleEventsCannotAuthorizeACaptionEdit() {
        first();val old=SystemClock.uptimeMillis();move(100);event()
        move(40);root(player(null,false));event(time=old)
        move(40);root(player("Caption edit"));event();move(2000);call("onTick")
        assertEquals(1,count())
    }
    @Test fun restartKeepsRecentIdentityRingAndNewSessionSequences() {
        first();controller.destroy()
        val second=Robolectric.buildService(DriftlessAccessibilityService::class.java).create()
        service=second.get()
        try {
            call("onServiceConnected");root(player("Short A"));call("classifyNow");move(2000);call("onTick");assertEquals(1,count())
            swipe("Short B");assertEquals(2,count())
            val events=store.events(0).filter {it.pkg==yt}
            assertEquals(listOf(1,1),events.map {it.seq});assertEquals(2,events.map {it.sessionId}.toSet().size)
        } finally {second.destroy()}
    }
    @Test fun repeatedBurstCallbacksAreRateLimitedAndKeepOneTrailingSample() {
        first()
        val deadline=DriftlessAccessibilityService::class.java.getDeclaredField("debugTraceUntil").apply {isAccessible=true}
        deadline.setLong(service,store.account.now()+10000)
        val trace=DriftlessAccessibilityService::class.java.getDeclaredField("debugTrace").apply {isAccessible=true}.get(service) as org.json.JSONArray
        repeat(500) {event()}
        assertEquals(1,trace.length())
        move(31);repeat(500) {event()};assertEquals(1,trace.length())
        move(1);event();assertEquals(2,trace.length())
        val task=DriftlessAccessibilityService::class.java.getDeclaredField("classifyTask").apply {isAccessible=true}.get(service)
        val queue=android.os.Looper.getMainLooper().queue
        var message=queue.javaClass.getDeclaredField("mMessages").apply {isAccessible=true}.get(queue) as? android.os.Message
        val next=android.os.Message::class.java.getDeclaredField("next").apply {isAccessible=true}
        var pending=0
        while(message!=null) {if(message.callback===task) pending++;message=next.get(message) as? android.os.Message}
        assertEquals(1,pending);assertEquals(1,count())
    }
    @Test fun rapidSwipesRequireFullDwellOnTheSurvivingShort() {
        first();event();move(40);root(player(null,false));event()
        move(40);root(player("Too brief"));event()
        move(300);root(player(null,false));event()
        move(40);root(player("Short C"));event()
        move(1800);call("onTick")
        assertEquals(2,count())
    }
    @Test fun ordinaryPagerScrollStillCountsWithAPersistentPlayerContainer() {
        first();root(player("Short B"));move(40)
        event(type=AccessibilityEvent.TYPE_VIEW_SCROLLED)
        move(2000);call("onTick");assertEquals(2,count())
        repeat(10) {event(type=AccessibilityEvent.TYPE_VIEW_SCROLLED)}
        move(2000);call("onTick");assertEquals(2,count())
    }
    @Test fun overlayTextOutsideThePlayerAndWindowChangesDoNotCountAnotherShort() {
        first()
        root(node("window",children=*arrayOf(player("Short A"),node("comments",text="A new comment"))))
        move(40);event(type=AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
        move(2000);call("onTick");assertEquals(1,count())
        root(player("Short A"));move(40);event(type=AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
        move(2000);call("onTick");assertEquals(1,count())
    }
    @Test fun homeToANovelShortCountsOnceWithoutPackageOrActivityChange() {
        first();root(node("home"));move(40);event();move(200);call("classifyNow")
        root(player("Short B"));move(40);event();move(2000);call("onTick");assertEquals(2,count())
        repeat(20) {event()};move(2000);call("onTick");assertEquals(2,count())
    }
    @Test fun pauseAndScopeChangeCannotRetainAStructuralSignalFromThePreviousDataset() {
        first();event();move(40);root(player(null,false));event()
        service.onInterrupt()
        val scope="guest:yt-isolated-${UUID.randomUUID()}"
        service.changeDataScope(scope)
        store.account.save("clock",JSONObject().put("server",1793001700000L).put("elapsed",SystemClock.elapsedRealtime()).put("boot",1))
        root(player("Short B"));move(40);event();move(2000);call("onTick")
        assertEquals(1,count()) // fresh scope has only its own first item
        assertEquals(scope,store.activeScope())
    }
    @Test fun instagramScrollCountingUsesItsExistingSamplingAndIdentityRules() {
        val ig="com.instagram.android"
        fun reel(caption:String)=node("clips_viewer_view_pager",pkg=ig,children=*arrayOf(node("clips_video_container",desc=caption,pkg=ig)))
        root(reel("Reel A"));call("classifyNow");move(2000);call("onTick")
        root(reel("Reel B"));move(40);event(owner=ig,type=AccessibilityEvent.TYPE_VIEW_SCROLLED)
        move(2000);call("onTick")
        assertEquals(2,store.events(0).count {it.pkg==ig});assertEquals(0,count())
    }

    @Test fun serviceDeliveryDoesNotCoalesceAwayTheEntireBurstSamplingWindow() {
        val xml=context.resources.getXml(app.driftless.tracking.R.xml.driftless_accessibility)
        try {
            while(xml.eventType!=org.xmlpull.v1.XmlPullParser.START_TAG) xml.next()
            val timeout=xml.getAttributeIntValue("http://schemas.android.com/apk/res/android","notificationTimeout",-1)
            assertTrue(timeout>0)
            assertTrue(timeout<=DriftlessAccessibilityService.YOUTUBE_BURST_SAMPLE_MS)
        } finally {xml.close()}
    }

}
