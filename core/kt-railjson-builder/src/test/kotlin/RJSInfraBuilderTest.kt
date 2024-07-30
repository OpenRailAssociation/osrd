import fr.sncf.osrd.railjson.builder.begin
import fr.sncf.osrd.railjson.builder.end
import fr.sncf.osrd.railjson.builder.rjsInfra
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.*
import kotlin.test.Test

class RJSInfraBuilderTest {
    @Test
    fun sample() {
        rjsInfra {
            defaultTrackNodeDelay = 42.0
            defaultSightDistance = 50.0
            val trackA = trackSection("a", 10.0)
            val trackB = trackSection("b", 10.0)
            val trackC = trackSection("c", 10.0)
            val switchS = pointSwitch("s", trackA.end, trackB.begin, trackC.begin)
            val bsA = bufferStop("start_a", trackA.begin)
            val bsB = bufferStop("end_b", trackB.end)
            val bsC = bufferStop("end_c", trackC.end)
            val detU = detector("U", trackA.at(5.0))
            val detV = detector("V", trackB.at(5.0))
            route("u_b", detU, START_TO_STOP, bsB) {
                addTrackNodeDirection(switchS, "A_B1")
                addReleaseDetector(detV)
            }

            physicalSignal("S", trackA.at(4.0), START_TO_STOP) {
                logicalSignal("BAL") {
                    nextSignalingSystem("BAPR")
                    setting("Nf", "true")
                }
            }
        }
    }
}
