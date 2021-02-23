package fr.sncf.osrd.infra.parsing.railjson.schema.signaling;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.signaling.RJSSignalTemplate.ParameterRef;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects.RJSSignal;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSSignalCondition {
    public final PolymorphicJsonAdapterFactory<RJSSignalCondition> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSSignalCondition.class, "type")
                    .withSubtype(RJSSignalCondition.Signal.class, "signal_aspect")
    );

    public static final class Signal extends RJSSignalCondition {
        /** The signal the condition checks for */
        public final ParameterRef<RJSSignal> signal;

        /** The condition is true when the signal has the following aspect */
        public final ID<RJSAspect> hasAspect;

        Signal(
                ParameterRef<RJSSignal> signal,
                ID<RJSAspect> hasAspect
        ) {
            this.signal = signal;
            this.hasAspect = hasAspect;
        }
    }
}
