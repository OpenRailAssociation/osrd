package fr.sncf.osrd.cli

import com.beust.jcommander.Parameter
import com.beust.jcommander.Parameters
import com.rabbitmq.client.*
import com.squareup.moshi.Moshi
import fr.sncf.osrd.api.*
import fr.sncf.osrd.api.conflicts.ConflictDetectionEndpoint
import fr.sncf.osrd.api.etcs.ETCSBrakingCurvesEndpoint
import fr.sncf.osrd.api.path_properties.PathPropEndpoint
import fr.sncf.osrd.api.pathfinding.PathfindingBlocksEndpoint
import fr.sncf.osrd.api.project_signals.SignalProjectionEndpoint
import fr.sncf.osrd.api.standalone_sim.SimulationEndpoint
import fr.sncf.osrd.api.stdcm.STDCMEndpoint
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import io.lettuce.core.RedisClient
import io.lettuce.core.codec.ByteArrayCodec
import io.opentelemetry.api.GlobalOpenTelemetry
import io.opentelemetry.api.trace.Tracer
import io.opentelemetry.context.Context
import io.opentelemetry.context.propagation.TextMapGetter
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import kotlin.system.exitProcess
import kotlin.use
import kotlinx.serialization.ExperimentalSerializationApi
import okhttp3.OkHttpClient
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@ExperimentalSerializationApi
@Parameters(commandDescription = "RabbitMQ worker mode")
class WorkerCommand : CliCommand {

    @Parameter(
        names = ["--editoast-url"],
        description = "The base URL of editoast (used to query infrastructures)",
    )
    private var editoastUrl: String? = null

    @Parameter(
        names = ["--editoast-authorization"],
        description = "The HTTP Authorization header sent to editoast",
    )
    private var editoastAuthorization: String = "x-osrd-skip-authz"

    val LOCAL_TIMETABLE_CACHE: String?
    val WORKER_ID: String?
    val WORKER_ID_USE_HOSTNAME: Boolean
    val WORKER_KEY: String?
    val WORKER_AMQP_URI: String
    val WORKER_MAX_MSG_SIZE: Int
    val WORKER_POOL: String
    val WORKER_REQUESTS_QUEUE: String
    val WORKER_ACTIVITY_EXCHANGE: String
    val ALL_INFRA: Boolean
    val WORKER_THREADS: Int
    val MAX_CONCURRENT_TIMETABLE_REQUESTS: Int
    val DISABLE_ALL_TIMETABLE_CACHE: Boolean
    val VALKEY_URL: String?
    val OSRD_GIT_DESCRIBE: String
    val TELEMETRY_TRACER: Tracer

    lateinit var endpoints: Map<String, Take>

    init {
        LOCAL_TIMETABLE_CACHE = System.getenv("LOCAL_TIMETABLE_CACHE")
        WORKER_ID_USE_HOSTNAME = getBooleanEnvvar("WORKER_ID_USE_HOSTNAME")
        ALL_INFRA = getBooleanEnvvar("ALL_INFRA")
        WORKER_KEY = if (ALL_INFRA) "all" else System.getenv("WORKER_KEY")
        WORKER_AMQP_URI =
            System.getenv("WORKER_AMQP_URI") ?: "amqp://osrd:password@127.0.0.1:5672/%2f"
        WORKER_MAX_MSG_SIZE = getIntEnvvar("WORKER_MAX_MSG_SIZE") ?: (1024 * 1024 * 128 * 5)
        WORKER_POOL = System.getenv("WORKER_POOL") ?: "core"
        WORKER_REQUESTS_QUEUE =
            System.getenv("WORKER_REQUESTS_QUEUE") ?: "$WORKER_POOL-req-$WORKER_KEY"
        WORKER_ACTIVITY_EXCHANGE =
            System.getenv("WORKER_ACTIVITY_EXCHANGE") ?: "$WORKER_POOL-activity-xchg"
        WORKER_THREADS =
            System.getenv("WORKER_THREADS")?.toIntOrNull()
                ?: Runtime.getRuntime().availableProcessors()
        MAX_CONCURRENT_TIMETABLE_REQUESTS =
            System.getenv("MAX_CONCURRENT_TIMETABLE_REQUESTS")?.toIntOrNull() ?: 10
        DISABLE_ALL_TIMETABLE_CACHE =
            System.getenv("DISABLE_ALL_TIMETABLE_CACHE")?.lowercase() == "true"
        VALKEY_URL = System.getenv("VALKEY_URL")
        WORKER_ID =
            if (WORKER_ID_USE_HOSTNAME) {
                java.net.InetAddress.getLocalHost().hostName
            } else if (ALL_INFRA) {
                "all_infra_worker"
            } else {
                System.getenv("WORKER_ID")
            }
        OSRD_GIT_DESCRIBE = System.getenv("OSRD_GIT_DESCRIBE") ?: "development"
        TELEMETRY_TRACER = GlobalOpenTelemetry.getTracerProvider().get("WorkerCommand")
    }

