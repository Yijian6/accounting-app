package com.shiyu.accounting;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LauncherIconPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
