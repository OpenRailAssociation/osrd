package fr.sncf.osrd.cbtc;

import java.util.ArrayList;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.train.TrainState;

/**
 * Class dedicated to the calculation of speed constraints related to the CBTC.
 * Calculates the movement authorithy (MA) of the train and a list of speedController related to these MA.
 * This class is for the moment a receptacle for a future implementation.
 * TODO : Implement CBTCATP
 */
public class CBTCATP {
    // TODO : remove the warnings suppression
    @SuppressFBWarnings("URF_UNREAD_FIELD")
    private final Simulation sim;
    @SuppressFBWarnings("URF_UNREAD_FIELD")
    private final TrainSchedule trainSchedule;
    @SuppressFBWarnings("URF_UNREAD_FIELD")
    private final TrainState trainState;

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

    /**
     * Computes the list of speedControllers related to the CBTC.
     */
    public ArrayList<SpeedController> directive() {
        return new ArrayList<SpeedController>(); 
    }
}