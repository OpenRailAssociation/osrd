package fr.sncf.osrd.signal_projection

import fr.sncf.osrd.api.SignalCriticalPosition
import fr.sncf.osrd.api.ZoneUpdate
import fr.sncf.osrd.api.project_signals.SignalUpdate
import fr.sncf.osrd.api.project_signals.TrainSimulation
import fr.sncf.osrd.path.interfaces.JsonTrainPath
import fr.sncf.osrd.path.interfaces.JsonTrainPath.ObjectRange
import fr.sncf.osrd.path.interfaces.JsonTrainPath.TrackSectionRange
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Offset
import kotlin.test.Test
import kotlin.test.assertEquals

class SignalProjectionTests {

    val infra = Helpers.smallInfra

    @Test
    fun testSignalProjection() {

        // region train simulation data
        val zoneUpdates =
            listOf(
                ZoneUpdate(
                    "zone.[DA5:DECREASING, DA6_5:INCREASING]",
                    Duration(0),
                    Offset(Distance(0)),
                    true,
                ),
                ZoneUpdate(
                    "zone.[DA5:INCREASING, DC0:DECREASING, DC1:DECREASING]",
                    Duration(36151),
                    Offset(Distance(298000)),
                    true,
                ),
                ZoneUpdate(
                    "zone.[DA5:DECREASING, DA6_5:INCREASING]",
                    Duration(37059),
                    Offset(Distance(313000)),
                    false,
                ),
                ZoneUpdate(
                    "zone.[DC0:INCREASING, DC4:DECREASING]",
                    Duration(54950),
                    Offset(Distance(658000)),
                    true,
                ),
                ZoneUpdate(
                    "zone.[DA5:INCREASING, DC0:DECREASING, DC1:DECREASING]",
                    Duration(55700),
                    Offset(Distance(673000)),
                    false,
                ),
                ZoneUpdate(
                    "zone.[DC4:INCREASING, DC5:INCREASING, DD0:DECREASING]",
                    Duration(419907),
                    Offset(Distance(1348000)),
                    true,
                ),
                ZoneUpdate(
                    "zone.[DC0:INCREASING, DC4:DECREASING]",
                    Duration(422350),
                    Offset(Distance(1363000)),
                    false,
                ),
                ZoneUpdate(
                    "zone.[DC4:INCREASING, DC5:INCREASING, DD0:DECREASING]",
                    Duration(455711),
                    Offset(Distance(1604000)),
                    false,
                ),
            )

        val signalCriticalPosition =
            listOf(
                SignalCriticalPosition("SA5", Duration(0), Offset(Distance(0)), "0"),
                SignalCriticalPosition("SC4", Duration(68456), Offset(Distance(928000)), "928000"),
            )
        // endregion

        // region projected path data
        val blocks =
            listOf<ObjectRange<Block>>(
                ObjectRange(
                    "block.2a6a79dce91428cb218e997977d695bb",
                    Offset(Distance(1055000)),
                    Offset(Distance(1600000)),
                ),
                ObjectRange(
                    "block.151499349ed973ced9ff20962abacb06",
                    Offset(Distance(0)),
                    Offset(Distance(1620000)),
                ),
                ObjectRange(
                    "block.0a1f3b7bfc364dbd86f415c25bc6b711",
                    Offset(Distance(0)),
                    Offset(Distance(1000000)),
                ),
                ObjectRange(
                    "block.f0835741b4e115d7316f670771bb388a",
                    Offset(Distance(0)),
                    Offset(Distance(1917500)),
                ),
                ObjectRange(
                    "block.f943638a9bdc0269097a03865dfbe10f",
                    Offset(Distance(0)),
                    Offset(Distance(433500)),
                ),
            )
        val routes =
            listOf<ObjectRange<Route>>(
                ObjectRange("rt.DA0->DA5", Offset(Distance(7885000)), Offset(Distance(10050000))),
                ObjectRange("rt.DA5->DC5", Offset(Distance(0)), Offset(Distance(1000000))),
                ObjectRange("rt.DC5->DD2", Offset(Distance(0)), Offset(Distance(2351000))),
            )
        val trackSectionRanges =
            listOf(
                TrackSectionRange(
                    "TA6",
                    Offset(Distance(7655000)),
                    Offset(Distance(10000000)),
                    EdgeDirection.START_TO_STOP,
                ),
                TrackSectionRange(
                    "TC1",
                    Offset(Distance(0)),
                    Offset(Distance(1000000)),
                    EdgeDirection.START_TO_STOP,
                ),
                TrackSectionRange(
                    "TD0",
                    Offset(Distance(0)),
                    Offset(Distance(2171000)),
                    EdgeDirection.START_TO_STOP,
                ),
            )
        // endregion

        val trainSimulation =
            TrainSimulation(
                signalCriticalPositions = signalCriticalPosition,
                zoneUpdates = zoneUpdates,
                simulationEndTime = Duration(455711),
            )

        val jsonTrainPath = JsonTrainPath(blocks, routes, trackSectionRanges)
        val trainPath = jsonTrainPath.toTrainPath(listOf(), infra.rawInfra, infra.blockInfra, null)

        val signalProjections =
            projectSignals(
                infra,
                trainPath,
                trainSimulation.signalCriticalPositions,
                trainSimulation.zoneUpdates,
                trainSimulation.simulationEndTime,
            )

        val updateBySignal = mutableMapOf<String, MutableList<SignalUpdate>>()
        for (update in signalProjections) {
            updateBySignal.getOrPut(update.signalID, { mutableListOf<SignalUpdate>() }).add(update)
        }

        assertEquals(listOf("VL", "S", "A"), updateBySignal["SA5"]!!.map { it.aspectLabel })
    }
}
