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
}
