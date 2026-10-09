package uk.co.ballfindr.app;

import android.Manifest;
import android.content.Context;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.Logger;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * Crash-safe replacement for the stock PushNotifications plugin.
 *
 * The stock plugin's register()/unregister() call FirebaseMessaging.getInstance()
 * with no error handling. When the app is built without android/app/google-services.json
 * Firebase is never initialised, getInstance() throws IllegalStateException, and
 * Capacitor's bridge rethrows it on the main thread: the app crashes. The live
 * website calls register() right after sign-in, so every login crashed the app.
 *
 * This subclass keeps the same plugin name and behaviour, but rejects the call
 * (which the website already handles silently) instead of crashing when Firebase
 * is not configured. Once google-services.json is added, push works unchanged.
 *
 * Registered from MainActivity via initialPlugins, which Capacitor registers after
 * the auto-discovered plugins, so this class replaces the stock one by name.
 */
@CapacitorPlugin(
    name = "PushNotifications",
    permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "receive")
)
public class SafePushNotificationsPlugin extends PushNotificationsPlugin {

    private static final String NOT_CONFIGURED =
        "Push notifications are not configured in this build (missing google-services.json)";

    /** The google-services Gradle plugin generates google_app_id only when google-services.json is present. */
    static boolean isFirebaseConfigured(Context context) {
        if (context == null) return false;
        return context.getResources().getIdentifier("google_app_id", "string", context.getPackageName()) != 0;
    }

    @Override
    @PluginMethod
    public void register(PluginCall call) {
        if (!isFirebaseConfigured(getContext())) {
            Logger.warn("PushNotifications", NOT_CONFIGURED);
            call.reject(NOT_CONFIGURED);
            return;
        }
        try {
            super.register(call);
        } catch (RuntimeException e) {
            Logger.error("PushNotifications", "register failed", e);
            call.reject("Push registration failed: " + e.getMessage());
        }
    }

    @Override
    @PluginMethod
    public void unregister(PluginCall call) {
        if (!isFirebaseConfigured(getContext())) {
            call.resolve();
            return;
        }
        try {
            super.unregister(call);
        } catch (RuntimeException e) {
            Logger.error("PushNotifications", "unregister failed", e);
            call.reject("Push unregister failed: " + e.getMessage());
        }
    }
}
