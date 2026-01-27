package fr.sncf.osrd.envelope_sim.etcs

import fr.sncf.osrd.railjson.schema.rollingstock.RJSEtcsBrakeParams

fun RJSEtcsBrakeParams.toEtcsBrakeParams(): EtcsBrakeParams =
    EtcsBrakeParams(
        gammaEmergency = gammaEmergency.toSpeedIntervalValueCurve(),
        gammaService = gammaService.toSpeedIntervalValueCurve(),
        gammaNormalService = gammaNormalService.toSpeedIntervalValueCurve(),
        kDry = kDry.toSpeedIntervalValueCurve(),
        kWet = kWet.toSpeedIntervalValueCurve(),
        kNPos = kNPos.toSpeedIntervalValueCurve(),
        kNNeg = kNNeg.toSpeedIntervalValueCurve(),
        tTractionCutOff = tTractionCutOff,
        tBs1 = tBs1,
        tBs2 = tBs2,
        tBe = tBe,
    )

fun RJSEtcsBrakeParams.RJSSpeedIntervalValueCurve.toSpeedIntervalValueCurve():
    EtcsBrakeParams.SpeedIntervalValueCurve =
    EtcsBrakeParams.SpeedIntervalValueCurve(boundaries = boundaries, values = values)
