package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.Map;

import java.util.Arrays;
import java.util.TreeMap;

public class RJSRollingStock implements Identified {
    public static final JsonAdapter<RJSRollingStock> adapter = new Moshi
            .Builder()
            .add(RJSRollingResistance.adapter)
            .build()
            .adapter(RJSRollingStock.class);


    public static final transient String CURRENT_VERSION = "3.1";

    /** The version of the rolling stock format used */
    public String version = null;

    /** A unique train identifier */
    public String name = null;

    /**
     * <p>Engineers measured a number of effort curves for each rolling stock.
     * These are referenced from effort curve profiles.
     * Effort curves associate a speed to a traction force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves</p>
     * This match the default effort curve to take
     */
    @Json(name = "effort_curves")
    public RJSEffortCurves effortCurves;

    @Json(name="power_restrictions")
    public Map<String, String> powerRestrictions;

    /** The class of power usage of the train */
    @Json(name = "base_power_class")
    public String basePowerClass = null;

    /** the length of the train, in meters. */
    public double length = Double.NaN;

    /** The max speed of the train, in meters per seconds. */
    @Json(name = "max_speed")
    public double maxSpeed = Double.NaN;

    /**
     * The time the train takes to start up, in seconds.
     * During this time, the train's maximum acceleration is limited.
     */
    @Json(name = "startup_time")
    public double startUpTime = Double.NaN;

    /** The acceleration to apply during the startup state. */
    @Json(name = "startup_acceleration")
    public double startUpAcceleration = Double.NaN;

    /** The maximum acceleration when the train is in its regular operating mode. */
    @Json(name = "comfort_acceleration")
    public double comfortAcceleration = Double.NaN;

    /** The braking deceleration coefficient can be the max or constant (depends on type field). */
    public RJSGamma gamma = null;


    /**
     * Inertia coefficient.
     * The mass alone isn't sufficient to compute accelerations, as the wheels and internals
     * also need force to get spinning. This coefficient can be used to account for the difference.
     * It's without unit: effective mass = mass * inertia coefficient
     */
    @Json(name = "inertia_coefficient")
    public double inertiaCoefficient = Double.NaN;

    /** The list of equipments (protection systems, signaling equipment) the train is able to deal with */
    public String[] features = new String[0];

    /** The mass of the train */
    public double mass = Double.NaN;

    @Json(name = "rolling_resistance")
    public RJSRollingResistance rollingResistance = null;

    @Json(name = "loading_gauge")
    public RJSLoadingGaugeType loadingGauge = null;

    public enum GammaType {
        CONST,
        MAX
    }

    @SuppressFBWarnings("UWF_NULL_FIELD")
    public static final class RJSGamma {
        public double value = Double.NaN;
        public GammaType type = null;
    }

    @Override
    public String getID() {
        return name;
    }

    //***************************** CHANTIER QUALESI SIM PARAMETERS *********************************
    record CurvePoint(double x, double y) { }    // position of a point in a 2D space (x, y)
    public static class SpeedDependantPowerCoefficient{
        // x:speed values , y:associated dimensionless powerCoefficient which modulate output power
        CurvePoint[] curve = {
                new CurvePoint(0.0,0.0),
                new CurvePoint(10.0,0.0),
                new CurvePoint(20.0,1.0),
                new CurvePoint(3000.0,1.0)
        };
        public SpeedDependantPowerCoefficient(){        //Constructor
            System.out.printf(Arrays.toString(curve));  //So IntelliJ doesn't tell me curve's unused
        }
    }

    public static class SocDependantPowerCoefficient{
        // x:speed values , y:associated dimensionless powerCoefficient which modulate output power
        CurvePoint[] curve = {
                new CurvePoint(0.0,0.1),
                new CurvePoint(10.0,0.1),
                new CurvePoint(20.0,1.0),
                new CurvePoint(110.0,1.0),
                new CurvePoint(120.0,1.5),
                new CurvePoint(3000.0,1.5)
        };
        public SocDependantPowerCoefficient(){          //Constructor
            System.out.printf(Arrays.toString(curve));  //So IntelliJ doesn't tell me curve's unused
        }
    }

    public static class PowerConverter {
        Double efficiency = 0.001;

        public PowerConverter(){}
        public PowerConverter(Double efficiency){
            this.efficiency = efficiency;
        }
    }

    public static class RefillLaw {
        Double tauRech = 0.45 ;     //Time constant of the refill behavior https://en.wikipedia.org/wiki/Time_constant
        //5 Tau => 99%·socRef
        Double socRef = 0.85;   //Set-point of State of charge https://en.wikipedia.org/wiki/Setpoint_(control_system)

        public RefillLaw() {}
        public RefillLaw(Double tauRech, Double socRef) {
            this.tauRech = tauRech;
            this.socRef = socRef;
        }
    }

