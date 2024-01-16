package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeTestUtils
import fr.sncf.osrd.envelope_sim.SimpleRollingStock
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.getZonePathZone
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.withEnvelope
import fr.sncf.osrd.stdcm.preprocessing.implementation.BlockAvailabilityLegacyAdapter
import fr.sncf.osrd.stdcm.preprocessing.implementation.computeUnavailableSpace
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class BlockAvailabilityLegacyAdapterTests {
    /**
     * This is just a simple smoke test, the class is expected to be replaced very soon so there's
     * no need for extended testing
     */
    @Test
    fun simpleUnavailableRouteTest() {
        val infra = Helpers.smallInfra
        val routes = listOf("rt.DA0->DA6", "rt.DA6->DC6")
        val blocks = Helpers.getBlocksOnRoutes(infra, routes)
        val zone = infra.rawInfra.getZonePathZone(infra.blockInfra.getBlockPath(blocks[0])[0])
        val zoneName = infra.rawInfra.getZoneName(zone)
        val startOccupancy = 42.0
        val endOccupancy = 84.0
        val unavailableSpace =
            computeUnavailableSpace(
                infra.rawInfra,
                infra.blockInfra,
                listOf(
                    SpacingRequirement(
                        zoneName,
                        startOccupancy,
                        endOccupancy,
                        true,
                    )
                ),
                SimpleRollingStock.STANDARD_TRAIN,
                10.0,
                20.0
            )
        val adapter = BlockAvailabilityLegacyAdapter(infra.blockInfra, unavailableSpace)
        val explorer =
            initInfraExplorer(
                    infra.rawInfra,
                    infra.blockInfra,
                    PathfindingEdgeLocationId(blocks[0], Offset(0.meters))
                )
                .first()
                .withEnvelope(
                    Envelope.make(
                        EnvelopeTestUtils.generateTimes(
                            doubleArrayOf(0.0, 1.0),
                            doubleArrayOf(100.0, 100.0)
                        )
                    )
                )
        val res = adapter.getAvailability(explorer, Offset(0.meters), Offset(1.meters), 42.0)
        val expected =
            BlockAvailabilityInterface.Unavailable((42 + 20).toDouble(), Offset(0.meters))
        Assertions.assertEquals(expected, res)
    }
}
