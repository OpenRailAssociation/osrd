package fr.sncf.osrd.api.stdcm;

import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.train.RollingStock;

public final class STDCMConfig {
    public final RollingStock rollingStock;
    public final double startTime;
    public final double endTime;
    public final double maxTime;
    public final double safetyDistance;

    public final Signal<?> startBlockEntrySig;
    public final Signal<?> startBlockExitSig;
    public final Signal<?> endBlockEntrySig;
    public final Signal<?> endBlockExitSig;


    // TODO: figure out where this stuff should go
    // String Lh = "23:59:59"; //Last hour
    // double Cm = 1; //"01:00:00"; // Chevauchement mini
    // double Tm = 0; //"03:00:00"; // Temps mini par canton
    // int lim = 8600;

    /** A self-contained STDCM input configuration */
    public STDCMConfig(
            RollingStock rollingStock,
            double startTime,
            double endTime,
            double maxTime, double safetyDistance,
            Signal<?> startBlockEntrySig, Signal<?> startBlockExitSig,
            Signal<?> endBlockEntrySig, Signal<?> endBlockExitSig
    ) {
        this.rollingStock = rollingStock;
        this.startTime = startTime;
        this.endTime = endTime;
        this.maxTime = maxTime;
        this.safetyDistance = safetyDistance;
        this.startBlockEntrySig = startBlockEntrySig;
        this.startBlockExitSig = startBlockExitSig;
        this.endBlockEntrySig = endBlockEntrySig;
        this.endBlockExitSig = endBlockExitSig;
    }
}
