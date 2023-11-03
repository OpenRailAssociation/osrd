package fr.sncf.osrd.api.stdcm;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSComfortType;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import java.util.Collection;
import java.util.List;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public final class STDCMRequest {

    public static final JsonAdapter<STDCMRequest> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSAllowance.adapter)
            .add(RJSAllowanceValue.adapter)
            .build()
            .adapter(STDCMRequest.class);
    /**
     * Infra id
     */
    public String infra;

    /**
     * Infra version
     */
    @Json(name = "expected_version")
    public String expectedVersion;

    /**
     * Rolling stock used for this request
     */
    @Json(name = "rolling_stock")
    public RJSRollingStock rollingStock;

    /** Train comfort */
    public RJSComfortType comfort;

    /**
     * Spacing requirements for any train in the timetable
     */
    @Json(name = "spacing_requirements")
    public Collection<ResultTrain.SpacingRequirement> spacingRequirements;

    /** A list of steps on the path. A step is a set of location with a stop duration.
     *  The path only has to go through a single point per location.
     */
    public List<STDCMStep> steps;

    /**
     * Train start time
     */
    @Json(name = "start_time")
    public double startTime;

    /**
     * Train end time
     */
    @Json(name = "end_time")
    public double endTime;

    /**
     * Time step used in simulations (defaults to 2)
     */
    @Json(name = "time_step")
    public double timeStep = 2.;

    /**
     * By how long we can delay the departure of the train in seconds (defaults to 2h)
     */
    @Json(name = "maximum_departure_delay")
    public double maximumDepartureDelay = 3600 * 2;

    /**
     * Specifies the running time that the train should not exceed to reach its destination,
     * e.g. with a value of 18000, we ignore results after 5h.
     */
    @Json(name = "maximum_run_time")
    public double maximumRunTime;

    /**
     * Train category for speed limits
     */
    @Json(name = "speed_limit_tags")
    public String speedLimitComposition = null;

    /**
     * Grid margin of x seconds before the train passage,
     * which means that the path used by the train should be free and available
     * at least x seconds before its passage.
     */
    @Json(name = "margin_before")
    public double gridMarginBeforeSTDCM = 0;

    /**
     * Grid margin of y seconds after the train passage,
     * which means that the path used by the train should be free and available
     * at least y seconds after its passage.
     */
    @Json(name = "margin_after")
    public double gridMarginAfterSTDCM = 0;

    /** Standard allowance to use when adding the new train. If unspecified (null), no allowance is added.
     * This is only one part of the usual allowance object, because we can't define ranges nor specify
     * the allowance type (mareco / linear). */
    @Json(name = "standard_allowance")
    public RJSAllowanceValue standardAllowance = null;

    /**
     * Create a default STDCMRequest
     */
    public STDCMRequest() {
        this(
                null,
                null,
                null,
                null,
                null,
                Double.NaN,
                Double.NaN,
                null,
                0,
                0,
                12 * 3600
        );
    }

    /**
     * Creates a STDCMRequest
     */
    public STDCMRequest(
            String infra,
            String expectedVersion,
            RJSRollingStock rollingStock,
            Collection<ResultTrain.SpacingRequirement> spacingRequirements,
            List<STDCMStep> steps,
            double startTime,
            double endTime,
            String speedLimitComposition,
            double marginBefore,
            double marginAfter,
            double maximumRunTime
    ) {
        this.infra = infra;
        this.expectedVersion = expectedVersion;
        this.rollingStock = rollingStock;
        this.spacingRequirements = spacingRequirements;
        this.steps = steps;
        this.startTime = startTime;
        this.endTime = endTime;
        this.speedLimitComposition = speedLimitComposition;
        this.gridMarginBeforeSTDCM = marginBefore;
        this.gridMarginAfterSTDCM = marginAfter;
        this.maximumRunTime = maximumRunTime;
    }

    public static class STDCMStep {
        /** Duration of the stop, if the train stops */
        @Json(name = "stop_duration")
        public double stopDuration;

        /** If set to false, the train passes through the point without stopping */
        public boolean stop;

        /** List of possible points to validate the step: the train only has to pass through or stop at
         * one of the points. */
        public Collection<PathfindingWaypoint> waypoints;


        /** Create a new step */
        public STDCMStep(double stopDuration, boolean stop, Collection<PathfindingWaypoint> waypoints) {
            this.stopDuration = stopDuration;
            this.stop = stop;
            this.waypoints = waypoints;
        }
    }
}
