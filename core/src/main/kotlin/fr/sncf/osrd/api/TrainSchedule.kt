package fr.sncf.osrd.api

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.standalone_sim.AllowanceDistribution
import fr.sncf.osrd.api.standalone_sim.MarginValue
import fr.sncf.osrd.api.standalone_sim.MarginValueAdapter
import fr.sncf.osrd.api.standalone_sim.SimulationPowerRestrictionItem
import fr.sncf.osrd.api.standalone_sim.TrainScheduleOptions
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta
import java.time.ZonedDateTime

/**
 * Describes a train schedule, the general-purpose OSRD representation of a train. This should
 * generally reflect the models described in editoast or pydantic schemas, though it's not
 * automatically generated.
 *
 * In core, we rarely deal with raw train schedule, editoast runs some pre- or post-processing. This
 * is just used for one of the outputs of STDCM.
 */
data class TrainSchedule(
    @Json(name = "train_name") val trainName: String,
    val labels: List<String?>,
    @Json(name = "rolling_stock_name") val rollingStockName: String,
    @Json(name = "start_time") val startTime: ZonedDateTime,
    val schedule: List<ScheduleItem>,
    val margins: RangeValues<MarginValue>,
    @Json(name = "initial_speed") val initialSpeed: Int,
    val comfort: Comfort,
    val path: List<PathItem>,
    @Json(name = "constraint_distribution") val constraintDistribution: AllowanceDistribution,
    @Json(name = "speed_limit_tag") val speedLimitTag: String?,
    @Json(name = "power_restrictions") val powerRestrictions: List<SimulationPowerRestrictionItem>,
    val options: TrainScheduleOptions,
    @Json(name = "main_category") val mainCategory: String?,
    @Json(name = "sub_category") val subCategory: String?,
) {
    companion object {
        val adapter: JsonAdapter<TrainSchedule> =
            Moshi.Builder()
                .add(MarginValueAdapter())
                .add(RJSRollingResistance.adapter)
                .addLast(UnitAdapterFactory())
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(TrainSchedule::class.java)
    }
}

data class PathItem(
    val id: String,
    // location could also be an "operational point reference", but this variant isn't used in core
    val location: TrackOffset,
)

data class TrackOffset(val track: String, val offset: Offset<TrackSection>)

data class ScheduleItem(
    val at: String,
    val arrival: TimeDelta,
    @Json(name = "stop_for") val stopFor: TimeDelta?,
    @Json(name = "reception_signal") val receptionSignal: RJSTrainStop.RJSReceptionSignal,
)
