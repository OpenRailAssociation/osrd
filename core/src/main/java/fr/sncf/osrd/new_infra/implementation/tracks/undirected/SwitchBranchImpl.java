package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.new_infra.api.tracks.undirected.SwitchBranch;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackObject;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class SwitchBranchImpl implements SwitchBranch {

    public Switch switchRef;
    int index;

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("switchRef", switchRef.getID())
                .toString();
    }

    @Override
    public Switch getSwitch() {
        return switchRef;
    }

    @Override
    public ImmutableList<TrackObject> getTrackObjects() {
        return ImmutableList.of();
    }

    @Override
    public int getIndex() {
        return index;
    }
}
