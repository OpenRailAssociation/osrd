package fr.sncf.osrd.standalone_sim

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.api.parseRawSimulationScheduleItems
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.api.standalone_sim.StopDetails
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.OPEN
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.STOP
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
        expectedItems: List<SimulationScheduleItem>,
    ) {
        val mergedItems = parseRawSimulationScheduleItems(simulationScheduleItems)
        Assertions.assertThat(mergedItems).usingRecursiveComparison().isEqualTo(expectedItems)
    }

    @SuppressFBWarnings(
        value = ["UPM_UNCALLED_PRIVATE_METHOD"],
        justification = "called implicitly by MethodSource",
    )
    private fun testParseRawSimulationScheduleItemsArgs(): Stream<Arguments> {
        return Stream.of(
            // Parser outputs minimum arrival for same path offset
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(Offset(Distance(1000)), TimeDelta(200), null),
                    SimulationScheduleItem(Offset(Distance(1000)), TimeDelta(100), null),
                    SimulationScheduleItem(Offset(Distance(1000)), null, null),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(Offset(Distance(1000)), TimeDelta(100), null),
                ),
            ),
            // Parser outputs sum of stopFor for same path offset
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(25), OPEN, false),
                    ),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(75), OPEN, false),
                    ),
                    SimulationScheduleItem(Offset(Distance(1000)), null, null),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(100), OPEN, false),
                    ),
                ),
            ),
            // Parser outputs the most constrained (SHORT_SLIP_STOP, then STOP, then OPEN)
            // receptionSignal for the same path offset
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), OPEN, false),
                    ),
                    SimulationScheduleItem(Offset(Distance(1000)), null, null),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), OPEN, false),
                    ),
                ),
            ),
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), OPEN, false),
                    ),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), STOP, false),
                    ),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), STOP, false),
                    ),
                ),
            ),
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), OPEN, false),
                    ),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), STOP, false),
                    ),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), SHORT_SLIP_STOP, false),
                    ),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), SHORT_SLIP_STOP, false),
                    ),
                ),
            ),
            // Parser outputs isBacktracking = true if at least one of the items with the same
            // offset is backtracking, else it outputs false
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), OPEN, false),
                    ),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), OPEN, false),
                    ),
                ),
            ),
            Arguments.of(
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), OPEN, false),
                    ),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), OPEN, true),
                    ),
                ),
                listOf(
                    SimulationScheduleItem(Offset(Distance.ZERO), null, null),
                    SimulationScheduleItem(
                        Offset(Distance(1000)),
                        null,
                        StopDetails(TimeDelta(0), OPEN, true),
                    ),
                ),
            ),
        )
    }
}
