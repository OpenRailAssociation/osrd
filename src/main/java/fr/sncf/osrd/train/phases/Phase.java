package fr.sncf.osrd.train.phases;


import fr.sncf.osrd.train.TrackSectionRange;

import java.util.function.Consumer;

public interface Phase {
    PhaseState getState();

    void forEachPathSection(Consumer<TrackSectionRange> consumer);
}
