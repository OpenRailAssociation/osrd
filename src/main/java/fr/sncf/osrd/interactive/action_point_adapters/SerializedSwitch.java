package fr.sncf.osrd.interactive.action_point_adapters;

import fr.sncf.osrd.train.phases.NavigatePhase;

public final class SerializedSwitch extends SerializedActionPoint {
    public SerializedSwitch(NavigatePhase.SwitchActionPoint switchActionPoint) {
        super(switchActionPoint.switchId);
    }
}
