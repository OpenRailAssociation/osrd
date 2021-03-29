package fr.sncf.osrd.train.phases;


import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.TrackSectionLoc;

import java.util.function.Consumer;

public interface Phase {
    PhaseState getState();

    TrackSectionLoc getEndLocation();

    void forEachPathSection(Consumer<TrackSectionRange> consumer);
}
