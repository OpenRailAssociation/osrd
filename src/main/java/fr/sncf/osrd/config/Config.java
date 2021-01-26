package fr.sncf.osrd.config;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.timetable.Schedule;

@SuppressFBWarnings(value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class Config {
    public final float simulationTimeStep;
    public final Infra infra;
    public final Schedule schedule;
    public final double simulationStepPause;
    public final boolean showViewer;
    public final boolean realTimeViewer;
    public final boolean changeReplayCheck;

    /**
     * Creates a new configuration
     * @param simulationTimeStep the simulation time step
     * @param infra the infrastructure to simulate on
     * @param schedule the schedule to run trains from
     * @param simulationStepPause the time to wait between simulation steps
     * @param showViewer whether to show the gui viewer
     * @param realTimeViewer whether the viewer should interpolate the train's movement to be realtime
     * @param changeReplayCheck whether to check for replay errors
     */
    public Config(
            float simulationTimeStep,
            Infra infra,
            Schedule schedule,
            double simulationStepPause,
            boolean showViewer,
            boolean realTimeViewer,
            boolean changeReplayCheck
    ) {
        this.simulationTimeStep = simulationTimeStep;
        this.infra = infra;
        this.schedule = schedule;
        this.simulationStepPause = simulationStepPause;
        this.showViewer = showViewer;
        this.realTimeViewer = realTimeViewer;
        this.changeReplayCheck = changeReplayCheck;
    }
}
