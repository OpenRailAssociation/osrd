package fr.sncf.osrd.infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchPort;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

@ExcludeFromGeneratedCodeCoverage
public class SwitchPortImpl implements SwitchPort {
    private final String id;
    public Switch switchRef;

    public SwitchPortImpl(String id) {
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }

    @Override
    public Switch getSwitch() {
        return switchRef;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("id", id)
                .add("switchRef", switchRef.getID())
                .toString();
    }
}
