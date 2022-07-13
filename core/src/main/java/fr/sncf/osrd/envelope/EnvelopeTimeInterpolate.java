package fr.sncf.osrd.envelope;

public interface EnvelopeTimeInterpolate {

    /** Computes the time required to get to a given point of the envelope */
    double interpolateTotalTime(double position);

    /** Returns the end position of the envelope */
    double getEndPos();
}
