package fr.sncf.osrd.standalone_sim

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.api.api_v2.parseRawSimulationScheduleItems
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.OPEN
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta
import java.util.stream.Stream
import org.assertj.core.api.Assertions
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SimulationScheduleItemsParserTests {

    @ParameterizedTest
    @MethodSource("testParseRawSimulationScheduleItemsArgs")
    fun parserOutputsMinimumArrivalForSamePathOffset(
        simulationScheduleItems: List<SimulationScheduleItem>,
        expectedItems: List<SimulationScheduleItem>
    ) {
        val mergedItems = parseRawSimulationScheduleItems(simulationScheduleItems)
        Assertions.assertThat(mergedItems).usingRecursiveComparison().isEqualTo(expectedItems)
    }

    @SuppressFBWarnings(
        value = ["UPM_UNCALLED_PRIVATE_METHOD"],
        justification = "called implicitly by MethodSource"
    )
    private fun testParseRawSimulationScheduleItemsArgs(): Stream<Arguments> {
        return Stream.of(
            // Parser outputs minimum arrival for same path offset
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null, OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), TimeDelta(200), null, OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), TimeDelta(100), null, OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), null, null, OPEN),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null, OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), TimeDelta(100), null, OPEN),
                )
            ),
            // Parser outputs sum of stopFor for same path offset
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null, OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), null, TimeDelta(25), OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), null, TimeDelta(75), OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), null, null, OPEN),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null, OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), null, TimeDelta(100), OPEN),
                )
            ),
            // Parser outputs the most constrained (SHORT_SLIP_STOP, then STOP, then OPEN)
            // receptionSignal for the same path offset
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null, OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), null, null, OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), null, null, OPEN),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null, OPEN),
                    SimulationScheduleItem(Offset(Distance(1000)), null, null, OPEN),
                )
            )
        )
    }
}
