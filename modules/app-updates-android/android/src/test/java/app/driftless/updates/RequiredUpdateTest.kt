package app.driftless.updates

import android.content.Context
import android.content.pm.ApplicationInfo
import androidx.test.core.app.ApplicationProvider
import com.google.android.play.core.appupdate.testing.FakeAppUpdateManager
import com.google.android.play.core.install.model.AppUpdateType
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RequiredUpdateTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val policy get() = RequiredUpdate(context)
    private lateinit var play: FakeAppUpdateManager
    @Before fun setup() {
        context.getSharedPreferences("scrollsnooze_required_update", Context.MODE_PRIVATE).edit().clear().commit()
        context.applicationInfo.flags = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE.inv()
        shadowOf(context.packageManager).setInstallSourceInfo(context.packageName, "com.android.vending", "com.android.vending")
        shadowOf(context.packageManager).getInternalMutablePackageInfo(context.packageName).longVersionCode = 1L
        play = FakeAppUpdateManager(context)
    }
    @Test fun playInstallsSupportedButDebugAndSideloadsAreNot() {
        assertTrue(policy.supported())
        context.applicationInfo.flags = context.applicationInfo.flags or ApplicationInfo.FLAG_DEBUGGABLE
        assertFalse(policy.supported())
        context.applicationInfo.flags = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE.inv()
        shadowOf(context.packageManager).setInstallSourceInfo(context.packageName, "other.installer", "other.installer")
        assertFalse(policy.supported())
    }
    @Test fun noUpdateAndOlderBuildNeverCreateARequirement() {
        policy.observe(play.appUpdateInfo.result)
        assertFalse(policy.state()["required"] as Boolean)
        play.setUpdateAvailable(1)
        policy.observe(play.appUpdateInfo.result)
        assertEquals(0L, policy.targetVersion())
    }
    @Test fun anAvailableBuildPersistsAcrossPolicyRecreationAndUnavailablePlayResults() {
        play.setUpdateAvailable(2)
        policy.observe(play.appUpdateInfo.result)
        assertTrue(policy.state()["required"] as Boolean)
        play.setUpdateNotAvailable()
        policy.observe(play.appUpdateInfo.result)
        assertEquals(2L, RequiredUpdate(context).targetVersion())
        assertTrue(RequiredUpdate(context).state()["required"] as Boolean)
    }
    @Test fun flexibleOnlyUpdatesStillRequireInstallingViaTheStore() {
        play.setUpdateAvailable(2, AppUpdateType.FLEXIBLE)
        policy.observe(play.appUpdateInfo.result)
        assertTrue(policy.state()["required"] as Boolean)
    }
    @Test fun aNewerAvailableReleaseRaisesTheRequirementAndOlderResponsesCannotLowerIt() {
        play.setUpdateAvailable(4); policy.observe(play.appUpdateInfo.result)
        play.setUpdateAvailable(2); policy.observe(play.appUpdateInfo.result)
        assertEquals(4L, policy.targetVersion())
    }
    @Test fun onlyTheInstalledVersionClearsThePersistedRequirement() {
        play.setUpdateAvailable(3); policy.observe(play.appUpdateInfo.result)
        val info = shadowOf(context.packageManager).getInternalMutablePackageInfo(context.packageName)
        info.longVersionCode = 2L
        assertEquals(3L, policy.targetVersion())
        info.longVersionCode = 3L
        assertEquals(0L, policy.targetVersion())
        assertFalse(policy.state()["required"] as Boolean)
    }
}
