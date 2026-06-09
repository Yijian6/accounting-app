package com.shiyu.accounting;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LauncherIcon")
public class LauncherIconPlugin extends Plugin {
    private static final String[][] THEME_ALIASES = {
        { "nightsakura", "LauncherNightsakura" },
        { "inkgold", "LauncherInkgold" },
        { "deepsea", "LauncherDeepsea" },
        { "moss", "LauncherMoss" },
        { "dawn", "LauncherDawn" },
        { "frostmoon", "LauncherFrostmoon" },
        { "cloudpaper", "LauncherCloudpaper" },
        { "whitepeach", "LauncherWhitepeach" }
    };

    @PluginMethod
    public void setThemeIcon(PluginCall call) {
        String theme = call.getString("theme", "nightsakura");
        String targetAlias = getAlias(theme);

        if (targetAlias == null) {
            call.reject("Unknown launcher icon theme");
            return;
        }

        PackageManager packageManager = getContext().getPackageManager();
        String packageName = getContext().getPackageName();

        setAliasState(packageManager, packageName, targetAlias, PackageManager.COMPONENT_ENABLED_STATE_ENABLED);

        for (String[] entry : THEME_ALIASES) {
            String alias = entry[1];
            if (!alias.equals(targetAlias)) {
                setAliasState(packageManager, packageName, alias, PackageManager.COMPONENT_ENABLED_STATE_DISABLED);
            }
        }

        call.resolve();
    }

    private String getAlias(String theme) {
        for (String[] entry : THEME_ALIASES) {
            if (entry[0].equals(theme)) {
                return entry[1];
            }
        }
        return null;
    }

    private void setAliasState(PackageManager packageManager, String packageName, String alias, int state) {
        ComponentName component = new ComponentName(packageName, packageName + "." + alias);
        packageManager.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP);
    }
}
