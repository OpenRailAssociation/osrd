package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;

import static fr.sncf.osrd.envelope_sim.Utils.clamp;
import static fr.sncf.osrd.envelope_sim.power.EnergySourceType.CATENARY;
import static fr.sncf.osrd.envelope_sim.power.EnergySourceType.POWER_PACK;

/** Base I/O of our EMR model */
public class EnergySource{

    /** Floor power limit */
    public double pMin;

    /** Ceiling power limit */
    public double pMax;

    /** The energy storage if this EnergySource has a limited quantity of energy.
     * If not, null */
    public EnergyStorage storage;

    /** If this EnergySource has power conversion and/or need to account for power losses.
     * If not, null */
    public PowerConverter converter;

    /** If this EnergySource output power is dependent on the speed of the train.
     * If not, null */
    public SpeedDependantPowerCoefficient speedCoef;

    public EnergySourceType type;

    public EnergySource(double pMin,
                        double pMax,
                        SpeedDependantPowerCoefficient speedCoef,
                        EnergySourceType type
    ) {
        this.pMin = pMin;
        this.pMax = pMax;
        this.storage = null;
        this.converter = null;
        this.speedCoef = speedCoef;
        this.type = type;
    }
    public EnergySource(double pMin,
                        double pMax,
                        EnergyStorage storage,
                        PowerConverter converter,
                        EnergySourceType type
    ) {
        this.pMin = pMin;
        this.pMax = pMax;
        this.storage = storage;
        this.converter = converter;
        this.type = type;
    }

    public EnergySource(double pMin, double pMax,
                        EnergyStorage storage,
                        PowerConverter converter,
                        SpeedDependantPowerCoefficient speedCoef,
                        EnergySourceType type
    ) {
        this.pMin = pMin;
        this.pMax = pMax;
        this.storage = storage;
        this.converter = converter;
        this.speedCoef = speedCoef;
        this.type = type;
    }

    public static EnergySource newPowerPackDiesel() {
        double pMinDiesel;
        double pMaxDiesel;
        var storage = new EnergyStorage();
        var powerConverter = new PowerConverter();
        return EnergySource(pMinDiesel, pMaxDiesel, storage, powerConverter, POWER_PACK);
    }

    public static EnergySource newCatenary() {
        double pMinCatenary;
        double pMaxCatenary;
        var powerConverter = new PowerConverter();
        var speedCoef = new SpeedDependantPowerCoefficient();
        return EnergySource(pMinCatenary, pMaxCatenary, null, powerConverter, speedCoef, CATENARY);
    }

    // METHODS :
    /** Return value restricted by EnergySource's Ceiling and Floor power limits : ES.pMin <= return <= ES.pMax*/
    public double clipToESPowerLimits(double power){
        return clamp(pMin,power,pMax);
    }

    /** Return available power based on contextual speed */
    public double getPower(double speed){
        double availablePower = pMax;
        // Not sure if we MUST test if Storage!=null && Storage.socDependency!=null
        if(storage!=null)
            availablePower *= storage.socDependency.getPowerCoefficientFromSoc(storage.getSoc());
        if(speedCoef!=null)
            availablePower *= speedCoef.getPowerCoefficientFromSpeed(speed);
        if(converter!=null) availablePower = converter.convert(availablePower);
        return clipToESPowerLimits(availablePower);
    }     // Clip could become a problem if any coef>1, need to find a work around or at least keep it in sight
}