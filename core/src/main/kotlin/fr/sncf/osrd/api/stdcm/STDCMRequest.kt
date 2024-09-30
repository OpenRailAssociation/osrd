package fr.sncf.osrd.api.stdcm

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint
import fr.sncf.osrd.railjson.schema.common.ID
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
class STDCMRequest
@JvmOverloads
constructor(
    /** Infra id */
    var infra: String,
    /** Infra version */
    @Json(name = "expected_version") var expectedVersion: String,
    /** Rolling stock used for this request */
    @Json(name = "rolling_stock") var rollingStock: RJSRollingStock,
    /** Spacing requirements for any train in the timetable */
    @Json(name = "spacing_requirements") var spacingRequirements: Collection<SpacingRequirement>,
    /**
     * A list of steps on the path. A step is a set of location with a stop duration. The path only
     * has to go through a single point per location.
     */
    var steps: List<STDCMStep>,
    /** Train start time */
    @Json(name = "start_time") var startTime: Double = Double.NaN,
    /** Train end time */
    @Json(name = "end_time") var endTime: Double = Double.NaN,
    speedLimitComposition: String? = null,
    marginBefore: Double = 0.0,
    marginAfter: Double = 0.0,
    maximumRunTime: Double = 12.0 * 3600.0
) {
    /** Train comfort */
    var comfort: Comfort? = null

    /** Time step used in simulations (defaults to 2) */
    @Json(name = "time_step") var timeStep = 2.0

    /** By how long we can delay the departure of the train in seconds (defaults to 2h) */
    @Json(name = "maximum_departure_delay") var maximumDepartureDelay = (3600 * 2).toDouble()

    /**
     * Specifies the running time that the train should not exceed to reach its destination, e.g.
     * with a value of 18000, we ignore results after 5h.
     */
    @Json(name = "maximum_run_time") var maximumRunTime: Double

    /** Train category for speed limits */
    @Json(name = "speed_limit_tags") var speedLimitComposition: String? = null

    /**
     * Grid margin of x seconds before the train passage, which means that the path used by the
     * train should be free and available at least x seconds before its passage.
     */
    @Json(name = "margin_before") var gridMarginBeforeSTDCM = 0.0

    /**
     * Grid margin of y seconds after the train passage, which means that the path used by the train
     * should be free and available at least y seconds after its passage.
     */
    @Json(name = "margin_after") var gridMarginAfterSTDCM = 0.0

    /**
     * Standard allowance to use when adding the new train. If unspecified (null), no allowance is
     * added. This is only one part of the usual allowance object, because we can't define ranges
     * nor specify the allowance type (mareco / linear).
     */
    @Json(name = "standard_allowance") var standardAllowance: RJSAllowanceValue? = null

    /** Creates a STDCMRequest */
    /** Create a default STDCMRequest */
    init {
        this.speedLimitComposition = speedLimitComposition
        gridMarginBeforeSTDCM = marginBefore
        gridMarginAfterSTDCM = marginAfter
        this.maximumRunTime = maximumRunTime
    }

    data class STDCMStep(
        /** Duration of the stop, if the train stops */
        @Json(name = "stop_duration") var stopDuration: Double?,
        /** If set to false, the train passes through the point without stopping */
        var stop: Boolean,
        /**
         * List of possible points to validate the step: the train only has to pass through or stop
         * at one of the points.
         */
        var waypoints: Collection<PathfindingWaypoint>
    )

    companion object {
        val adapter: JsonAdapter<STDCMRequest> =
            Moshi.Builder()
                .add(KotlinJsonAdapterFactory())
                .add(ID.Adapter.FACTORY)
                .add(RJSRollingResistance.adapter)
                .add(RJSAllowance.adapter)
                .add(RJSAllowanceValue.adapter)
                .build()
                .adapter(STDCMRequest::class.java)
    }
}
