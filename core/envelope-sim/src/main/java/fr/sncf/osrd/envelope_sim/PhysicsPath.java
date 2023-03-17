package fr.sncf.osrd.envelope_sim;

public interface PhysicsPath {
    /** The length of the path, in meters */
    double getLength();

    /** The average slope on a given range, in meters per kilometers */
    double getAverageGrade(double begin, double end);
}
