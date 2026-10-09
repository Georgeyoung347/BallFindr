package uk.co.ballfindr.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.Manifest;
import android.os.Build;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * End-to-end check of the "turn on notifications" button: runs the same
 * JavaScript the website runs (requestPermissions, then register) through the
 * real Capacitor bridge in the app's WebView. Before the fix this crashed the
 * app process, which fails this test with "Process crashed".
 */
@RunWith(AndroidJUnit4.class)
public class EnableNotificationsFlowTest {

    private static final long PAGE_TIMEOUT_MS = 120_000;
    private static final long CALL_TIMEOUT_MS = 30_000;

    private static String eval(ActivityScenario<MainActivity> scenario, String js) throws InterruptedException {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity((activity) ->
            activity.getBridge().eval(js, (value) -> {
                result.set(value);
                done.countDown();
            })
        );
        if (!done.await(10, TimeUnit.SECONDS)) return null;
        String v = result.get();
        // evaluateJavascript returns JSON; unwrap plain strings.
        if (v != null && v.length() >= 2 && v.startsWith("\"") && v.endsWith("\"")) v = v.substring(1, v.length() - 1);
        return v;
    }

    private static String waitFor(ActivityScenario<MainActivity> scenario, String js, long timeoutMs) throws InterruptedException {
        long end = SystemClock.uptimeMillis() + timeoutMs;
        String last = null;
        while (SystemClock.uptimeMillis() < end) {
            last = eval(scenario, js);
            if (last != null && !"null".equals(last) && !"pending".equals(last) && !"no".equals(last)) return last;
            SystemClock.sleep(1000);
        }
        return last;
    }

    @Test
    public void enablingNotificationsDoesNotCrash() throws Exception {
        // Pre-grant so the system dialog does not block the test (the user tapping "Allow").
        if (Build.VERSION.SDK_INT >= 33) {
            InstrumentationRegistry.getInstrumentation()
                .getUiAutomation()
                .grantRuntimePermission("uk.co.ballfindr.app", Manifest.permission.POST_NOTIFICATIONS);
        }

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            String ready = waitFor(
                scenario,
                "(document.readyState === 'complete' && window.Capacitor && Capacitor.isPluginAvailable('PushNotifications')) ? 'ready' : 'no'",
                PAGE_TIMEOUT_MS
            );
            assertEquals("Capacitor bridge never became ready in the WebView", "ready", ready);

            String started = eval(
                scenario,
                "(function () {" +
                "  window.__bfPush = 'pending';" +
                "  var P = Capacitor.Plugins.PushNotifications;" +
                "  P.requestPermissions()" +
                "    .then(function (r) { window.__bfPerm = r.receive; return P.register(); })" +
                "    .then(function () { window.__bfPush = 'resolved'; }," +
                "          function (e) { window.__bfPush = 'rejected:' + (e && e.message); });" +
                "  return 'started';" +
                "})()"
            );
            assertEquals("started", started);

            String outcome = waitFor(scenario, "window.__bfPush || 'null'", CALL_TIMEOUT_MS);
            if (outcome == null || "pending".equals(outcome) || "null".equals(outcome)) {
                fail("register() never finished: " + outcome);
            }

            // Give any delayed native work time to blow up, then prove the app is still alive.
            SystemClock.sleep(5000);
            String alive = eval(scenario, "'alive'");
            assertEquals("App did not survive enabling notifications", "alive", alive);

            if (!SafePushNotificationsPlugin.isFirebaseConfigured(InstrumentationRegistry.getInstrumentation().getTargetContext())) {
                assertTrue("Without Firebase, register must reject: " + outcome, outcome.startsWith("rejected"));
            }
        }
    }
}
