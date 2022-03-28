package fr.sncf.osrd.standalone_sim.result;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class ResultSpeed {
    public final double time;
    public final double position;
    public final double speed;

    /** A space time sample */
    public ResultSpeed(double time, double speed, double position) {
        this.time = time;
        this.speed = speed;
        this.position = position;
    }
}