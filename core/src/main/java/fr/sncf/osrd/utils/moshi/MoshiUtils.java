package fr.sncf.osrd.utils.moshi;

import com.squareup.moshi.JsonAdapter;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import okio.Okio;
import java.io.IOException;
import java.nio.file.Path;

public class MoshiUtils {
    /** Deserialize from some file */
    @SuppressFBWarnings(
            value = "RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE",
            justification = "that's a spotbugs bug :)"
    )
    public static <T> T deserialize(JsonAdapter<T> adapter, Path inputPath) throws IOException {
        try (
                var fileSource = Okio.source(inputPath);
                var bufferedSource = Okio.buffer(fileSource)
        ) {
            return adapter.fromJson(bufferedSource);
        }
    }
}
