package fr.sncf.osrd.envelope_sim.allowances;

public abstract class AllowanceValue {
    /** Defines how the allowance is internally distributed when the trip is subdivided */
    public final AllowanceDistribution distribution;

    protected AllowanceValue(AllowanceDistribution distribution) {
        this.distribution = distribution;
    }

    /** Returns the allowance for a section of a trip, divided over time */
    public final double getSectionAllowanceTime(
            double sectionTime, double totalTime,
            double sectionDistance, double totalDistance
    ) {
        var ratio = distribution.getSectionRatio(sectionTime, totalTime, sectionDistance, totalDistance);
        var totalAllowance = getAllowanceTime(totalTime, totalDistance);
        return ratio * totalAllowance;
    }


    /** Returns the allowance, given the total time and distance of the trip */
    public abstract double getAllowanceTime(double baseTime, double distance);


    /** A fixed time allowance */
    public static class FixedTime extends AllowanceValue {
        public double time;

        public FixedTime(AllowanceDistribution distribution, double time) {
            super(distribution);
            this.time = time;
        }

        @Override
        public double getAllowanceTime(double baseTime, double distance) {
            return time;
        }
    }

    /** An added percentage of total time */
    public static class Percentage extends AllowanceValue {
        public double percentage;

        public Percentage(AllowanceDistribution distribution, double percentage) {
            super(distribution);
            this.percentage = percentage;
        }

        @Override
        public double getAllowanceTime(double baseTime, double distance) {
            assert percentage >= 0;
            return baseTime * (percentage / 100);
        }
    }

    /** Added time in minutes per 100 km */
    public static class TimePerDistance extends AllowanceValue {
        public double timePerDistance;

        public TimePerDistance(AllowanceDistribution distribution, double timePerDistance) {
            super(distribution);
            this.timePerDistance = timePerDistance;
        }

        @Override
        public double getAllowanceTime(double baseTime, double distance) {
            var n = distance / 100000; // number of portions of 100km in the train journey
            return timePerDistance * n * 60;
        }
    }
}
