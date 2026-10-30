package app.driftless.tracking.android

import android.app.AppOpsManager
import android.os.Process
import android.content.Context
import android.provider.Settings
import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.core.Recorder
import app.driftless.tracking.core.UsageMath
import app.driftless.tracking.core.ViewEvent
import app.driftless.tracking.core.ViewKind
import java.time.Duration
import java.time.ZoneId
import java.util.TimeZone
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowSystemClock

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AccountUsageTest {
    private val context=ApplicationProvider.getApplicationContext<Context>()
    private val inc="00000000-0000-4000-8000-000000000001"
    private val pkg="com.instagram.android"
    private val date="2026-11-01" // 25-hour account day in New York
    private val zone=ZoneId.of("America/New_York")
    private val bounds=UsageMath.dayBounds(date,zone)
    private val now=bounds.first+3_600_000
    private lateinit var store:SqliteStore
    @Before fun setup() {
        Settings.Global.putInt(context.contentResolver,Settings.Global.BOOT_COUNT,1)
        store=SqliteStore(context,null)
        store.selectScope("account:$inc"); store.setSourceDevice("device-a")
    }
    @After fun close() { store.close() }
    private fun response(rev:Int=1, used:Int=0, own:Int=0, grant:Int=3, server:Long=now):JSONObject {
        val limits=JSONObject().put("views",10)
        val device=JSONObject().put("used",JSONObject().put("views",own)).put("granted",JSONObject().put("views",grant))
        val snap=JSONObject().put("incarnation",inc).put("periodId","$inc:$date").put("localDate",date).put("tz",zone.id)
            .put("startMs",bounds.first).put("endMs",bounds.second).put("rev",rev).put("limits",limits).put("used",JSONObject().put("views",used))
            .put("devices",JSONObject().put("device-a",device)).put("unavailable",JSONArray()).put("serverTimeMs",server)
        return JSONObject().put("serverTimeMs",server).put("policy",JSONObject().put("incarnation",inc).put("tz",zone.id)
            .put("activeFromMs",bounds.first).put("rev",1).put("policies",JSONArray().put(JSONObject().put("effectiveDate",date).put("limits",limits))))
            .put("snapshot",snap)
    }
    private fun install(value:JSONObject=response()) { store.account.install(value.toString(),"account:$inc") }
    private fun event(id:String,at:Long=store.account.now()) = ViewEvent(id,id,1,pkg,ViewKind.VIEW,at-1000,at,Recorder.localDate(at,zone),zone.id,1,"experimental")
    private fun pending()=JSONArray(store.account.contributions("device-a"))
    private fun count()=pending().getJSONObject(0).getJSONObject("apps").getJSONObject(pkg).getInt("views")
    @Test fun deduplicatesEventsAndBlocksAtOwnReservationWithoutDoubleCountingAcceptedUsage() {
        install(); store.account.observeViews(date,setOf(pkg))
        assertEquals("reserved",store.account.status())
        assertTrue(store.recordView(event("one"))); assertFalse(store.recordView(event("one")))
        install(response(2,8,1)) // 7 from other phones, 1 already accepted from this phone
        assertEquals("reserved",store.account.status()) // 8, not 9
        store.recordView(event("two")); assertEquals("reserved",store.account.status())
        store.recordView(event("three")); assertEquals("credit_exhausted",store.account.status())
        assertEquals(3,count())
    }
    @Test fun remainingIsCappedByOwnReservationNeverNegativeAndRepeatedRolloverDoesNotRestoreIt() {
        install();store.account.observeViews(date,setOf(pkg))
        assertEquals(3L,store.account.remainingCredit().getLong("views"))
        store.recordView(event("one"));install(response(2,8,1))
        assertEquals(2L,store.account.remainingCredit().getLong("views"))
        store.recordView(event("two"));store.recordView(event("three"));store.recordView(event("overshoot"))
        assertEquals(0L,store.account.remainingCredit().getLong("views"))
        store.account.resetHistory()
        assertEquals(0L,store.account.remainingCredit().getLong("views"))
        ShadowSystemClock.advanceBy(Duration.ofMillis(bounds.second-store.account.now()))
        repeat(3) { assertEquals("credit_required",store.account.status()) }
        assertTrue(store.account.remainingCredit().isNull("views"))
    }
    @Test fun staleSnapshotCannotReduceAcceptedUsageOrRestoreCredit() {
        install(response(3,10,3)); store.account.observeViews(date,setOf(pkg))
        install(response(2,0,0,10))
        assertEquals("credit_exhausted",store.account.status())
    }
    @Test fun staleAndOfflineStatusIsHonestAndRolloverNeedsFreshCredit() {
        install(); store.account.observeViews(date,setOf(pkg))
        ShadowSystemClock.advanceBy(Duration.ofSeconds(61))
        assertEquals("reserved_stale",store.account.status())
        ShadowSystemClock.advanceBy(Duration.ofMillis(bounds.second-store.account.now()))
        assertEquals("2026-11-02",store.account.date())
        assertEquals("credit_required",store.account.status())
        store.recordView(event("next-day"))
        assertEquals("2026-11-02",pending().getJSONObject(1).getString("localDate"))
    }
    @Test fun rebootRequiresVerifiedClockAndCannotReuseYesterdayCredit() {
        install(); store.account.observeViews(date,setOf(pkg))
        Settings.Global.putInt(context.contentResolver,Settings.Global.BOOT_COUNT,2)
        assertEquals("clock_unverified",store.account.status())
        assertTrue(store.account.blocked(pkg))
    }
    @Test fun fixedTimezoneSurvivesDeviceTimezoneChangeAndDstDayIsNot24Hours() {
        val prior=TimeZone.getDefault()
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo")); install()
            assertEquals(zone,store.account.zone()); assertEquals(date,store.account.date())
            TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Honolulu"))
            assertEquals(zone,store.account.zone()); assertEquals(25*3_600_000L,bounds.second-bounds.first)
        } finally {TimeZone.setDefault(prior)}
    }
    @Test fun resetKeepsAccountingDeduplicationAndFrozenRevisionsButClearsVisibleHistory() {
        install(); store.recordView(event("old")); store.account.observeViews(date,setOf(pkg))
        val batch=pending().getJSONObject(0); val frozen=batch.toString()
        store.account.resetHistory()
        assertTrue(store.daily(date).isEmpty())
        assertFalse(store.recordView(event("old")))
        assertEquals(1,count()); assertEquals(frozen,batch.toString())
        store.account.acknowledge(date,batch.getLong("rev"))
        assertEquals(1,pending().length()) // later reset revision survives a delayed acknowledgement
        assertEquals(1,store.backupDaily(date).sumOf {it.views})
        assertEquals("reserved",store.account.status())
        store.recordView(event("new")); store.recordView(event("third"))
        assertEquals(2,store.daily(date).sumOf {it.views}); assertEquals(3,store.backupDaily(date).sumOf {it.views})
        assertEquals("credit_exhausted",store.account.status())
    }
    @Test fun delayedPreResetRecorderCannotRestoreIntervalsOrCachedHistory() {
        install(); val old=store.capturedStore(); val at=store.account.now()-1000
        store.recordView(event("first",at)); store.account.resetHistory()
        old.addTime(date,pkg,120000,0); old.heartbeat(date,10)
        old.recordView(event("delayed",at))
        assertTrue(store.daily(date).isEmpty()); assertTrue(store.events(0).isEmpty()); assertEquals(0,store.heartbeatMinutes(date))
        val rows=JSONArray().put(JSONObject().put("localDate",date).put("deviceId","other").put("tz",zone.id).put("rev",5).put("coverage",1).put("views",99).put("minutes",20))
        store.mergeSynced(rows.toString(),"account:$inc")
        assertNull(store.personalMeasurement(date,setOf(pkg))["views"])
    }
    @Test fun switchAndFreshIncarnationDoNotAdoptOldLedgerOrGrants() {
        install(); store.recordView(event("old")); val old=store.capturedStore()
        store.selectScope("account:00000000-0000-4000-8000-000000000002")
        assertEquals(0,pending().length()); assertFalse(store.account.active())
        old.recordView(event("late-old",now))
        assertTrue(store.daily(date).isEmpty())
        try { install(); fail("scope mismatch") } catch(_:IllegalArgumentException) {}
        store.selectScope("account:$inc"); assertEquals(2,count())
    }
    @Test fun delayedRecorderRetainsItsIncarnationTimezoneAcrossAnAccountSwitch() {
        install();val captured=store.capturedZone()
        val fresh="00000000-0000-4000-8000-000000000002"
        store.selectScope("account:$fresh")
        val value=JSONObject(response().toString().replace(inc,fresh))
        value.getJSONObject("policy").put("tz","Asia/Tokyo")
        value.getJSONObject("snapshot").put("tz","Asia/Tokyo")
        store.account.install(value.toString(),"account:$fresh")
        assertEquals(ZoneId.of("Asia/Tokyo"),store.account.zone())
        assertEquals(zone,captured())
        assertEquals(ZoneId.of("Asia/Tokyo"),store.account.zone())
    }
    @Test fun measuredZeroIsDifferentFromUnavailableOsHistoryAndViewsOnlyAffectVideoSurface() {
        install(); assertEquals("measurement_unavailable",store.account.status())
        store.account.observeViews(date,setOf(pkg)); assertEquals("reserved",store.account.status())
        assertTrue(pending().getJSONObject(0).getJSONObject("apps").getJSONObject(pkg).isNull("usageMs"))
        assertEquals(0,count()); install(response(2,10,3))
        assertTrue(store.account.blocked(pkg,true)); assertFalse(store.account.blocked(pkg,false))
    }
    @Test fun transitionDoesNotImportExistingLocalCountersIntoAccounting() {
        store.recordView(event("legacy-local",now-1000))
        val value=response();value.getJSONObject("policy").put("activeFromMs",now+1000)
        value.put("snapshot",JSONObject.NULL);install(value)
        assertFalse(store.account.active()); assertEquals(0,pending().length())
        ShadowSystemClock.advanceBy(Duration.ofMillis(1000))
        assertTrue(store.account.active()); assertEquals("credit_required",store.account.status())
        store.recordView(event("new-period")); assertEquals(1,count())
    }
    @Test fun permissionChangesReviseNullablePayloadsWithoutReusingFrozenRevisions() {
        install()
        shadowOf(context.getSystemService(AppOpsManager::class.java)).setMode(AppOpsManager.OPSTR_GET_USAGE_STATS,Process.myUid(),context.packageName,AppOpsManager.MODE_IGNORED)
        store.setAccountUsage(date,pkg,59999)
        val unavailable=pending().getJSONObject(0)
        assertTrue(unavailable.getJSONObject("apps").getJSONObject(pkg).isNull("usageMs"))
        store.account.acknowledge(date,unavailable.getLong("rev"))
        val ops=context.getSystemService(AppOpsManager::class.java)
        shadowOf(ops).setMode(AppOpsManager.OPSTR_GET_USAGE_STATS,Process.myUid(),context.packageName,AppOpsManager.MODE_ALLOWED)
        val known=pending().getJSONObject(0)
        assertTrue(known.getLong("rev")>unavailable.getLong("rev"))
        assertEquals(59999,known.getJSONObject("apps").getJSONObject(pkg).getInt("usageMs"))
        assertTrue(unavailable.getJSONObject("apps").getJSONObject(pkg).isNull("usageMs"))
    }
    @Test fun resetTwicePreservesCumulativeCloudBackupWithoutRevealingItsBaseline() {
        install();store.recordView(event("one"));store.account.resetHistory()
        store.recordView(event("two"));store.account.resetHistory()
        store.recordView(event("three"))
        assertEquals(1,store.daily(date).sumOf {it.views});assertEquals(3,store.backupDaily(date).sumOf {it.views})
        assertEquals(3,count());assertEquals("credit_exhausted",store.account.status())
    }
    @Test fun historicalSummaryFloorsOnlyAfterAddingDeviceMilliseconds() {
        install()
        shadowOf(context.getSystemService(AppOpsManager::class.java)).setMode(AppOpsManager.OPSTR_GET_USAGE_STATS,Process.myUid(),context.packageName,AppOpsManager.MODE_ALLOWED)
        store.setAccountUsage(date,pkg,59999)
        val value=response(2)
        value.getJSONObject("snapshot").getJSONObject("used").put("minutes",119998)
        value.getJSONObject("snapshot").getJSONObject("devices").getJSONObject("device-a").getJSONObject("used").put("minutes",59999)
        install(value)
        assertEquals(1L,store.personalMeasurement(date,setOf(pkg))["minutes"])
        ShadowSystemClock.advanceBy(Duration.ofMillis(bounds.second-store.account.now()+1))
        assertEquals(1L,store.personalMeasurement(date,setOf(pkg))["minutes"])
        assertNull(store.personalMeasurement("2026-11-02",setOf(pkg))["minutes"])
    }
    @Test fun processRestartRetainsOfflineLedgerGrantAndResetFence() {
        val name="phase2-account-restart.db"; context.deleteDatabase(name)
        store.close();store=SqliteStore(context,name);store.selectScope("account:$inc");store.setSourceDevice("device-a")
        install(); store.recordView(event("offline"));store.account.resetHistory();store.close()
        store=SqliteStore(context,name)
        assertEquals(1,count());assertEquals("reserved",store.account.status());assertTrue(store.daily(date).isEmpty())
        assertFalse(store.recordView(event("offline")))
        context.deleteDatabase(name)
    }
    @Test fun restoredPersonalBackupIsNotHiddenByAnEmptyAllowanceSnapshot() {
        install()
        val restored="""[{"localDate":"$date","deviceId":"old-installation","tz":"${zone.id}","views":50,"minutes":2,"coverage":1,"rev":1}]"""
        store.mergeSynced(restored,"account:$inc")
        store.mergeSynced(restored,"account:$inc")
        assertEquals(50L,store.personalMeasurement(date,setOf(pkg))["views"])
        assertEquals(2L,store.personalMeasurement(date,setOf(pkg))["minutes"])
        assertEquals(0L,store.account.effectiveUsage("views",date))
    }
    @Test fun personalAndAllowanceCopiesOfOneDeviceAreReconciledWithoutAddingTwice() {
        install(response(2,5,5))
        val restored="""[{"localDate":"$date","deviceId":"device-a","tz":"${zone.id}","views":50,"minutes":2,"coverage":1,"rev":1}]"""
        store.mergeSynced(restored,"account:$inc")
        assertEquals(50L,store.personalMeasurement(date,setOf(pkg))["views"])
        assertEquals(5L,store.account.effectiveUsage("views",date))
    }

    @Test fun accountCreditPausesRespectMasterSwitchSelectedAppsAndVideoGoalOptIn() {
        install(response(2,10,3))
        store.account.observeViews(date,setOf(pkg))
        val entitlement=app.driftless.tracking.core.CachedEntitlement(true,null)
        val config=app.driftless.tracking.core.BlockConfig(true,setOf(pkg),null,emptyList(),true,
            app.driftless.tracking.core.FeedSettings(enforceGoal=true))
        assertTrue(store.account.shouldPause(pkg,config,entitlement,true))
        assertFalse(store.account.shouldPause(pkg,config.copy(enabled=false),entitlement,true))
        assertFalse(store.account.shouldPause(pkg,config.copy(apps=emptySet()),entitlement,true))
        assertFalse(store.account.shouldPause(pkg,config.copy(feed=config.feed.copy(enforceGoal=false)),entitlement,true))
        assertFalse(store.account.shouldPause(pkg,config,entitlement,false))
        assertTrue(store.account.blocked(pkg)) // Accounting is still exhausted, not erased.
    }
    @Test fun unlimitedMetricsDoNotRequireFreshCreditAfterMidnightOrReboot() {
        install(); store.account.observeViews(date,setOf(pkg))
        val entitlement=app.driftless.tracking.core.CachedEntitlement(true,null)
        val scheduleOnly=app.driftless.tracking.core.BlockConfig(true,setOf(pkg),null,emptyList())
        ShadowSystemClock.advanceBy(Duration.ofMillis(bounds.second-store.account.now()))
        assertFalse(store.account.shouldPause(pkg,scheduleOnly,entitlement,true))
        Settings.Global.putInt(context.contentResolver,Settings.Global.BOOT_COUNT,2)
        assertFalse(store.account.shouldPause(pkg,scheduleOnly,entitlement,true))
        val minuteOnly=scheduleOnly.copy(dailyMinutes=30)
        assertFalse(store.account.shouldPause(pkg,minuteOnly,entitlement,true)) // Only a view allowance is configured.
    }

}
