package fr.sncf.osrd.api

import fr.sncf.osrd.parseRJSInfra
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.function.BiConsumer
import okhttp3.OkHttpClient
import org.slf4j.Logger
import org.slf4j.LoggerFactory

class InfraManager(baseUrl: String, authorizationToken: String?, httpClient: OkHttpClient) :
    APIClient(baseUrl, authorizationToken, httpClient), InfraProvider {
    private val infraCache = ConcurrentHashMap<String, InfraCacheEntry>()
    private val signalingSimulator = makeSignalingSimulator()

    fun forEach(action: BiConsumer<String, InfraCacheEntry>) {
        infraCache.forEach(action)
    }

    enum class InfraStatus(val isStable: Boolean) {
        INITIALIZING(false),
        DOWNLOADING(false),
        PARSING_JSON(false),
        PARSING_INFRA(false),
        LOADING_SIGNALS(false),
        BUILDING_BLOCKS(false),
        CACHED(true),

        // errors that are known to be temporary
        TRANSIENT_ERROR(false),
        ERROR(true);

        private var transitions = arrayOf<InfraStatus>()

        fun canTransitionTo(newStatus: InfraStatus): Boolean {
            for (status in transitions) if (status == newStatus) return true
            return false
        }

        companion object {
            init {
                INITIALIZING.transitions = arrayOf<InfraStatus>(DOWNLOADING)
                DOWNLOADING.transitions = arrayOf<InfraStatus>(PARSING_JSON, ERROR, TRANSIENT_ERROR)
                PARSING_JSON.transitions =
                    arrayOf<InfraStatus>(PARSING_INFRA, ERROR, TRANSIENT_ERROR)
                PARSING_INFRA.transitions =
                    arrayOf<InfraStatus>(LOADING_SIGNALS, ERROR, TRANSIENT_ERROR)
                LOADING_SIGNALS.transitions =
                    arrayOf<InfraStatus>(BUILDING_BLOCKS, ERROR, TRANSIENT_ERROR)
                BUILDING_BLOCKS.transitions = arrayOf<InfraStatus>(CACHED, ERROR, TRANSIENT_ERROR)
                // if a new version appears
                CACHED.transitions = arrayOf<InfraStatus>(DOWNLOADING)
                // at the next try
                TRANSIENT_ERROR.transitions = arrayOf<InfraStatus>(DOWNLOADING)
                // if a new version appears
                ERROR.transitions = arrayOf<InfraStatus>(DOWNLOADING)
            }
        }
    }

    class InfraCacheEntry {
        var status: InfraStatus = InfraStatus.INITIALIZING
        var lastStatus: InfraStatus? = null
        var lastError: Throwable? = null
        var infra: FullInfra? = null
        var version: Int? = null

        fun transitionTo(newStatus: InfraStatus, error: Throwable? = null) {
            assert(status.canTransitionTo(newStatus)) {
                String.format("cannot switch from %s to %s", status, newStatus)
            }
            this.lastStatus = this.status
            this.lastError = error
            this.status = newStatus
        }
    }

    @Throws(OSRDError::class)
    private fun downloadInfra(cacheEntry: InfraCacheEntry, infraId: String): FullInfra {
        // create a request
        val endpointPath = String.format("infra/%s/railjson/", infraId)
        val request = buildRequest(endpointPath)

        try {
            // use the client to send the request
            logger.info("starting to download {}", request.url)
            cacheEntry.transitionTo(InfraStatus.DOWNLOADING)

            val rjsInfra: RJSInfra
            val version: Int
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    if (response.code != 404) {
                        throw UnexpectedHttpResponse(response)
                    } else {
                        logger.info("Infra not found (deleted) on supplier middleware")
                        throw OSRDError.newInfraLoadingError(
                            ErrorType.InfraHardLoadingError,
                            "Infra not found (deleted) on supplier middleware",
                        )
                    }
                }
                // Parse the response
                logger.info("parsing the JSON of {}", request.url)
                cacheEntry.transitionTo(InfraStatus.PARSING_JSON)
                val versionHeader =
                    checkNotNull(response.header("x-infra-version")) {
                        "missing x-infra-version header in railjson response"
                    }
                version = versionHeader.toInt()
                cacheEntry.version = version
                checkNotNull(response.body) { "missing body in railjson response" }
                rjsInfra = RJSInfra.adapter.fromJson(response.body.source())!!
            }

            // Parse railjson into a proper infra
            logger.info("parsing the infra of {}", request.url)
            cacheEntry.transitionTo(InfraStatus.PARSING_INFRA)
            val rawInfra = parseRJSInfra(rjsInfra)
            logger.info("loading signals of {}", request.url)
            cacheEntry.transitionTo(InfraStatus.LOADING_SIGNALS)
            val loadedSignalInfra = signalingSimulator.loadSignals(rawInfra)
            logger.info("building blocks of {}", request.url)
            cacheEntry.transitionTo(InfraStatus.BUILDING_BLOCKS)
            val blockInfra = signalingSimulator.buildBlocks(rawInfra, loadedSignalInfra)

            // Cache the infra
            logger.info("successfully cached {}", request.url)
            cacheEntry.infra =
                FullInfra(rawInfra, loadedSignalInfra, blockInfra, signalingSimulator)
            cacheEntry.transitionTo(InfraStatus.CACHED)
            return cacheEntry.infra!!
        } catch (e: IOException) {
            cacheEntry.transitionTo(InfraStatus.TRANSIENT_ERROR, e)
            // TODO: retry with an exponential backoff and jitter (use a concurrent Thread.sleep)
            throw OSRDError.newInfraLoadingError(
                ErrorType.InfraSoftLoadingError,
                cacheEntry.lastStatus!!.name,
                e,
            )
        } catch (e: UnexpectedHttpResponse) {
            cacheEntry.transitionTo(InfraStatus.TRANSIENT_ERROR, e)
            throw OSRDError.newInfraLoadingError(
                ErrorType.InfraSoftLoadingError,
                cacheEntry.lastStatus!!.name,
                e,
            )
        } catch (e: VirtualMachineError) {
            cacheEntry.transitionTo(InfraStatus.TRANSIENT_ERROR, e)
            throw OSRDError.newInfraLoadingError(
                ErrorType.InfraSoftLoadingError,
                cacheEntry.lastStatus!!.name,
                e,
            )
        } catch (e: Throwable) {
            cacheEntry.transitionTo(InfraStatus.ERROR, e)
            throw OSRDError.newInfraLoadingError(
                ErrorType.InfraHardLoadingError,
                cacheEntry.lastStatus!!.name,
                e,
            )
        }
    }

    /** Load an infra given an id. Cache infra for optimized future call */
    @ExcludeFromGeneratedCodeCoverage
    @Throws(OSRDError::class, InterruptedException::class)
    fun load(infraId: String, expectedVersion: Int?): FullInfra {
        try {
            infraCache.putIfAbsent(infraId, InfraCacheEntry())
            val cacheEntry: InfraCacheEntry = infraCache.get(infraId)!!

            // /!\ the cache entry lock is held while a download / parse process is in progress
            synchronized(cacheEntry) {
                // try downloading the infra again if:
                //  - the existing cache entry hasn't reached a stable state
                //  - we don't have the right version
                val obsoleteVersion =
                    expectedVersion != null &&
                        (cacheEntry.version == null || expectedVersion > cacheEntry.version!!)
                if (!cacheEntry.status.isStable || obsoleteVersion)
                    return downloadInfra(cacheEntry, infraId)

                // otherwise, wait for the infra to reach a stable state
                if (cacheEntry.status == InfraStatus.CACHED) return cacheEntry.infra!!
                if (cacheEntry.status == InfraStatus.ERROR)
                    throw OSRDError.newInfraLoadingError(
                        ErrorType.InfraLoadingCacheException,
                        cacheEntry.lastStatus!!.name,
                        cacheEntry.lastError,
                    )
                throw OSRDError.newInfraLoadingError(
                    ErrorType.InfraInvalidStatusWhileWaitingStable,
                    cacheEntry.status.name,
                )
            }
        } catch (e: Exception) {
            logger.error("exception while loading infra", e)
            throw e
        }
    }

    fun deleteFromInfraCache(infraId: String): InfraCacheEntry? {
        return infraCache.remove(infraId)
    }

    @Throws(OSRDError::class, InterruptedException::class)
    override fun getInfra(infraId: String, expectedVersion: Int?): FullInfra {
        try {
            val cacheEntry = infraCache.get(infraId)
            if (cacheEntry == null || !cacheEntry.status.isStable) {
                // download the infra
                return load(infraId, expectedVersion)
            }
            val obsoleteVersion = expectedVersion != null && expectedVersion != cacheEntry.version
            if (obsoleteVersion) {
                deleteFromInfraCache(infraId)
                throw OSRDError(ErrorType.InfraInvalidVersionException)
            }
            if (cacheEntry.status == InfraStatus.CACHED) return cacheEntry.infra!!
            throw OSRDError.newInfraLoadingError(
                ErrorType.InfraLoadingInvalidStatusException,
                cacheEntry.status,
            )
        } catch (e: RuntimeException) {
            throw e
        } catch (e: Exception) {
            logger.error("exception while getting infra", e)
            throw e
        }
    }

    companion object {
        val logger: Logger = LoggerFactory.getLogger(InfraManager::class.java)
    }
}
