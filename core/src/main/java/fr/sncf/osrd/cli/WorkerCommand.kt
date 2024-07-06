package fr.sncf.osrd.cli

import com.beust.jcommander.Parameter
import com.beust.jcommander.Parameters
import com.rabbitmq.client.AMQP
import com.rabbitmq.client.Channel
import com.rabbitmq.client.ConnectionFactory
import com.rabbitmq.client.DeliverCallback
import fr.sncf.osrd.api.*
import fr.sncf.osrd.api.api_v2.conflicts.ConflictDetectionEndpointV2
import fr.sncf.osrd.api.api_v2.path_properties.PathPropEndpoint
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlocksEndpointV2
import fr.sncf.osrd.api.api_v2.project_signals.SignalProjectionEndpointV2
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationEndpoint
import fr.sncf.osrd.api.api_v2.stdcm.STDCMEndpointV2
import fr.sncf.osrd.api.pathfinding.PathfindingBlocksEndpoint
import fr.sncf.osrd.api.stdcm.STDCMEndpoint
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import io.opentelemetry.api.GlobalOpenTelemetry
import io.opentelemetry.context.Context
import io.opentelemetry.context.propagation.TextMapGetter
import okhttp3.OkHttpClient
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.takes.Request
import java.io.InputStream
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread


@Parameters(commandDescription = "RabbitMQ worker mode")
class WorkerCommand : CliCommand {

    @Parameter(names = ["--amqp-uri"]) var amqpUri: String = "amqp://127.0.0.1:5672/%2f" // TODO

    @Parameter(
        names = ["--editoast-url"],
        description = "The base URL of editoast (used to query infrastructures)"
    )
    private val editoastUrl: String? = null

    @Parameter(
        names = ["--editoast-authorization"],
        description = "The HTTP Authorization header sent to editoast"
    )
    private val editoastAuthorization: String? = null

    @Parameter(names = ["-j", "--threads"], description = "The number of threads to serve requests from")
    private val threads: Int = 1


    val WORKER_ID: String
    val WORKER_KEY: String
    val WORKER_POOL: String
    val WORKER_REQUESTS_QUEUE: String
    val WORKER_ACTIVITY_EXCHANGE: String

    init {
        // TODO: handle errors more gracefully, etc
        WORKER_ID = System.getenv("WORKER_ID")!!
        WORKER_KEY = System.getenv("WORKER_KEY")!!
        WORKER_POOL = System.getenv("WORKER_POOL") ?: "core"
        WORKER_REQUESTS_QUEUE = System.getenv("WORKER_REQUESTS_QUEUE") ?: "$WORKER_POOL-req-$WORKER_KEY"
        WORKER_ACTIVITY_EXCHANGE = System.getenv("WORKER_ACTIVITY_EXCHANGE") ?: "$WORKER_POOL-activity-xchg"
    }

