package fr.sncf.osrd.railjson.parser;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import okio.Okio;
import java.io.IOException;
import java.nio.file.Path;

public class RJSParser {
    /** Parse the RailJSON file at the given Path */
    @SuppressFBWarnings(
            value = "RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE",
            justification = "that's a spotbugs bug :)"
    )
    public static RJSInfra parseRailJSONFromFile(String path) throws IOException {
        try (
                var fileSource = Okio.source(Path.of(path));
                var bufferedSource = Okio.buffer(fileSource)
        ) {
            var rjsRoot = RJSInfra.adapter.fromJson(bufferedSource);
            assert rjsRoot != null;
            return rjsRoot;
        }
    }
}
