package fr.sncf.osrd.cli;

import com.beust.jcommander.IDefaultProvider;
import java.util.Locale;

public class EnvProvider implements IDefaultProvider {
    final String prefix;

    public EnvProvider(String prefix) {
        this.prefix = prefix;
    }

    @Override
    public String getDefaultValueFor(String optionName) {
        // ignore short arguments
        if (!optionName.startsWith("--")) return null;

        var kebabName = optionName.substring(2);
        var screamingSnakeName = kebabName.replace('-', '_').toUpperCase(Locale.ENGLISH);
        return System.getenv(prefix + screamingSnakeName);
    }
}
