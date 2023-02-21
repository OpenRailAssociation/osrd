package fr.sncf.osrd.reporting.warnings;

import com.squareup.moshi.JsonAdapter;
import fr.sncf.osrd.reporting.Reflection;
import java.io.Serial;
import java.io.Serializable;
import java.util.List;

public class Warning implements Serializable {
    @Serial
    private static final long serialVersionUID = -8459877431662464930L;

    /** Detailed warning message */
    public final String message;

    public static final String osrdWarningType = "core";

    public Warning(String message) {
        this.message = message;
    }

    public static final JsonAdapter<Warning> adapter = Reflection.makeJsonAdapterFromSubtypes(
            Warning.class, "type", List.of(), "osrdWarningType");
}
