package fr.sncf.osrd.infra.parsing.railjson.schema;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

/** The train detectors reference the TVD sections they're part of. */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class TVDSection implements Identified {
    public final String id;

    @Json(name = "is_berthing_track")
    public final boolean isBerthingTrack;

    public TVDSection(String id, boolean isBerthingTrack) {
        this.id = id;
        this.isBerthingTrack = isBerthingTrack;
    }

    @Override
    public String getID() {
        return id;
    }
}
