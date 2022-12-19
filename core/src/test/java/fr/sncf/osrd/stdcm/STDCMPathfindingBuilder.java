package fr.sncf.osrd.stdcm;

import com.google.common.collect.ImmutableMultimap;
import com.google.common.collect.Multimap;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.STDCMResult;
import fr.sncf.osrd.api.stdcm.graph.STDCMPathfinding;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.Set;

/** This class makes it easier to handle the STDCM pathfinding parameters,
 * it makes some parameters "optional".
 * <p/>
 * This is part of the test module because it's only realistically used in tests
 * and the default values were set with tests in mind,
 * but it could be moved to the non-test module if it becomes relevant */
public class STDCMPathfindingBuilder {

    // region NON-OPTIONAL
    private SignalingInfra infra = null;
    Set<Pathfinding.EdgeLocation<SignalingRoute>> startLocations = null;
    Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations = null;

    // endregion NON-OPTIONAL

    // region OPTIONAL
    private RollingStock rollingStock = TestTrains.REALISTIC_FAST_TRAIN;
    private double startTime = 0;
    private RollingStock.Comfort comfort = RollingStock.Comfort.STANDARD;
    Multimap<SignalingRoute, OccupancyBlock> unavailableTimes = ImmutableMultimap.of();
    double timeStep = 2.;
    double maxDepartureDelay = 3600 * 2;
    double maxRunTime = Double.POSITIVE_INFINITY;
    String tag = "";
    AllowanceValue standardAllowance;
    // endregion OPTIONAL

    // region SETTERS
    /** Sets the infra to be used */
    public STDCMPathfindingBuilder setInfra(SignalingInfra infra) {
        this.infra = infra;
        return this;
    }

    /** Set the rolling stock to be used for the simulation. Defaults to REALISTIC_FAST_TRAIN */
    public STDCMPathfindingBuilder setRollingStock(RollingStock rollingStock) {
        this.rollingStock = rollingStock;
        return this;
    }

    /** Sets the locations at which the train can start */
    public STDCMPathfindingBuilder setStartLocations(Set<Pathfinding.EdgeLocation<SignalingRoute>> startLocations) {
        this.startLocations = startLocations;
        return this;
    }

    /** Sets the locations we are trying to reach */
    public STDCMPathfindingBuilder setEndLocations(Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations) {
        this.endLocations = endLocations;
        return this;
    }

    /** Set the earliest time at which the train can leave. Defaults to 0 */
    public STDCMPathfindingBuilder setStartTime(double startTime) {
        this.startTime = startTime;
        return this;
    }

    /** Sets the rolling stock comfort parameter used for the simulation. Defaults to "standard" */
    public STDCMPathfindingBuilder setComfort(RollingStock.Comfort comfort) {
        this.comfort = comfort;
        return this;
    }

    /** Sets at which times each section of routes are unavailable. By default, everything is available */
    public STDCMPathfindingBuilder setUnavailableTimes(
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes
    ) {
        this.unavailableTimes = unavailableTimes;
        return this;
    }

    /** Sets the time step used for the simulations in seconds. Defaults to 2s */
    public STDCMPathfindingBuilder setTimeStep(double timeStep) {
        this.timeStep = timeStep;
        return this;
    }

    /** Sets by how much we can delay the departure time in seconds. Defaults to 2h */
    public STDCMPathfindingBuilder setMaxDepartureDelay(double maxDepartureDelay) {
        this.maxDepartureDelay = maxDepartureDelay;
        return this;
    }

    /** Sets how long the total run time can be in seconds. Defaults to +inf */
    public STDCMPathfindingBuilder setMaxRunTime(double maxRunTime) {
        this.maxRunTime = maxRunTime;
        return this;
    }

    /** Sets the train tag used to determine the speed limits by category. Defaults to empty */
    public STDCMPathfindingBuilder setTag(String tag) {
        this.tag = tag;
        return this;
    }

    /** Sets the standard allowance used for the new train. Defaults to null (no allowance) */
    public STDCMPathfindingBuilder setStandardAllowance(AllowanceValue allowance) {
        this.standardAllowance = allowance;
        return this;
    }

    // endregion SETTERS

    /** Runs the pathfinding request with the given parameters */
    public STDCMResult run() {
        assert infra != null : "infra is a required parameter and was not set";
        assert rollingStock != null : "rolling stock is a required parameter and was not set";
        assert startLocations != null : "start locations is a required parameter and was not set";
        assert endLocations != null : "end locations is a required parameter and was not set";
        return STDCMPathfinding.findPath(
                infra,
                rollingStock,
                comfort,
                startTime,
                0,
                startLocations,
                endLocations,
                unavailableTimes,
                timeStep,
                maxDepartureDelay,
                maxRunTime,
                tag,
                standardAllowance
        );
    }
}
