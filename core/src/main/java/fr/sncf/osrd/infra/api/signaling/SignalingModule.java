package fr.sncf.osrd.infra.api.signaling;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;

public interface SignalingModule {
    /** Returns a list of supported signal types */
    Iterable<SignalType<?, ?>> getSupportedTypes();

    /** Turns a railjson signal into a signal */
    Signal<?> parseSignal(ReservationInfra infra, RJSSignal signal);

    ImmutableMap<ReservationRoute, SignalingRoute> createRoutes(
            ReservationInfra infra,
            ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> signalMap
    );
}
