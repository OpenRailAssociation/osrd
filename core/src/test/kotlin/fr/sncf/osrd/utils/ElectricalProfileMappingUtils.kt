package fr.sncf.osrd.utils

import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSTrackRange

fun getRjsElectricalProfileMapping_1(): RJSElectricalProfileSet {
    return RJSElectricalProfileSet(
        listOf(
            RJSElectricalProfileSet.RJSElectricalProfile(
                "A",
                "1",
                listOf(RJSTrackRange("TA0", 0.0, 1_600.0), RJSTrackRange("TA0", 1_800.0, 2_000.0)),
            ),
            RJSElectricalProfileSet.RJSElectricalProfile(
                "B",
                "1",
                listOf(RJSTrackRange("TA0", 1_600.0, 1_800.0), RJSTrackRange("TA1", 0.0, 1_950.0)),
            ),
            RJSElectricalProfileSet.RJSElectricalProfile(
                "C",
                "2",
                listOf(RJSTrackRange("TA0", 0.0, 2_000.0)),
            ),
            RJSElectricalProfileSet.RJSElectricalProfile(
                "D",
                "2",
                listOf(RJSTrackRange("TA1", 0.0, 1_950.0)),
            ),
        )
    )
}

fun getRjsElectricalProfileMapping_2(): RJSElectricalProfileSet {
    return RJSElectricalProfileSet(
        listOf(
            RJSElectricalProfileSet.RJSElectricalProfile(
                "A",
                "1",
                listOf(
                    RJSTrackRange("TA0", 0.0, 1_600.0),
                    RJSTrackRange("TA1", 300.0, 1_950.0),
                    RJSTrackRange("TA2", 0.0, 250.0),
                ),
            ),
            RJSElectricalProfileSet.RJSElectricalProfile(
                "B",
                "1",
                listOf(
                    RJSTrackRange("TA0", 1_600.0, 2_000.0),
                    RJSTrackRange("TA1", 0.0, 300.0),
                    RJSTrackRange("TA2", 250.0, 1_950.0),
                ),
            ),
            RJSElectricalProfileSet.RJSElectricalProfile(
                "C",
                "2",
                listOf(
                    RJSTrackRange("TA0", 1_900.0, 2_000.0),
                    RJSTrackRange("TA1", 0.0, 200.0),
                    RJSTrackRange("TA2", 0.0, 1_950.0),
                ),
            ),
            RJSElectricalProfileSet.RJSElectricalProfile(
                "D",
                "2",
                listOf(RJSTrackRange("TA0", 0.0, 1_900.0), RJSTrackRange("TA1", 200.0, 1_950.0)),
            ),
        )
    )
}
