package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import com.google.common.collect.Multimap
import fr.sncf.osrd.DriverBehaviour
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.stdcm.STDCMRequest.RouteOccupancy
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.infra_state.api.TrainPath
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.standalone_sim.StandaloneSim
import fr.sncf.osrd.stdcm.graph.simulateRoute
import fr.sncf.osrd.stdcm.preprocessing.implementation.computeUnavailableSpace
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.StandaloneTrainSchedule
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.graph.GraphAdapter
import fr.sncf.osrd.utils.graph.Pathfinding
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import org.junit.jupiter.api.Assertions
import kotlin.math.max
import kotlin.math.min

object STDCMHelpers {
    /** Make the occupancy multimap of a train going from point A to B starting at departureTime  */
    fun makeOccupancyFromPath(
        infra: FullInfra,
        startLocations: Set<EdgeLocation<SignalingRoute>>,
        endLocations: Set<EdgeLocation<SignalingRoute>>,
        departureTime: Double
    ): Multimap<SignalingRoute, OccupancyBlock> {
        val trainPath = makeTrainPath(infra.java, startLocations, endLocations)
        val result = StandaloneSim.run(
            infra,
            trainPath,
            EnvelopeTrainPath.from(trainPath),
            listOf(
                StandaloneTrainSchedule(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    0.0,
                    listOf(TrainStop(trainPath.length, 1.0)), listOf(),
                    null,
                    RollingStock.Comfort.STANDARD,
                    null,
                    null
                )
            ),
            2.0,
            DriverBehaviour(0.0, 0.0)
        )
        val rawOccupancies = result.baseSimulations[0].routeOccupancies
        val occupancies = ArrayList<RouteOccupancy>()
        for ((key, value) in rawOccupancies) {
            occupancies.add(
                RouteOccupancy(
                    key,
                    departureTime + value.timeHeadOccupy,
                    departureTime + value.timeTailFree
                )
            )
        }
        return computeUnavailableSpace(
            infra.java,
            occupancies,
            TestTrains.REALISTIC_FAST_TRAIN,
            0.0,
            0.0
        )
    }

    /** Creates a train path object from start and end locations  */
    private fun makeTrainPath(
        infra: SignalingInfra,
        startLocations: Set<EdgeLocation<SignalingRoute>>,
        endLocations: Set<EdgeLocation<SignalingRoute>>
    ): TrainPath {
        val path = Pathfinding(GraphAdapter(infra.signalingRouteGraph))
            .setEdgeToLength { route: SignalingRoute -> route.infraRoute.length }
            .runPathfinding(listOf<Collection<EdgeLocation<SignalingRoute>>>(startLocations, endLocations))
        val routeList = path.ranges.stream()
            .map{ range -> range.edge!!}
            .toList()
        val firstRouteRange = path.ranges[0]
        val lastRouteRange = path.ranges[path.ranges.size - 1]
        val firstTracks = firstRouteRange.edge.infraRoute
            .getTrackRanges(firstRouteRange.start, firstRouteRange.end)
        val lastTracks = lastRouteRange.edge.infraRoute
            .getTrackRanges(lastRouteRange.start, lastRouteRange.end)
        val lastTrackRange = lastTracks[lastTracks.size - 1]
        return TrainPathBuilder.from(
            routeList,
            firstTracks[0].offsetLocation(0.0),
            lastTrackRange.offsetLocation(lastTrackRange.length)
        )
    }

    /** Returns how long the longest occupancy block lasts, which is the minimum delay we need to add
     * between two identical trains  */
    fun getMaxOccupancyLength(occupancies: Multimap<SignalingRoute, OccupancyBlock>): Double {
        var maxOccupancyLength = 0.0
        for (route in occupancies.keySet()) {
            var endTime = 0.0
            var startTime = Double.POSITIVE_INFINITY
            for ((timeStart, timeEnd) in occupancies[route]) {
                endTime = max(endTime, timeEnd)
                startTime = min(startTime, timeStart)
            }
            maxOccupancyLength = max(maxOccupancyLength, endTime - startTime)
        }
        return maxOccupancyLength
    }

    /** Returns the time it takes to reach the end of the last routes,
     * starting at speed 0 at the start of the first route */
    fun getRoutesRunTime(routes: List<SignalingRoute?>): Double {
        var time = 0.0
        var speed = 0.0
        for (route in routes) {
            val envelope = simulateRoute(
                route!!, speed, 0.0,
                TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
            )!!
            time += envelope.totalTime
            speed = envelope.endSpeed
        }
        return time
    }
    /** Checks that the result don't cross in an occupied section, with a certain tolerance for float inaccuracies  */
    /** Checks that the result don't cross in an occupied section  */
    @JvmStatic
    @JvmOverloads
    fun occupancyTest(
        res: STDCMResult,
        occupancyGraph: ImmutableMultimap<SignalingRoute?, OccupancyBlock>,
        tolerance: Double = 0.0
    ) {
        val envelopeWrapper = EnvelopeStopWrapper(res.envelope, res.stopResults)
        val routes = res.trainPath.routePath
        for (index in routes.indices) {
            val startRoutePosition = routes[index].pathOffset
            val routeOccupancies = occupancyGraph[routes[index].element]
            for ((timeStart, timeEnd, distanceStart, distanceEnd) in routeOccupancies) {
                val enterTime = res.departureTime + envelopeWrapper.interpolateTotalTimeClamp(
                    startRoutePosition + distanceStart
                )
                val exitTime = res.departureTime + envelopeWrapper.interpolateTotalTimeClamp(
                    startRoutePosition + distanceEnd
                )
                Assertions.assertTrue(
                    enterTime + tolerance >= timeEnd || exitTime - tolerance <= timeStart
                )
            }
        }
    }
}
