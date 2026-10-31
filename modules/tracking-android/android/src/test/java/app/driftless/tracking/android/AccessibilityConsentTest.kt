package app.driftless.tracking.android

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowSystemClock
import java.io.File
import java.time.Duration
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import android.os.Handler
import app.driftless.tracking.core.Engine
import app.driftless.tracking.core.TrackingStore

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AccessibilityConsentTest {
    private val ctx = ApplicationProvider.getApplicationContext<Context>()
    private val controller = Robolectric.buildService(DriftlessAccessibilityService::class.java)
    private lateinit var service: DriftlessAccessibilityService
    private lateinit var store: SqliteStore
    private val pkg = "com.instagram.android"
    private var originalFlags = 0

    private fun call(name: String) = DriftlessAccessibilityService::class.java.getDeclaredMethod(name)
        .apply { isAccessible = true }.invoke(service)
    private fun debug(enabled: Boolean) {
        val flags = if (enabled) originalFlags or ApplicationInfo.FLAG_DEBUGGABLE
            else originalFlags and ApplicationInfo.FLAG_DEBUGGABLE.inv()
        ctx.applicationInfo.flags = flags
        service.applicationInfo.flags = flags
    }
    private fun event() = service.onAccessibilityEvent(
        AccessibilityEvent.obtain(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED).apply { packageName = pkg })

    @Before fun setup() {
        originalFlags = ctx.applicationInfo.flags
        ctx.getSharedPreferences("driftless_tracking", 0).edit().clear().commit()
        store = SqliteStore.get(ctx)
        store.selectScope("guest:consent-${UUID.randomUUID()}")
        Settings.Global.putInt(ctx.contentResolver, Settings.Global.BOOT_COUNT, 1)
        store.account.save("clock", JSONObject().put("server", System.currentTimeMillis())
            .put("elapsed", SystemClock.elapsedRealtime()).put("boot", 1))
        controller.create(); service = controller.get(); call("onServiceConnected")
        val root = AccessibilityNodeInfo.obtain().apply {
            packageName = pkg; isVisibleToUser = true; viewIdResourceName = "$pkg:id/clips_viewer_view_pager"
        }
        val item = AccessibilityNodeInfo.obtain().apply {
            packageName = pkg; isVisibleToUser = true; viewIdResourceName = "$pkg:id/clips_video_container"
            contentDescription = "Private player label"
        }
        shadowOf(root).addChild(item)
        shadowOf(service).setRootInActiveWindow(root)
        TrackingPrefs(ctx).floatingCountEnabled = false
    }
    @After fun cleanup() {
        controller.destroy()
        ctx.applicationInfo.flags = originalFlags
        service.applicationInfo.flags = originalFlags
    }
    @Test fun anOlderDisclosureVersionCannotTrackUntilTheCurrentOneIsAffirmativelyAccepted() {
        val saved = ctx.getSharedPreferences("driftless_tracking", 0)
        saved.edit().putBoolean("a11y_disclosure_accepted", true)
            .putInt("a11y_disclosure_version", 3).putLong("a11y_disclosure_accepted_at", 1L).commit()
        assertFalse(TrackingPrefs(ctx).disclosureAccepted)
        assertTrue(TrackingPrefs(ctx).disclosureRenewalRequired)
        event(); call("classifyNow")
        ShadowSystemClock.advanceBy(Duration.ofSeconds(2)); call("onTick")
        assertTrue(store.events(0).isEmpty())
        TrackingPrefs(ctx).disclosureAccepted = true
        assertFalse(TrackingPrefs(ctx).disclosureRenewalRequired)
        assertEquals(4, saved.getInt("a11y_disclosure_version", 0))
        assertTrue(saved.getLong("a11y_disclosure_accepted_at", 0) > 1L)
        assertTrue(TrackingPrefs(ctx).disclosureAccepted)
        event()
        ShadowSystemClock.advanceBy(Duration.ofSeconds(2)); call("onTick")
        assertEquals(1, store.events(0).size)
        TrackingPrefs(ctx).disclosureAccepted = false
        val count = store.events(0).size
        event(); call("classifyNow")
        ShadowSystemClock.advanceBy(Duration.ofSeconds(2)); call("onTick")
        assertEquals(count, store.events(0).size)
        assertFalse(TrackingPrefs(ctx).disclosureAccepted)
    }
    @Test fun freshInstallWithoutConsentDoesNotTrack() {
        assertFalse(TrackingPrefs(ctx).disclosureAccepted)
        event(); call("classifyNow")
        ShadowSystemClock.advanceBy(Duration.ofSeconds(2)); call("onTick")
        assertTrue(store.events(0).isEmpty())
    }
    private fun advance(ms: Long) = ShadowSystemClock.advanceBy(Duration.ofMillis(ms))
    private fun viewingTime(): Long = store.daily(store.account.date()).sumOf { it.surfaceMs + it.unknownMs }
    private fun startPending() {
        TrackingPrefs(ctx).disclosureAccepted = true
        event()
        assertTrue(store.events(0).isEmpty())
    }

    @Test fun revocationBeforeDwellDiscardsUnfinishedCountAndTimeImmediately() {
        startPending(); advance(500)
        TrackingPrefs(ctx).disclosureAccepted = false
        assertFalse(service.isOperational)
        advance(3000); event(); call("classifyNow"); call("onTick")
        assertTrue(store.events(0).isEmpty())
        assertEquals(0L, viewingTime())
    }

    @Test fun revocationJustBeforeThresholdKeepsOnlyPreviouslyRecordedTime() {
        startPending(); advance(1000); call("classifyNow")
        assertEquals(1000L, viewingTime())
        advance(499); TrackingPrefs(ctx).disclosureAccepted = false
        advance(501); call("onTick")
        assertTrue(store.events(0).isEmpty())
        assertEquals(1000L, viewingTime())
    }

    private fun engineField() = DriftlessAccessibilityService::class.java.getDeclaredField("engine").apply { isAccessible = true }
    private fun assertNoRevokedAccounting(scope: String, expectedTime: Long = 1000L) {
        store.readableDatabase.rawQuery("SELECT COUNT(*) FROM events WHERE scope=?", arrayOf(scope)).use {
            it.moveToFirst(); assertEquals(0, it.getInt(0))
        }
        store.readableDatabase.rawQuery("SELECT SUM(surface_ms+unknown_ms) FROM daily WHERE scope=?", arrayOf(scope)).use {
            it.moveToFirst(); assertEquals(expectedTime, it.getLong(0))
        }
    }
    private fun revokePending(): String {
        startPending(); advance(1000); call("classifyNow")
        TrackingPrefs(ctx).disclosureAccepted = false
        advance(3000)
        return store.activeScope()
    }
    @Test fun revokedScreenOffCannotCreditPendingActivity() {
        val scope = revokePending()
        ctx.sendBroadcast(android.content.Intent(android.content.Intent.ACTION_SCREEN_OFF))
        shadowOf(Looper.getMainLooper()).idle()
        assertNoRevokedAccounting(scope)
    }
    @Test fun revokedInterruptionCannotCreditPendingActivity() {
        val scope = revokePending()
        service.onInterrupt()
        assertNoRevokedAccounting(scope)
    }
    @Test fun revokedClockRefreshExecutesItsBodyWithoutCreditingPendingActivity() {
        val scope = revokePending()
        val before = engineField().get(service)
        service.refreshAccountClock(scope)
        shadowOf(Looper.getMainLooper()).idle()
        assertNotSame(before, engineField().get(service))
        assertEquals(scope, store.activeScope())
        assertNoRevokedAccounting(scope)
    }
    @Test fun revokedScopeChangeDiscardsWithoutCreditingEitherScope() {
        val scope = revokePending()
        val next = "guest:revoked-switch-${UUID.randomUUID()}"
        service.changeDataScope(next)
        assertEquals(next, store.activeScope())
        assertNoRevokedAccounting(scope)
        assertNoRevokedAccounting(next, 0L)
    }
    @Test fun revokedShutdownWhileBoundCannotCreditPendingActivity() {
        val scope = revokePending()
        assertSame(service, DriftlessAccessibilityService.current)
        call("stop")
        assertNull(DriftlessAccessibilityService.current)
        assertNoRevokedAccounting(scope)
    }
    @Test fun revokedUnbindWhileBoundCannotCreditPendingActivity() {
        val scope = revokePending()
        assertSame(service, DriftlessAccessibilityService.current)
        controller.unbind()
        assertNull(DriftlessAccessibilityService.current)
        assertNoRevokedAccounting(scope)
    }
    private fun runnable(name: String) = DriftlessAccessibilityService::class.java.getDeclaredField(name)
        .apply { isAccessible = true }.get(service) as Runnable
    @Test fun delayedClassificationAlreadyCapturedBeforeRevocationCannotCreditActivity() {
        startPending(); advance(1000); call("classifyNow")
        val callback = runnable("classifyTask")
        TrackingPrefs(ctx).disclosureAccepted = false
        Handler(Looper.getMainLooper()).postDelayed(callback, 2000)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(3))
        assertNoRevokedAccounting(store.activeScope())
    }
    @Test fun delayedTickAlreadyCapturedBeforeRevocationCannotCreditActivity() {
        startPending(); advance(1000); call("classifyNow")
        val callback = runnable("tick")
        TrackingPrefs(ctx).disclosureAccepted = false
        Handler(Looper.getMainLooper()).postDelayed(callback, 2000)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(3))
        assertNoRevokedAccounting(store.activeScope())
    }
    @Test fun queuedOverlayRefreshAfterRevocationCannotCreditActivity() {
        val scope = revokePending()
        service.refreshFloatingCount()
        shadowOf(Looper.getMainLooper()).idle()
        assertNoRevokedAccounting(scope)
        assertFalse(service.isOperational)
    }

    private fun pauseScheduledSampling() {
        val handler = DriftlessAccessibilityService::class.java.getDeclaredField("main")
            .apply { isAccessible = true }.get(service) as Handler
        handler.removeCallbacks(runnable("tick"))
        handler.removeCallbacks(runnable("classifyTask"))
    }
    private fun await(latch: CountDownLatch) {
        assertTrue("Thread handshake did not complete", latch.await(2, TimeUnit.SECONDS))
    }
    private fun join(worker: Thread) {
        worker.join(2000)
        assertFalse("Consent caller did not finish", worker.isAlive)
    }
    @Test fun backgroundRevocationReturnsOnlyAfterMainAppliesConsentAndDiscardsSession() {
        startPending(); advance(1000); call("classifyNow")
        pauseScheduledSampling() // isolate the handoff from unrelated sampling before the cutoff
        val posted = CountDownLatch(1)
        val result = AtomicReference<String>()
        val worker = Thread {
            try {
                TrackingPrefs(ctx).updateDisclosureConsent(false) { done ->
                    posted.countDown()
                    done.await(2, TimeUnit.SECONDS)
                }
                check(!TrackingPrefs(ctx).disclosureAccepted)
                check(!service.isOperational)
                check((engineField().get(service) as Engine).activePackage == null)
                result.set("success")
            } catch (e: Throwable) { result.set("failure: $e") }
        }
        worker.start(); await(posted)
        assertNull(result.get())
        assertTrue(TrackingPrefs(ctx).disclosureAccepted)
        assertTrue(service.isOperational)
        shadowOf(Looper.getMainLooper()).idle()
        join(worker)
        assertEquals("success", result.get())
        advance(3000); event(); call("onTick"); call("classifyNow")
        assertNoRevokedAccounting(store.activeScope())
    }

    @Test fun inFlightAccountingFinishesBeforeAppliedRevocationAndCannotOverlapIt() {
        // Wrap the real store: block inside a real engine.addTime call on the main thread.
        val entered = CountDownLatch(1)
        val posted = CountDownLatch(1)
        val result = AtomicReference<String>()
        val base = store.capturedStore()
        val recording = object : TrackingStore by base {
            override fun addTime(localDate: String, pkg: String, surfaceMs: Long, unknownMs: Long) {
                assertSame(Looper.getMainLooper(), Looper.myLooper())
                entered.countDown()
                await(posted) // background caller queues revocation while this callback is executing
                assertTrue(TrackingPrefs(ctx).disclosureAccepted)
                assertNull(result.get())
                base.addTime(localDate, pkg, surfaceMs, unknownMs)
                assertTrue(TrackingPrefs(ctx).disclosureAccepted)
            }
        }
        engineField().set(service, Engine(recording, RulesLoader.load(ctx), zone = store.capturedZone()))
        val worker = Thread {
            try {
                await(entered)
                TrackingPrefs(ctx).updateDisclosureConsent(false) { done ->
                    posted.countDown(); done.await(2, TimeUnit.SECONDS)
                }
                result.set("success")
            } catch (e: Throwable) { result.set("failure: $e") }
        }
        worker.start()
        startPending(); advance(1000); call("classifyNow")
        // Callback has returned but the queued transition has not yet run.
        assertEquals(1000L, viewingTime())
        assertTrue(TrackingPrefs(ctx).disclosureAccepted)
        assertNull(result.get())
        pauseScheduledSampling()
        shadowOf(Looper.getMainLooper()).idle(); join(worker)
        assertEquals("success", result.get())
        assertFalse(TrackingPrefs(ctx).disclosureAccepted)
        assertNull((engineField().get(service) as Engine).activePackage)
        advance(3000); event(); call("onTick"); call("classifyNow")
        assertNoRevokedAccounting(store.activeScope())
    }

    @Test fun timeoutReportsUnconfirmedChangeThenQueuedRevocationDiscardsWithoutFlush() {
        startPending(); advance(1000); call("classifyNow")
        // Leave only our transition queued; the main looper is deliberately not drained.
        pauseScheduledSampling()
        val result = AtomicReference<Throwable>()
        val worker = Thread {
            try {
                TrackingPrefs(ctx).updateDisclosureConsent(false) { done ->
                    // Same timed-await result as an expired five-second deadline, without sleeping.
                    done.await(0, TimeUnit.SECONDS)
                }
                result.set(AssertionError("Timeout must not return success"))
            } catch (e: Throwable) { result.set(e) }
        }
        worker.start(); join(worker)
        assertTrue(result.get() is IllegalStateException)
        assertTrue(result.get().message!!.contains("not confirmed"))
        assertTrue(result.get().message!!.contains("pending"))
        assertTrue(TrackingPrefs(ctx).disclosureAccepted)
        assertTrue(service.isOperational)
        // Time can pass before the queued change applies. It must not be flushed by revocation.
        advance(3000)
        shadowOf(Looper.getMainLooper()).idle()
        assertFalse(TrackingPrefs(ctx).disclosureAccepted)
        assertFalse(service.isOperational)
        assertNull((engineField().get(service) as Engine).activePackage)
        event(); call("onTick"); call("classifyNow")
        assertNoRevokedAccounting(store.activeScope())
    }

    @Test fun completedRecordsSurviveRevocationAndReacceptanceCountsANewItem() {
        startPending(); advance(2000); call("onTick")
        assertEquals(1, store.events(0).size)
        val completedTime = viewingTime()
        advance(100); TrackingPrefs(ctx).disclosureAccepted = false
        advance(3000); call("onTick"); call("classifyNow")
        assertEquals(1, store.events(0).size)
        assertEquals(completedTime, viewingTime())
        val root = AccessibilityNodeInfo.obtain().apply {
            packageName = pkg; isVisibleToUser = true; viewIdResourceName = "$pkg:id/clips_viewer_view_pager"
        }
        shadowOf(root).addChild(AccessibilityNodeInfo.obtain().apply {
            packageName = pkg; isVisibleToUser = true; viewIdResourceName = "$pkg:id/clips_video_container"
            contentDescription = "New item after reacceptance"
        })
        shadowOf(service).setRootInActiveWindow(root)
        TrackingPrefs(ctx).disclosureAccepted = true
        assertTrue(service.isOperational)
        event(); advance(2000); call("onTick")
        assertEquals(2, store.events(0).size)
        assertEquals(completedTime + 2000L, viewingTime())
    }

    @Test fun preConsentConnectionKeepsOnlyBindingStatusWithoutViewingDiagnostics() {
        assertSame(service, DriftlessAccessibilityService.current)
        assertFalse(service.isOperational)
        event(); call("classifyNow"); advance(2000); call("onTick")
        assertTrue(store.events(0).isEmpty())
        assertEquals(0L, viewingTime())
    }

    @Test fun releaseExecutionRejectsEventExportAndCaptureEvenWithConsent() {
        TrackingPrefs(ctx).disclosureAccepted = true
        debug(false)
        assertNull(service.captureStructure())
        val out = File(ctx.cacheDir, "blocked-${UUID.randomUUID()}.json")
        service.scheduleStructureCapture(1000, out)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(1))
        assertFalse(out.exists())
        assertThrows(expo.modules.kotlin.exception.CodedException::class.java) {
            DebugTrackingExports.exportSessionLog(ctx, 7)
        }
        assertThrows(expo.modules.kotlin.exception.CodedException::class.java) {
            DebugTrackingExports.lastStructureCapture(ctx)
        }
    }
    @Test fun delayedDebugCaptureRechecksConsentAndValidDebugExportsStillWork() {
        debug(true)
        TrackingPrefs(ctx).disclosureAccepted = true
        val structure = service.captureStructure()!!
        assertFalse(structure.contains("Private player label"))
        assertTrue(structure.contains("hasDesc"))
        val out = File(ctx.cacheDir, "revoked-${UUID.randomUUID()}.json")
        service.scheduleStructureCapture(1000, out)
        TrackingPrefs(ctx).disclosureAccepted = false
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(1))
        assertNull(service.captureStructure())
        assertFalse(out.exists())
        TrackingPrefs(ctx).disclosureAccepted = true
        service.scheduleStructureCapture(1000, out)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(1))
        assertTrue(out.exists())
        assertTrue(DebugTrackingExports.lastStructureCapture(ctx).endsWith(out.name))
        assertEquals(0, DebugTrackingExports.exportSessionLog(ctx, 7)["count"])
    }
}
