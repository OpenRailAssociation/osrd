package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.ApplicableDirections;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.Identified;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTVDSection;

public class RJSTrainDetector extends DirectionalRJSTrackObject implements Identified {
    public final String id;

    public RJSTrainDetector(String id, ApplicableDirections applicableDirections, double position) {
        super(applicableDirections, position);
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }
}
