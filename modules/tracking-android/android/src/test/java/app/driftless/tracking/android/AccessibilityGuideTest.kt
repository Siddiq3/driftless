package app.driftless.tracking.android

import android.content.Context
import android.view.ViewGroup
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.provider.Settings
import android.os.Looper
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[35])
class AccessibilityGuideTest {
    @Test fun cannotOpenSettingsWithoutCountingConsent() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        TrackingPrefs(context).disclosureAccepted=false
        val controller=Robolectric.buildActivity(AccessibilityGuideActivity::class.java).create()
        assertTrue(controller.get().isFinishing)
        assertNull(shadowOf(controller.get()).nextStartedActivity)
        controller.destroy()
    }
    @Test fun opensActualAccessibilitySettingsWhenPipIsUnavailable() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        TrackingPrefs(context).disclosureAccepted=true
        val controller=Robolectric.buildActivity(AccessibilityGuideActivity::class.java).create().start().resume()
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(300))
        val intent=shadowOf(controller.get()).nextStartedActivity
        assertEquals(Settings.ACTION_ACCESSIBILITY_SETTINGS,intent.action)
        assertTrue(intent.flags and Intent.FLAG_ACTIVITY_NEW_TASK != 0)
        assertTrue(controller.get().isFinishing)
        controller.pause().stop().destroy()
        TrackingPrefs(context).disclosureAccepted=false
    }
    @Test fun waitsForPipThenSeparatesSettingsAndKeepsGuideForExistingGrant() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        TrackingPrefs(context).disclosureAccepted=true
        shadowOf(context.packageManager).setSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE,true)
        Settings.Secure.putString(context.contentResolver,Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            Health.serviceComponent(context).flattenToString())
        val controller=Robolectric.buildActivity(AccessibilityGuideActivity::class.java).create().start().resume()
        val activity=controller.get()
        val root=activity.findViewById<ViewGroup>(android.R.id.content)
        assertTrue(root.getChildAt(0) is GuideVideoPlayer)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(300))
        assertNull(shadowOf(activity).nextStartedActivity)
        activity.onPictureInPictureModeChanged(true,Configuration())
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(20))
        val intent=shadowOf(activity).nextStartedActivity
        assertEquals(Settings.ACTION_ACCESSIBILITY_SETTINGS,intent.action)
        assertTrue(intent.flags and Intent.FLAG_ACTIVITY_NEW_TASK != 0)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(5))
        assertFalse(activity.isFinishing)
        assertNull(shadowOf(activity).nextStartedActivity)
        controller.pause().stop().destroy()
        TrackingPrefs(context).disclosureAccepted=false
        Settings.Secure.putString(context.contentResolver,Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,"")
        shadowOf(context.packageManager).setSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE,false)
    }
    @Test fun delayedPipCallbackFallsBackOnceAndNewEnablementClosesGuide() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        TrackingPrefs(context).disclosureAccepted=true
        Settings.Secure.putString(context.contentResolver,Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,"")
        shadowOf(context.packageManager).setSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE,true)
        val controller=Robolectric.buildActivity(AccessibilityGuideActivity::class.java).create().start().resume()
        val activity=controller.get()
        val root=activity.findViewById<ViewGroup>(android.R.id.content)
        assertTrue(root.getChildAt(0) is GuideVideoPlayer)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1300))
        val intent=shadowOf(activity).nextStartedActivity
        assertEquals(Settings.ACTION_ACCESSIBILITY_SETTINGS,intent.action)
        assertTrue(intent.flags and Intent.FLAG_ACTIVITY_NEW_TASK != 0)
        assertFalse(activity.isFinishing)
        Settings.Secure.putString(context.contentResolver,Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            Health.serviceComponent(context).flattenToString())
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(2400))
        assertTrue(activity.isFinishing)
        assertNull(shadowOf(activity).nextStartedActivity)
        controller.pause().stop().destroy()
        TrackingPrefs(context).disclosureAccepted=false
        Settings.Secure.putString(context.contentResolver,Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,"")
        shadowOf(context.packageManager).setSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE,false)
    }
}
