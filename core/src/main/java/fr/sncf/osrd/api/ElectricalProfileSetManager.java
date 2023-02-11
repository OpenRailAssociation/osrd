package fr.sncf.osrd.api;

import com.squareup.moshi.JsonDataException;
import fr.sncf.osrd.external_generated_inputs.ElectricalProfileMapping;
import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import okhttp3.OkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

/** Manager that fetches and stores the different electrical profile sets used. */
public class ElectricalProfileSetManager extends APIClient {
    protected final ConcurrentHashMap<String, CacheEntry> cache =
            new ConcurrentHashMap<>();
    private static final Logger logger = LoggerFactory.getLogger(ElectricalProfileSetManager.class);

    public ElectricalProfileSetManager(String baseUrl, String authorizationToken, OkHttpClient client) {
        super(baseUrl, authorizationToken, client);
    }

    /**
     * Get the electrical profile set with the given ID and store it in the cacheEntry.
     */
    private void downloadSet(CacheEntry cacheEntry, String profileSetId) {
        try {
            logger.info("Electrical profile set {} is not cached", profileSetId);
            var endpointPath = String.format("electrical_profile_set/%s/", profileSetId);
            var request = buildRequest(endpointPath);

            logger.info("Fetching from {}", request.url());
            cacheEntry.setStatus(CacheStatus.DOWNLOADING);
            RJSElectricalProfileSet rjsProfileSet;
            try (var response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful())
                    throw new UnexpectedHttpResponse(response);
                var body = response.body();
                if (body == null)
                    throw new JsonDataException("empty response body");
                logger.info("Electrical profile set {} fetched, parsing it to json", profileSetId);
                cacheEntry.setStatus(CacheStatus.PARSING_JSON);
                rjsProfileSet = RJSElectricalProfileSet.adapter.fromJson(body.source());
            }
            if (rjsProfileSet == null)
                throw new JsonDataException("Empty electrical profile set JSON");

            logger.info("Parsing electrical profile set {} into model", profileSetId);
            cacheEntry.setStatus(CacheStatus.PARSING_MODEL);
            var mapping = new ElectricalProfileMapping();
            mapping.parseRJS(rjsProfileSet);

            logger.info("Electrical profile set {} parsed", profileSetId);
            cacheEntry.mapping = mapping;
            cacheEntry.setStatus(CacheStatus.CACHED);
        } catch (IOException | UnexpectedHttpResponse | VirtualMachineError e) {
            cacheEntry.setStatus(CacheStatus.TRANSIENT_ERROR);
            throw OSRDError.newEPSetLoadingError(ErrorType.EPSetSoftLoadingError, e, profileSetId);
        } catch (Exception e) {
            logger.error("Hard error while loading electrical profile set", e);
            cacheEntry.setStatus(CacheStatus.ERROR);
            throw OSRDError.newEPSetLoadingError(ErrorType.EPSetHardLoadingError, e, profileSetId);
        }
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

        synchronized (cacheEntry) {
            if (cacheEntry.status == CacheStatus.CACHED)
                return cacheEntry.mapping;
            else if (cacheEntry.status == CacheStatus.ERROR)
                throw OSRDError.newEPSetLoadingError(ErrorType.EPSetLoadingCacheException, null, profileSetId);
            else {
                downloadSet(cacheEntry, profileSetId);
                if (cacheEntry.status != CacheStatus.CACHED)
                    // We should have raised exceptions before this point if the status is not CACHED
                    throw OSRDError.newEPSetLoadingError(ErrorType.EPSetInvalidStatusAfterLoading, null, profileSetId);
                return cacheEntry.mapping;
            }
        }
    }


    protected static class CacheEntry {
        protected CacheStatus status;
        private ElectricalProfileMapping mapping;

        CacheEntry(ElectricalProfileMapping mapping) {
            this.mapping = mapping;
            this.status = CacheStatus.INITIALIZING;
        }

        void setStatus(CacheStatus newStatus) {
            assert status.canTransitionTo(newStatus);
            status = newStatus;
        }
    }

    protected enum CacheStatus {
        INITIALIZING,
        DOWNLOADING,
        PARSING_JSON,
        PARSING_MODEL,
        CACHED,
        // errors that are known to be temporary
        TRANSIENT_ERROR,
        ERROR;

        private CacheStatus[] transitions;

        boolean canTransitionTo(CacheStatus newStatus) {
            for (var status : transitions)
                if (status == newStatus)
                    return true;
            return false;
        }

        static {
            INITIALIZING.transitions = new CacheStatus[] { DOWNLOADING };
            DOWNLOADING.transitions = new CacheStatus[] { PARSING_JSON, ERROR, TRANSIENT_ERROR };
            PARSING_JSON.transitions = new CacheStatus[] { PARSING_MODEL, ERROR, TRANSIENT_ERROR };
            PARSING_MODEL.transitions = new CacheStatus[] { CACHED, ERROR, TRANSIENT_ERROR };
            // at the next try
            TRANSIENT_ERROR.transitions = new CacheStatus[] { DOWNLOADING };
        }
    }
}
