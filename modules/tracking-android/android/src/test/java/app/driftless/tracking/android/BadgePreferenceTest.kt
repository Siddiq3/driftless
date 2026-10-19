package app.driftless.tracking.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class BadgePreferenceTest {
    @Test fun defaultsVisibleButHonorsExplicitOptOutAcrossPreferenceInstances() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val storage = context.getSharedPreferences("driftless_tracking",Context.MODE_PRIVATE)
        storage.edit().clear().commit()
        val prefs = TrackingPrefs(context)
        assertTrue(prefs.floatingCountEnabled)
        assertFalse(prefs.disclosureAccepted) // Visibility still requires separate counting consent.
        prefs.floatingCountEnabled = false
        assertFalse(TrackingPrefs(context).floatingCountEnabled)
        prefs.floatingCountEnabled = true
        assertTrue(TrackingPrefs(context).floatingCountEnabled)
        storage.edit().clear().commit()
    }
    @Test fun popupSettingsPersistAndSizeStaysWithinBounds() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val storage = context.getSharedPreferences("driftless_tracking", Context.MODE_PRIVATE)
        storage.edit().clear().commit()
        val prefs = TrackingPrefs(context)
        assertEquals(54, prefs.floatingCountSize)
        assertEquals(0L, prefs.floatingCountPausedUntil)
        prefs.floatingCountSize = 72
        prefs.badgeX = 0.9f
        prefs.badgeY = 0.8f
        val deadline = System.currentTimeMillis() + 3_600_000L
        prefs.floatingCountPausedUntil = deadline
        val restored = TrackingPrefs(context)
        assertEquals(72, restored.floatingCountSize)
        assertEquals(0.9f, restored.badgeX, 0.001f)
        assertEquals(0.8f, restored.badgeY, 0.001f)
        assertEquals(deadline, restored.floatingCountPausedUntil)
        prefs.floatingCountSize = 500
        assertEquals(80, prefs.floatingCountSize)
        prefs.floatingCountSize = 1
        assertEquals(40, prefs.floatingCountSize)
        storage.edit().clear().commit()
    }

}
