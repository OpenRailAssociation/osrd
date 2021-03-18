package fr.sncf.osrd.infra.parser;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.infra.RJSInfra;
import okio.Okio;
import okio.Sink;

import java.io.IOException;
import java.nio.file.Path;

public class RailJSONSerializer {
    /**
     * Serializes to JSON the in-memory RailJSON representation
     * @param rjsInfra the RailJSON root node
     * @param outputPath the output file path
     * @throws IOException {@inheritDoc}
     */
    @SuppressFBWarnings(
            value = "RCN_REDUNDANT_NULLCHECK_WOULD_HAVE_BEEN_A_NPE",
            justification = "that's a spotbugs bug :)"
    )
    public static void serialize(RJSInfra rjsInfra, Path outputPath) throws IOException {
        try (
                Sink fileSink = Okio.sink(outputPath);
                var bufferedSink = Okio.buffer(fileSink)
        ) {
            RJSInfra.adapter.toJson(bufferedSink, rjsInfra);
        }
    }
}
