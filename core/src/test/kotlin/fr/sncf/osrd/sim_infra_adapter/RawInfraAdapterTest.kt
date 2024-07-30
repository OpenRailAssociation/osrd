package fr.sncf.osrd.sim_infra_adapter

import fr.sncf.osrd.parseRJSInfra
import fr.sncf.osrd.railjson.builder.begin
import fr.sncf.osrd.railjson.builder.buildParseRJSInfra
import fr.sncf.osrd.railjson.builder.end
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.START_TO_STOP
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.STOP_TO_START
import fr.sncf.osrd.railjson.schema.infra.*
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.mutableOffsetArrayListOf
import kotlin.test.Test
import kotlin.test.assertEquals
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class RawInfraAdapterTest {
    // If:
    //  - the route ends with a signal exactly on its end detector
    //  - the route ends on a track link
    //  - both the signal and end detector are just on the other side of this track link
    // the signal should be part of the route's zone path
    @ParameterizedTest
    @ValueSource(strings = ["ll", "lr", "rl", "rr"])
    fun routeEndsOnTrackLinkWithSignal(detectorSides: String) {
        val sideX = detectorSides[0]
        val sideY = detectorSides[1]

        //        a           b           c
        //  ||=========>||<=========||========>||
        //  begin       x           y          end
        val infra = buildParseRJSInfra {
            val trackA = trackSection("track_a", 10.0)
            val trackB = trackSection("track_b", 10.0)
            val trackC = trackSection("track_c", 10.0)

            val linkAb = link("link_ab", trackA.end, trackB.end)
            val linkBc = link("link_bc", trackB.begin, trackC.begin)

            val bufferStopBegin = bufferStop("begin", trackA.begin)
            val bufferStopEnd = bufferStop("end", trackC.end)

            val trackX = if (sideX == 'l') trackA else trackB
            val directionX = if (sideX == 'l') START_TO_STOP else STOP_TO_START
            val locationX = trackX.at(10.0)
            val trackY = if (sideY == 'l') trackB else trackC
            val directionY = if (sideY == 'l') STOP_TO_START else START_TO_STOP
            val locationY = trackY.at(0.0)

            detector("x", locationX)
            detector("y", locationY)
            defaultSightDistance = 42.0
            physicalSignal("U", locationX, directionX)
            physicalSignal("V", locationY, directionY)

            route("route", bufferStopBegin, START_TO_STOP, bufferStopEnd) {
                // FIXME: the parser shouldn't require configurations for nodes which have a
                // single config
                addTrackNodeDirection(linkAb, "STATIC")
                addTrackNodeDirection(linkBc, "STATIC")
            }
        }

        val route = infra.getRouteFromName("route")
        val signalMap = infra.physicalSignals.associateBy { infra.getPhysicalSignalName(it)!! }
        val signalU = signalMap["U"]!!
        val signalV = signalMap["V"]!!
        val routePath = infra.getRoutePath(route)
        assertEquals(3, routePath.size)
        assertEquals(mutableStaticIdxArrayListOf(signalU), infra.getSignals(routePath[0]))
        assertEquals(
            mutableOffsetArrayListOf(Offset(10.meters)),
            infra.getSignalPositions(routePath[0])
        )
        assertEquals(mutableStaticIdxArrayListOf(signalV), infra.getSignals(routePath[1]))
        assertEquals(
            mutableOffsetArrayListOf(Offset(10.meters)),
            infra.getSignalPositions(routePath[0])
        )
        assertEquals(mutableStaticIdxArrayListOf(), infra.getSignals(routePath[2]))
    }

    @Test
    fun smokeAdaptTinyInfra() {
        val rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json")
        parseRJSInfra(rjsInfra)
    }

    @Test
    fun smokeAdaptSmallInfra() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        parseRJSInfra(rjsInfra)
    }

    /**
     * Checks that we can load a route that starts at the edge of a track section, an edge case that
     * happens when loading a real infra but not on our generated infras
     */
    @Test
    fun adaptSmallInfraRouteWithEmptyTrackRange() {
        // The route goes from the end of TA1 to TA3, two tracks that are linked through switch PA0
        // in
        // its LEFT config
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        rjsInfra.detectors.add(RJSTrainDetector("det_at_transition", 1950.0, "TA1"))
        rjsInfra.detectors.add(RJSTrainDetector("det_end_new_route", 20.0, "TA3"))
        val newRoute =
            RJSRoute(
                "new_route",
                RJSWaypointRef("det_at_transition", RJSWaypointRef.RJSWaypointType.DETECTOR),
                START_TO_STOP,
                RJSWaypointRef("det_end_new_route", RJSWaypointRef.RJSWaypointType.DETECTOR),
            )
        newRoute.trackNodesDirections["PA0"] = "A_B1"
        rjsInfra.routes = listOf(newRoute)
        parseRJSInfra(rjsInfra)
    }

    private fun assertCrossing(rawInfra: RawInfra, nodeIdx: StaticIdx<TrackNode>) {
        val portIdxs = rawInfra.getTrackNodePorts(nodeIdx)
        assert(portIdxs.size == 4u)
        val configIdxs = rawInfra.getTrackNodeConfigs(nodeIdx)
        assert(configIdxs.size == 1u)
    }

    private fun assertDoubleSlipSwitch(rawInfra: RawInfra, nodeIdx: StaticIdx<TrackNode>) {
        val portIdxs = rawInfra.getTrackNodePorts(nodeIdx)
        assert(portIdxs.size == 4u)
        val configIdxs = rawInfra.getTrackNodeConfigs(nodeIdx)
        assert(configIdxs.size == 4u)
    }

    private fun assertPointSwitch(rawInfra: RawInfra, nodeIdx: StaticIdx<TrackNode>) {
        val portIdxs = rawInfra.getTrackNodePorts(nodeIdx)
        assert(portIdxs.size == 3u)
        val configIdxs = rawInfra.getTrackNodeConfigs(nodeIdx)
        assert(configIdxs.size == 2u)
    }

    @Test
    fun loadSmallInfraNodes() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        val rawInfra = parseRJSInfra(rjsInfra)
        val nodeNameToIdxMap =
            rawInfra.trackNodes
                .map { nodeIdx -> Pair(rawInfra.getTrackNodeName(nodeIdx), nodeIdx) }
                .toMap()
        assertPointSwitch(rawInfra, nodeNameToIdxMap["PA0"]!!)
        assertPointSwitch(rawInfra, nodeNameToIdxMap["PE1"]!!)
        assertDoubleSlipSwitch(rawInfra, nodeNameToIdxMap["PH0"]!!)
        assertCrossing(rawInfra, nodeNameToIdxMap["PD1"]!!)

        // check that PD0 crossing connects correctly track-sections with their directions
        assertCrossing(rawInfra, nodeNameToIdxMap["PD0"]!!)
        val configIdx = TrackNodeConfigId(0u) // only configuration of "PD0" crossing node
        val te0 = rawInfra.getTrackSectionFromName("TE0")!!
        val tf0 = rawInfra.getTrackSectionFromName("TF0")!!
        val td0 = rawInfra.getTrackSectionFromName("TD0")!!
        val td2 = rawInfra.getTrackSectionFromName("TD2")!!
        val te0Increasing = DirTrackSectionId(te0, Direction.INCREASING)
        val te0Decreasing = DirTrackSectionId(te0, Direction.DECREASING)
        val tf0Increasing = DirTrackSectionId(tf0, Direction.INCREASING)
        val tf0Decreasing = DirTrackSectionId(tf0, Direction.DECREASING)
        val td0Increasing = DirTrackSectionId(td0, Direction.INCREASING)
        val td0Decreasing = DirTrackSectionId(td0, Direction.DECREASING)
        val td2Increasing = DirTrackSectionId(td2, Direction.INCREASING)
        val td2Decreasing = DirTrackSectionId(td2, Direction.DECREASING)
        assert(rawInfra.getNextTrackNode(te0Increasing).asIndex() == nodeNameToIdxMap["PD0"])
        assert(rawInfra.getNextTrackNode(tf0Decreasing).asIndex() == nodeNameToIdxMap["PD0"])
        assert(rawInfra.getNextTrackNode(td0Increasing).asIndex() == nodeNameToIdxMap["PD0"])
        assert(rawInfra.getNextTrackNode(td2Decreasing).asIndex() == nodeNameToIdxMap["PD0"])
        assert(rawInfra.getNextTrackSection(te0Increasing, configIdx).asIndex() == tf0Increasing)
        assert(rawInfra.getNextTrackSection(tf0Decreasing, configIdx).asIndex() == te0Decreasing)
        assert(rawInfra.getNextTrackSection(td0Increasing, configIdx).asIndex() == td2Increasing)
        assert(rawInfra.getNextTrackSection(td2Decreasing, configIdx).asIndex() == td0Decreasing)
    }

    @Test
    fun loadSmallInfraCrossingZone() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        val rawInfra = parseRJSInfra(rjsInfra)

        // Check that for crossing nodes, only one zone is generated.
        // In small_infra, PD0 and PD1 are crossings, linked by track-section TF0 (no detector on
        // TF0) so PD0 and PD1 are in the same detection zone (bounded by the 6 detectors below)
        val detectorNameToIdx = rawInfra.detectors.associateBy { rawInfra.getDetectorName(it) }
        val de0inc = detectorNameToIdx["DE0"]!!.increasing
        val dd2inc = detectorNameToIdx["DD2"]!!.increasing
        val dd3inc = detectorNameToIdx["DD3"]!!.increasing
        val dd4dec = detectorNameToIdx["DD4"]!!.decreasing
        val dd5dec = detectorNameToIdx["DD5"]!!.decreasing
        val df0dec = detectorNameToIdx["DF0"]!!.decreasing
        val expectedBounds = setOf(de0inc, dd2inc, dd3inc, dd4dec, dd5dec, df0dec)

        val zoneCrossings = rawInfra.getNextZone(de0inc)!!
        assert(rawInfra.getZoneBounds(zoneCrossings).toSet() == expectedBounds)
        val zoneCrossingsName = rawInfra.getZoneName(zoneCrossings)
        for (dirDet in expectedBounds) {
            assert(rawInfra.getNextZone(dirDet) == zoneCrossings)
            assert(
                "${rawInfra.getDetectorName(dirDet.value)}:${dirDet.direction}" in zoneCrossingsName
            )
        }
    }
}
