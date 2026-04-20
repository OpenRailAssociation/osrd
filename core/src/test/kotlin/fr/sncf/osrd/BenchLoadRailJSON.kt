package fr.sncf.osrd

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraMetadata
import fr.sncf.osrd.api.makeSignalingSimulator
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import java.nio.file.Path
import java.util.concurrent.TimeUnit
import kotlin.io.path.readText
import kotlinx.benchmark.*

/**
 * Benchmark for the load of a [FullInfra].
 *
 * The benchmark reads the railjson file into memory, then measure the time it takes to create a
 * [FullInfra] from it.
 *
 * # Usage
 *
 * First, compile the benchmark JAR with the `testBenchmarkJar` gradle task:
 *
 *     ./gradlew testBenchmarkJar
 *
 * Then run the JAR file in the same directory as an infra:
 *
 *     java -jar build/benchmarks/test/jars/osrd-test-jmh-JMH.jar
 *
 * The above command accepts some arguments and options to tweak the number of iterations, the time
 * of each iteration, the number of forks(??). Personally i use `-f1` to run only one fork. Use `-h`
 * to see all the options.
 */
@State(Scope.Benchmark)
@Warmup(iterations = 2, time = 1, timeUnit = TimeUnit.SECONDS)
@Measurement(iterations = 10, time = 1, timeUnit = TimeUnit.SECONDS)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@BenchmarkMode(Mode.AverageTime)
open class BenchLoadRailJSON {
    private var railjson: String = ""

    @Setup
    fun loadFile() {
        railjson = Path.of("infra.json").readText()
    }

    @TearDown
    fun unloadFile() {
        railjson = ""
    }

    @Benchmark
    fun loadInfra(bh: Blackhole) {
        val rjsInfra = RJSInfra.adapter.fromJson(railjson)!!
        val signalingSimulator = makeSignalingSimulator()
        val rawInfra = parseRJSInfra(rjsInfra)
        val loadedSignalInfra = signalingSimulator.loadSignals(rawInfra)
        val blockInfra = signalingSimulator.buildBlocks(rawInfra, loadedSignalInfra)
        val metadata = InfraMetadata("infra")
        val infra = FullInfra(rawInfra, loadedSignalInfra, blockInfra, signalingSimulator, metadata)
        bh.consume(infra)
    }
}
