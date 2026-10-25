package app.driftless.tracking.android

import android.appwidget.AppWidgetManager
import android.content.Context
import android.provider.Settings
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.R
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Instant
import java.util.TimeZone

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[35])
class CountWidgetTest {
    @Test fun widgetUsesVerifiedAccountDayAndNeverReusesPreviousAccountsCount() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val prior=TimeZone.getDefault()
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Honolulu"))
            Settings.Global.putInt(context.contentResolver,Settings.Global.BOOT_COUNT,1)
            val store=SqliteStore.get(context);val inc="00000000-0000-4000-8000-000000000003"
            store.selectScope("account:$inc");store.setSourceDevice("widget-device")
            val now=Instant.parse("2026-11-01T04:30:00Z").toEpochMilli()
            val limits=JSONObject().put("views",20)
            val policy=JSONObject().put("incarnation",inc).put("tz","America/New_York").put("activeFromMs",now-1800000).put("rev",1)
                .put("policies",JSONArray().put(JSONObject().put("effectiveDate","2026-11-01").put("limits",limits)))
            val snapshot=JSONObject().put("incarnation",inc).put("localDate","2026-11-01").put("rev",1).put("limits",limits)
                .put("used",JSONObject().put("views",7)).put("devices",JSONObject()).put("unavailable",JSONArray())
                .put("endMs",now+86400000).put("serverTimeMs",now)
            store.account.install(JSONObject().put("serverTimeMs",now).put("policy",policy).put("snapshot",snapshot).toString(),"account:$inc")
            val manager=shadowOf(AppWidgetManager.getInstance(context))
            val widget=manager.createWidget(CountWidget::class.java,R.layout.driftless_count_widget)
            CountWidget.update(context)
            assertEquals("7",manager.getViewFor(widget).findViewById<TextView>(R.id.count_widget_value).text.toString())
            assertTrue(manager.getViewFor(widget).findViewById<TextView>(R.id.count_widget_status).text.toString().contains("Counting is off"))
            store.selectScope("account:widget-fresh")
            CountWidget.update(context)
            assertEquals("—",manager.getViewFor(widget).findViewById<TextView>(R.id.count_widget_value).text.toString())
        } finally {TimeZone.setDefault(prior)}
    }
}
