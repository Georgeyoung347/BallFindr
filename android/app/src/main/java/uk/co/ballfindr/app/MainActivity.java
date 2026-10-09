package uk.co.ballfindr.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // initialPlugins are registered after the auto-discovered plugins, so this
        // crash-safe subclass replaces the stock PushNotifications plugin by name.
        initialPlugins.add(SafePushNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
