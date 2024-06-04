package fr.sncf.osrd.envelope;

import java.util.List;

public interface EnvelopeTimeInterpolate {

    /** Computes the time required to get to a given point of the envelope */
    double interpolateArrivalAt(double position);

    /** Computes last time when the train is at a given point of the envelope (including stop duration if at stop) */
    double interpolateDepartureFrom(double position);

    /** Computes the time required to get to a given point of the envelope in microseconds */
    long interpolateArrivalAtUS(double position);

    /** Computes last time when the train is at a given point of the envelope (including stop duration if at stop) in microseconds */
    long interpolateDepartureFromUS(double position);

    /**
     * Computes the time required to get to a given point of the envelope, clamping the position to
     * [0, envelope length] first
     */
    double interpolateArrivalAtClamp(double position);

    /**
     * Computes last time when the train is at a given point of the envelope (including stop duration if at stop), clamping the position to [0, envelope length] first
     */
    double interpolateDepartureFromClamp(double position);

    /** Returns the start position of the envelope */
    double getBeginPos();

    /** Returns the end position of the envelope */
    double getEndPos();

    /** Returns the total time of the envelope */
    double getTotalTime();

    record EnvelopePoint(double time, double speed, double position) {}

    List<EnvelopePoint> iteratePoints();
}
