package fr.sncf.osrd.envelope_sim.allowances;

public abstract class AllowanceValue {
    public abstract double getAllowanceTime(double baseTime, double totalDistance);

    /** A fixed time allowance */
    public static class FixedTime extends AllowanceValue {
        public double time;

        public FixedTime(double time) {
            this.time = time;
        }

        @Override
        public double getAllowanceTime(double baseTime, double totalDistance) {
            assert time >= 0;
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
        public double getAllowanceTime(double baseTime, double totalDistance) {
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
        public double getAllowanceTime(double baseTime, double totalDistance) {
            var n = totalDistance / 100000; // number of portions of 100km in the train journey
            return timePerDistance * n * 60;
        }
    }
}
