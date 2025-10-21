package fr.sncf.osrd.api.etcs

import fr.sncf.osrd.api.*
import fr.sncf.osrd.conflicts.ConflictType
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.etcs.*
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.*
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
        return try {
            // Load infra.
            val infra = infraManager.getInfra(request.infra, request.expectedVersion)

            // Load electrical profile set.
            val electricalProfileMap =
                electricalProfileSetManager.getProfileMap(request.electricalProfileSetId)

            // Parse rolling stock.
            val rollingStock = parseRawRollingStock(request.physicsConsist)

            // Parse path.
            val trainPath =
                request.path.toTrainPath(infra.rawInfra, infra.blockInfra, electricalProfileMap)
            val powerRestrictionsLegacyMap =
                parsePowerRestrictions(request.powerRestrictions).toRangeMap()
            val electrificationMap =
                trainPath.getElectrificationMap(
                    rollingStock.basePowerClass,
                    powerRestrictionsLegacyMap,
                    rollingStock.powerRestrictions,
                    request.useElectricalProfiles,
                )
            val curvesAndConditions =
                rollingStock.mapTractiveEffortCurves(electrificationMap, request.comfort)
            val signalingRanges = buildSignalingRanges(infra, trainPath)
            val stops = getSimStops(parseRawSimulationScheduleItems(request.schedule))
            val context =
                EnvelopeSimContext(
                    rollingStock,
                    trainPath,
                    2.0,
                    curvesAndConditions.curves,
                    makeETCSContext(rollingStock, infra, trainPath, signalingRanges),
                )

            // Parse mrsp.
            val mrsp = parseRawMrsp(request.mrsp, Offset(trainPath.getLength()))

            // Compute ETCS braking curves.
            val etcsSimulator = ETCSBrakingSimulatorImpl(context)
            // Compute slowdown braking curves.
            val slowdowns = etcsSimulator.computeLoaLocations(mrsp)
            val slowdownBrakingCurves = etcsSimulator.computeSlowdownBrakingCurves(mrsp, slowdowns)
            // Compute stop braking curves.
            val etcsStops =
                etcsSimulator.computeEoaLocations(
                    mrsp,
                    stops.map { it.offset },
                    stops.map { it.rjsReceptionSignal.isStopOnClosedSignal },
                    EoaType.STOP,
                )
            val stopBrakingCurves = etcsSimulator.computeStopBrakingCurves(mrsp, etcsStops)
            val etcsSignals = getTravelledPathSignals(infra, trainPath, ETCS_LEVEL2.id)
            val etcsSignalsOnPath =
                etcsSignals.filter {
                    it.offset.distance > Distance.ZERO &&
                        it.offset.distance <= trainPath.getLength()
                }
            val etcsSignalOffsets = etcsSignalsOnPath.map { it.offset }
            val areEtcsSignalRouteDelimiters = etcsSignalsOnPath.map { it.isRouteDelimiter }
            val etcsSpacingConflictEoas =
                etcsSimulator.computeEoaLocations(
                    mrsp,
                    etcsSignalOffsets,
                    areEtcsSignalRouteDelimiters,
                    EoaType.SPACING,
                )
            val etcsRoutingConflictEoas =
                etcsSimulator.computeEoaLocations(
                    mrsp,
                    etcsSignalOffsets,
                    areEtcsSignalRouteDelimiters,
                    EoaType.ROUTING,
                )
            val etcsConflictEoas = etcsSpacingConflictEoas.plus(etcsRoutingConflictEoas).sorted()
            val conflictBrakingCurves =
                etcsSimulator.computeStopBrakingCurves(mrsp, etcsConflictEoas)

            // Build response.
            val res =
                ETCSBrakingCurvesResponse(
                    slowdownBrakingCurves.map { buildETCSCurves(it.value) },
                    stopBrakingCurves.map { buildETCSCurves(it.value) },
                    buildETCSConflictCurves(conflictBrakingCurves),
                )
            RsJson(RsWithBody(etcsBrakingCurvesResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }

    private data class TravelledPathSignal(
        val offset: Offset<TravelledPath>,
        val isRouteDelimiter: Boolean,
    ) : Comparable<TravelledPathSignal> {
        override fun compareTo(other: TravelledPathSignal): Int {
            return offset.compareTo(other.offset)
        }
    }

    /**
     * Returns the sorted list of unique signals on the block path, corresponding to the signaling
     * system if specified.
     */
    private fun getTravelledPathSignals(
        fullInfra: FullInfra,
        trainPath: TrainPath,
        signalingSystemId: String? = null,
    ): List<TravelledPathSignal> {
        val res = mutableSetOf<TravelledPathSignal>()
        for (blockRange in trainPath.getBlocks()) {
            val block = blockRange.value
            val blockSignalsPositions = fullInfra.blockInfra.getSignalsPositions(block)
            val blockSignals = fullInfra.blockInfra.getBlockSignals(block)
            assert(blockSignalsPositions.size == blockSignals.size)
            for ((signalPosition, signal) in blockSignalsPositions zip blockSignals) {
                val signSystemId = fullInfra.rawInfra.getSignalingSystemId(signal)
                val isRouteDelimiter = fullInfra.loadedSignalInfra.getSettings(signal).getFlag("Nf")
                if (signalingSystemId == null || signSystemId == signalingSystemId) {
                    val signalOffset = blockRange.offsetToTrainPath(signalPosition)
                    res.add(TravelledPathSignal(signalOffset, isRouteDelimiter))
                }
            }
        }
        return res.sorted()
    }

    private fun parseRawMrsp(
        rawMrsp: RangeValues<SpeedLimitProperty>,
        endPos: Offset<TravelledPath>,
        beginPos: Offset<TravelledPath> = Offset(Distance.ZERO),
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
                    doubleArrayOf(speed, speed),
                )
            )
        }
        return Envelope.make(*mrspParts.toTypedArray())
    }

    private fun buildETCSConflictCurves(
        eoaBrakingCurves: EOABrakingCurves
    ): List<ETCSConflictCurves> {
        return eoaBrakingCurves.map {
            assert(it.key.eoaType == EoaType.SPACING || it.key.eoaType == EoaType.ROUTING)
            ETCSConflictCurves(
                it.value[BrakingType.IND]!!.brakingCurve.buildSimpleEnvelope(),
                it.value[BrakingType.PS]!!.brakingCurve.buildSimpleEnvelope(),
                it.value[BrakingType.GUI]!!.brakingCurve.buildSimpleEnvelope(),
                if (it.key.eoaType == EoaType.SPACING) ConflictType.SPACING
                else ConflictType.ROUTING,
            )
        }
    }

    private fun buildETCSCurves(brakingCurves: BrakingCurves): ETCSCurves {
        return ETCSCurves(
            brakingCurves[BrakingType.IND]?.brakingCurve?.buildSimpleEnvelope(),
            brakingCurves[BrakingType.PS]!!.brakingCurve.buildSimpleEnvelope(),
            brakingCurves[BrakingType.GUI]!!.brakingCurve.buildSimpleEnvelope(),
        )
    }

    private fun Envelope.buildSimpleEnvelope(): SimpleEnvelope {
        val points = this.iteratePoints().distinct()
        // Reduce the number of points in the envelope. Epsilon = 1.0 for now, reduce its value if
        // more precision is needed.
        val simplifiedEnvelope = simplifyEnvelopePoints(points)
        return SimpleEnvelope(
            simplifiedEnvelope.map { Offset(it.position.meters) },
            simplifiedEnvelope.map { it.time.seconds },
            simplifiedEnvelope.map { it.speed },
        )
    }
}