    override fun run(): Int {
        val maxMemory =
            String.format("%.2f", Runtime.getRuntime().maxMemory() / (1 shl 30).toDouble())
        logger.info("starting the API server with max {}Gi of java heap", maxMemory)

        val httpClient = OkHttpClient.Builder().readTimeout(120, TimeUnit.SECONDS).build()

        val infraId = WORKER_KEY
        val diagnosticRecorder = DiagnosticRecorderImpl(false)
        val infraManager = InfraManager(editoastUrl, editoastAuthorization, httpClient, false)
        val electricalProfileSetManager =
            ElectricalProfileSetManager(editoastUrl, editoastAuthorization, httpClient)

        infraManager.load(infraId, null, diagnosticRecorder)

        val monitoringType = System.getenv("CORE_MONITOR_TYPE")
        if (monitoringType != null) {
            logger.info("monitoring type: {}", monitoringType)
            // TODO: implement monitoring
        }

        val tracer = GlobalOpenTelemetry.getTracerProvider().get("WorkerCommand")

        val endpoints =
            mapOf(
                "/pathfinding/routes" to PathfindingBlocksEndpoint(infraManager),
                "/v2/pathfinding/blocks" to PathfindingBlocksEndpointV2(infraManager),
                "/v2/path_properties" to PathPropEndpoint(infraManager),
                "/standalone_simulation" to
                    StandaloneSimulationEndpoint(infraManager, electricalProfileSetManager),
                "/v2/standalone_simulation" to
                    SimulationEndpoint(infraManager, electricalProfileSetManager),
                "/project_signals" to SignalProjectionEndpoint(infraManager),
                "/v2/signal_projection" to SignalProjectionEndpointV2(infraManager),
                "/detect_conflicts" to ConflictDetectionEndpoint(),
                "/v2/conflict_detection" to ConflictDetectionEndpointV2(),
                "/cache_status" to InfraCacheStatusEndpoint(infraManager),
                "/version" to VersionEndpoint(),
                "/stdcm" to STDCMEndpoint(infraManager),
                "/v2/stdcm" to STDCMEndpointV2(infraManager),
                "/infra_load" to InfraLoadEndpoint(infraManager),
            )

        val factory = ConnectionFactory()
        factory.setUri(amqpUri)
        val connection = factory.newConnection()
        connection.createChannel().use { channel ->
            reportActivity(channel, "started")
        }

        repeat(threads) {
            thread {
                val activityChannel = connection.createChannel()
                val channel = connection.createChannel()
                channel.basicConsume(
                    WORKER_REQUESTS_QUEUE,
                    false,
                    DeliverCallback { consumerTag, message ->
                        reportActivity(activityChannel, "request-received")

                        val replyTo = message.properties.replyTo
                        val correlationId = message.properties.correlationId
                        val body = message.body
                        val path = message.properties.headers["x-rpc-path"] as String?
                        if (path == null) {
                            logger.error("missing x-rpc-path header")
                            channel.basicReject(message.envelope.deliveryTag, false)
                            if (replyTo != null) {
                                // TODO: response format to handle protocol error
                                channel.basicPublish(
                                    "",
                                    replyTo,
                                    null,
                                    "missing x-rpc-path header".toByteArray()
                                )
                            }

                            return@DeliverCallback
                        }

                        val endpoint = endpoints[path]
                        if (endpoint == null) {
                            logger.error("unknown path {}", path)
                            channel.basicReject(message.envelope.deliveryTag, false)
                            if (replyTo != null) {
                                // TODO: response format to handle protocol error
                                channel.basicPublish("", replyTo, null, "unknown path $path".toByteArray())
                            }

                            return@DeliverCallback
                        }

                        class RabbitMQTextMapGetter : TextMapGetter<Map<String, Any>> {
                            override fun keys(carrier: Map<String, Any>): Iterable<String> {
                                return carrier.keys
                            }

                            override fun get(carrier: Map<String, Any>?, key: String): String? {
                                return carrier?.get(key) as String?
                            }
                        }

                        val context = GlobalOpenTelemetry.getPropagators().textMapPropagator.extract(
                            Context.current(),
                            message.properties.headers,
                            RabbitMQTextMapGetter()
                        )
                        val span = tracer.spanBuilder(path).setParent(context).startSpan()

                        val payload = try {
                            span.makeCurrent().use { scope ->
                                val response = endpoint.act(MQRequest(body))
                                response
                                    .body()
                                    .readAllBytes() // TODO: check the response code too to catch error
                            }
                        } catch (t: Throwable) {
                            span.recordException(t)
                            "ERROR, exception received".toByteArray() // TODO: have a valid payload for uncaught exceptions
                        } finally {
                            span.end()
                        }

                        if (replyTo != null) {
                            val properties = AMQP.BasicProperties().builder()
                                .correlationId(correlationId)
                                .headers(mapOf("x-status" to "ok"))
                                .build()
                            channel.basicPublish("", replyTo, properties, payload)
                        }

                        channel.basicAck(message.envelope.deliveryTag, false)
                    }
                ) { _ ->
                }
            }
        }
        return 0
    }

    private fun reportActivity(activityChannel: Channel, event: String) {
        val properties = AMQP.BasicProperties().builder().headers(mapOf("x-event" to event)).build()
        activityChannel.basicPublish(WORKER_ACTIVITY_EXCHANGE, WORKER_KEY, properties, null)
    }

    class MQRequest(private val body: ByteArray) : Request {
        override fun head(): MutableIterable<String> {
            return mutableListOf()
        }

        override fun body(): InputStream {
            return body.inputStream()
        }
    }

    companion object {
        val logger: Logger = LoggerFactory.getLogger(WorkerCommand::class.java)
    }
}
