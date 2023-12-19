package fr.sncf.osrd.external_generated_inputs;

import static java.util.Arrays.asList;
import static java.util.Collections.singletonList;

import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSTrackRange;

public class ExternalGeneratedInputsHelpers {
    /**
     * Return a short list of electrical profiles
     */
    public static RJSElectricalProfileSet getRjsElectricalProfileSet() {
        return new RJSElectricalProfileSet(asList(new RJSElectricalProfileSet.RJSElectricalProfile("25000V", "1",
                        asList(new RJSTrackRange("track", 0, 10), new RJSTrackRange("track", 90, 100))),
                new RJSElectricalProfileSet.RJSElectricalProfile("22500V", "1",
                        asList(new RJSTrackRange("track", 10, 30), new RJSTrackRange("track", 70, 90))),
                new RJSElectricalProfileSet.RJSElectricalProfile("20000V", "1",
                        singletonList(new RJSTrackRange("track", 30, 70)))));
    }
}
