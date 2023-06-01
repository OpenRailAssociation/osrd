package fr.sncf.osrd.api;

import static fr.sncf.osrd.api.SignalingSimulatorKt.makeSignalingSimulator;
import static fr.sncf.osrd.sim_infra_adapter.RawInfraAdapterKt.adaptRawInfra;

import com.squareup.moshi.JsonDataException;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorder;
import fr.sncf.osrd.signaling.SignalingSimulator;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import okhttp3.OkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;

public class InfraManager extends APIClient {
    static final Logger logger = LoggerFactory.getLogger(InfraManager.class);

    private final ConcurrentHashMap<String, InfraCacheEntry> infraCache = new ConcurrentHashMap<>();
    private final SignalingSimulator signalingSimulator = makeSignalingSimulator();
    private final boolean loadIfMissing;

    public void forEach(BiConsumer<String, InfraCacheEntry> action) {
        infraCache.forEach(action);
    }

    public static final class InfraLoadException extends OSRDError {
        private static final long serialVersionUID = 4291184310194002894L;
        public static final String osrdErrorType = "infra_loading";

        public final InfraStatus sourceOperation;

        InfraLoadException(String message, InfraStatus sourceOperation, Throwable cause) {
            super(message, ErrorCause.USER, cause);
            this.sourceOperation = sourceOperation;
        }

        InfraLoadException(String message, InfraStatus sourceOperation) {
            super(message, ErrorCause.USER);
            this.sourceOperation = sourceOperation;
        }

        @Override
        public String toString() {
            return getMessage() + " in state " + sourceOperation.name() + ": " + super.getCause();
        }
    }

    public static final class InfraGetException extends OSRDError {
        private static final long serialVersionUID = 4291184310194002894L;
        public static final String osrdErrorType = "get_infra";

        InfraGetException(String message) {
            super(message, ErrorCause.USER);
        }
    }


    public enum InfraStatus {
        INITIALIZING(false),
        DOWNLOADING(false),
        PARSING_JSON(false),
        PARSING_INFRA(false),
        ADAPTING_KOTLIN(false),
        LOADING_SIGNALS(false),
        BUILDING_BLOCKS(false),
        CACHED(true),
        // errors that are known to be temporary
        TRANSIENT_ERROR(false),
        ERROR(true);

        static {
            INITIALIZING.transitions = new InfraStatus[]{DOWNLOADING};
            DOWNLOADING.transitions = new InfraStatus[]{PARSING_JSON, ERROR, TRANSIENT_ERROR};
            PARSING_JSON.transitions = new InfraStatus[]{PARSING_INFRA, ERROR, TRANSIENT_ERROR};
            PARSING_INFRA.transitions = new InfraStatus[]{ADAPTING_KOTLIN, ERROR, TRANSIENT_ERROR};
            ADAPTING_KOTLIN.transitions = new InfraStatus[]{LOADING_SIGNALS, ERROR, TRANSIENT_ERROR};
            LOADING_SIGNALS.transitions = new InfraStatus[]{BUILDING_BLOCKS, ERROR, TRANSIENT_ERROR};
            BUILDING_BLOCKS.transitions = new InfraStatus[]{CACHED, ERROR, TRANSIENT_ERROR};
            // if a new version appears
            CACHED.transitions = new InfraStatus[]{DOWNLOADING};
            // at the next try
            TRANSIENT_ERROR.transitions = new InfraStatus[]{DOWNLOADING};
            // if a new version appears
            ERROR.transitions = new InfraStatus[]{DOWNLOADING};
        }

        private InfraStatus(boolean isStable) {
            this.isStable = isStable;
        }

        public final boolean isStable;
        private InfraStatus[] transitions;

        boolean canTransitionTo(InfraStatus newStatus) {
            for (var status : transitions)
                if (status == newStatus)
                    return true;
            return false;
        }
    }


    public static final class InfraCacheEntry {
        public InfraStatus status = InfraStatus.INITIALIZING;
        public InfraStatus lastStatus = null;
        public Throwable lastError = null;
        public FullInfra infra = null;
        public String version = null;

        void transitionTo(InfraStatus newStatus) {
            transitionTo(newStatus, null);
        }

        void transitionTo(InfraStatus newStatus, Throwable error) {
            assert status.canTransitionTo(newStatus) : String.format("cannot switch from %s to %s", status, newStatus);
            this.lastStatus = this.status;
            this.lastError = error;
            this.status = newStatus;
        }
    }


    public InfraManager(String baseUrl, String authorizationToken, OkHttpClient httpClient, boolean loadIfMissing) {
        super(baseUrl, authorizationToken, httpClient);
        this.loadIfMissing = loadIfMissing;
    }

