package fr.sncf.osrd.sim_infra_adapter

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import fr.sncf.osrd.Helpers
import fr.sncf.osrd.envelope_sim.electrification.Electrification
import fr.sncf.osrd.envelope_sim.electrification.Electrified
import fr.sncf.osrd.envelope_sim.electrification.Neutral
import fr.sncf.osrd.envelope_sim.electrification.NonElectrified
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.kt_external_generated_inputs.ElectricalProfileMapping
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSApplicableDirectionsTrackRange
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSCatenary
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.getRjsElectricalProfileMapping_1
import fr.sncf.osrd.utils.getRjsElectricalProfileMapping_2
import fr.sncf.osrd.utils.pathFromTracks
import fr.sncf.osrd.utils.units.meters
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import java.util.stream.Stream

class EnvelopeTrainPathTest {

    @Test
    fun envelopeFromPathTestAverageGrades() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        for (track in rjsInfra.trackSections) {
            if (track.id.equals("TA0")) {
                track.slopes = listOf(
                    RJSSlope(0.0, 1_000.0, 5.0),
                    RJSSlope(1_000.0, 2_000.0, 15.0),
                )
            }
            if (track.id.equals("TA1")) {
                track.slopes = listOf(
                    RJSSlope(0.0, 1_000.0, 10.0),
                    RJSSlope(1_000.0, 1_950.0, 25.0),
                )
            }
        }

        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val path = pathFromTracks(infra.rawInfra, listOf("TA0", "TA1"), Direction.INCREASING, 500.meters, 3_500.meters)
        val envelopeSimPath = EnvelopeTrainPath.from(path)
        Assertions.assertEquals(5.0, envelopeSimPath.getAverageGrade(0.0, 500.0))
        Assertions.assertEquals(15.0, envelopeSimPath.getAverageGrade(500.0, 1500.0))
        Assertions.assertEquals(10.0, envelopeSimPath.getAverageGrade(1500.0, 2500.0))
        Assertions.assertEquals(25.0, envelopeSimPath.getAverageGrade(2500.0, 3000.0))
        Assertions.assertEquals(11.0, envelopeSimPath.getAverageGrade(0.0, 2500.0))
        Assertions.assertEquals(10.0, envelopeSimPath.getAverageGrade(300.0, 700.0))
    }

    @ParameterizedTest
    @MethodSource("electrificationMapArguments")
    fun envelopeFromPathTestElectrificationMap(
        tracks: List<String>,
        direction: Direction,
        expectedMap: ImmutableRangeMap<Double, Electrification>
    ) {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        rjsInfra.catenaries = listOf(
            RJSCatenary(
                "", listOf(
                    RJSApplicableDirectionsTrackRange("TA0", ApplicableDirection.BOTH, 0.0, 800.0),
                )
            ),
            RJSCatenary(
                "1500", listOf(
                    RJSApplicableDirectionsTrackRange("TA0", ApplicableDirection.BOTH, 800.0, 2_000.0),
                    RJSApplicableDirectionsTrackRange("TA1", ApplicableDirection.BOTH, 0.0, 1_000.0)
                )
            ),
            RJSCatenary(
                "25000", listOf(
                    RJSApplicableDirectionsTrackRange("TA1", ApplicableDirection.BOTH, 1_100.0, 1_950.0)
                )
            )
            //and there is already a deadSection on TA0 from 1900 to 1950 in the Direction.INCREASING
        )
        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val path = pathFromTracks(infra.rawInfra, tracks, direction, 500.meters, 3_600.meters)
        val envelopeSimPath = EnvelopeTrainPath.from(path)

        assertThat(envelopeSimPath.getElectrificationMap(null, null, null))
            .isEqualTo(expectedMap)
    }

    @Test
    fun envelopeFromPathTestElectrificationMapByPowerClassIncreasingDirection() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        rjsInfra.catenaries = listOf(
            RJSCatenary(
                "", listOf(
                    RJSApplicableDirectionsTrackRange("TA0", ApplicableDirection.BOTH, 0.0, 1500.0),
                )
            ),
            RJSCatenary(
                "1500", listOf(
                    RJSApplicableDirectionsTrackRange("TA0", ApplicableDirection.BOTH, 1500.0, 2_000.0),
                    RJSApplicableDirectionsTrackRange("TA1", ApplicableDirection.BOTH, 0.0, 500.0)
                )
            ),
            RJSCatenary(
                "25000", listOf(
                    RJSApplicableDirectionsTrackRange("TA1", ApplicableDirection.BOTH, 500.0, 1_950.0)
                )
            )
            //and there is already a deadSection on TA0 from 1900 to 1950 in the Direction.INCREASING
        )

        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val rjsElectricalProfiles = getRjsElectricalProfileMapping_1()
        val profileMap = ElectricalProfileMapping()
        profileMap.parseRJS(rjsElectricalProfiles)
        val path = pathFromTracks(infra.rawInfra, listOf("TA0", "TA1"), Direction.INCREASING, 1_000.meters, 3_500.meters)
        val envelopeSimPath = EnvelopeTrainPath.from(path, profileMap)
        val electrificationByPowerClass = envelopeSimPath.getElectrificationMap(
            "1",
            null,
            null
        )
        val expected = ImmutableRangeMap.Builder<Double, Electrification>()

        putInElectrificationMapByPowerClass(
            expected,
            0.0, 500.0, NonElectrified(), "A"
        )
        putInElectrificationMapByPowerClass(
            expected,
            500.0, 600.0, Electrified("1500"), "A"
        )
        putInElectrificationMapByPowerClass(
            expected,
            600.0, 800.0, Electrified("1500"), "B"
        )
        putInElectrificationMapByPowerClass(
            expected,
            800.0, 850.0, Electrified("1500"), "A"
        )
        putInElectrificationMapByPowerClass(
            expected,
            850.0, 960.0, Neutral(true, Electrified("1500"), true), "A"
        )
        putInElectrificationMapByPowerClass(
            expected,
            960.0, 1000.0, Neutral(true, Electrified("1500"), false), "A"
        )
        putInElectrificationMapByPowerClass(
            expected,
            1_000.0, 1_500.0, Electrified("1500"), "B"
        )
        putInElectrificationMapByPowerClass(
            expected,
            1_500.0, 2_500.0, Electrified("25000"), "B"
        )
        assertThat(electrificationByPowerClass).isEqualTo(expected.build())
    }

    @Test
    fun envelopeFromPathTestElectrificationMapByPowerClassDecreasingDirection() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        rjsInfra.catenaries = listOf(
            RJSCatenary(
                "1500",
                listOf(
                    RJSApplicableDirectionsTrackRange("TA0", ApplicableDirection.BOTH, 0.0, 2_000.0),
                    RJSApplicableDirectionsTrackRange("TA1", ApplicableDirection.BOTH, 0.0, 1_950.0),
                    RJSApplicableDirectionsTrackRange("TA2", ApplicableDirection.BOTH, 0.0, 1_950.0),
                ),
            ),
        )

        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val rjsElectricalProfiles = getRjsElectricalProfileMapping_2()
        val profileMap = ElectricalProfileMapping()
        profileMap.parseRJS(rjsElectricalProfiles)
        val path = pathFromTracks(infra.rawInfra, listOf("TA2", "TA1", "TA0"), Direction.DECREASING, 1_000.meters, 5_000.meters)
        val envelopeSimPath = EnvelopeTrainPath.from(path, profileMap)
        val electrificationPowerClass1 = envelopeSimPath.getElectrificationMap(
            "1", null, null
        )
        val expectedElectrificationPowerClass1 = ImmutableRangeMap.Builder<Double, Electrification>()
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            0.0, 700.0, Electrified("1500"), "B"
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            700.0, 2_600.0, Electrified("1500"), "A"
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            2_600.0, 3_300.0, Electrified("1500"), "B"
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            3_300.0, 4_000.0, Electrified("1500"), "A"
        )

        assertThat(electrificationPowerClass1).isEqualTo(expectedElectrificationPowerClass1.build())

        val electrificationPowerClass2 = envelopeSimPath.getElectrificationMap(
            "2", null, null
        )
        val expectedElectrificationPowerClass2 = ImmutableRangeMap.Builder<Double, Electrification>()
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            0.0, 950.0, Electrified("1500"), "C"
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            950.0, 2_700.0, Electrified("1500"), "D"
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            2_700.0, 3_000.0, Electrified("1500"), "C"
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            3_000.0, 4_000.0, Electrified("1500"), "D"
        )

        assertThat(electrificationPowerClass2).isEqualTo(expectedElectrificationPowerClass2.build())
    }

    companion object {
        @JvmStatic
        private fun electrificationMapArguments(): Stream<Arguments> {
            return Stream.of(
                Arguments.of(
                    listOf("TA0", "TA1"),
                    Direction.INCREASING,
                    ImmutableRangeMap.Builder<Double, Electrification>()
                        .put(Range.closedOpen(0.0, 300.0), NonElectrified())
                        .put(Range.closedOpen(300.0, 1350.0), Electrified("1500"))
                        .put(Range.closedOpen(1350.0, 1460.0), Neutral(true, Electrified("1500"), true))
                        .put(Range.closedOpen(1460.0, 1500.0), Neutral(true, Electrified("1500"), false))
                        .put(Range.closedOpen(1500.0, 2500.0), Electrified("1500"))
                        .put(Range.closedOpen(2500.0, 2600.0), NonElectrified())
                        .put(Range.closedOpen(2600.0, 3100.0), Electrified("25000"))
                        .build()
                ),
                Arguments.of(
                    listOf("TA1", "TA0"),
                    Direction.DECREASING,
                    ImmutableRangeMap.Builder<Double, Electrification>()
                        .put(Range.closedOpen(0.0, 350.0), Electrified("25000"))
                        .put(Range.closedOpen(350.0, 450.0), NonElectrified())
                        .put(Range.closedOpen(450.0, 2650.0), Electrified("1500"))
                        .put(Range.closedOpen(2650.0, 3100.0), NonElectrified())
                        .build()
                ),
            )
        }
    }
}

/** Puts the specified Electrification with according electricalProfile in the range lower upper */
private fun putInElectrificationMapByPowerClass(
    expectedElectrificationMapByPowerClass: ImmutableRangeMap.Builder<Double, Electrification>,
    lower: Double,
    upper: Double,
    electrification: Electrification,
    electricalProfile: String,
) {
    val elecWithProfile = electrification.withElectricalProfile(electricalProfile)
    expectedElectrificationMapByPowerClass.put(Range.closedOpen(lower, upper), elecWithProfile)
}
