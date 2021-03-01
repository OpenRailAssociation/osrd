package fr.sncf.osrd.infra.railjson.schema;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSBufferStop;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSTrainDetector;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;

/** The train detectors reference the TVDSection sections they're part of. */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSTVDSection implements Identified {
    public final String id;

    /** If a train can turn around when it is in this section */
    @Json(name = "is_berthing_track")
    public final boolean isBerthingTrack;

    /** List of train detectors in the tvd section */
    @Json(name = "train_detectors")
    public final Collection<ID<RJSTrainDetector>> trainDetectors;

    /** List of buffer stops in the tvd section */
    @Json(name = "buffer_stops")
    public final Collection<ID<RJSBufferStop>> bufferStops;

    /**
     * Create a serialized tvd section
     * @param isBerthingTrack is the train allow to turn around in the section
     * @param bufferStops buffer stops in the section
     * @param trainDetectors train detectors in the section
     */
    public RJSTVDSection(String id, boolean isBerthingTrack, HashSet<ID<RJSTrainDetector>> trainDetectors,
                         ArrayList<ID<RJSBufferStop>> bufferStops) {
        this.id = id;
        this.isBerthingTrack = isBerthingTrack;
        this.trainDetectors = trainDetectors;
        this.bufferStops = bufferStops;
    }

    @Override
    public String getID() {
        return id;
    }
}