    @ExcludeFromGeneratedCodeCoverage
    @SuppressFBWarnings({
            "RCN_REDUNDANT_NULLCHECK_WOULD_HAVE_BEEN_A_NPE",
            "NP_NULL_ON_SOME_PATH_FROM_RETURN_VALUE",
            "DM_GC"
    })
    private FullInfra downloadInfra(
            InfraCacheEntry cacheEntry,
            String infraId,
            DiagnosticRecorder diagnosticRecorder
    ) throws InfraLoadException {
        // create a request
        var endpointPath = String.format("infra/%s/railjson/", infraId);
        var request = buildRequest(endpointPath);

        try {
            // use the client to send the request
            logger.info("starting to download {}", request.url());
            cacheEntry.transitionTo(InfraStatus.DOWNLOADING);

            RJSInfra rjsInfra;
            String version;
            try (var response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful())
                    throw new UnexpectedHttpResponse(response);

                // Parse the response
                logger.info("parsing the JSON of {}", request.url());
                cacheEntry.transitionTo(InfraStatus.PARSING_JSON);
                version = response.header("x-infra-version");
                assert version != null : "missing x-infra-version header in railjson response";
                rjsInfra = RJSInfra.adapter.fromJson(response.body().source());
            }

            if (rjsInfra == null)
                throw new JsonDataException("RJSInfra is null");

            // Parse railjson into a proper infra
            logger.info("parsing the infra of {}", request.url());
            cacheEntry.transitionTo(InfraStatus.PARSING_INFRA);
            final var infra = SignalingInfraBuilder.fromRJSInfra(
                    rjsInfra,
                    Set.of(new BAL3(diagnosticRecorder)),
                    diagnosticRecorder
            );

            // Attempt to ease memory pressure by making the RailJSON deserialized copy
            // orphan, and calling the garbage collector.
            rjsInfra = null;
            System.gc();

            logger.info("adaptation to kotlin of {}", request.url());
            cacheEntry.transitionTo(InfraStatus.ADAPTING_KOTLIN);
            var rawInfra = adaptRawInfra(infra);
            logger.info("loading signals of {}", request.url());
            cacheEntry.transitionTo(InfraStatus.LOADING_SIGNALS);
            var loadedSignalInfra = signalingSimulator.loadSignals(rawInfra);
            logger.info("building blocks of {}", request.url());
            cacheEntry.transitionTo(InfraStatus.BUILDING_BLOCKS);
            var blockInfra = signalingSimulator.buildBlocks(rawInfra, loadedSignalInfra);

            // Cache the infra
            logger.info("successfully cached {}", request.url());
            cacheEntry.infra = new FullInfra(infra, rawInfra, loadedSignalInfra, blockInfra, signalingSimulator);
            cacheEntry.version = version;
            cacheEntry.transitionTo(InfraStatus.CACHED);
            return cacheEntry.infra;
        } catch (IOException | UnexpectedHttpResponse | VirtualMachineError e) {
            cacheEntry.transitionTo(InfraStatus.TRANSIENT_ERROR, e);
            throw new InfraLoadException("soft error while loading new infra", cacheEntry.lastStatus, e);
        } catch (Throwable e) {
            cacheEntry.transitionTo(InfraStatus.ERROR, e);
            throw new InfraLoadException("hard error while loading new infra", cacheEntry.lastStatus, e);
        }
    }

    /**
     * Load an infra given an id. Cache infra for optimized future call
     */
    @ExcludeFromGeneratedCodeCoverage
    @SuppressFBWarnings({"REC_CATCH_EXCEPTION"})
    public FullInfra load(String infraId, String expectedVersion, DiagnosticRecorder diagnosticRecorder)
            throws InfraLoadException, InterruptedException {
        try {
            infraCache.putIfAbsent(infraId, new InfraCacheEntry());
            var cacheEntry = infraCache.get(infraId);

            // /!\ the cache entry lock is held while a download / parse process is in progress
            synchronized (cacheEntry) {
                // try downloading the infra again if:
                //  - the existing cache entry hasn't reached a stable state
                //  - we don't have the right version
                var obsoleteVersion = expectedVersion != null && !expectedVersion.equals(cacheEntry.version);
                if (!cacheEntry.status.isStable || obsoleteVersion)
                    return downloadInfra(cacheEntry, infraId, diagnosticRecorder);

                // otherwise, wait for the infra to reach a stable state
                if (cacheEntry.status == InfraStatus.CACHED)
                    return cacheEntry.infra;
                if (cacheEntry.status == InfraStatus.ERROR)
                    throw new InfraLoadException("cached exception", cacheEntry.lastStatus, cacheEntry.lastError);
                throw new InfraLoadException("invalid status after waitUntilStable", cacheEntry.status);
            }
        } catch (Exception e) {
            logger.error("exception while loading infra", e);
            throw e;
        }
    }

    public InfraCacheEntry getInfraCache(String infraId) {
        return infraCache.get(infraId);
    }

    public InfraCacheEntry deleteFromInfraCache(String infraId) {
        return infraCache.remove(infraId);
    }

    /**
     * Get an infra given an id
     */
    public FullInfra getInfra(String infraId, String expectedVersion, DiagnosticRecorder diagnosticRecorder)
            throws InfraLoadException, InterruptedException {
        try {
            infraCache.putIfAbsent(infraId, new InfraCacheEntry());
            var cacheEntry = infraCache.get(infraId);
            // download the infra for tests
            if (loadIfMissing) {
                return load(infraId, expectedVersion, diagnosticRecorder);
            }
            var obsoleteVersion = expectedVersion != null && !expectedVersion.equals(cacheEntry.version);
            if (!cacheEntry.status.isStable)
                throw new InfraGetException("Infra not loaded");
            if (obsoleteVersion) {
                deleteFromInfraCache(infraId);
                throw new InfraGetException("Invalid version");
            }
            if (cacheEntry.status == InfraStatus.CACHED)
                return cacheEntry.infra;
            throw new InfraLoadException("invalid status", cacheEntry.status);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            logger.error("exception while getting infra", e);
            throw e;
        }
    }
}
