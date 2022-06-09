package fr.sncf.osrd.envelope_sim.allowances.utils;

public abstract class AllowanceValue {

    /** Returns the allowance for a section of a trip, divided over time */
    public final double getSectionAllowanceTime(
            double sectionTime, double totalTime,
            double sectionDistance, double totalDistance
    ) {
        var ratio = getSectionRatio(sectionTime, totalTime, sectionDistance, totalDistance);
        var totalAllowance = getAllowanceTime(totalTime, totalDistance);
        return ratio * totalAllowance;
    }


    /** Returns the allowance, given the total time and distance of the trip */
    public abstract double getAllowanceTime(double baseTime, double distance);

    /** Returns the allowance, given the total time and distance of the trip */
    public abstract double getAllowanceRatio(double baseTime, double distance);

    /** Returns the share of the total allowance a given section gets */
    public abstract double getSectionRatio(double sectionTime,
                                           double totalTime,
                                           double sectionDistance,
                                           double totalDistance);


    /** A fixed time allowance */
    public static class FixedTime extends AllowanceValue {
        public double time;

        public FixedTime(double time) {
            this.time = time;
        }

        @Override
        public double getAllowanceTime(double baseTime, double distance) {
            return time;
        }

        @Override
        public double getAllowanceRatio(double baseTime, double distance) {
            return time / baseTime;
        }

        @Override
        public double getSectionRatio(double sectionTime, double totalTime, double sectionDistance, double totalDistance) {
            return sectionTime / totalTime;
        }
    }

    /** An added percentage of total time */
    public static class Percentage extends AllowanceValue {
        public double percentage;

        public Percentage(double percentage) {
            this.percentage = percentage;
        }

        @Override
        public double getAllowanceTime(double baseTime, double distance) {
            assert percentage >= 0;
            return baseTime * (percentage / 100);
        }

        @Override
        public double getAllowanceRatio(double baseTime, double distance) {
            return percentage / 100;
        }

        @Override
        public double getSectionRatio(double sectionTime, double totalTime, double sectionDistance, double totalDistance) {
            return sectionTime / totalTime;
        }
    }

    /** Added time in minutes per 100 km */
    public static class TimePerDistance extends AllowanceValue {
        public double timePerDistance;

        public TimePerDistance(double timePerDistance) {
            this.timePerDistance = timePerDistance;
        }

        @Override
        public double getAllowanceTime(double baseTime, double distance) {
            var n = distance / 100000; // number of portions of 100km in the train journey
            return timePerDistance * n * 60;
        }

        @Override
        public double getAllowanceRatio(double baseTime, double distance) {
            return getAllowanceTime(baseTime, distance) / baseTime;
        }

        @Override
        public double getSectionRatio(double sectionTime, double totalTime, double sectionDistance, double totalDistance) {
            return sectionDistance / totalDistance;
        }
    }
}
