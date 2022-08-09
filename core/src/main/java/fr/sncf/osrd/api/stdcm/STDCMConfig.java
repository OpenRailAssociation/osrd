package fr.sncf.osrd.api.stdcm;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import java.util.Set;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class STDCMConfig {
    public final RollingStock rollingStock;
    public final double startTime;
    public final double endTime;
    public final double safetyDistance;

    public final Set<SignalingRoute> startSignalingRoutes;
    public final Set<SignalingRoute> endSignalingRoutes;


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
            double safetyDistance,
            Set<SignalingRoute> startSignalingRoutes,
            Set<SignalingRoute> endSignalingRoutes
    ) {
        this.rollingStock = rollingStock;
        this.startTime = startTime;
        this.endTime = endTime;
        this.safetyDistance = safetyDistance;
        this.startSignalingRoutes = startSignalingRoutes;
        this.endSignalingRoutes = endSignalingRoutes;
    }
}
