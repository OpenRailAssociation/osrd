package fr.sncf.osrd.envelope_sim_infra.ertms.etcs;

public class FixedValueData {

    private FixedValueData() {
        // No need to instantiate the class
    }

    public static final double dvEbiMin = 7.5; // km/h
    public static final double dvEbiMax = 15; // km/h
    public static final double vEbiMin = 110; // km/h
    public static final double vEbiMax = 210; // km/h
    public static final double dvSbiMin = 5.5; // km/h
    public static final double dvSbiMax = 10; // km/h
    public static final double vSbiMin = 110; // km/h
    public static final double vSbiMax = 210; // km/h
    public static final double dvWarningMin = 4; // km/h
    public static final double dvWarningMax = 5; // km/h
    public static final double vWarningMin = 110; // km/h
    public static final double vWarningMax = 140; // km/h
    public static final double tWarning = 2; // s
    public static final double tDriver = 4; // s
    public static final double t41 = 1; // s
    public static final double mRotatingMax = 15; // %
    public static final double mRotatingMin = 2; // %

    /**  */
    public static double vUra(double speed) {
        if (speed <= 30 / 3.6)
            return 2 / 3.6;
        // vUra(30km/h) = 2km/h & vUra(500km/h) = 12km/h with a linear interpolation in between
        // this gives the following equation : y = (x + 64) / 47, still in km/h
        else return ((speed + 64) / 47) / 3.6;
    }
}