package app.driftless.updates

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Build
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.install.model.UpdateAvailability

/** Device-wide and independent of sign-in/local-history resets. Only installing clears a gate. */
class RequiredUpdate(private val context: Context) {
    private val prefs = context.getSharedPreferences("scrollsnooze_required_update", Context.MODE_PRIVATE)
    fun installedVersion(): Long {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        @Suppress("DEPRECATION")
        return if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
    }
    fun supported(): Boolean {
        if (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) return false
        return runCatching {
            if (Build.VERSION.SDK_INT >= 30) context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName == "com.android.vending"
            else {
                @Suppress("DEPRECATION")
                context.packageManager.getInstallerPackageName(context.packageName) == "com.android.vending"
            }
        }.getOrDefault(false)
    }
    @Synchronized fun targetVersion(): Long {
        val saved = prefs.getLong("required_version", 0L)
        if (saved > 0 && installedVersion() >= saved) {
            prefs.edit().remove("required_version").commit()
            return 0L
        }
        return saved
    }
    @Synchronized fun observe(info: AppUpdateInfo) {
        if (info.updateAvailability() !in listOf(UpdateAvailability.UPDATE_AVAILABLE,
                UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)) return
        val available = info.availableVersionCode().toLong()
        if (available > installedVersion() && available > targetVersion()) {
            check(prefs.edit().putLong("required_version", available).commit()) { "Could not save required update" }
        }
    }
    fun state(inProgress: Boolean = false): Map<String, Any> {
        val installed = installedVersion()
        val target = targetVersion()
        val enabled = supported()
        return mapOf("supported" to enabled, "required" to (enabled && target > installed),
            "installedVersion" to installed.toDouble(), "requiredVersion" to target.toDouble(),
            "inProgress" to inProgress)
    }
}
