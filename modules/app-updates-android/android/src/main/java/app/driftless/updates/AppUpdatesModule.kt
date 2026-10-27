package app.driftless.updates

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppUpdatesModule : Module() {
    private val context get() = requireNotNull(appContext.reactContext)
    private val policy by lazy { RequiredUpdate(context.applicationContext) }
    private val manager by lazy { AppUpdateManagerFactory.create(context.applicationContext) }
    private var updating = false

    private fun openStore(activity: Activity) {
        val id = activity.packageName
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$id"))
                .setPackage("com.android.vending"))
        } catch (_: android.content.ActivityNotFoundException) {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$id")))
        }
    }

    override fun definition() = ModuleDefinition {
        Name("ScrollSnoozeAppUpdates")
        Function("cachedState") { policy.state() }
        AsyncFunction("check") { promise: Promise ->
            if (!policy.supported()) promise.resolve(policy.state())
            else manager.appUpdateInfo.addOnSuccessListener { info ->
                runCatching {
                    policy.observe(info)
                    policy.state(info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)
                }.onSuccess { promise.resolve(it) }
                    .onFailure { promise.reject(CodedException("UPDATE_STATE", "Update check could not finish", it)) }
            }.addOnFailureListener { promise.reject(CodedException("UPDATE_CHECK", "Google Play update check unavailable", it)) }
        }
        AsyncFunction("startUpdate") { promise: Promise ->
            val activity = appContext.currentActivity
                ?: return@AsyncFunction promise.reject(CodedException("NO_ACTIVITY", "No foreground activity", null))
            activity.runOnUiThread {
                if (updating) {
                    promise.reject(CodedException("UPDATE_IN_PROGRESS", "An update is already open", null))
                    return@runOnUiThread
                }
                updating = true
                // Every attempt obtains a fresh AppUpdateInfo; Play intents are single-use.
                manager.appUpdateInfo.addOnSuccessListener { info ->
                    runCatching {
                        policy.observe(info)
                        if (info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) &&
                            info.updateAvailability() in listOf(UpdateAvailability.UPDATE_AVAILABLE,
                                UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)) {
                            manager.startUpdateFlow(info, activity, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
                                .addOnSuccessListener { result ->
                                    updating = false
                                    promise.resolve(if (result == Activity.RESULT_OK) "completed" else "cancelled")
                                }.addOnFailureListener {
                                    updating = false
                                    runCatching { openStore(activity) }
                                        .onSuccess { promise.resolve("store") }
                                        .onFailure { promise.reject(CodedException("UPDATE_OPEN", "Google Play could not open", it)) }
                                }
                        } else {
                            openStore(activity); updating = false; promise.resolve("store")
                        }
                    }.onFailure {
                        updating = false
                        promise.reject(CodedException("UPDATE_OPEN", "Google Play could not open", it))
                    }
                }.addOnFailureListener {
                    updating = false
                    runCatching { openStore(activity) }
                        .onSuccess { promise.resolve("store") }
                        .onFailure { promise.reject(CodedException("UPDATE_OPEN", "Google Play could not open", it)) }
                }
            }
        }
    }
}
