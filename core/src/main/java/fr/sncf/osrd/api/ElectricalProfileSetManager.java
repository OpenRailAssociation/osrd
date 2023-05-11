package fr.sncf.osrd.api;

import com.squareup.moshi.JsonDataException;
import fr.sncf.osrd.external_generated_inputs.ElectricalProfileMapping;
import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet;
import okhttp3.OkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

/** Manager that fetches and stores the different electrical profile sets used. */
public class ElectricalProfileSetManager extends APIClient {
    private final ConcurrentHashMap<String, CacheEntry> cache =
            new ConcurrentHashMap<>();
    private static final Logger logger = LoggerFactory.getLogger(ElectricalProfileSetManager.class);

    public ElectricalProfileSetManager(String baseUrl, String authorizationToken, OkHttpClient client) {
        super(baseUrl, authorizationToken, client);
    }

    /**
     * Return the electrical profile set corresponding to the given id, in a ready-to-use format.
     */
    public ElectricalProfileMapping getProfileMap(String profileSetId) {
        if (profileSetId == null) {
            return null;
        }

        cache.putIfAbsent(profileSetId, new CacheEntry(null));
        var cacheEntry = cache.get(profileSetId);

        if (cacheEntry.status == CacheEntryStatus.INITIALIZING) {
            synchronized (cacheEntry) {
                try {
                    logger.info("Electrical profile set {} is not cached", profileSetId);
                    var endpointPath = String.format("electrical_profile_set/%s/", profileSetId);
                    var request = buildRequest(endpointPath);
                    logger.info("Fetching it from {}", request.url());

                    RJSElectricalProfileSet rjsProfileSet;
                    try (var response = httpClient.newCall(request).execute()) {
                        if (!response.isSuccessful())
                            throw new UnexpectedHttpResponse(response);
                        var body = response.body();
                        if (body == null)
                            throw new JsonDataException("empty response body");
                        rjsProfileSet = RJSElectricalProfileSet.adapter.fromJson(body.source());
                    }
                    if (rjsProfileSet == null)
                        throw new JsonDataException("Empty electrical profile set JSON");
                    logger.info("Electrical profile set {} fetched, parsing it", profileSetId);
                    var mapping = new ElectricalProfileMapping();
                    mapping.parseRJS(rjsProfileSet);
                    logger.info("Electrical profile set {} parsed", profileSetId);
                    cacheEntry.mapping = mapping;
                    cacheEntry.status = CacheEntryStatus.CACHED;
                } catch (IOException | UnexpectedHttpResponse | JsonDataException e) {
                    logger.error("failed to get electrical profile set", e);
                    cacheEntry.status = CacheEntryStatus.ERROR;
                }
            }
        }

        if (cacheEntry.status == CacheEntryStatus.CACHED)
            return cacheEntry.mapping;
        return null;
    }

    public enum CacheEntryStatus {
        INITIALIZING,
        CACHED,
        ERROR;
    }

    private static class CacheEntry {
        private CacheEntryStatus status;
        private ElectricalProfileMapping mapping;

        public CacheEntry(ElectricalProfileMapping mapping) {
            this.mapping = mapping;
            this.status = CacheEntryStatus.INITIALIZING;
        }
    }
}
