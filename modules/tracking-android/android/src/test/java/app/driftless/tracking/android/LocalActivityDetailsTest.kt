package app.driftless.tracking.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.core.ViewEvent
import app.driftless.tracking.core.ViewKind
import app.driftless.tracking.core.countBadgeValue
import app.driftless.tracking.core.isValidatedVersion
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Instant
import java.time.ZoneId

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class LocalActivityDetailsTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val store get() = SqliteStore.get(context)
    private val rules get() = RulesLoader.load(context)
    private val ig = "com.instagram.android"
    private val yt = "com.google.android.youtube"

    // Robolectric's sandbox application database only; never opens a device/user database.
    @Before fun setup() { store.wipeAll() }
    @After fun cleanup() { store.wipeAll() }

    private fun event(id: String, pkg: String, at: String = "2026-10-19T07:15:00Z", zone: String = "Asia/Kolkata"): ViewEvent {
        val instant = Instant.parse(at)
        return ViewEvent(id, id, 1, pkg, ViewKind.VIEW, instant.toEpochMilli() - 500,
            instant.toEpochMilli(), instant.atZone(ZoneId.of(zone)).toLocalDate().toString(),
            zone, rules.version, "not-approved")
    }
    @Suppress("UNCHECKED_CAST")
    private fun days(from: String, to: String = from): List<Map<String, Any>> =
        WrappedDetails.readLocalActivity(context, from, to)["days"] as List<Map<String, Any>>
    @Suppress("UNCHECKED_CAST")
    private fun hours(day: Map<String, Any>) = day["hourlyViews"] as List<Int>

    @Test fun instagramAndYoutubeAppearWithEmptyApprovedVersionsAndMatchPopupWithoutDuplicates() {
        assertTrue(rules.apps.values.all { it.validatedVersions.isEmpty() })
        for (pkg in listOf(ig, yt)) {
            val e = event(pkg, pkg)
            assertTrue(store.recordView(e))
            assertFalse(store.recordView(e)) // Retry of the same local event.
            assertFalse(store.recordView(e.copy(eventId = "retry-$pkg"))) // Same session/sequence.
        }
        val hourly = hours(days("2026-10-19").single())
        val popupTotal = store.daily("2026-10-19").filter { it.pkg in rules.apps }.sumOf { it.views }
        assertEquals(24, hourly.size)
        assertEquals(2, hourly[12])
        assertEquals(popupTotal, hourly.sum())
        assertEquals(countBadgeValue(popupTotal, false, true).text, hourly.sum().toString())
        assertEquals(days("2026-10-19"), days("2026-10-19")) // Reading cannot add events.
        assertEquals(2, store.events(0).size)
        // Existing recap/validated path and accuracy checks still exclude these same events.
        assertEquals(emptyList<Any>(), WrappedDetails.read(context, "2026-10-19", "2026-10-19")["days"])
        for (pkg in listOf(ig, yt)) assertFalse(isValidatedVersion(rules.apps.getValue(pkg), "not-approved"))
    }

    @Test fun recordedTimezoneCountedTimestampAndLocalDateBoundariesArePreserved() {
        store.recordView(event("before", ig, "2026-10-18T18:29:59Z")) // 23:59 IST.
        store.recordView(event("after", yt, "2026-10-18T18:30:00Z")) // Midnight IST; item started before midnight.
        store.recordView(event("travel", yt, "2026-10-19T06:59:00Z", "America/Los_Angeles")) // Oct 18, 23:59.
        val result = days("2026-10-18", "2026-10-19").associateBy { it["localDate"] }
        assertEquals(2, hours(result.getValue("2026-10-18"))[23])
        assertEquals(1, hours(result.getValue("2026-10-19"))[0])
        assertEquals(2, hours(days("2026-10-18").single()).sum())
        assertEquals(1, hours(days("2026-10-19").single()).sum())
        assertTrue(days("2026-10-20").isEmpty())
    }

    @Test fun adsOtherAppsAndOtherRuleVersionsStayExcludedButMissingEventVersionIsAllowedLocally() {
        store.recordView(event("local", ig).copy(appVersion = null))
        store.recordView(event("ad", ig).copy(kind = ViewKind.AD_VIEW))
        store.recordView(event("unsupported", "example.other"))
        store.recordView(event("old-rule", yt).copy(ruleVersion = rules.version - 1))
        assertEquals(1, hours(days("2026-10-19").single()).sum())
        assertEquals(emptyList<Any>(), WrappedDetails.read(context, "2026-10-19", "2026-10-19")["days"])
    }

    @Test fun missingApprovedConfigurationDefaultsToUntrustedInsteadOfCrashing() {
        val json = JSONObject(context.assets.open(RulesLoader.ASSET).bufferedReader().use { it.readText() })
        val apps = json.getJSONArray("apps")
        for (i in 0 until apps.length()) apps.getJSONObject(i).remove("validatedVersions")
        val parsed = RulesLoader.parse(json.toString())
        assertEquals(rules.apps.keys, parsed.apps.keys)
        assertTrue(parsed.apps.values.all { it.validatedVersions.isEmpty() })
        assertTrue(parsed.apps.values.none { isValidatedVersion(it, "not-approved") })
    }
}
