package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.api.ForcedStopType
import fr.sncf.osrd.api.OperationalPointStop
import fr.sncf.osrd.api.stdcm.parseForcedOpStops
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals

class ForcedStopsTests {
    @Test
    fun parseForcedOpStopsSmallInfraTests() {
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val forcedOpStops =
            setOf(
                OperationalPointStop("South_West_station", ForcedStopType.GENERAL_STOP),
                OperationalPointStop("South_station", ForcedStopType.OVERTAKE),
            )
        val actualParseForcedOpStops = parseForcedOpStops(infra, forcedOpStops)
        val expectedParseForcedOpStops =
            setOf(
                BlockLocation(infra.blockInfra.blocks[23], Offset(500.meters)),
                BlockLocation(infra.blockInfra.blocks[19], Offset(2730.meters)),
                BlockLocation(infra.blockInfra.blocks[96], Offset(2050.meters)),
                BlockLocation(infra.blockInfra.blocks[97], Offset(2200.meters)),
            )
        assertEquals(expectedParseForcedOpStops, actualParseForcedOpStops)
    }
}
