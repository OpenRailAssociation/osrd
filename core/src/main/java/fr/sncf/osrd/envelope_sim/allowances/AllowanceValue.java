package fr.sncf.osrd.envelope_sim.allowances;

public abstract class AllowanceValue {
    /** Returns the allowance, given the total time and distance of the trip */
    public abstract double getAllowanceTime(double baseTime, double distance);

    /** Returns the allowance for a part of a trip, divided over time */
    public final double getPartialAllowanceTime(double sectionTime, double totalTime, double totalDistance) {
        var totalAllowance = getAllowanceTime(totalTime, totalDistance);
        var ratio = sectionTime / totalTime;
        return totalAllowance * ratio;
    }

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
    }
}
