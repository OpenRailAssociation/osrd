package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.new_infra.api.tracks.undirected.SwitchBranch;
import fr.sncf.osrd.utils.attrs.MutableAttrMap;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class SwitchBranchImpl implements SwitchBranch {

    public Switch switchRef;
    private final MutableAttrMap<Object> attrs = new MutableAttrMap<>();

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("switchRef", switchRef.getID())
                .add("attrs", attrs)
                .toString();
    }

    @Override
    public Switch getSwitch() {
        return switchRef;
    }

    @Override
    public MutableAttrMap<Object> getAttrs() {
        return attrs;
    }
}
