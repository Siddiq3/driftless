package app.driftless.tracking.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.core.ViewEvent
import app.driftless.tracking.core.ViewKind
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AccountScopeTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private fun event(id:String, date:String="2026-10-24") = ViewEvent(id,id,1,"com.instagram.android",ViewKind.VIEW,1,1000,date,"Asia/Kolkata",1,"unapproved")
    @Test fun scopesSeparateRecordedDataAndOldRecorderCallbacks() {
        val store=SqliteStore(context,null)
        store.selectScope("account:a")
        val recorderA=store.capturedStore()
        recorderA.recordView(event("a"))
        store.selectScope("account:b")
        assertTrue(store.daily("2026-10-24").isEmpty())
        recorderA.recordView(event("a-late"))
        assertTrue(store.daily("2026-10-24").isEmpty())
        store.recordView(event("b"))
        assertEquals(1,store.daily("2026-10-24").sumOf{it.views})
        store.selectScope("account:a")
        assertEquals(2,store.daily("2026-10-24").sumOf{it.views})
        store.selectScope("guest:fresh")
        assertTrue(store.daily("2026-10-24").isEmpty())
        store.close()
    }
    @Test fun guestImportIsIdempotentAndCannotBeReassigned() {
        val store=SqliteStore(context,null)
        store.selectScope("guest:first")
        val oldRecorder=store.capturedStore()
        oldRecorder.recordView(event("guest"))
        store.setUsage("2026-10-24","com.instagram.android",120000)
        store.selectScope("account:a")
        store.importGuest("guest:first","account:a")
        store.importGuest("guest:first","account:a")
        assertEquals(1,store.daily("2026-10-24").sumOf{it.views})
        oldRecorder.recordView(event("settled-old-callback"))
        assertEquals(2,store.daily("2026-10-24").sumOf{it.views})
        try { store.importGuest("guest:first","account:b"); fail("must not reassign") } catch(_:IllegalArgumentException) {}
        store.selectScope("account:b")
        assertTrue(store.daily("2026-10-24").isEmpty())
        store.close()
    }
    @Test fun restoredRowsUseRevisionUpsertsWithoutDuplicatingCurrentDeviceMeasurements() {
        val store=SqliteStore(context,null)
        store.selectScope("account:a")
        store.setSourceDevice("device-a")
        store.recordView(event("local"))
        val json="""[{"localDate":"2026-10-24","deviceId":"device-a","tz":"Asia/Kolkata","views":99,"minutes":3,"coverage":1,"rev":1},{"localDate":"2026-10-24","deviceId":"device-b","tz":"Asia/Kolkata","views":5,"minutes":2,"coverage":1,"rev":2}]"""
        store.mergeSynced(json,"account:a")
        store.mergeSynced(json,"account:a")
        assertEquals(6,store.personalMeasurement("2026-10-24",setOf("com.instagram.android"))["views"])
        store.selectScope("account:b")
        assertNull(store.personalMeasurement("2026-10-24",setOf("com.instagram.android"))["views"])
        try { store.mergeSynced(json,"account:a"); fail("wrong scope") } catch(_:IllegalArgumentException) {}
        store.close()
    }
    @Test fun reopenKeepsTheScopeAndItsPendingOfflineMeasurements() {
        val name="scope-reopen-test.db"
        context.deleteDatabase(name)
        var store=SqliteStore(context,name)
        store.selectScope("account:a")
        store.recordView(event("offline"))
        store.close()
        store=SqliteStore(context,name)
        assertEquals("account:a",store.activeScope())
        assertEquals(1,store.daily("2026-10-24").sumOf{it.views})
        store.selectScope("account:b")
        assertTrue(store.daily("2026-10-24").isEmpty())
        store.close();context.deleteDatabase(name)
    }
}