    private fun getBooleanEnvvar(name: String): Boolean {
        return System.getenv(name)?.lowercase() !in arrayOf(null, "", "0", "false")
    }

    private fun getIntEnvvar(name: String): Int? {
        return System.getenv(name)?.toIntOrNull()
    }

    override fun run(): Int {
        if (WORKER_ID == null || WORKER_KEY == null) {
            throw IllegalStateException(
                "Environment variables WORKER_ID or WORKER_KEY are not set properly."
            )
        }

        val maxMemory =
            String.format("%.2f", Runtime.getRuntime().maxMemory() / (1 shl 30).toDouble())
        logger.info(
            "starting the API server with max {}Gi of java heap and {} threads",
            maxMemory,
            WORKER_THREADS,
        )

        val httpClient = OkHttpClient.Builder().readTimeout(120, TimeUnit.SECONDS).build()
        val valkeyConnection = VALKEY_URL?.let {
            RedisClient.create(it).connect(ByteArrayCodec.INSTANCE)
        }
        val s3Context = makeS3Context()

        val infraId = WORKER_KEY.split("-").first()
        val timetableId = WORKER_KEY.split("-").getOrNull(1)?.toInt()
        val infraManager = InfraManager(editoastUrl!!, editoastAuthorization, httpClient, s3Context)
        val timetableCache =
            TimetableCacheManager(
                TimetableDownloader(
                    editoastUrl!!,
                    editoastAuthorization,
                    httpClient,
                    MAX_CONCURRENT_TIMETABLE_REQUESTS,
                ),
                LOCAL_TIMETABLE_CACHE,
                valkeyConnection,
                DISABLE_ALL_TIMETABLE_CACHE,
                OSRD_GIT_DESCRIBE,
                s3Context,
            )
        val electricalProfileSetManager =
            ElectricalProfileSetManager(editoastUrl, editoastAuthorization, httpClient)

        val monitoringType = System.getenv("CORE_MONITOR_TYPE")
        if (monitoringType != null) {
            logger.info("monitoring type: {}", monitoringType)
            // TODO: implement monitoring
        }

        endpoints =
            mapOf(
                "/pathfinding/blocks" to PathfindingBlocksEndpoint(infraManager),
                "/path_properties" to PathPropEndpoint(infraManager),
                "/standalone_simulation" to
                    SimulationEndpoint(infraManager, electricalProfileSetManager),
                "/signal_projection" to SignalProjectionEndpoint(infraManager),
                "/conflict_detection" to ConflictDetectionEndpoint(infraManager),
                "/etcs_braking_curves" to
                    ETCSBrakingCurvesEndpoint(infraManager, electricalProfileSetManager),
                "/stdcm" to STDCMEndpoint(infraManager, timetableCache, s3Context),
                "/worker_load" to WorkerLoadEndpoint(infraManager, timetableCache),
            )

        loadInfraAndTimetable(infraManager, timetableCache, infraId, timetableId)

        val executor =
            ThreadPoolExecutor(
                WORKER_THREADS,
                WORKER_THREADS,
                0L,
                TimeUnit.MILLISECONDS,
                LinkedBlockingQueue(),
            )
        return consume(executor)
    }

    /** Load the given infra and timetable this worker is specialized on, if set. */
    private fun loadInfraAndTimetable(
        infraManager: InfraManager,
        timetableCache: TimetableCacheManager,
        infraId: String,
        timetableId: Int?,
    ) {
        if (!ALL_INFRA) {
            try {
                val infra = infraManager.load(infraId, null)
                if (timetableId != null) timetableCache.load(infra, timetableId)
            } catch (e: OSRDError) {
                val isInfraLoadError =
                    setOf(ErrorType.InfraHardLoadingError, ErrorType.InfraSoftLoadingError)
                        .contains(e.osrdErrorType)
                if (isInfraLoadError) {
                    if (e.osrdErrorType.isRecoverable) {
                        logger.warn("Failed to load infra $infraId with a perennial error: $e")
                        // go on and future requests will be consumed and rejected
                    } else {
                        logger.error("Failed to load infra $infraId with a temporary error: $e")
                        // Stop worker and let another worker spawn eventually
                        throw e
                    }
                } else {
                    logger.error("Failed to load infra $infraId with an unexpected OSRD Error: $e")
                    throw e
                }
            } catch (t: Throwable) {
                logger.error("Failed to load infra $infraId with an unexpected exception: $t")
                throw t
            }
        }
        if (ALL_INFRA && timetableId != null)
            logger.warn("Timetables can't be preloaded when not specialized on an infra")
    }

