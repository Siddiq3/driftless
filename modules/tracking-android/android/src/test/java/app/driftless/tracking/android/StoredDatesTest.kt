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
class StoredDatesTest {
    private val store get() = SqliteStore.get(ApplicationProvider.getApplicationContext<Context>())
    @Before fun setup() { store.wipeAll() }
    @After fun cleanup() { store.wipeAll() }

    @Test fun returnsRetainedDatesBeyondAWeekWithoutChangingAggregates() {
        store.setUsage("2026-09-01", "instagram", 120000)
        store.setUsage("2026-09-01", "youtube", 60000)
        store.setUsage("2026-10-23", "instagram", 300000)
        store.setUsage("2025-01-01", "instagram", 10000)
        val before = store.daily("2026-09-01")
        assertEquals(listOf("2026-09-01", "2026-10-23"), store.storedDates("2026-01-01", "2026-10-23"))
        assertEquals(before, store.daily("2026-09-01"))
        assertTrue(store.storedDates("2027-01-01", "2027-01-02").isEmpty())
    }
    @Test fun boundsDateEnumerationAndWipeRemovesResults() {
        val start = LocalDate.of(2024, 1, 1)
        for (n in 0..410) store.setUsage(start.plusDays(n.toLong()).toString(), "instagram", 1000)
        val dates = store.storedDates("2024-01-01", "2026-01-01")
        assertEquals(400, dates.size)
        assertEquals(dates.distinct().sorted(), dates)
        store.wipeAll()
        assertTrue(store.storedDates("2024-01-01", "2026-01-01").isEmpty())
    }
}
