package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSBufferStop;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import java.util.Collection;

/** The train detectors reference the TVDSection sections they're part of. */
@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSTVDSection implements Identified {
    public String id;

    /** If a train can turn around when it is in this section */
    @Json(name = "is_berthing_track")
    public boolean isBerthingTrack;

    /** List of train detectors in the tvd section */
    @Json(name = "detectors")
    public Collection<RJSObjectRef<RJSTrainDetector>> trainDetectors;

    /** List of buffer stops in the tvd section */
    @Json(name = "buffer_stops")
    public Collection<RJSObjectRef<RJSBufferStop>> bufferStops;

    @Override
    public String getID() {
        return id;
    }
}
