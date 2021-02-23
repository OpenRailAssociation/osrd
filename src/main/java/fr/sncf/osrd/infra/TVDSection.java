package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.detectorgraph.TVDSectionPath;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.Identified;
import fr.sncf.osrd.infra.trackgraph.Detector;

import java.util.ArrayList;

public class TVDSection implements Identified {
    public final String id;
    public final ArrayList<ID<Detector>> detectors;
    public final ArrayList<TVDSectionPath> sections = new ArrayList<>();
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final boolean isBerthingTrack;

    /**
     * Instantiate a TVDSection.
     * Note: The list of TVDSectionPath will be automatically be filled building the infra.
     */
    public TVDSection(String id, ArrayList<ID<Detector>> detectors, boolean isBerthingTrack) {
        this.id = id;
        this.detectors = detectors;
        this.isBerthingTrack = isBerthingTrack;
    }

    @Override
    public String getID() {
        return id;
    }
}
