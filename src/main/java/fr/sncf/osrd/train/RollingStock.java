package fr.sncf.osrd.train;

import fr.sncf.osrd.util.StairSequence;
import fr.sncf.osrd.util.Indexable;

/**
 * The immutable characteristics of a specific train.
 * There must be a RollingStock instance per train on the network.
 */
public class RollingStock implements Indexable {
    /*
    These three coefficients are required for the train's physical simulation.

    https://www.sciencedirect.com/science/article/pii/S2210970616300415

    A = rollingResistance
    B = mechanicalResistance
    C = aerodynamicResistance

    R = (
        A
        + B * v
        + C * v^2
    )
    */

    public final double rollingResistance;
    public final double mechanicalResistance;
    public final double aerodynamicResistance;

    /** the length of the train, in meters. */
    public final double length;

    /** The max speed of the train, in meters per seconds. */
    public final double maxSpeed;

    /**
     * The time the train takes to start up, in seconds.
     * During this time, the train's maximum acceleration is limited.
     */
    public final double startUpTime;

    /** The acceleration to apply during the startup state. */
    public final double startUpAcceleration;

    /** The maximum acceleration when the train is in its regular operating mode. */
    public final double comfortAcceleration;

    /** The mass of the train, in metric tons. */
    public final double mass;

    /**
     * Inertia coefficient.
     * The mass alone isn't sufficient to compute accelerations, as the wheels and internals
     * also need force to get spinning. This coefficient can be used to account for the difference.
     * It's without unit.
     */
    public final double inertiaCoefficient;

    public final boolean isTVM300Equiped;
    public final boolean isTVM430Equiped;
    public final boolean isETCS1Equiped;
    public final boolean isETCS2Equiped;
    public final boolean isKVBEquiped;

    /**
     * Associates a speed to a force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves
     */
    public final StairSequence<Double> tractiveEffortCurve;

    /**
     * Creates a new train inventory item.
     * @param rollingResistance a rolling resistance coefficient
     * @param mechanicalResistance a mechanical resistance coefficient
     * @param aerodynamicResistance an aerodynamic resistance coefficient
     * @param length the length of the train, in meters
     * @param maxSpeed the max speed, in m/s
     * @param startUpTime the train startup time, in seconds
     * @param startUpAcceleration the maximum acceleration during startup, in m/s^2
     * @param comfortAcceleration the cruise maximum acceleration, in m/s^2
     * @param mass the mass of the train, in metric tons
     * @param inertiaCoefficient a special inertia coefficient
     * @param isTVM300Equiped whether the train has TVM300 hardware
     * @param isTVM430Equiped whether the train has TVM430 hardware
     * @param isETCS1Equiped whether the train has ETCS1 hardware
     * @param isETCS2Equiped whether the train has ETCS2 hardware
     * @param isKVBEquiped whether the train has KVB hardware
     * @param tractiveEffortCurve the tractive effort curve for the train
     */
    public RollingStock(
            double rollingResistance,
            double mechanicalResistance,
            double aerodynamicResistance,
            double length,
            double maxSpeed,
            double startUpTime,
            double startUpAcceleration,
            double comfortAcceleration,
            double mass,
            double inertiaCoefficient,
            boolean isTVM300Equiped,
            boolean isTVM430Equiped,
            boolean isETCS1Equiped,
            boolean isETCS2Equiped,
            boolean isKVBEquiped,
            StairSequence<Double> tractiveEffortCurve
    ) {
        this.rollingResistance = rollingResistance;
        this.mechanicalResistance = mechanicalResistance;
        this.aerodynamicResistance = aerodynamicResistance;
        this.length = length;
        this.maxSpeed = maxSpeed;
        this.startUpTime = startUpTime;
        this.startUpAcceleration = startUpAcceleration;
        this.comfortAcceleration = comfortAcceleration;
        this.mass = mass;
        this.inertiaCoefficient = inertiaCoefficient;
        this.isTVM300Equiped = isTVM300Equiped;
        this.isTVM430Equiped = isTVM430Equiped;
        this.isETCS1Equiped = isETCS1Equiped;
        this.isETCS2Equiped = isETCS2Equiped;
        this.isKVBEquiped = isKVBEquiped;
        this.tractiveEffortCurve = tractiveEffortCurve;
    }

    private int index = -1;

    @Override
    public void setIndex(int index) {
        assert this.index == -1;
        this.index = index;
    }

    @Override
    public int getIndex() {
        assert index != -1;
        return index;
    }
}
