package fr.sncf.osrd.envelope_sim_infra

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeTestUtils
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder.LimitKind
import fr.sncf.osrd.envelope_sim.EnvelopeProfile.CONSTANT_SPEED
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.RJSRoute
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSApplicableDirectionsTrackRange
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.sim_infra.api.SpeedLimitSource.GivenTrainTag
import fr.sncf.osrd.sim_infra.api.SpeedLimitSource.UnknownTag
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.Helpers.fullInfraFromRJS
import fr.sncf.osrd.utils.Helpers.getExampleInfra
import fr.sncf.osrd.utils.units.Distance.Companion.toMeters
import java.io.IOException
import java.net.URISyntaxException
import java.util.stream.Stream
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MRSPTest {
    // Small_infra paths
    private var path: PathProperties? = null
    private var path30: PathProperties? = null
    private var path60: PathProperties? = null

    // Nested_switches paths
    private var pathTo1: TestPath? = null
    private var pathTo1NoRoutes: TestPath? = null
    private var pathTo2: TestPath? = null
    private var pathTo3: TestPath? = null
    private var pathTo4: TestPath? = null
    private var pathTo4Variation: TestPath? = null

    private fun setUpOnSmallInfra() {
        val rjsInfra = getExampleInfra("small_infra/infra.json")

        // Speed sections for tag-dependent speed testing
        val speedSection1 =
            RJSSpeedSection(
                NAME,
                SPEED1,
                mapOf(TRAIN_TAG1 to SPEED2),
                listOf(
                    RJSApplicableDirectionsTrackRange(
                        "TA0",
                        ApplicableDirection.BOTH,
                        POSITION1,
                        POSITION2
                    )
                ),
                null
            )
        val speedSection2 =
            RJSSpeedSection(
                NAME,
                null,
                mapOf(TRAIN_TAG2 to SPEED3),
                listOf(
                    RJSApplicableDirectionsTrackRange(
                        "TA0",
                        ApplicableDirection.BOTH,
                        POSITION2,
                        POSITION3
                    )
                ),
                null
            )

        // Speed sections that depend on the train's route
        val route1 =
            RJSRoute(
                "DA5->DC0",
                RJSWaypointRef("DA5", RJSWaypointRef.RJSWaypointType.DETECTOR),
                EdgeDirection.START_TO_STOP,
                RJSWaypointRef("DC0", RJSWaypointRef.RJSWaypointType.DETECTOR)
            )
        route1.switchesDirections["PC0"] = "A_B1"
        val route2 =
            RJSRoute(
                "DA5->DC1",
                RJSWaypointRef("DA5", RJSWaypointRef.RJSWaypointType.DETECTOR),
                EdgeDirection.START_TO_STOP,
                RJSWaypointRef("DC1", RJSWaypointRef.RJSWaypointType.DETECTOR)
            )
        route2.switchesDirections["PC0"] = "A_B2"
        val da5 = rjsInfra.detectors.first { d -> d.id == "DA5" }
        val dc0 = rjsInfra.detectors.first { d -> d.id == "DC0" }
        val dc1 = rjsInfra.detectors.first { d -> d.id == "DC1" }
        val speedSection3 =
            RJSSpeedSection(
                NAME,
                SPEED30,
                mapOf(),
                listOf(
                    RJSApplicableDirectionsTrackRange(
                        da5.track,
                        ApplicableDirection.BOTH,
                        da5.position,
                        10_000.0
                    ),
                    RJSApplicableDirectionsTrackRange(
                        dc0.track,
                        ApplicableDirection.BOTH,
                        0.0,
                        dc0.position
                    )
                ),
                listOf(route1.id)
            )
        val speedSection4 =
            RJSSpeedSection(
                NAME,
                SPEED60,
                mapOf(),
                listOf(
                    RJSApplicableDirectionsTrackRange(
                        da5.track,
                        ApplicableDirection.BOTH,
                        da5.position,
                        10_000.0
                    ),
                    RJSApplicableDirectionsTrackRange(
                        dc1.track,
                        ApplicableDirection.BOTH,
                        0.0,
                        dc1.position
                    )
                ),
                listOf(route2.id)
            )
        rjsInfra.speedSections = ArrayList()
        rjsInfra.speedSections.addAll(
            listOf(speedSection1, speedSection2, speedSection3, speedSection4)
        )
        rjsInfra.routes.addAll(listOf(route1, route2))

        // Compute paths
        val infra = fullInfraFromRJS(rjsInfra)
        val blockInfra = infra.blockInfra
        path = makePathProps(blockInfra, infra.rawInfra, BlockId(0U), routes = listOf())
        val block30 = Helpers.getBlocksOnRoutes(infra, listOf(route1.id))[0]
        path30 = makePathProps(blockInfra, infra.rawInfra, block30, routes = listOf(route1.id))
        val block60 = Helpers.getBlocksOnRoutes(infra, listOf(route2.id))[0]
        path60 = makePathProps(blockInfra, infra.rawInfra, block60, routes = listOf(route2.id))
    }

    private fun setUpOnNestedSwitches() {
        val rjsInfra = getExampleInfra("nested_switches/infra.json")
        val infra = fullInfraFromRJS(rjsInfra)

        fun routeLen(route: String): Double {
            return Helpers.getBlocksOnRoutes(infra, listOf(route)).sumOf { block ->
                infra.blockInfra.getBlockLength(block).distance.meters
            }
        }

        fun makePathFromRoute(route: String, speed: Double): TestPath {
            val block = Helpers.getBlocksOnRoutes(infra, listOf(route)).last()
            val pathProps =
                makePathProps(infra.blockInfra, infra.rawInfra, block, routes = listOf(route))
            val pathLen = routeLen(route)
            val envelope =
                Envelope.make(
                    EnvelopeTestUtils.makeFlatPart(LimitKind.SPEED_LIMIT, 0.0, pathLen, speed)
                )
            return TestPath(pathProps, envelope)
        }

        pathTo1 = makePathFromRoute(ROUTES[0], 42.0)
        // There is a speed limit at 40 m/s along ROUTES[1..4] which doesn't
        // apply to any specific route. *For now*, we chose to only consider
        // the speed limit that apply to the train route only.
        // That might change in the future.
        pathTo2 = makePathFromRoute(ROUTES[1], 60.0)
        pathTo3 = makePathFromRoute(ROUTES[2], 30.0)
        pathTo4 = makePathFromRoute(ROUTES[3], 80.0)
        pathTo4Variation = makePathFromRoute(ROUTES[4], 30.0)

        val block = Helpers.getBlocksOnRoutes(infra, listOf(ROUTES[0])).last()
        pathTo1NoRoutes =
            TestPath(
                makePathProps(infra.blockInfra, infra.rawInfra, block, routes = listOf()),
                Envelope.make(
                    EnvelopeTestUtils.makeFlatPart(
                        LimitKind.SPEED_LIMIT,
                        0.0,
                        routeLen(ROUTES[0]),
                        50.0
                    )
                )
            )
    }

    @BeforeAll
    @Throws(IOException::class, URISyntaxException::class)
    fun setUp() {
        setUpOnSmallInfra()
        setUpOnNestedSwitches()
    }

    @ParameterizedTest
    @MethodSource("testComputeMRSPArgs")
    fun testComputeMRSP(
        path: PathProperties,
        rollingStock: RollingStock,
        addRollingStockLength: Boolean,
        trainTag: String?,
        expectedEnvelope: Envelope?
    ) {
        val mrsp = computeMRSP(path, rollingStock, addRollingStockLength, trainTag)
        EnvelopeTestUtils.assertEquals(expectedEnvelope, mrsp, 0.001)
    }

    private fun testComputeMRSPArgs(): Stream<Arguments> {
        val pathLength = toMeters(path!!.getLength())
        return Stream.of(
            // Multiple speed sections with correct/incorrect train tag and no rolling stock
            // length
            Arguments.of(
                path,
                TestTrains.REALISTIC_FAST_TRAIN,
                false,
                TRAIN_TAG2,
                Envelope.make(
                    // No speed section at first => train speed limit
                    EnvelopeTestUtils.makeFlatPart(
                        listOf(LimitKind.TRAIN_LIMIT, CONSTANT_SPEED, HasMissingSpeedTag),
                        0.0,
                        POSITION1,
                        TestTrains.MAX_SPEED
                    ),
                    // Speed section with incorrect train tag => speed 1
                    EnvelopeTestUtils.makeFlatPart(
                        listOf(
                            LimitKind.SPEED_LIMIT,
                            CONSTANT_SPEED,
                            UnknownTag(),
                            HasMissingSpeedTag
                        ),
                        POSITION1,
                        POSITION2,
                        SPEED1
                    ),
                    // Speed section with correct train tag => speed 3
                    EnvelopeTestUtils.makeFlatPart(
                        listOf(LimitKind.SPEED_LIMIT, CONSTANT_SPEED, GivenTrainTag(TRAIN_TAG2)),
                        POSITION2,
                        POSITION3,
                        SPEED3
                    ),
                    // No speed section at end => train speed limit
                    EnvelopeTestUtils.makeFlatPart(
                        listOf(LimitKind.TRAIN_LIMIT, CONSTANT_SPEED, HasMissingSpeedTag),
                        POSITION3,
                        pathLength,
                        TestTrains.MAX_SPEED
                    )
                )
            ),

            // Multiple speed sections with rolling stock length
            Arguments.of(
                path,
                TestTrains.REALISTIC_FAST_TRAIN,
                true,
                null,
                Envelope.make(
                    // No speed section at first => train speed limit
                    EnvelopeTestUtils.makeFlatPart(
                        LimitKind.TRAIN_LIMIT,
                        0.0,
                        POSITION1,
                        TestTrains.MAX_SPEED
                    ),
                    // Speed section with incorrect train tag: speed 1
                    EnvelopeTestUtils.makeFlatPart(
                        LimitKind.SPEED_LIMIT,
                        POSITION1,
                        POSITION2 + TestTrains.REALISTIC_FAST_TRAIN.length,
                        SPEED1
                    ),
                    // Rolling stock length > speedSection2 length => speedSection2 not
                    // taken into account
                    // No speed section at end => train speed limit
                    EnvelopeTestUtils.makeFlatPart(
                        LimitKind.TRAIN_LIMIT,
                        POSITION2 + TestTrains.REALISTIC_FAST_TRAIN.length,
                        pathLength,
                        TestTrains.MAX_SPEED
                    )
                )
            ),

            // No speed sections taken into account: speedSection1 speed2 > train maxSpeed,
            // speedSection2 speed 0m/s
            Arguments.of(
                path,
                TestTrains.REALISTIC_FAST_TRAIN,
                false,
                TRAIN_TAG1,
                Envelope.make(
                    EnvelopeTestUtils.makeFlatPart(
                        listOf(LimitKind.TRAIN_LIMIT, CONSTANT_SPEED, HasMissingSpeedTag),
                        0.0,
                        POSITION1,
                        TestTrains.MAX_SPEED
                    ),
                    EnvelopeTestUtils.makeFlatPart(
                        LimitKind.TRAIN_LIMIT,
                        POSITION1,
                        POSITION2,
                        TestTrains.MAX_SPEED
                    ),
                    EnvelopeTestUtils.makeFlatPart(
                        listOf(LimitKind.TRAIN_LIMIT, CONSTANT_SPEED, HasMissingSpeedTag),
                        POSITION2,
                        pathLength,
                        TestTrains.MAX_SPEED
                    )
                )
            ),

            // 30 km/h speed limit applicable to the route
            Arguments.of(
                path30,
                TestTrains.REALISTIC_FAST_TRAIN,
                false,
                null,
                Envelope.make(
                    EnvelopeTestUtils.makeFlatPart(LimitKind.SPEED_LIMIT, 0.0, 360.0, SPEED30)
                )
            ),

            // 60 km/h speed limit applicable to the route
            Arguments.of(
                path60,
                TestTrains.REALISTIC_FAST_TRAIN,
                false,
                null,
                Envelope.make(
                    EnvelopeTestUtils.makeFlatPart(LimitKind.SPEED_LIMIT, 0.0, 360.0, SPEED60)
                )
            ),
            pathTo1!!.makeArguments(),
            pathTo2!!.makeArguments(),
            pathTo3!!.makeArguments(),
            pathTo4!!.makeArguments(),
            pathTo4Variation!!.makeArguments(),
            pathTo1NoRoutes!!.makeArguments(),
        )
    }

    companion object {
        // On small_infra
        private const val POSITION1 = 200.0
        private const val POSITION2 = 1000.0
        private const val POSITION3 = 1200.0
        private const val SPEED1 = 42.0
        private const val SPEED2 = 90.0
        private const val SPEED3 = 70.0
        private const val SPEED30 = 30.0
        private const val SPEED60 = 60.0
        private const val NAME = "The chosen one"
        private const val TRAIN_TAG1 = "Hello there"
        private const val TRAIN_TAG2 = "General Kenobi"

        // On nested_switches
        private val ROUTES = listOf("1 -> 1'", "1 -> 2", "1 -> 3", "1 -> 4", "1 -> 4'")

        private data class TestPath(val path: PathProperties, val envelope: Envelope) {
            fun makeArguments(): Arguments {
                return Arguments.of(path, TestTrains.REALISTIC_FAST_TRAIN, false, null, envelope)
            }
        }
    }
}
