package fr.sncf.osrd.standalone_sim.result;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public record ResultStops(double time, double position, double duration) {
}