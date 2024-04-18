package fr.sncf.osrd.api.api_v2.standalone_sim

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.RangeValues
import fr.sncf.osrd.api.api_v2.TrackRange
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlockResponse
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Offset
import java.time.LocalDateTime

class SimulationRequest(
    val path: SimulationPath,
    @Json(name = "start_time") val startTime: LocalDateTime,
    val schedule: List<SimulationScheduleItem>,
    val margins: RangeValues<MarginValue>,
    @Json(name = "initial_speed") val initialSpeed: Double,
    val comfort: Comfort,
    @Json(name = "constraint_distribution") val constraintDistribution: RJSAllowanceDistribution,
    @Json(name = "speed_limit_tag") val speedLimitTag: String?,
    @Json(name = "power_restrictions") val powerRestrictions: List<SimulationPowerRestrictionItem>,
    val options: TrainScheduleOptions,
    @Json(name = "rolling_stock") val rollingStock: PhysicsRollingStock,
    @Json(name = "electrical_profile_set_id") val electricalProfileSetId: Long?
) {
    companion object {
        val adapter: JsonAdapter<PathfindingBlockResponse> =
            Moshi.Builder()
                .add(MarginValue.adapter)
                .addLast(UnitAdapterFactory())
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(PathfindingBlockResponse::class.java)
    }
}

class SimulationPath(
    val blocks: List<String>,
    val routes: List<String>,
    @Json(name = "track_section_ranges") val trackSectionRanges: List<TrackRange>,
)

class SimulationScheduleItem(
    val pathOffset: Offset<Path>,
    val arrival: Duration?,
    @Json(name = "stop_for") val stopFor: Duration?,
)

open class MarginValue {
    class MinPerKm(var value: Double) : MarginValue()

    class Percentage(var percentage: Double) : MarginValue()

    companion object {
        val adapter: PolymorphicJsonAdapterFactory<MarginValue> =
            (PolymorphicJsonAdapterFactory.of(MarginValue::class.java, "type")
                .withSubtype(MinPerKm::class.java, "min_per_km")
                .withSubtype(Percentage::class.java, "percentage"))
    }
}

class SimulationPowerRestrictionItem(
    val from: Offset<Path>,
    val to: Offset<Path>,
    val value: String,
)

class TrainScheduleOptions(
    @Json(name = "use_electrical_profiles") val useElectricalProfiles: Boolean
)
