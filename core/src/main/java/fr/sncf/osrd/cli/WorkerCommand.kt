package fr.sncf.osrd.cli

import com.beust.jcommander.Parameter
import com.beust.jcommander.Parameters
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@Parameters(commandDescription = "RabbitMQ worker mode")
class WorkerCommand : CliCommand {
    @Parameter(names = ["--rabbitmq-url"])
    var rabbitmqUrl: String = "amqp://localhost" // TODO


    override fun run(): Int {
        val maxMemory = String.format("%.2f", Runtime.getRuntime().maxMemory() / (1 shl 30).toDouble())
        logger.info("starting the API server with max {}Gi of java heap", maxMemory)

        val monitoringType = System.getenv("CORE_MONITOR_TYPE")
        if (monitoringType != null) {
            logger.info("monitoring type: {}", monitoringType)
            // TODO: implement monitoring
        }



        return 0
    }

    companion object {
        val logger: Logger = LoggerFactory.getLogger(WorkerCommand::class.java)
    }
}