    public static class ManagementSystem{
        Double overchargeThreshold;          //overcharge limit
        Double underchargeThreshold;         //undercharge limit

        public ManagementSystem(Double overchargeThreshold, Double underchargeThreshold) {
            this.overchargeThreshold = overchargeThreshold;
            this.underchargeThreshold = underchargeThreshold;
        }
    }

    public static class EnergyStorage{
        Double capacity = 0.5;//How much energy you can store (in Joules or Watts·Seconds)
        Double soc = .5;//The State of Charge of your EnergyStorage, soc·capacity = actual stock of energy
        RefillLaw refillLaw = new RefillLaw();
        ManagementSystem management = new ManagementSystem(0.85, 0.2);
        SocDependantPowerCoefficient socDependency = new SocDependantPowerCoefficient();

        public EnergyStorage() {}
        public EnergyStorage(
                Double capacity, Double soc, RefillLaw refillLaw,
                ManagementSystem management, SocDependantPowerCoefficient socDependency
        ) {
            this.capacity = capacity;
            this.soc = soc;
            this.refillLaw = refillLaw;
            this.management = management;
            this.socDependency = socDependency;
        }
    }

    public static class EnergySource{
        Double pMin;           // Negative power limit
        Double pMax;           // Positive power limit
        EnergyStorage Storage;          // If your EnergySource have a limited quantity of energy
        PowerConverter Converter;  // If your EnergySource has power conversion and/or need to account for power losses
        SpeedDependantPowerCoefficient speedCoef;
        // If your EnergySource output power is dependent on speed of the train

        public EnergySource(Double pMin, Double pMax) {
            this.pMin = pMin;
            this.pMax = pMax;
        }
        public EnergySource(Double pMin, Double pMax, SpeedDependantPowerCoefficient speedCoef) {
            this.pMin = pMin;
            this.pMax = pMax;
            this.speedCoef = speedCoef;
        }
        public EnergySource(Double pMin, Double pMax, EnergyStorage storage, PowerConverter converter) {
            this.pMin = pMin;
            this.pMax = pMax;
            this.Storage = storage;
            this.Converter = converter;
        }

        public EnergySource(Double pMin, Double pMax,
                            EnergyStorage storage,
                            PowerConverter converter,
                            SpeedDependantPowerCoefficient speedCoef
        ) {
            this.pMin = pMin;
            this.pMax = pMax;
            this.Storage = storage;
            this.Converter = converter;
            this.speedCoef = speedCoef;
        }

        // Methods :
        public Double getPower(Double speed){ //return available power depending on context (speed for now)

            return pMax*2;
        }
    }

    // IDK if af an arrayList or a map is better to store EnergySource of the train
    // Instantiating a pantograph/catenary thingy and a test battery

    public static TreeMap<Integer, EnergySource> getEnergySources() {
        TreeMap<Integer, EnergySource> EnergySourceMap = new TreeMap<>(/*needs a sorting method ?*/);
        EnergySource pantograph = new EnergySource(
                400.,
                500.,
                new SpeedDependantPowerCoefficient()
        );
        EnergySource battery = new EnergySource(
                400.,
                500.,
                new EnergyStorage(),
                new PowerConverter(0.56)
        );

        EnergySourceMap.put(0, pantograph);
        EnergySourceMap.put(1, battery);
        return EnergySourceMap;
    }
/*
    static double interpolateValue(double abscissaValue, CurvePoint[] Curve) {
        // Finds the abscissaValue directly adjacent points on the x-axis
        int index = 0; int leftX = 0; int rightX = Curve.length - 1;

        int mid = (leftX + rightX)/2;
        while (Math.abs(Curve[mid].y - Math.abs(abscissaValue)) < 0.000001) {
            index = mid;
            if (Curve[mid].y < Math.abs(abscissaValue)) {
                leftX = mid + 1;
                index = leftX;
            }
            else {
                rightX = mid - 1;
            }
        }
        // Deals with edges of the
        if (index == 0) {
            return tractiveEffortCurve[0].maxEffort();
        }
        if (index == tractiveEffortCurve.length) {
            return tractiveEffortCurve[index - 1].maxEffort();
        }
        TractiveEffortPoint previousPoint = tractiveEffortCurve[index - 1];
        TractiveEffortPoint nextPoint = tractiveEffortCurve[index];
        double coeff =
                (previousPoint.maxEffort() - nextPoint.maxEffort()) / (previousPoint.speed() - nextPoint.speed());
        return previousPoint.maxEffort() + coeff * (Math.abs(abscissaValue) - previousPoint.speed());
    }*/

    //***************************** CHANTIER QUALESI SIM PARAMETERS *********************************
}
