package pl.forma.dziennik;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ExternalLinksPlugin.class);
        registerPlugin(FormaWidgetsPlugin.class);
        registerPlugin(FormaUpdaterPlugin.class);
        registerPlugin(FormaFoodCatalogPlugin.class);
        registerPlugin(WorkoutNotificationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
