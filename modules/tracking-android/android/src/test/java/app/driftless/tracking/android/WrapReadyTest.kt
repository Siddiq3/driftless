package app.driftless.tracking.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Before
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.LocalDate

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class WrapReadyTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val store get() = SqliteStore.get(context)
    private val prefs get() = TrackingPrefs(context)
    private val packages = setOf("com.instagram.android", "com.google.android.youtube")
    private val today get() = LocalDate.parse(store.account.date())
    private val yesterday get() = today.minusDays(1).toString()

    @Before fun setup() {
        store.wipeAll(); store.selectScope("guest:wrap-test"); prefs.clearWrapHistory()
    }
    @After fun cleanup() { store.wipeAll(); prefs.clearWrapHistory() }

    @Test fun completedPeriodsRespectMondaySundayAndYearBoundaries() {
        assertEquals(listOf(ReadyWrap("weekly", "2026-10-18"), ReadyWrap("daily", "2026-10-18")),
            WrapReady.periods(LocalDate.parse("2026-10-19")))
        assertEquals("2026-10-11", WrapReady.periods(LocalDate.parse("2026-10-18"))[0].end)
        assertEquals("2025-12-31", WrapReady.periods(LocalDate.parse("2026-01-01"))[1].end)
        assertEquals("2026-10-12", ReadyWrap("weekly", "2026-10-18").from)
    }
    @Test fun unknownPeriodsAndTodaysActivityDoNotTriggerAPrompt() {
        assertNull(WrapReady.next(store, packages, prefs))
        store.setUsage(today.toString(), "com.instagram.android", 120000)
        assertNull(WrapReady.next(store, packages, prefs))
    }
    @Test fun measuredZeroIsEnoughAndYesterdayDoesNotNeedVideoCounts() {
        store.setUsage(yesterday, "com.instagram.android", 0)
        assertNull(store.personalMeasurement(yesterday, packages)["views"])
        assertNotNull(WrapReady.next(store, packages, prefs))
    }
    @Test fun weeklyTakesPriorityAndPartialWeeksAreAvailable() {
        val week = WrapReady.periods(today)[0]
        store.setUsage(week.from, "com.google.android.youtube", 60000)
        store.setUsage(yesterday, "com.instagram.android", 60000)
        assertEquals(week, WrapReady.next(store, packages, prefs))
        prefs.markWrapShown(week)
        assertEquals(ReadyWrap("daily", yesterday), WrapReady.next(store, packages, prefs))
    }
    @Test fun promptMarkersSurviveRecreationArePerScopeAndClearWithHistory() {
        for (wrap in WrapReady.periods(today)) prefs.markWrapShown(wrap)
        store.setUsage(yesterday, "com.instagram.android", 60000)
        assertNull(WrapReady.next(store, packages, TrackingPrefs(context)))
        store.selectScope("guest:wrap-other")
        assertNull(prefs.shownWrapEnd("daily"))
        assertNull(WrapReady.next(store, packages, prefs)) // Other account's data stays hidden.
        store.setUsage(yesterday, "com.instagram.android", 60000)
        assertNotNull(WrapReady.next(store, packages, prefs))
        store.selectScope("guest:wrap-test")
        assertNull(WrapReady.next(store, packages, prefs))
        prefs.clearWrapHistory()
        assertNotNull(WrapReady.next(store, packages, prefs))
    }
    @Test fun restoredAccountMeasurementsCanMakeAWrapReady() {
        store.selectScope("account:wrap-restored")
        store.mergeSynced("""[{"localDate":"$yesterday","deviceId":"other-device","tz":"UTC","views":5,"minutes":2,"coverage":1,"rev":1}]""", store.activeScope())
        assertNotNull(WrapReady.next(store, packages, prefs))
    }
}
