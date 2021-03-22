package fr.sncf.osrd.railjson.simulation.schedule;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.railjson.common.ID;
import fr.sncf.osrd.railjson.common.RJSTrackLocation;
import fr.sncf.osrd.railjson.infra.RJSRoute;

/**
 * <p>A train phase corresponds to an operation during the lifetime of a scheduled train.
 * It could be a stop, a maneuver, or a navigation phase.</p>
 *
 * <p>The location of the train when entering a phase is known from the previous phase,
 * and the phase exit state is up to the phase.</p>
 */
public abstract class RJSTrainPhase {
    public static final PolymorphicJsonAdapterFactory<RJSTrainPhase> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSTrainPhase.class, "type")
                    .withSubtype(RJSTrainPhase.Navigate.class, "navigate")
                    .withSubtype(RJSTrainPhase.Stop.class, "stop")
    );

    public static final class Navigate extends RJSTrainPhase {
        /** The sequence of routes the train should take.
         * The train must be on the first route when it enters this phase. */
        public final ID<RJSRoute>[] routes;

        /** The location of the head of the train when it exits this phase */
        public final RJSTrackLocation endLocation;

        /** The distance at which the driver can see objects on the tracks */
        public final double driverSightDistance;

        /** Create a navigation phase */
        public Navigate(ID<RJSRoute>[] routes, RJSTrackLocation endLocation, double driverSightDistance) {
            this.routes = routes;
            this.endLocation = endLocation;
            this.driverSightDistance = driverSightDistance;
        }

        /** Create an uninitialized navigation phase */
        public Navigate() {
            this.routes = null;
            this.endLocation = null;
            this.driverSightDistance = Double.NaN;
        }
    }

    public static final class Stop extends RJSTrainPhase {
        /** The duration of the stop */
        public final double duration;

        public Stop(double duration) {
            this.duration = duration;
        }
    }
}
