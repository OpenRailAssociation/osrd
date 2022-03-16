package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import fr.sncf.osrd.new_infra.api.tracks.undirected.*;
import fr.sncf.osrd.new_infra.implementation.BaseAttributes;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

@ExcludeFromGeneratedCodeCoverage
public class SwitchPortImpl extends BaseAttributes implements SwitchPort {
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
}
