package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSBufferStop;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;

/** The train detectors reference the TVDSection sections they're part of. */
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

    /**
     * Create a serialized tvd section
     * @param isBerthingTrack is the train allow to turn around in the section
     * @param bufferStops buffer stops in the section
     * @param trainDetectors train detectors in the section
     */
    public RJSTVDSection(String id, boolean isBerthingTrack, HashSet<RJSObjectRef<RJSTrainDetector>> trainDetectors,
                         ArrayList<RJSObjectRef<RJSBufferStop>> bufferStops) {
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
