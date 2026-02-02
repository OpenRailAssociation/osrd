package fr.sncf.osrd.standalone_sim.result;

public class ResultStops {
    public double time;
    public double position;
    public double duration;

    /** RestultStops constructor */
    public ResultStops(double time, double position, double duration) {
        this.time = time;
        this.position = position;
        this.duration = duration;
    }

    public ResultStops withAddedTime(double timeToAdd) {
        return new ResultStops(time + timeToAdd, position, duration);
    }
}
