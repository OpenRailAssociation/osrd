package fr.sncf.osrd.api.etcs

import fr.sncf.osrd.api.*
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.etcs.BrakingCurves
import fr.sncf.osrd.envelope_sim.etcs.BrakingType
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulatorImpl
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.sim_infra.api.TravelledPath
import fr.sncf.osrd.sim_infra.api.getSignalOffsets
import fr.sncf.osrd.sim_infra.api.makePathProperties
import fr.sncf.osrd.standalone_sim.PathOffsetBuilder
import fr.sncf.osrd.standalone_sim.buildSignalingRanges
import fr.sncf.osrd.standalone_sim.getSimStops
import fr.sncf.osrd.standalone_sim.makeETCSContext
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.seconds
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class ETCSBrakingCurvesEndpoint(
    private val infraManager: InfraProvider,
    private val electricalProfileSetManager: ElectricalProfileSetManager,
) : Take {
    override fun act(req: Request): Response {
        val request = readRequest(req) ?: return RsWithStatus(RsText("Missing request body"), 400)
        return run(request)
    }

    @WithSpan(value = "Reading request content", kind = SpanKind.SERVER)
    private fun readRequest(req: Request): ETCSBrakingCurvesRequest? {
        val body = RqPrint(req).printBody()
        return etcsBrakingCurvesRequestAdapter.fromJson(body)
    }

    /** Process the given parsed request */
    @WithSpan(value = "Processing ETCSBrakingCurves request", kind = SpanKind.SERVER)
    fun run(request: ETCSBrakingCurvesRequest): Response {
        val recorder = DiagnosticRecorderImpl(false)
        return try {
            // Load infra.
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)

            // Load electrical profile set.
            val electricalProfileMap =
                electricalProfileSetManager.getProfileMap(request.electricalProfileSetId)

            // Parse rolling stock.
            val rollingStock = parseRawRollingStock(request.physicsConsist)

            // Parse path.
            val chunkPath = makeChunkPath(infra.rawInfra, request.path.trackSectionRanges)
            val routePath = convertRoutePath(infra.rawInfra, request.path.routes)
            val pathProps = makePathProperties(infra.rawInfra, chunkPath, routePath.toList())
            val blockPath = convertBlockPath(infra.blockInfra, request.path.blocks)
            val envelopeSimPath =
                EnvelopeTrainPath.from(infra.rawInfra, pathProps, electricalProfileMap)
            val powerRestrictionsLegacyMap =
                parsePowerRestrictions(request.powerRestrictions).toRangeMap()
            val electrificationMap =
                envelopeSimPath.getElectrificationMap(
                    rollingStock.basePowerClass,
                    powerRestrictionsLegacyMap,
                    rollingStock.powerRestrictions,
                    request.useElectricalProfiles
                )
            val curvesAndConditions =
                rollingStock.mapTractiveEffortCurves(electrificationMap, request.comfort)
            val signalingRanges = buildSignalingRanges(infra, blockPath, chunkPath)
            val stops = getSimStops(parseRawSimulationScheduleItems(request.schedule))
            val context =
                EnvelopeSimContext(
                    rollingStock,
                    envelopeSimPath,
                    2.0,
                    curvesAndConditions.curves,
                    makeETCSContext(rollingStock, infra, chunkPath, routePath, signalingRanges)
                )

            // Parse mrsp.
            val mrsp = parseRawMrsp(request.mrsp, Offset(envelopeSimPath.length.meters))

            // Compute ETCS braking curves.
            val etcsSimulator = ETCSBrakingSimulatorImpl(context)
            // Compute slowdown braking curves.
            val slowdowns = etcsSimulator.computeLoaLocations(mrsp)
            val slowdownBrakingCurves = etcsSimulator.computeSlowdownBrakingCurves(mrsp, slowdowns)
            // Compute stop braking curves.
            val etcsStops = etcsSimulator.computeEoaLocations(mrsp, stops)
            val stopBrakingCurves = etcsSimulator.computeStopBrakingCurves(mrsp, etcsStops)
            // Compute signal braking curves.
            val etcsSignalBlockPathOffsets =
                infra.blockInfra.getSignalOffsets(infra.rawInfra, blockPath, ETCS_LEVEL2.id)
            val pathOffsetBuilder =
                PathOffsetBuilder(
                    trainPathBlockOffset(infra.rawInfra, infra.blockInfra, blockPath, chunkPath)
                        .distance
                )
            val etcsSignalOffsets =
                etcsSignalBlockPathOffsets
                    .map { pathOffsetBuilder.toTravelledPath(it) }
                    .filter { it.distance > Distance.ZERO && it.distance <= chunkPath.length }
            val etcsSignalStops =
                etcsSignalOffsets.map {
                    MaxSpeedEnvelope.SimStop(it, RJSReceptionSignal.SHORT_SLIP_STOP)
                }
            val etcsSignalEoas = etcsSimulator.computeEoaLocations(mrsp, etcsSignalStops)
            val signalBrakingCurves = etcsSimulator.computeStopBrakingCurves(mrsp, etcsSignalEoas)

            // Build response.
            val res =
                ETCSBrakingCurvesResponse(
                    slowdownBrakingCurves.map { buildETCSCurves(it.value) },
                    stopBrakingCurves.map { buildETCSCurves(it.value) },
                    signalBrakingCurves.map { buildETCSCurves(it.value) }
                )
            RsJson(RsWithBody(etcsBrakingCurvesResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }

    private fun parseRawMrsp(
        rawMrsp: RangeValues<SpeedLimitProperty>,
        endPos: Offset<TravelledPath>,
        beginPos: Offset<TravelledPath> = Offset(Distance.ZERO)
    ): Envelope {
        val speedLimitDistanceRangeMap = rawMrsp.toDistanceRangeMap(beginPos, endPos)
        val mrspParts = mutableListOf<EnvelopePart>()
        for (entry in speedLimitDistanceRangeMap) {
            val speedLimitProperty = entry.value
            val speed = speedLimitProperty.speed.metersPerSecond
            val speedLimitSource = speedLimitProperty.source
            val attrs: MutableList<SelfTypeHolder> = mutableListOf(EnvelopeProfile.CONSTANT_SPEED)
            if (speedLimitSource != null) attrs.add(speedLimitSource)
            mrspParts.add(
                EnvelopePart.generateTimes(
                    attrs,
                    doubleArrayOf(entry.lower.meters, entry.upper.meters),
                    doubleArrayOf(speed, speed)
                )
            )
        }
        return Envelope.make(*mrspParts.toTypedArray())
    }

    private fun buildETCSCurves(brakingCurves: BrakingCurves): ETCSCurves {
        return ETCSCurves(
            buildSimpleEnvelope(brakingCurves[BrakingType.IND]?.brakingCurve),
            buildSimpleEnvelope(brakingCurves[BrakingType.PS]!!.brakingCurve)!!,
            buildSimpleEnvelope(brakingCurves[BrakingType.GUI]!!.brakingCurve)!!,
        )
    }

    private fun buildSimpleEnvelope(envelope: Envelope?): SimpleEnvelope? {
        if (envelope == null) return envelope
        val points = envelope.iteratePoints().distinct()
        // Reduce the number of points in the envelope. Epsilon = 1.0 for now, reduce its value if
        // more precision is needed.
        val simplifiedEnvelope = simplifyEnvelopePoints(points)
        return SimpleEnvelope(
            simplifiedEnvelope.map { Offset(it.position.meters) },
            simplifiedEnvelope.map { it.time.seconds },
            simplifiedEnvelope.map { it.speed }
        )
    }
}
