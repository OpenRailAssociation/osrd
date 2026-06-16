package fr.sncf.osrd.railjson.schema.infra.trackranges

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.Identified
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSign

/**
 * Neutral sections are portions of track where trains aren't allowed to pull power from
 * electrifications. They have to rely on inertia to cross such sections. In practice, neutral
 * sections are delimited by signs. In OSRD, neutral sections are directional to allow accounting
 * for different sign placement depending on the direction. For more details see
 * [the documentation](https://osrd.fr/en/docs/explanation/neutral_sections/).
 */
data class RJSNeutralSection(
    override val id: String,
    @Json(name = "announcement_track_ranges")
    val announcementTrackRanges: List<RJSDirectionalTrackRange>,
    @Json(name = "track_ranges") val trackRanges: List<RJSDirectionalTrackRange>,

    /** Whether trains need to lower their pantograph when entering this section */
    @Json(name = "lower_pantograph") val lowerPantograph: Boolean,
    val extensions: RJSNeutralSectionExtensions?,
) : Identified

data class RJSNeutralSectionExtensions(
    @Json(name = "neutral_sncf") val neutralSncf: RJSNeutralSectionNeutralSncfExtension?
)

data class RJSNeutralSectionNeutralSncfExtension(
    val announcement: List<RJSSign>,
    val exe: RJSSign,
    val end: List<RJSSign>,
    val rev: List<RJSSign>,
)
