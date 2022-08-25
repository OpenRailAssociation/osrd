package fr.sncf.osrd.envelope_sim_infra.ertms.etcs;

public class NationalDefaultData {

    private NationalDefaultData() {
        // No need to instantiate the class
    }

    /** National Value Available Adhesion */
    public static final double mNvavadh = 0;

    /** Emergency Brake Confidence Level */
    public static final double mNvebcl = 1 - 1E-9;

    /** Permission to inhibit the compensation of the speed measurement accuracy */
    public static final boolean qNvinhsmicperm = false;

}
