package fr.sncf.osrd.api.etcs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.api.standalone_sim.*
import fr.sncf.osrd.path.interfaces.JsonTrainPath
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.utils.json.UnitAdapterFactory

data class ETCSBrakingCurvesRequest(
    val infra: String,
    @Json(name = "expected_version") val expectedVersion: Int?,

    // Rolling stock
    @Json(name = "physics_consist") val physicsConsist: PhysicsConsistModel,
    val comfort: Comfort,

    // Simulation inputs
    val path: JsonTrainPath,
    val schedule: List<SimulationScheduleItem>,
    @Json(name = "power_restrictions") val powerRestrictions: List<SimulationPowerRestrictionItem>,
    @Json(name = "electrical_profile_set_id") val electricalProfileSetId: String?,
    @Json(name = "use_electrical_profiles") val useElectricalProfiles: Boolean,
    val mrsp: RangeValues<SpeedLimitProperty>,
)

val etcsBrakingCurvesRequestAdapter: JsonAdapter<ETCSBrakingCurvesRequest> =
    Moshi.Builder()
        .add(polymorphicSpeedLimitSourceAdapter)
        .add(RJSRollingResistance.adapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(ETCSBrakingCurvesRequest::class.java)
