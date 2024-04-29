package fr.sncf.osrd.stdcm

import com.google.common.collect.HashMultimap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.UndirectedTrackRange
import fr.sncf.osrd.api.api_v2.stdcm.WorkSchedule
import fr.sncf.osrd.api.stdcm.makeTrainSchedule
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.standalone_sim.run
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.Helpers.smallInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.seconds
import java.io.IOException
import java.net.URISyntaxException
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class FullSTDCMTests {
    /**
     * Simple test on tiny infra with no occupancy. This is the same test as the one testing the
     * STDCM API, but calling the methods directly
     */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testTinyInfra() {
        val infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"))
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setRollingStock(
                RJSRollingStockParser.parse(
                    Helpers.getExampleRollingStock("fast_rolling_stock.json")
                )
            )
            .setStartLocations(
                setOf(
                    Helpers.convertRouteLocation(
                        infra,
                        "rt.buffer_stop_b->tde.foo_b-switch_foo",
                        Offset(100.meters)
                    )
                )
            )
            .setEndLocations(
                setOf(
                    Helpers.convertRouteLocation(
                        infra,
                        "rt.tde.foo_b-switch_foo->buffer_stop_c",
                        Offset(10125.meters)
                    )
                )
            )
            .run()!!
    }

    /**
     * We try to fit a train in a short opening between two trains. We create a train at t=0, get
     * the minimum delay we need (how long its longest occupancy block lasts), add a train at `2 *
     * min delay`, and try to fit a train between the two.
     */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testTinyInfraSmallOpening() {
        val infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"))
        val start =
            setOf(
                Helpers.convertRouteLocation(
                    infra,
                    "rt.buffer_stop_b->tde.foo_b-switch_foo",
                    Offset(100.meters)
                )
            )
        val end =
            setOf(
                Helpers.convertRouteLocation(
                    infra,
                    "rt.tde.foo_b-switch_foo->buffer_stop_c",
                    Offset(10125.meters)
                )
            )
        val requirements = makeRequirementsFromPath(infra, start, end, 0.0).toMutableList()
        val minDelay =
            getMaxOccupancyDuration(requirements) // Eventually we may need to add a % margin
        requirements.addAll(makeRequirementsFromPath(infra, start, end, minDelay * 2))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(minDelay)
                .setStartLocations(start)
                .setEndLocations(end)
                .setBlockAvailability(makeBlockAvailability(infra, requirements))
                .setMaxDepartureDelay(minDelay * 2)
                .run()!!
        checkNoConflict(infra, requirements, res)
    }

    /** We try to fit a train in a short opening between two trains, this time on small_infra */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testSmallInfraSmallOpening() {
        val infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"))
        val start =
            setOf(Helpers.convertRouteLocation(infra, "rt.buffer_stop.3->DB0", Offset(1590.meters)))
        val end =
            setOf(Helpers.convertRouteLocation(infra, "rt.DH2->buffer_stop.7", Offset(5000.meters)))
        val requirements = makeRequirementsFromPath(infra, start, end, 0.0).toMutableList()
        requirements.addAll(makeRequirementsFromPath(infra, start, end, 600.0))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(300.0)
                .setStartLocations(start)
                .setEndLocations(end)
                .setBlockAvailability(makeBlockAvailability(infra, requirements))
                .setMaxDepartureDelay(600.0)
                .run()!!
        checkNoConflict(infra, requirements, res)
    }

    /**
     * We make an opening that is just too small to fit a train, we check that it isn't taken and
     * doesn't cause conflicts
     */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testSmallInfraImpossibleOpening() {
        val infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"))
        val start =
            setOf(Helpers.convertRouteLocation(infra, "rt.buffer_stop.3->DB0", Offset(1590.meters)))
        val end =
            setOf(Helpers.convertRouteLocation(infra, "rt.DH2->buffer_stop.7", Offset(5000.meters)))
        val requirements = makeRequirementsFromPath(infra, start, end, 0.0).toMutableList()
        val minDelay = getMaxOccupancyDuration(requirements)
        requirements.addAll(makeRequirementsFromPath(infra, start, end, minDelay * 0.95))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(start)
                .setEndLocations(end)
                .setBlockAvailability(makeBlockAvailability(infra, requirements))
                .run()!!
        checkNoConflict(infra, requirements, res)
    }

    /** Test that we properly account for work schedules */
    @Test
    fun testWorkSchedules() {
        /*
        We look for a path starting on the track TB0, which has a work schedule from t=0 to t=3600
         */
        val blockAvailability =
            makeBlockAvailability(
                smallInfra,
                listOf(),
                listOf(
                    WorkSchedule(
                        listOf(UndirectedTrackRange("TB0", Offset(0.meters), Offset(2000.meters))),
                        0.seconds,
                        3600.seconds
                    )
                )
            )
        val infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"))
        val start =
            setOf(Helpers.convertRouteLocation(infra, "rt.buffer_stop.3->DB0", Offset(0.meters)))
        val end =
            setOf(Helpers.convertRouteLocation(infra, "rt.DH2->buffer_stop.7", Offset(0.meters)))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(start)
                .setEndLocations(end)
                .setBlockAvailability(blockAvailability)
                .run()!!
        assertTrue(res.departureTime >= 3600)
    }

    /** Check that the result we find doesn't cause a conflict */
    private fun checkNoConflict(
        infra: FullInfra,
        requirements: List<SpacingRequirement>,
        res: STDCMResult
    ) {
        val requirementMap = HashMultimap.create<String, SpacingRequirement>()
        for (requirement in requirements) {
            requirementMap.put(requirement.zone, requirement)
        }
        val newRequirements =
            run(
                    res.envelope,
                    res.trainPath,
                    res.chunkPath,
                    makeTrainSchedule(
                        res.envelope.endPos,
                        TestTrains.REALISTIC_FAST_TRAIN,
                        RollingStock.Comfort.STANDARD,
                        res.stopResults
                    ),
                    infra
                )
                .spacingRequirements
        for (requirement in newRequirements) {
            val shifted = requirement.withAddedTime(res.departureTime)
            for (existingRequirement in requirementMap[requirement.zone]) {
                Assertions.assertTrue(
                    shifted.beginTime >= existingRequirement.endTime ||
                        shifted.endTime <= existingRequirement.beginTime
                )
            }
        }
    }
}
