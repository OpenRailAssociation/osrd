package fr.sncf.osrd.sim_infra_adapter

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified
import fr.sncf.osrd.path.legacy_objects.electrification.Neutral
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSApplicableDirectionsTrackRange
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSElectrification
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

class EnvelopeTrainPathTest {

    @Test
    fun envelopeFromPathTestAverageGrades() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        for (track in rjsInfra.trackSections) {
            if (track.id.equals("TA0")) {
                track.slopes = listOf(RJSSlope(0.0, 1_000.0, 5.0), RJSSlope(1_000.0, 2_000.0, 15.0))
            }
            if (track.id.equals("TA1")) {
                track.slopes =
                    listOf(RJSSlope(0.0, 1_000.0, 10.0), RJSSlope(1_000.0, 1_950.0, 25.0))
            }
        }

        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val path =
            pathFromTracks(
                infra,
                listOf("TA0", "TA1"),
                Direction.INCREASING,
                500.meters,
                3_500.meters,
            )
        Assertions.assertEquals(5.0, path.getAverageGrade(0.0, 500.0))
        Assertions.assertEquals(15.0, path.getAverageGrade(500.0, 1500.0))
        Assertions.assertEquals(10.0, path.getAverageGrade(1500.0, 2500.0))
        Assertions.assertEquals(25.0, path.getAverageGrade(2500.0, 3000.0))
        Assertions.assertEquals(11.0, path.getAverageGrade(0.0, 2500.0))
        Assertions.assertEquals(10.0, path.getAverageGrade(300.0, 700.0))
    }

    @ParameterizedTest
    @MethodSource("electrificationMapArguments")
    fun envelopeFromPathTestElectrificationMap(
        tracks: List<String>,
        direction: Direction,
        expectedMap: ImmutableRangeMap<Double, Electrification>,
    ) {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        rjsInfra.electrifications =
            listOf(
                RJSElectrification(
                    "",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            0.0,
                            800.0,
                        )
                    ),
                ),
                RJSElectrification(
                    "1500V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            800.0,
                            2_000.0,
                        ),
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            0.0,
                            1_000.0,
                        ),
                    ),
                ),
                RJSElectrification(
                    "25000V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            1_100.0,
                            1_950.0,
                        )
                    ),
                ),
                // and there is already a deadSection on TA0 from 1900 to 1950 in the
                // Direction.INCREASING
            )
        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val path = pathFromTracks(infra, tracks, direction, 500.meters, 3_600.meters)

        assertThat(path.getElectrificationMap(null, null, null)).isEqualTo(expectedMap)
    }

    @Test
    fun envelopeFromPathTestElectrificationMapByPowerClassIncreasingDirection() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        rjsInfra.electrifications =
            listOf(
                RJSElectrification(
                    "",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            0.0,
                            1500.0,
                        )
                    ),
                ),
                RJSElectrification(
                    "1500V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            1500.0,
                            2_000.0,
                        ),
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            0.0,
                            500.0,
                        ),
                    ),
                ),
                RJSElectrification(
                    "25000V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            500.0,
                            1_950.0,
                        )
                    ),
                ),
                // and there is already a deadSection on TA0 from 1900 to 1950 in the
                // Direction.INCREASING
            )

        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val rjsElectricalProfiles = getRjsElectricalProfileMapping_1()
        val profileMap = ElectricalProfileMapping()
        profileMap.parseRJS(rjsElectricalProfiles)
        val path =
            pathFromTracks(
                infra,
                listOf("TA0", "TA1"),
                Direction.INCREASING,
                1_000.meters,
                3_500.meters,
                electricalProfileMapping = profileMap,
            )
        val electrificationByPowerClass = path.getElectrificationMap("1", null, null)
        val expected = ImmutableRangeMap.Builder<Double, Electrification>()

        putInElectrificationMapByPowerClass(expected, 0.0, 500.0, NonElectrified(), "A", false)
        putInElectrificationMapByPowerClass(
            expected,
            500.0,
            600.0,
            Electrified("1500V"),
            "A",
            false,
        )
        putInElectrificationMapByPowerClass(
            expected,
            600.0,
            800.0,
            Electrified("1500V"),
            "B",
            false,
        )
        putInElectrificationMapByPowerClass(
            expected,
            800.0,
            960.0,
            Electrified("1500V"),
            "A",
            false,
        )
        putInElectrificationMapByPowerClass(
            expected,
            960.0,
            1000.0,
            Neutral(true, Electrified("1500V"), false),
            "A",
            false,
        )
        putInElectrificationMapByPowerClass(
            expected,
            1_000.0,
            1_500.0,
            Electrified("1500V"),
            "B",
            false,
        )
        putInElectrificationMapByPowerClass(
            expected,
            1_500.0,
            2_500.0,
            Electrified("25000V"),
            "B",
            true,
        )
        assertThat(electrificationByPowerClass).isEqualTo(expected.build())
    }

    @Test
    fun envelopeFromPathTestElectrificationMapByPowerClassDecreasingDirection() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        rjsInfra.electrifications =
            listOf(
                RJSElectrification(
                    "1500V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            0.0,
                            2_000.0,
                        ),
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            0.0,
                            1_950.0,
                        ),
                        RJSApplicableDirectionsTrackRange(
                            "TA2",
                            ApplicableDirection.BOTH,
                            0.0,
                            1_950.0,
                        ),
                    ),
                )
            )

        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val rjsElectricalProfiles = getRjsElectricalProfileMapping_2()
        val profileMap = ElectricalProfileMapping()
        profileMap.parseRJS(rjsElectricalProfiles)
        val path =
            pathFromTracks(
                infra,
                listOf("TA2", "TA1", "TA0"),
                Direction.DECREASING,
                1_000.meters,
                5_000.meters,
                electricalProfileMapping = profileMap,
            )
        val electrificationPowerClass1 = path.getElectrificationMap("1", null, null)
        val expectedElectrificationPowerClass1 =
            ImmutableRangeMap.Builder<Double, Electrification>()
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            0.0,
            700.0,
            Electrified("1500V"),
            "B",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            700.0,
            2_600.0,
            Electrified("1500V"),
            "A",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            2_600.0,
            2_910.0,
            Electrified("1500V"),
            "B",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            2_910.0,
            3_050.0,
            Neutral(false, Electrified("1500V"), false),
            "B",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            3_050.0,
            3_300.0,
            Electrified("1500V"),
            "B",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            3_300.0,
            4_000.0,
            Electrified("1500V"),
            "A",
            true,
        )

        assertThat(electrificationPowerClass1).isEqualTo(expectedElectrificationPowerClass1.build())

        val electrificationPowerClass2 = path.getElectrificationMap("2", null, null)
        val expectedElectrificationPowerClass2 =
            ImmutableRangeMap.Builder<Double, Electrification>()
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            0.0,
            950.0,
            Electrified("1500V"),
            "C",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            950.0,
            2_700.0,
            Electrified("1500V"),
            "D",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            2_700.0,
            2_910.0,
            Electrified("1500V"),
            "C",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            2_910.0,
            3_000.0,
            Neutral(false, Electrified("1500V"), false),
            "C",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            3_000.0,
            3_050.0,
            Neutral(false, Electrified("1500V"), false),
            "D",
            false,
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            3_050.0,
            4_000.0,
            Electrified("1500V"),
            "D",
            true,
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
                        .put(Range.closedOpen(300.0, 1_460.0), Electrified("1500V"))
                        .put(
                            Range.closedOpen(1_460.0, 1_500.0),
                            Neutral(true, Electrified("1500V"), false),
                        )
                        .put(Range.closedOpen(1_500.0, 2_500.0), Electrified("1500V"))
                        .put(Range.closedOpen(2_500.0, 2_600.0), NonElectrified())
                        .put(Range.closed(2_600.0, 3_100.0), Electrified("25000V"))
                        .build(),
                ),
                Arguments.of(
                    listOf("TA1", "TA0"),
                    Direction.DECREASING,
                    ImmutableRangeMap.Builder<Double, Electrification>()
                        .put(Range.closedOpen(0.0, 350.0), Electrified("25000V"))
                        .put(Range.closedOpen(350.0, 450.0), NonElectrified())
                        .put(Range.closedOpen(450.0, 1_460.0), Electrified("1500V"))
                        .put(
                            Range.closedOpen(1_460.0, 1_600.0),
                            Neutral(false, Electrified("1500V"), false),
                        )
                        .put(Range.closedOpen(1_600.0, 2_650.0), Electrified("1500V"))
                        .put(Range.closed(2_650.0, 3_100.0), NonElectrified())
                        .build(),
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
    includeUpperBound: Boolean,
) {
    val range =
        if (includeUpperBound) Range.closed(lower, upper) else Range.closedOpen(lower, upper)
    val elecWithProfile = electrification.withElectricalProfile(electricalProfile)
    expectedElectrificationMapByPowerClass.put(range, elecWithProfile)
}
