package fr.sncf.osrd.new_infra.api.tracks.undirected;

/** A branch connects two ports of the same switch */
public non-sealed interface SwitchBranch extends TrackEdge {
    /** Returns the switch this branch is associated to */
    Switch getSwitch();

    /** Returns the length of the switch branch. For a switch branch, it's always 0 */
    default double getLength() {
        return 0;
    }
}
