package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;

/**
 * Braking parameters for ERTMS ETCS Level 2
 * Commented with their names in ETCS specification document `SUBSET-026-3 v400.pdf` from the
 * file at https://www.era.europa.eu/system/files/2023-09/index004_-_SUBSET-026_v400.zip
 */
public class RJSEtcsBrakeParams {

    // A_brake_emergency: the emergency deceleration curve (values > 0 m/s²)
    @Json(name = "gamma_emergency")
    public RJSSpeedIntervalValueCurve gammaEmergency;

    // A_brake_service: the full service deceleration curve (values > 0 m/s²)
    @Json(name = "gamma_service")
    public RJSSpeedIntervalValueCurve gammaService;

    // A_brake_normal_service: the normal service deceleration curve used to compute guidance curve (values > 0 m/s²)
    @Json(name = "gamma_normal_service")
    public RJSSpeedIntervalValueCurve gammaNormalService;

    // Kdry_rst: the rolling stock deceleration correction factors for dry rails
    // Boundaries should be the same as gammaEmergency
    // Values (no unit) should be contained in [0, 1]
    @Json(name = "k_dry")
    public RJSSpeedIntervalValueCurve kDry;

    // Kwet_rst: the rolling stock deceleration correction factors for wet rails
    // Boundaries should be the same as gammaEmergency
    // Values (no unit) should be contained in [0, 1]
    @Json(name = "k_wet")
    public RJSSpeedIntervalValueCurve kWet;

    // Kn+: the correction acceleration factor on normal service deceleration in positive gradients
    // Values (in m/s²) should be contained in [0, 10]
    @Json(name = "k_n_pos")
    public RJSSpeedIntervalValueCurve kNPos;

    // Kn-: the correction acceleration factor on normal service deceleration in negative gradients
    // Values (in m/s²) should be contained in [0, 10]
    @Json(name = "k_n_neg")
    public RJSSpeedIntervalValueCurve kNNeg;

    // T_traction_cut_off: time delay in s from the traction cut-off command to the moment the acceleration due to
    // traction is zero
    @Json(name = "t_traction_cut_off")
    public double tTractionCutOff;

    // T_bs1: time service break in s used for SBI1 computation
    @Json(name = "t_bs1")
    public double tBs1;

    // T_bs2: time service break in s used for SBI2 computation
    @Json(name = "t_bs2")
    public double tBs2;

    // T_be: safe brake build up time in s
    @Json(name = "t_be")
    public double tBe;

    public RJSEtcsBrakeParams(
            RJSSpeedIntervalValueCurve gammaEmergency,
            RJSSpeedIntervalValueCurve gammaService,
            RJSSpeedIntervalValueCurve gammaNormalService,
            RJSSpeedIntervalValueCurve kDry,
            RJSSpeedIntervalValueCurve kWet,
            RJSSpeedIntervalValueCurve kNPos,
            RJSSpeedIntervalValueCurve kNNeg,
            double tTractionCutOff,
            double tBs1,
            double tBs2,
            double tBe) {
        this.gammaEmergency = gammaEmergency;
        this.gammaService = gammaService;
        this.gammaNormalService = gammaNormalService;
        this.kDry = kDry;
        this.kWet = kWet;
        this.kNPos = kNPos;
        this.kNNeg = kNNeg;
        this.tTractionCutOff = tTractionCutOff;
        this.tBs1 = tBs1;
        this.tBs2 = tBs2;
        this.tBe = tBe;
    }

    public static final class RJSSpeedIntervalValueCurve {
        // Speed in m/s (sorted ascending). External bounds are implicit to [0, rolling_stock.max_speed]
        public double[] boundaries;

        // Interval values (unit to be made explicit at use)
        // There must be one more value than boundaries
        public double[] values;

        public RJSSpeedIntervalValueCurve(double[] boundaries, double[] values) {
            this.boundaries = boundaries;
            this.values = values;
        }
    }
}
