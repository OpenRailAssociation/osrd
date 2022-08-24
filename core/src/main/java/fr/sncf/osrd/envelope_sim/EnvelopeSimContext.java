package fr.sncf.osrd.envelope_sim;

public class EnvelopeSimContext {

    public enum UseCase {
        TIMETABLE,
        RUNNING_TIME,
        ETCS_EBD,
        ETCS_SBD,
        ETCS_GUI
    }

    public final PhysicsRollingStock rollingStock;
    public final PhysicsPath path;
    public final double timeStep;

    public final UseCase useCase;

    /** Creates a context suitable to run simulations on envelopes */
    public EnvelopeSimContext(PhysicsRollingStock rollingStock, PhysicsPath path, double timeStep) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.timeStep = timeStep;
        this.useCase = UseCase.TIMETABLE;
    }

    /** Creates a context suitable to run a specific ETCS braking curve envelopePart */
    public EnvelopeSimContext(PhysicsRollingStock rollingStock, PhysicsPath path, double timeStep, UseCase useCase) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.timeStep = timeStep;
        this.useCase = useCase;
    }
}
