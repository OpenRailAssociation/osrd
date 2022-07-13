package fr.sncf.osrd.envelope_sim.allowances.utils;

/** Defines how the allowance shall be distributed among subsections / stops */
public enum AllowanceDistribution {
    /** The allowance of a section is (total allowance) * (section duration) / (total duration) */
    TIME_RATIO,
    /** The allowance of a section is (total allowance) * (section distance) / (total distance) */
    DISTANCE_RATIO;

    /** Returns the share of the total allowance a given section gets */
    public double getSectionRatio(double sectionTime, double totalTime, double sectionDistance, double totalDistance) {
        switch (this) {
            case TIME_RATIO:
                return sectionTime / totalTime;
            case DISTANCE_RATIO:
                return sectionDistance / totalDistance;
        }

        throw new RuntimeException("unknown allowance distribution");
    }
}
