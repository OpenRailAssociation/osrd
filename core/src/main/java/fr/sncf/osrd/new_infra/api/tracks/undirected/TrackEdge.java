package fr.sncf.osrd.new_infra.api.tracks.undirected;

import com.google.common.collect.ImmutableList;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.utils.DoubleRangeMap;
import java.util.EnumMap;

/** An undirected track edge, which can either be a branch of a switch, or a track section */
public sealed interface TrackEdge permits SwitchBranch, TrackSection {
    /** The physical length of the edge, in meters */
    double getLength();

    /** List of detectors on the track */
    ImmutableList<Detector> getDetectors();

    /** List of gradients on the track for a given direction (corrected with curves) */
    EnumMap<Direction, DoubleRangeMap> getGradients();

    /** List of speed sections on the track for a given direction */
    EnumMap<Direction, DoubleRangeMap> getSpeedSections();

    /** Global unique index starting at 0, used for union finds */
    int getIndex();
}
