package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.Map;

import java.util.ArrayList;
import java.util.Arrays;

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

    //********************** 2D point and generic interpolation function ****************************
    record CurvePoint(double x, double y) { }    // position of a point in a 2D space (x, y)

    /** Get interpolated Y=f(X) from a given real X*/
    static double getInterpolatedY(double realX, CurvePoint[] curvePointArray) {
        int index = 0;
        int left = 0;
        int right = curvePointArray.length - 1;
        while (left <= right) {
            // this line is to calculate the mean of the two values
            int mid = (left + right) >>> 1;
            if (Math.abs(curvePointArray[mid].x - Math.abs(realX)) < 0.000001) {
                index = mid;
                break;
            } else if (curvePointArray[mid].x < Math.abs(realX)) {
                left = mid + 1;
                index = left;
            } else {
                right = mid - 1;
            }
        }
        if (index == 0) {
            return curvePointArray[0].y();
        }
        if (index == curvePointArray.length) {
            return curvePointArray[index - 1].y();
        }
        CurvePoint previousPoint = curvePointArray[index - 1];
        CurvePoint nextPoint = curvePointArray[index];
        double coeff =
                (previousPoint.y() - nextPoint.y()) / (previousPoint.x() - nextPoint.x());
        return previousPoint.y() + coeff * (Math.abs(realX) - previousPoint.x());
    }
    //***************************** CHANTIER QUALESI SIM PARAMETERS *********************************
    public static class SpeedDependantPowerCoefficient{
        // x:speed values , y:associated dimensionless powerCoefficient which modulate output power
        CurvePoint[] curve;

        public SpeedDependantPowerCoefficient(CurvePoint[] curve) {
            this.curve = curve;
        }

        double getPowerCoefficientFromSpeed(double speed){
            return getInterpolatedY(speed,this.curve);
        }
    }

    public static class SocDependantPowerCoefficient{
        // x:speed values , y:associated dimensionless powerCoefficient which modulate output power
        CurvePoint[] curve;

        public SocDependantPowerCoefficient(CurvePoint[] curve) {
            this.curve = curve;
        }

        double getPowerCoefficientFromSoc(double soc){
            return getInterpolatedY(soc,this.curve);
        }
    }

    public static class PowerConverter {
        double efficiency;
        public PowerConverter(double efficiency){
            this.efficiency = efficiency;
        }
    }

    public static class RefillLaw {
        double tauRech = 0.45 ;     //Time constant of the refill behavior https://en.wikipedia.org/wiki/Time_constant
        //5 Tau => 99%·socRef
        double socRef = 0.85;   //Set-point of State of charge https://en.wikipedia.org/wiki/Setpoint_(control_system)
        double Kp = 1000/tauRech;   //Kp = capacity/tauRech  <=> = Joule·Second^-1 = Watt

        public RefillLaw() {}
        public RefillLaw(double tauRech, double socRef, double EnergyStorageCapacity) {
            this.tauRech = tauRech;
            this.socRef = socRef;
            this.Kp = EnergyStorageCapacity/tauRech;    // Kp = Joule·Second^-1 = Watt
        }
        public double getRefillPower(double soc){
            return (socRef-soc)*Kp; //refill power >0 when soc<=socRef
        }
    }

    public static class ManagementSystem{
        double overchargeThreshold;          //overcharge limit
        double underchargeThreshold;         //undercharge limit

        public ManagementSystem(double overchargeThreshold, double underchargeThreshold) {
            this.overchargeThreshold = overchargeThreshold;
            this.underchargeThreshold = underchargeThreshold;
        }
    }

    public static class EnergyStorage{
        double capacity;//How much energy you can store (in Joules or Watts·Seconds)
        double soc;//The State of Charge of your EnergyStorage, soc·capacity = actual stock of energy
        RefillLaw refillLaw;
        ManagementSystem management;
        SocDependantPowerCoefficient socDependency;

        public EnergyStorage(
                double capacity, double soc, RefillLaw refillLaw,
                ManagementSystem management, SocDependantPowerCoefficient socDependency
        ) {
            this.capacity = capacity;
            this.soc = soc;
            this.refillLaw = refillLaw;
            this.management = management;
            this.socDependency = socDependency;
        }
        public void updateStateOfCharge(double energy){
            soc += energy/capacity;
        }
    }

    public static class EnergySource{
        double pMin;           // Negative power limit
        double pMax;           // Positive power limit
        EnergyStorage Storage;          // If your EnergySource have a limited quantity of energy
        PowerConverter Converter;  // If your EnergySource has power conversion and/or need to account for power losses
        SpeedDependantPowerCoefficient speedCoef;
        // If your EnergySource output power is dependent on speed of the train

        public EnergySource(double pMin, double pMax, SpeedDependantPowerCoefficient speedCoef) {
            this.pMin = pMin;
            this.pMax = pMax;
            this.speedCoef = speedCoef;
        }
        public EnergySource(double pMin, double pMax, EnergyStorage storage, PowerConverter converter) {
            this.pMin = pMin;
            this.pMax = pMax;
            this.Storage = storage;
            this.Converter = converter;
        }

        public EnergySource(double pMin, double pMax,
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
        public double getPower(double speed){ //return available power depending on context (speed for now)
            double availablePower = pMax;
            if(Storage!=null && Storage.socDependency!=null)
                availablePower *= Storage.socDependency.getPowerCoefficientFromSoc(.45/**/);
            if(Converter!=null) availablePower *= Converter.efficiency;
            if(speedCoef!=null) availablePower *= speedCoef.getPowerCoefficientFromSpeed(speed);
            return availablePower;
        }
    }


    // INSTANTIATING PANTOGRAPH AND BATTERY ENERGY SOURCE -------------------------------------------------------------
    public static ArrayList<EnergySource> getEnergySources() {
        ArrayList<EnergySource> EnergySourceArray = new ArrayList<>(); // Create an ArrayList object

        // PANTOGRAPH
        CurvePoint[] curveLowValueOnLowSpeed = {
                new CurvePoint(0.0,0.0),
                new CurvePoint(10.0,0.0),
                new CurvePoint(20.0,1.0),
                new CurvePoint(3000.0,1.0)
        };

        EnergySource pantograph = new EnergySource(
                400.,
                500.,
                new SpeedDependantPowerCoefficient(curveLowValueOnLowSpeed)
        );


        // BATTERY
        CurvePoint[] curveHigherValueOnHighSpeed = {
                new CurvePoint(0.0,0.1),
                new CurvePoint(10.0,0.1),
                new CurvePoint(20.0,1.0),
                new CurvePoint(110.0,1.0),
                new CurvePoint(120.0,1.5),
                new CurvePoint(3000.0,1.5)
        };

        EnergySource battery = new EnergySource(
                400.,
                500.,
                new EnergyStorage(
                        150*3.6E6, 0.8,         // kWh to J : x3.6E6
                        new RefillLaw(),
                        new ManagementSystem(0.9,0.2),  // to be used later
                        new SocDependantPowerCoefficient(curveHigherValueOnHighSpeed)
                        ),
                new PowerConverter(0.56)
        );

        EnergySourceArray.add(pantograph);
        EnergySourceArray.add(battery);
        return EnergySourceArray;
    }

    //***************************** CHANTIER QUALESI SIM PARAMETERS *********************************
}
