package fr.sncf.osrd.utils.moshi;

import com.squareup.moshi.JsonAdapter;
import java.io.IOException;
import java.nio.file.Path;
import okio.Okio;

public class MoshiUtils {
    /** Deserialize from some file */
    public static <T> T deserialize(JsonAdapter<T> adapter, Path inputPath) throws IOException {
        try (var fileSource = Okio.source(inputPath);
                var bufferedSource = Okio.buffer(fileSource)) {
            return adapter.fromJson(bufferedSource);
        }
    }
}
