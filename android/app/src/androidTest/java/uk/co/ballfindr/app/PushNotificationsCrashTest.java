package uk.co.ballfindr.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.PluginResult;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Regression tests for the crash on sign-in: the website calls
 * PushNotifications.register() after login, and the stock plugin crashed the
 * app when the build has no google-services.json.
 */
@RunWith(AndroidJUnit4.class)
public class PushNotificationsCrashTest {

    /** Records how a plugin call finished instead of sending it to the WebView. */
    private static final class RecordingCall extends PluginCall {

        volatile String outcome = null;

        RecordingCall(String methodName) {
            super(null, "PushNotifications", "test", methodName, new JSObject());
        }

        // resolve() and resolve(data) call the message handler directly (there is
        // none in this test), so every completion path is overridden here.
        @Override
        public void successCallback(PluginResult successResult) {
            outcome = "resolved";
        }

        @Override
        public void resolve() {
            outcome = "resolved";
        }

        @Override
        public void resolve(JSObject data) {
            outcome = "resolved";
        }

        @Override
        public void errorCallback(String msg) {
            outcome = "rejected: " + msg;
        }

        @Override
        public void reject(String msg, String code, Exception ex, JSObject data) {
            outcome = "rejected: " + msg;
        }
    }

    @Test
    public void appHasExpectedPackage() {
        Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("uk.co.ballfindr.app", ctx.getPackageName());
    }

    @Test
    public void pushPluginIsTheCrashSafeReplacement() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<Plugin> instance = new AtomicReference<>();
            scenario.onActivity((activity) -> {
                PluginHandle handle = activity.getBridge().getPlugin("PushNotifications");
                instance.set(handle == null ? null : handle.getInstance());
            });
            assertNotNull("PushNotifications plugin must be registered", instance.get());
            assertTrue(
                "Expected SafePushNotificationsPlugin but got " + instance.get().getClass().getName(),
                instance.get() instanceof SafePushNotificationsPlugin
            );
        }
    }

    @Test
    public void registerAndUnregisterDoNotCrash() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            RecordingCall register = new RecordingCall("register");
            RecordingCall unregister = new RecordingCall("unregister");
            AtomicReference<Throwable> thrown = new AtomicReference<>();

            // Same entry point and thread the bridge uses for a call from the website.
            scenario.onActivity((activity) -> {
                try {
                    PluginHandle handle = activity.getBridge().getPlugin("PushNotifications");
                    handle.invoke("register", register);
                    handle.invoke("unregister", unregister);
                } catch (Throwable t) {
                    thrown.set(t);
                }
            });

            if (thrown.get() != null) {
                Throwable cause = thrown.get().getCause() != null ? thrown.get().getCause() : thrown.get();
                throw new AssertionError("register/unregister threw (this is the sign-in crash): " + cause, cause);
            }
            assertNotNull("register must finish the call", register.outcome);
            assertNotNull("unregister must finish the call", unregister.outcome);

            Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
            if (!SafePushNotificationsPlugin.isFirebaseConfigured(ctx)) {
                assertTrue("Without Firebase, register must reject: " + register.outcome, register.outcome.startsWith("rejected"));
            }
        }
    }
}