    /**
     * Callback function called on any received message. One instance per queue messsage, the class
     * attribute contains message-local data.
     */
    private inner class MessageCallback(
        val activityChannel: Channel,
        val channel: Channel,
        val connection: Connection,
    ) {
        operator fun invoke(message: Delivery) {
            val startTimeMS = System.currentTimeMillis()
            reportActivity(activityChannel, "request-received")

            val replyTo = message.properties.replyTo
            val correlationId = message.properties.correlationId
            val body = message.body
            val path =
                if (message.properties.headers["x-rpc-path"] is LongString) {
                    message.properties.headers["x-rpc-path"].toString()
                } else {
                    (message.properties.headers["x-rpc-path"] as? ByteArray?)?.decodeToString()
                }
            if (path == null) {
                logger.error("missing x-rpc-path header")
                channel.basicReject(message.envelope.deliveryTag, false)
                if (replyTo != null) {
                    // TODO: response format to handle protocol error
                    channel.basicPublish(
                        "",
                        replyTo,
                        null,
                        "missing x-rpc-path header".toByteArray(),
                    )
                }

                return
            }
            logger.info("received request for path {}", path)

            val endpoint = endpoints[path]
            if (endpoint == null) {
                logger.error("unknown path {}", path)
                channel.basicReject(message.envelope.deliveryTag, false)
                if (replyTo != null) {
                    // TODO: response format to handle protocol error
                    channel.basicPublish("", replyTo, null, "unknown path $path".toByteArray())
                }

                return
            }

            val context =
                GlobalOpenTelemetry.getPropagators()
                    .textMapPropagator
                    .extract(Context.current(), message.properties.headers, RabbitMQTextMapGetter())
            val span = TELEMETRY_TRACER.spanBuilder(path).setParent(context).startSpan()

            var payload: ByteArray
            var status: ByteArray
            try {
                span.makeCurrent().use { scope ->
                    val response =
                        // Only the STDCMEndpoint requires access to the queue for now.
                        // This avoids systematically creating a channel that will almost
                        // always be unused.
                        if (endpoint.requiresQueueCtx()) {
                            connection.createChannel().use { chan ->
                                endpoint.act(
                                    MQRequest(body),
                                    Take.QueueContext(chan, replyTo, correlationId),
                                )
                            }
                        } else {
                            endpoint.act(MQRequest(body))
                        }
                    payload = response.body().toByteArray()
                    val statusCode = response.statusCode()
                    status = (if (statusCode / 100 == 2) "ok" else "core_error").encodeToByteArray()
                }
            } catch (t: Throwable) {
                span.recordException(t)
                logger.error("Unexpected error: ", t)
                payload =
                    "ERROR, exception received"
                        .toByteArray() // TODO: have a valid payload for uncaught exceptions
                status = "core_error".encodeToByteArray()
                // Stop worker and let another worker spawn eventually
                if (t is OSRDError && !t.osrdErrorType.isRecoverable) {
                    throw t
                }
            } finally {
                span.end()
            }

            if (replyTo != null) {
                val properties =
                    AMQP.BasicProperties()
                        .builder()
                        .correlationId(correlationId)
                        .headers(mapOf("x-status" to status, "x-non-terminating-response" to false))
                        .build()
                channel.basicPublish("", replyTo, properties, payload)
            }

            channel.basicAck(message.envelope.deliveryTag, false)
            val executionTimeMS = System.currentTimeMillis() - startTimeMS
            logger.info("request for path {} processed in {}s", path, executionTimeMS / 1_000.0)
        }
    }

