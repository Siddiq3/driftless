package app.driftless.tracking.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.core.ViewEvent
import app.driftless.tracking.core.ViewKind
import org.junit.Assert.*
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class GuestAccountLifecycleTest {
    private val context=ApplicationProvider.getApplicationContext<Context>()
    private val store=SqliteStore(context,null)
    private val ig="com.instagram.android"
    private val yt="com.google.android.youtube"
    private val packages=setOf(ig,yt)
    private val date="2026-10-29"
    private val at=Instant.parse("2026-10-29T12:00:00Z").toEpochMilli()
    @After fun close() { store.close() }
    private fun event(id:String,pkg:String,ms:Long=at,day:String=date)=
        ViewEvent(id,id,1,pkg,ViewKind.VIEW,ms-1000,ms,day,"Asia/Kolkata",1,"experimental")
    private fun watch(prefix:String,reels:Int,shorts:Int) {
        for(i in 1..reels) assertTrue(store.recordView(event("$prefix-ig-$i",ig)))
        for(i in 1..shorts) assertTrue(store.recordView(event("$prefix-yt-$i",yt)))
    }
    private fun assertCounts(reels:Int,shorts:Int) {
        val result=store.personalMeasurement(date,packages)
        assertEquals((reels+shorts).toLong(),(result["views"] as Number).toLong())
        assertEquals(mapOf(ig to reels,yt to shorts),result["appViews"])
    }
    @Test fun repeatedMixedPlatformLogoutLoginAddsOnlyTheNewGuestActivity() {
        store.setSourceDevice("phone")
        store.selectScope("account:a");watch("account",50,30);assertCounts(50,30)
        store.selectScope("guest:first");assertTrue(store.daily(date).isEmpty())
        watch("guest1",20,15);assertCounts(20,15)
        val late=store.capturedStore()
        store.selectScope("account:a");store.importGuest("guest:first","account:a")
        assertCounts(70,45)
        repeat(3) {store.importGuest("guest:first","account:a");assertCounts(70,45)}
        store.selectScope("guest:second");watch("guest2",10,5)
        store.selectScope("account:a");store.importGuest("guest:second","account:a")
        assertCounts(80,50)
        repeat(3) {store.importGuest("guest:second","account:a");assertCounts(80,50)}
        assertEquals(130,store.events(0).size)
        val duplicate=event("guest1-ig-1",ig)
        assertFalse(store.recordView(duplicate))
        assertFalse(store.recordView(duplicate.copy(eventId="different-id-same-session")))
        assertCounts(80,50)
        late.recordView(event("late-guest-short",yt))
        assertCounts(80,51) // Delayed callbacks route to the bound account once.
        assertFalse(late.recordView(event("late-guest-short",yt)))
        store.readableDatabase.rawQuery("SELECT COUNT(*) FROM guest_event_archive",null).use {
            it.moveToFirst();assertEquals(50,it.getInt(0))
        }
        store.selectScope("guest:third");watch("guest3",2,3)
        store.selectScope("account:b");store.importGuest("guest:third","account:b")
        assertCounts(2,3)
        try {store.importGuest("guest:first","account:b");fail("must reject reassignment")} catch(_:IllegalArgumentException) {}
        store.selectScope("account:a");assertCounts(80,51)
    }
    @Test fun restoredOldDeviceHistoryAndNewGuestActivityAddWithoutRestagingOrDuplicatingTheOldDevice() {
        store.setSourceDevice("new-phone");store.selectScope("guest:new-install")
        watch("guest",20,15)
        store.selectScope("account:a")
        val restored="""[{"localDate":"$date","deviceId":"old-phone","tz":"Asia/Kolkata","views":80,"minutes":2,"coverage":1,"rev":1,"personalAppViews":{"$ig":50,"$yt":30}}]"""
        store.mergeSynced(restored,"account:a")
        store.importGuest("guest:new-install","account:a");assertCounts(70,45)
        store.mergeSynced(restored,"account:a");assertCounts(70,45)
        assertEquals(35,store.backupDaily(date).sumOf{it.views})
        // A server readback of this installation's own contribution overlaps its local records.
        store.mergeSynced("""[{"localDate":"$date","deviceId":"new-phone","tz":"Asia/Kolkata","views":35,"minutes":1,"coverage":1,"rev":1,"personalAppViews":{"$ig":20,"$yt":15}}]""","account:a")
        assertCounts(70,45)
    }
    @Test fun midnightDatesPackageAndStableEventMetadataSurviveMigrationAndRollback() {
        store.selectScope("guest:midnight")
        val before=event("before",ig,Instant.parse("2026-10-28T18:29:59Z").toEpochMilli(),"2026-10-28")
        val after=event("after",yt,Instant.parse("2026-10-28T18:30:00Z").toEpochMilli(),date)
        store.recordView(before);store.recordView(after)
        store.selectScope("account:a")
        // A mid-transaction failure must leave both source records and aggregates recoverable.
        store.writableDatabase.execSQL("CREATE TRIGGER fail_import BEFORE UPDATE OF scope ON events BEGIN SELECT RAISE(ABORT,'fixture failure'); END")
        try {store.importGuest("guest:midnight","account:a");fail("fixture must fail")} catch(_:android.database.SQLException) {}
        assertTrue(store.daily(date).isEmpty())
        store.writableDatabase.execSQL("DROP TRIGGER fail_import")
        store.importGuest("guest:midnight","account:a")
        assertEquals(listOf(before,after),store.events(0))
        assertEquals(1,store.daily("2026-10-28").single().views)
        assertEquals(ig,store.daily("2026-10-28").single().pkg)
        assertCounts(0,1)
    }
    @Test fun legacyCombinedCountsRemainKnownWhileUnprovablePlatformAttributionRemainsUnknown() {
        store.setSourceDevice("new-phone");store.selectScope("account:a")
        store.mergeSynced("""[{"localDate":"$date","deviceId":"legacy-phone","tz":"UTC","views":80,"minutes":2,"coverage":1,"rev":1}]""","account:a")
        val result=store.personalMeasurement(date,packages)
        assertEquals(80,result["views"])
        assertEquals(mapOf(ig to null,yt to null),result["appViews"])
    }
    @Test fun singlePlatformImportsKeepInstagramAndYoutubeCountsSeparate() {
        store.setSourceDevice("phone")
        store.selectScope("guest:instagram");watch("only-ig",7,0)
        store.selectScope("account:a");store.importGuest("guest:instagram","account:a");assertCounts(7,0)
        store.selectScope("guest:youtube");watch("only-yt",0,9)
        store.selectScope("account:a");store.importGuest("guest:youtube","account:a");assertCounts(7,9)
        assertEquals(7,store.events(0).count{it.pkg==ig})
        assertEquals(9,store.events(0).count{it.pkg==yt})
    }
    @Test fun concurrentCapturedRecorderAndImportPreserveEveryUniqueEventOnce() {
        store.setSourceDevice("phone");store.selectScope("guest:concurrent")
        val recorder=store.capturedStore()
        store.selectScope("account:a")
        val start=java.util.concurrent.CountDownLatch(1)
        val failure=java.util.concurrent.atomic.AtomicReference<Throwable>()
        val writer=Thread {
            try { start.await(); for(i in 1..20) recorder.recordView(event("concurrent-$i",if(i%2==0) ig else yt)) }
            catch(e:Throwable) {failure.set(e)}
        }
        val importer=Thread {
            try { start.await(); repeat(3) {store.importGuest("guest:concurrent","account:a")} }
            catch(e:Throwable) {failure.set(e)}
        }
        writer.start();importer.start();start.countDown();writer.join(5000);importer.join(5000)
        assertFalse(writer.isAlive);assertFalse(importer.isAlive);assertNull(failure.get())
        assertCounts(10,10);assertEquals(20,store.events(0).size)
    }

    @Test fun usageRefreshKeepsImportedGuestMinutesWithoutChargingThemAsSignedInUsage() {
        val now=System.currentTimeMillis()
        val today=java.time.Instant.ofEpochMilli(now).atZone(java.time.ZoneId.of("UTC")).toLocalDate().toString()
        val start=java.time.LocalDate.parse(today).atStartOfDay(java.time.ZoneId.of("UTC")).toInstant().toEpochMilli()
        android.provider.Settings.Global.putInt(context.contentResolver,android.provider.Settings.Global.BOOT_COUNT,1)
        org.robolectric.Shadows.shadowOf(context.getSystemService(android.app.AppOpsManager::class.java)).setMode(
            android.app.AppOpsManager.OPSTR_GET_USAGE_STATS,android.os.Process.myUid(),context.packageName,android.app.AppOpsManager.MODE_ALLOWED)
        val usage=org.robolectric.Shadows.shadowOf(context.getSystemService(android.app.usage.UsageStatsManager::class.java))
        usage.addEvent(ig,start+1000,android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED)
        usage.addEvent(ig,start+61000,android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED)
        usage.addEvent(ig,start+121000,android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED)
        usage.addEvent(ig,start+181000,android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED)
        store.selectScope("guest:minutes");store.setUsage(today,ig,60000)
        store.selectScope("account:minutes");store.setSourceDevice("phone")
        store.writableDatabase.execSQL("UPDATE scope_intervals SET start_ms=?,end_ms=? WHERE scope='guest:minutes'",arrayOf(start,start+120000))
        store.writableDatabase.execSQL("UPDATE scope_intervals SET start_ms=? WHERE scope='account:minutes'",arrayOf(start+120000))
        store.writableDatabase.execSQL("UPDATE account_intervals SET start_ms=? WHERE scope='account:minutes'",arrayOf(start+120000))
        store.account.install("""{"serverTimeMs":$now,"policy":{"incarnation":"minutes","tz":"UTC","activeFromMs":$start,"rev":1,"policies":[{"effectiveDate":"$today","limits":{}}]}}""","account:minutes")
        store.importGuest("guest:minutes","account:minutes")
        assertEquals(listOf(start+120000 to now),store.accountingIntervals(start,now))
        assertEquals(listOf(start to start+120000,start+120000 to now).toSet(),store.usageIntervals(start,now).toSet())
        repeat(2) {
            UsageReader.refresh(context,store,setOf(ig),1)
            assertEquals(120000L,store.daily(today).single().usageMs)
            assertEquals(2L,store.personalMeasurement(today,setOf(ig))["minutes"])
            val ledger=org.json.JSONArray(store.account.contributions("phone"))
            assertEquals(60000L,ledger.getJSONObject(0).getJSONObject("apps").getJSONObject(ig).getLong("usageMs"))
        }
    }

    @Test fun newerSameDeviceAccountingBreakdownRepairsLegacyPersonalAttributionWithoutRawEvents() {
        android.provider.Settings.Global.putInt(context.contentResolver,android.provider.Settings.Global.BOOT_COUNT,1)
        val now=System.currentTimeMillis()
        val day=java.time.Instant.ofEpochMilli(now).atZone(java.time.ZoneId.of("UTC")).toLocalDate().toString()
        val start=java.time.LocalDate.parse(day).atStartOfDay(java.time.ZoneId.of("UTC")).toInstant().toEpochMilli()
        store.selectScope("account:repair");store.setSourceDevice("new-phone")
        val snapshot=org.json.JSONObject().put("incarnation","repair").put("localDate",day).put("rev",1)
            .put("endMs",start+86400000).put("limits",org.json.JSONObject().put("views",100))
            .put("used",org.json.JSONObject().put("views",50)).put("unavailable",org.json.JSONArray())
            .put("devices",org.json.JSONObject().put("old-phone",org.json.JSONObject()
                .put("used",org.json.JSONObject().put("views",50))
                .put("apps",org.json.JSONObject().put(ig,org.json.JSONObject().put("views",35))
                    .put(yt,org.json.JSONObject().put("views",15)))))
        val policy=org.json.JSONObject().put("incarnation","repair").put("tz","UTC").put("activeFromMs",start).put("rev",1)
            .put("policies",org.json.JSONArray())
        store.account.install(org.json.JSONObject().put("serverTimeMs",now).put("policy",policy).put("snapshot",snapshot).toString(),"account:repair")
        fun restore(views:Int) = store.mergeSynced("""[{"localDate":"$day","deviceId":"old-phone","tz":"UTC","views":$views,"minutes":2,"coverage":1,"rev":$views}]""","account:repair")
        restore(40)
        repeat(2) {
            val result=store.personalMeasurement(day,packages)
            assertEquals(50L,result["views"])
            assertEquals(mapOf(ig to 35,yt to 15),result["appViews"])
            assertTrue(store.daily(day).isEmpty());assertTrue(store.events(0).isEmpty())
        }
        restore(80) // A smaller account-only snapshot cannot explain a larger personal total.
        val unknown=store.personalMeasurement(day,packages)
        assertEquals(80L,unknown["views"])
        assertEquals(mapOf(ig to null,yt to null),unknown["appViews"])
    }

}
