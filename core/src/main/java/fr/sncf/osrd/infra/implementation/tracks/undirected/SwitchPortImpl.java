package fr.sncf.osrd.infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchPort;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

@ExcludeFromGeneratedCodeCoverage
public class SwitchPortImpl implements SwitchPort {
    private final String id;
    private final String switchID; // This is a separate variable to report errors before the switch is instantiated
    public Switch switchRef;

    public SwitchPortImpl(String id, String switchID) {
        this.id = id;
        this.switchID = switchID;
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
                .add("switchID", switchID)
                .toString();
    }
}
