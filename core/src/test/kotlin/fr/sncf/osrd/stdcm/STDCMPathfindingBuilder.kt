package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import com.google.common.collect.Multimap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.graph.findPath
import fr.sncf.osrd.stdcm.preprocessing.DummyBlockAvailability
import fr.sncf.osrd.stdcm.preprocessing.OccupancySegment
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains

/**
 * This class makes it easier to handle the STDCM pathfinding parameters, it makes some parameters
 * "optional".
 *
 * This is part of the test module because it's only realistically used in tests and the default
 * values were set with tests in mind, but it could be moved to the non-test module if it becomes
 * relevant
 */
data class STDCMPathfindingBuilder(
    // region NON-OPTIONAL
    var infra: FullInfra? = null,
    var steps: MutableList<STDCMStep> = ArrayList(),

    // endregion NON-OPTIONAL
    // region OPTIONAL
    var rollingStock: RollingStock = TestTrains.REALISTIC_FAST_TRAIN,
    var startTime: Double = 0.0,
    var comfort: Comfort = Comfort.STANDARD,
    var pathfindingTimeout: Double = Pathfinding.TIMEOUT,
    var unavailableTimes: Multimap<BlockId, OccupancySegment> = ImmutableMultimap.of(),
    var timeStep: Double = 2.0,
    var maxDepartureDelay: Double = (3600 * 2).toDouble(),
    var maxRunTime: Double = Double.POSITIVE_INFINITY,
    var tag: String = "",
    var standardAllowance: AllowanceValue? = null,
    var blockAvailability: BlockAvailabilityInterface? = null,
) {
    // endregion OPTIONAL
    // region SETTERS
    /** Sets the infra to be used */
    fun setInfra(infra: FullInfra?): STDCMPathfindingBuilder {
        this.infra = infra
        return this
    }

    /** Set the rolling stock to be used for the simulation. Defaults to REALISTIC_FAST_TRAIN */
    fun setRollingStock(rollingStock: RollingStock): STDCMPathfindingBuilder {
        this.rollingStock = rollingStock
        return this
    }

    /**
     * Sets the locations at which the train can start. Meant to be used for simple tests with no
     * intermediate steps
     */
    fun setStartLocations(
        startLocations: Set<PathfindingEdgeLocationId<Block>>,
        plannedTimingData: PlannedTimingData? = null
    ): STDCMPathfindingBuilder {
        steps.add(0, STDCMStep(startLocations, null, false, plannedTimingData))
        return this
    }

    /**
     * Sets the locations the train must reach. Meant to be used for simple tests with no
     * intermediate steps
     */
    fun setEndLocations(
        endLocations: Set<PathfindingEdgeLocationId<Block>>,
        plannedTimingData: PlannedTimingData? = null
    ): STDCMPathfindingBuilder {
        steps.add(STDCMStep(endLocations, 0.0, true, plannedTimingData))
        return this
    }

    /** Add a step to the path */
    fun addStep(step: STDCMStep): STDCMPathfindingBuilder {
        steps.add(step)
        return this
    }

    /** Set the earliest time at which the train can leave. Defaults to 0 */
    fun setStartTime(startTime: Double): STDCMPathfindingBuilder {
        this.startTime = startTime
        return this
    }

    /**
     * Sets at which times each section of blocks are unavailable. By default, everything is
     * available
     */
    fun setUnavailableTimes(
        unavailableTimes: Multimap<BlockId, OccupancySegment>
    ): STDCMPathfindingBuilder {
        this.unavailableTimes = unavailableTimes
        return this
    }

    /** Sets the time step used for the simulations in seconds. Defaults to 2s */
    fun setTimeStep(timeStep: Double): STDCMPathfindingBuilder {
        this.timeStep = timeStep
        return this
    }

    /** Sets by how much we can delay the departure time in seconds. Defaults to 2h */
    fun setMaxDepartureDelay(maxDepartureDelay: Double): STDCMPathfindingBuilder {
        this.maxDepartureDelay = maxDepartureDelay
        return this
    }

    /** Sets how long the total run time can be in seconds. Defaults to +inf */
    fun setMaxRunTime(maxRunTime: Double): STDCMPathfindingBuilder {
        this.maxRunTime = maxRunTime
        return this
    }

    /** Sets the standard allowance used for the new train. Defaults to null (no allowance) */
    fun setStandardAllowance(allowance: AllowanceValue?): STDCMPathfindingBuilder {
        standardAllowance = allowance
        return this
    }

    /** Sets the pathfinding timeout. Default to Pathfinding.TIMEOUT. */
    fun setPathfindingTimeout(pathfindingTimeout: Double): STDCMPathfindingBuilder {
        this.pathfindingTimeout = pathfindingTimeout
        return this
    }

    /**
     * Sets the method used to get the availability of each block. Uses the given occupancy by
     * default.
     */
    fun setBlockAvailability(availability: BlockAvailabilityInterface): STDCMPathfindingBuilder {
        this.blockAvailability = availability
        return this
    }
    // endregion SETTERS
    /** Runs the pathfinding request with the given parameters */
    fun run(): STDCMResult? {
        assert(infra != null) { "infra is a required parameter and was not set" }
        assert(steps.size >= 2) { "Not enough steps have been set" }
        assert(blockAvailability == null || unavailableTimes.isEmpty) {
            "Can't set both block availability and unavailable times"
        }
        val blockAvailabilityAdapter =
            blockAvailability ?: DummyBlockAvailability(infra!!.blockInfra, unavailableTimes)
        return findPath(
            infra!!,
            rollingStock,
            comfort,
            startTime,
            steps,
            blockAvailabilityAdapter,
            timeStep,
            maxDepartureDelay,
            maxRunTime,
            tag,
            standardAllowance,
            pathfindingTimeout
        )
    }
}
