package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import fr.sncf.osrd.new_infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.new_infra.api.tracks.undirected.SwitchBranch;
import fr.sncf.osrd.new_infra.implementation.BaseAttributes;

public class SwitchBranchImpl extends BaseAttributes implements SwitchBranch {

    public Switch switchRef;

    @Override
    public Switch getSwitch() {
        return switchRef;
    }
}
