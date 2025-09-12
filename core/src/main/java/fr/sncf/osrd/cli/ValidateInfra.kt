package fr.sncf.osrd.cli

import com.beust.jcommander.Parameter
import com.beust.jcommander.Parameters
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.makeSignalingSimulator
import fr.sncf.osrd.parseRJSInfra
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage
import java.io.File
import java.io.IOException
import java.nio.file.Path
import kotlin.io.path.writeBytes
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.cbor.Cbor
import okio.buffer
import okio.source
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@Parameters(commandDescription = "Try to load an infra")
class ValidateInfra : CliCommand {
    @Parameter(names = ["--path"], description = "Path to the railjson file to load")
    private var infraPath: String? = null

    @OptIn(ExperimentalSerializationApi::class)
    @ExcludeFromGeneratedCodeCoverage
    override fun run(): Int {
        val recorder = DiagnosticRecorderImpl(false)
        try {
            logger.info("parsing json")
            val rjs: RJSInfra = Companion.parseRailJSONFromFile(infraPath!!)
            logger.info("parsing RailJSON")
            val rawInfra = parseRJSInfra(rjs)

            logger.info("loading signals")
            val signalingSimulator = makeSignalingSimulator()
            val loadedSignalInfra = signalingSimulator.loadSignals(rawInfra)
            logger.info("building blocks")
            val blocks = signalingSimulator.buildBlocks(rawInfra, loadedSignalInfra)
            logger.info("done")

            val fullInfra = FullInfra(rawInfra, loadedSignalInfra, blocks, signalingSimulator)

            val file = File("test.foo")
            val cbor = Cbor { serializersModule = FullInfra.serializerModule }
            val serializer = FullInfra.serializer()

            logger.info("writing timetable to local file cache at $file")
            val bytes = cbor.encodeToByteArray(serializer, fullInfra)
            file.writeBytes(bytes)

            return 0
        } catch (e: Exception) {
            e.printStackTrace()
            return 1
        } finally {
            recorder.report()
        }
    }

    companion object {
        val logger: Logger = LoggerFactory.getLogger(ValidateInfra::class.java)

        /** Parse the RailJSON file at the given Path */
        @SuppressFBWarnings(
            value = ["RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE"],
            justification = "that's a spotbugs bug :)",
        )
        @Throws(IOException::class)
        fun parseRailJSONFromFile(path: String): RJSInfra {
            Path.of(path).source().use { fileSource ->
                fileSource.buffer().use { bufferedSource ->
                    val rjsRoot = checkNotNull(RJSInfra.adapter.fromJson(bufferedSource))
                    return rjsRoot
                }
            }
        }
    }
}
