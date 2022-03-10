package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import fr.sncf.osrd.new_infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.new_infra.api.tracks.undirected.SwitchBranch;
import fr.sncf.osrd.new_infra.implementation.BaseAttributes;

public class InfraSwitchBranch extends BaseAttributes implements SwitchBranch {

    public Switch switchRef;
    private final double length;

    public InfraSwitchBranch(double length) {
        this.length = length;
    }

    @Override
    public Switch getSwitch() {
        return switchRef;
    }

    @Override
    public double getLength() {
        return length;
    }
}
