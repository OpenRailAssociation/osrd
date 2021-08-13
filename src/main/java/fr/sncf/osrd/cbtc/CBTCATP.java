package fr.sncf.osrd.cbtc;

import java.util.ArrayList;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.train.TrainState;

/**
 * Class dedicated to the calculation of speed constraints related to the CBTC. 
 */
public class CBTCATP {
    private Simulation sim;
    private TrainSchedule trainSchedule;
    private TrainState trainState;

    /**
     * Create a new ATP object
     * @param sim the current simumation
     * @param trainSchedule the schedule of the train
     * @param trainState the state of the train
     */
    public CBTCATP(Simulation sim, TrainSchedule trainSchedule, TrainState trainState) {
        this.trainSchedule = trainSchedule;
        this.trainState = trainState;
        this.sim = sim;
    }

    public ArrayList<SpeedController> directive() {
        return new ArrayList<SpeedController>(); 
    }
}