package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.List;

/**
 * Neutral sections are portions of track where trains aren't allowed to pull power from catenaries.
 * They have to rely on inertia to cross such sections.
 * In practice, neutral sections are delimited by signs. In OSRD, neutral sections are directional
 * to allow accounting for different sign placement depending on the direction.
 * For more details see <a href="https://osrd.fr/en/docs/explanation/neutral_sections/">the documentation</a>.
 */
@SuppressFBWarnings({ "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD" })
public class RJSNeutralSection {
    @Json(name = "track_ranges")
    public List<RJSDirectionalTrackRange> trackRanges;

    /** Whether trains need to lower their pantograph when entering this section */
    @Json(name = "lower_pantograph")
    public boolean lowerPantograph;
}
