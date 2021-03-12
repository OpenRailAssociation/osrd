package fr.sncf.osrd.train.lifestages;


import fr.sncf.osrd.train.TrackSectionRange;

import java.util.function.Consumer;

public interface LifeStage {
    LifeStageState getState();

    void forEachPathSection(Consumer<TrackSectionRange> consumer);
}
