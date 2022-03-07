package fr.sncf.osrd.new_infra.api.tracks.undirected;

public non-sealed interface SwitchPort extends TrackNode {
    /** Returns port identifier, which is unique per switch only */
    String getID();

    /** Returns the switch this port is associated to */
    Switch getSwitch();
}
