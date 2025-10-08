package fr.sncf.osrd.stdcm

import fr.sncf.osrd.api.DirectionalTrackRange
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.stdcm.STDCMTemporarySpeedLimit
import fr.sncf.osrd.api.stdcm.buildTemporarySpeedLimitManager
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap.RangeMapEntry
import fr.sncf.osrd.utils.Helpers.smallInfra
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import org.junit.jupiter.api.Test

class TemporarySpeedLimitTests {

    private fun sendSTDCMWithTemporarySpeedLimits(
        infra: FullInfra,
        temporarySpeedLimits: List<STDCMTemporarySpeedLimit>,
        beginDetector: String,
        endDetector: String,
    ): STDCMResult {
        val temporarySpeedLimitManager =
            buildTemporarySpeedLimitManager(infra, temporarySpeedLimits)
        val startDetectorId = infra.rawInfra.findDetector(beginDetector)!!
        val blocksOnStart =
            infra
                .blockInfra()
                .getBlocksStartingAtDetector(DirDetectorId(startDetectorId, Direction.INCREASING))
        val endDetectorId = infra.rawInfra.findDetector(endDetector)!!
        val blocksOnEnd =
            infra
                .blockInfra()
                .getBlocksStartingAtDetector(DirDetectorId(endDetectorId, Direction.INCREASING))
        val startBlock = blocksOnStart[0]
        val endBlock = blocksOnEnd[0]
        return STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(startBlock, Offset(Distance(0L)))))
            .setEndLocations(setOf(EdgeLocation(endBlock, Offset(Distance(0L)))))
            .setTemporarySpeedLimitManager(temporarySpeedLimitManager)
            .run()!!
    }

    @Test
    fun temporarySpeedLimitIsUsedIfSmallerThanOtherSpeedLimits() {
        val speedLimit = Speed.fromMetersPerSecond(20.0)
        // Add a temporary speed limit to a track
        val temporarySpeedLimits =
            listOf(
                STDCMTemporarySpeedLimit(
                    speedLimit.metersPerSecond,
                    listOf(
                        DirectionalTrackRange(
                            trackSection = "TF1",
                            begin = Offset(Distance.fromMeters(500.0)),
                            end = Offset(Distance.fromMeters(1000.0)),
                            direction = EdgeDirection.START_TO_STOP,
                        )
                    ),
                )
            )
        val res =
            sendSTDCMWithTemporarySpeedLimits(smallInfra, temporarySpeedLimits, "DE3", "DF1_1")
        val resultSpeedLimits =
            res.trainPath.getSpeedLimitProperties(
                "",
                buildTemporarySpeedLimitManager(smallInfra, temporarySpeedLimits),
            )

        // Check that the temporary speed limit applies on the correct range in the STDCM result

        // Distance between DE3 and the LTV begin on TF1 on the path TE2 -> TE0 -> TF0 -> TF1
        val expectedSpeedLimitBeginOffset = Distance.fromMeters(2183.0)
        // Same distance as above plus the LTV length
        val expectedSpeedLimitEndOffset = Distance.fromMeters(2683.0)
        val expectedSpeedLimitProperty =
            SpeedLimitProperty(Speed.fromMetersPerSecond(speedLimit.metersPerSecond), null)
        val expectedSpeedLimitRangeMap =
            RangeMapEntry(
                expectedSpeedLimitBeginOffset,
                expectedSpeedLimitEndOffset,
                expectedSpeedLimitProperty,
            )
        assert(resultSpeedLimits.contains(expectedSpeedLimitRangeMap))
    }

    @Test
    fun temporarySpeedLimitHigherThanPermanentSpeedLimitIsIgnored() {
        // Add a temporary speed limit to a track
        val temporarySpeedLimits =
            listOf(
                STDCMTemporarySpeedLimit(
                    100.0,
                    listOf(
                        DirectionalTrackRange(
                            trackSection = "TF1",
                            begin = Offset(Distance.fromMeters(500.0)),
                            end = Offset(Distance.fromMeters(1000.0)),
                            direction = EdgeDirection.START_TO_STOP,
                        )
                    ),
                )
            )
        val res =
            sendSTDCMWithTemporarySpeedLimits(smallInfra, temporarySpeedLimits, "DE3", "DF1_1")
        val resultSpeedLimits =
            res.trainPath.getSpeedLimitProperties(
                "",
                buildTemporarySpeedLimitManager(smallInfra, temporarySpeedLimits),
            )

        val expectedRangeMap =
            RangeMapEntry(
                Distance.fromMeters(0.0),
                Distance.fromMeters(3933.0),
                SpeedLimitProperty(Speed(83333U), SpeedLimitSource.UnknownTag()),
            )
        assert(resultSpeedLimits.contains(expectedRangeMap))
    }

    @Test
    fun smallestTemporarySpeedLimitOnTrackRangeIsKept() {
        // Add a temporary speed limit to a track
        val temporarySpeedLimits =
            listOf(
                STDCMTemporarySpeedLimit(
                    30.0,
                    listOf(
                        DirectionalTrackRange(
                            trackSection = "TF1",
                            begin = Offset(Distance.fromMeters(500.0)),
                            end = Offset(Distance.fromMeters(1000.0)),
                            direction = EdgeDirection.START_TO_STOP,
                        )
                    ),
                ),
                STDCMTemporarySpeedLimit(
                    20.0,
                    listOf(
                        DirectionalTrackRange(
                            trackSection = "TF1",
                            begin = Offset(Distance.fromMeters(800.0)),
                            end = Offset(Distance.fromMeters(1100.0)),
                            direction = EdgeDirection.START_TO_STOP,
                        )
                    ),
                ),
            )
        val res =
            sendSTDCMWithTemporarySpeedLimits(smallInfra, temporarySpeedLimits, "DE3", "DF1_1")
        val resultSpeedLimits =
            res.trainPath.getSpeedLimitProperties(
                "",
                buildTemporarySpeedLimitManager(smallInfra, temporarySpeedLimits),
            )

        val expectedSpeedLimitRangeMaps =
            listOf(
                RangeMapEntry(
                    Distance.fromMeters(2183.0),
                    Distance.fromMeters(2483.0),
                    SpeedLimitProperty(Speed.fromMetersPerSecond(30.0), null),
                ),
                RangeMapEntry(
                    Distance.fromMeters(2483.0),
                    Distance.fromMeters(2783.0),
                    SpeedLimitProperty(Speed.fromMetersPerSecond(20.0), null),
                ),
            )
        for (speedLimitRangeMap in expectedSpeedLimitRangeMaps) {
            assert(resultSpeedLimits.contains(speedLimitRangeMap))
        }
    }

    @Test
    fun temporarySpeedLimitsInOppositeDirectionAreIgnored() {
        // Add a temporary speed limit to a track
        val temporarySpeedLimits =
            listOf(
                STDCMTemporarySpeedLimit(
                    20.0,
                    listOf(
                        DirectionalTrackRange(
                            trackSection = "TF1",
                            begin = Offset(Distance.fromMeters(800.0)),
                            end = Offset(Distance.fromMeters(1100.0)),
                            direction = EdgeDirection.STOP_TO_START,
                        )
                    ),
                )
            )
        val res =
            sendSTDCMWithTemporarySpeedLimits(smallInfra, temporarySpeedLimits, "DE3", "DF1_1")
        val resultSpeedLimits =
            res.trainPath.getSpeedLimitProperties(
                "",
                buildTemporarySpeedLimitManager(smallInfra, temporarySpeedLimits),
            )

        val expectedRangeMap =
            RangeMapEntry(
                Distance.fromMeters(0.0),
                Distance.fromMeters(3933.0),
                SpeedLimitProperty(Speed(83333U), SpeedLimitSource.UnknownTag()),
            )
        assert(resultSpeedLimits.contains(expectedRangeMap))
    }
}