    /**
     * Set up the queue consumer. Blocks until the channel is closed or some other queue error
     * happens.
     */
    private fun consume(executor: ThreadPoolExecutor): Int {
        val factory = ConnectionFactory()
        if (ALL_INFRA) {
            factory.requestedHeartbeat = 43200 // 12 h heartbeat
        }
        factory.setUri(WORKER_AMQP_URI)
        factory.setSharedExecutor(executor)
        factory.setMaxInboundMessageBodySize(WORKER_MAX_MSG_SIZE)
        val connection = factory.newConnection()

        connection.use {
            connection.createChannel().use { channel -> reportActivity(channel, "started") }

            connection.createChannel().use { channel -> reportActivity(channel, "ready") }

            val activityChannel = connection.createChannel()
            val channel = connection.createChannel()
            // Set the prefetch count to something reasonable (ie. disable prefetching)
            // The default would be unlimited, which is very good for high throughput
            // queues, but that's not our usecase here.
            channel.basicQos(WORKER_THREADS)
            val messageCallback = MessageCallback(activityChannel, channel, connection)

            val terminatorCallback =
                fun(message: Delivery) {
                    try {
                        messageCallback(message)
                    } catch (t: Throwable) {
                        t.printStackTrace(System.err)
                        exitProcess(1)
                    }
                }

            channel.basicConsume(
                WORKER_REQUESTS_QUEUE,
                false,
                mapOf(),
                { _, message ->
                    if (executor.queue.count() >= WORKER_THREADS * 4) {
                        // We directly process the message with no dispatch if there's too many
                        // locally queued tasks. Prevents the worker from consuming all the rabbitmq
                        // at once, which would mess with the stats and automatic scaling.
                        terminatorCallback(message)
                    } else {
                        executor.execute { terminatorCallback(message) }
                    }
                },
                { _ ->
                    logger.error("consumer cancelled")
                    exitProcess(0)
                },
                { consumerTag, e ->
                    logger.info("consume shutdown: {}, {}", consumerTag, e.toString())
                },
            )

            while (true) {
                Thread.sleep(100)
                if (!channel.isOpen) break
            }

            logger.info("consume ended")

            return 0
        }
    }

    private fun reportActivity(activityChannel: Channel, event: String) {
        val properties =
            AMQP.BasicProperties()
                .builder()
                .headers(mapOf("x-event" to event, "x-worker-id" to WORKER_ID))
                .build()
        activityChannel.basicPublish(WORKER_ACTIVITY_EXCHANGE, WORKER_KEY, properties, null)
    }

    class MQRequest(private val body: ByteArray) : Request {
        override fun body(): String {
            return body.toString(Charsets.UTF_8)
        }
    }

    companion object {
        val logger: Logger = LoggerFactory.getLogger(WorkerCommand::class.java)
    }
}

interface Request {
    fun body(): String
}

interface Take {
    data class QueueContext(val chan: Channel, val replyTo: String, val correlationId: String)

    /**
     * This function processes the `request` and returns a [Response].
     *
     * It can optionally take a [QueueContext] to publish messages to a RabbitMQ queue. An example
     * can be found in the [STDCMEndpoint] class.
     */
    fun act(req: Request, ctx: QueueContext? = null): Response

    /**
     * This function is responsible for telling the caller whether the associated endpoint needs
     * access to the queue. Since this is only used in STDCMEndpoint right now, it defaults to
     * false.
     */
    fun requiresQueueCtx(): Boolean {
        return false
    }
}

interface Response {
    fun statusCode(): Int {
        return 200
    }

    fun body(): String
}

class RsText(private val text: String) : Response {
    override fun body(): String {
        return adapter.toJson(text)
    }

    companion object {
        val moshi = Moshi.Builder().build()
        val adapter = moshi.adapter(String::class.java)
    }
}

class RsJson(private val response: Response) : Response {
    override fun body(): String {
        return response.body()
    }

    override fun statusCode(): Int {
        return response.statusCode()
    }
}

class RsWithBody(private val body: String) : Response {
    override fun body(): String {
        return body
    }
}

class RsWithStatus(private val response: Response, private val statusCode: Int) : Response {
    override fun statusCode(): Int {
        return statusCode
    }

    override fun body(): String {
        return response.body()
    }
}

class RqFake(private val body: String) : Request {
    override fun body(): String {
        return body
    }
}

class RabbitMQTextMapGetter : TextMapGetter<Map<String, Any>> {
    override fun keys(carrier: Map<String, Any>): Iterable<String> {
        return carrier.keys
    }

    override fun get(carrier: Map<String, Any>?, key: String): String? {
        return (carrier?.get(key) as ByteArray?)?.decodeToString()
    }
}
