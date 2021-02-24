package fr.sncf.osrd.infra.railjson;

import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;

import com.squareup.moshi.*;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.RJSRoot;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalExpr;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalFunction;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSTrackObject;
import fr.sncf.osrd.infra.railjson.schema.trackranges.RJSTrackRange;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.signaling.SignalExpr;
import fr.sncf.osrd.infra.signaling.SignalFunction;
import fr.sncf.osrd.simulation.EntityType;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.utils.PointSequence;
import fr.sncf.osrd.utils.RangeSequence;
import okio.BufferedSource;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;

public class RailJSONParser {
    private static final class TrackRangeAttrBuilder<T> {
        private final RangeSequence.Builder<T>[] builders;

        @SuppressWarnings({"unchecked", "rawtypes"})
        TrackRangeAttrBuilder(TrackSection trackSection, RangeAttrGetter<T> getter) {
            this.builders = new RangeSequence.Builder[]{
                    getter.getAttr(trackSection, EdgeDirection.START_TO_STOP).builder(),
                    getter.getAttr(trackSection, EdgeDirection.STOP_TO_START).builder(),
            };
        }

        void add(RJSTrackRange range, T value) {
            var navigability = range.getNavigability();
            for (var direction : navigability.directionSet) {
                var builder = builders[direction.id];
                builder.add(range.begin, range.end, value);
            }
        }

        void build() throws InvalidInfraException {
            for (var builder : builders)
                builder.build();
        }
    }

    @SuppressWarnings("unchecked")
    private static final class TrackPointAttrBuilder<T> {
        private final PointSequence.Builder<T>[] builders;

        @SuppressWarnings({"unchecked", "rawtypes"})
        TrackPointAttrBuilder(TrackSection trackSection, PointAttrGetter<T> getter) {
            this.builders = new PointSequence.Builder[]{
                    getter.getAttr(trackSection, EdgeDirection.START_TO_STOP).builder(),
                    getter.getAttr(trackSection, EdgeDirection.STOP_TO_START).builder(),
            };
        }

        void add(RJSTrackObject object, T value) {
            var navigability = object.getNavigability();
            for (var direction : navigability.directionSet) {
                var builder = builders[direction.id];
                builder.add(object.position, value);
            }
        }

        void build() throws InvalidInfraException {
            for (var builder : builders)
                builder.build();
        }
    }

    /**
     * Parses some railJSON infra into the internal representation
     * @param source a data stream to read from
     * @param lenient whether to tolerate invalid yet understandable json constructs
     * @return an OSRD infrastructure
     * @throws InvalidInfraException {@inheritDoc}
     * @throws IOException {@inheritDoc}
     */
    public static Infra parse(BufferedSource source, boolean lenient) throws InvalidInfraException, IOException {
        var jsonReader = JsonReader.of(source);
        jsonReader.setLenient(lenient);
        var railJSON = RJSRoot.adapter.fromJson(jsonReader);
        if (railJSON == null)
            throw new InvalidInfraException("the railJSON source does not contain any data");
        return RailJSONParser.parse(railJSON);
    }

    /**
     * Parses a structured railJSON into the internal representation
     * @param railJSON a railJSON infrastructure
     * @return an OSRD infrastructure
     */
    public static Infra parse(RJSRoot railJSON) throws InvalidInfraException {
        var infra = new Infra.Builder();

        // register operational points
        for (var operationalPoint : railJSON.operationalPoints) {
            var op = new OperationalPoint(operationalPoint.id);
            infra.trackGraph.operationalPoints.put(op.id, op);
        }

        // create a unique identifier for all track intersection nodes
        var nodeIDs = TrackNodeIDs.from(railJSON.trackSectionLinks, railJSON.trackSections);
        infra.trackGraph.resizeNodes(nodeIDs.numberOfNodes);

        // TODO: parse switches

        // fill nodes with placeholders
        for (int i = 0; i < nodeIDs.numberOfNodes; i++)
            if (infra.trackGraph.getNode(i) == null)
                infra.trackGraph.setNode(i, new PlaceholderNode(String.valueOf(i)));

        // parse aspects
        for (var rjsAspect : railJSON.aspects) {
            var aspect = new Aspect(rjsAspect.id);
            infra.aspects.put(aspect.id, aspect);
        }

        // parse signal functions
        var signalFunctions = new HashMap<String, SignalFunction>();
        for (var rjsSignalFunction : railJSON.signalFunctions) {
            var signalFunction = parseSignalFunction(infra, rjsSignalFunction);
            signalFunctions.put(signalFunction.functionName, signalFunction);
        }

        var detectors = new HashMap<String, Detector>();

        // create track sections
        var infraTrackSections = new HashMap<String, TrackSection>();
        for (var trackSection : railJSON.trackSections) {
            var beginID = nodeIDs.get(trackSection.beginEndpoint());
            var endID = nodeIDs.get(trackSection.endEndpoint());
            var infraTrackSection = infra.trackGraph.makeTrackSection(beginID, endID, trackSection.id,
                    trackSection.length);
            infraTrackSections.put(trackSection.id, infraTrackSection);

            for (var rjsOp : trackSection.operationalPoints) {
                var op = infra.trackGraph.operationalPoints.get(rjsOp.ref.id);
                // add the reference from the OperationalPoint to the TrackSection,
                // add from the TrackSection to the OperationalPoint
                op.addRef(infraTrackSection, rjsOp.begin, rjsOp.end);
            }

            // Parse detectors
            var detectorsBuilder = infraTrackSection.detectors.builder();
            for (var rjsDetector : trackSection.trainDetectors) {
                var detector = new Detector(rjsDetector.id);
                detectors.put(detector.id, detector);
                detectorsBuilder.add(rjsDetector.position, detector);
            }
            detectorsBuilder.build();

            // Parse signals
            var signalsBuilder = infraTrackSection.signals.builder();
            for (var rjsSignal : trackSection.signals) {
                var function = signalFunctions.get(rjsSignal.evaluationFunction.id);
                // find the entity associated with each argument, by name
                var argc = function.argumentNames.length;
                var arguments = new String[argc];
                for (int i = 0; i < argc; i++)
                    arguments[i] = rjsSignal.arguments.get(function.argumentNames[i]).id;
                var signal = new Signal(rjsSignal.id, function, arguments);
                signalsBuilder.add(rjsSignal.position, signal);
            }
            signalsBuilder.build();
        }

        // link track sections together
        for (var trackSectionLink : railJSON.trackSectionLinks) {
            var begin = trackSectionLink.begin;
            var end = trackSectionLink.end;
            var beginEdge = infraTrackSections.get(begin.section.id);
            var endEdge = infraTrackSections.get(end.section.id);
            linkEdges(beginEdge, begin.endpoint, endEdge, end.endpoint);
        }

        // Parse TVDSections
        for (var rjsonTVD : railJSON.tvdSections) {
            var tvdDetectors = new ArrayList<Detector>();
            for (var detectorID : rjsonTVD.trainDetectors) {
                var detector = detectors.get(detectorID.id);
                if (detector == null)
                    throw new InvalidInfraException(String.format("cannot find detector %s", detectorID.id));
                tvdDetectors.add(detector);
            }
            var tvd = new TVDSection(rjsonTVD.id, tvdDetectors, rjsonTVD.isBerthingTrack);
            infra.tvdSections.put(tvd.id, tvd);
        }

        return infra.build();
    }

    private static SignalFunction parseSignalFunction(
            Infra.Builder builder,
            RJSSignalFunction rjsSignalFunction
    ) throws InvalidInfraException {
        var argumentNames = rjsSignalFunction.arguments;
        var defaultAspects = new ArrayList<Aspect>();
        for (var aspectID : rjsSignalFunction.defaultAspects)
            defaultAspects.add(builder.aspects.get(aspectID.id));

        // parse rules
        var rules = new HashMap<Aspect, SignalExpr>();
        for (var rjsRule : rjsSignalFunction.rules.entrySet()) {
            var aspect = builder.aspects.get(rjsRule.getKey());
            var expr = parseSignalExpr(builder, argumentNames, rjsRule.getValue());
            rules.put(aspect, expr);
        }

        // type check rules
        var argumentTypes = new EntityType[argumentNames.length];
        for (var rule : rules.values())
            rule.detectTypes((i, type) -> {
                // if there's already a different deduced type, error out
                if (argumentTypes[i] != null && argumentTypes[i] != type)
                    throw new InvalidInfraException(
                            String.format("found contradictory deduced types for argument %s in function %s",
                                    argumentNames[i], rjsSignalFunction.functionName));
                argumentTypes[i] = type;
            });

        return new SignalFunction(
                rjsSignalFunction.functionName,
                defaultAspects,
                rules,
                argumentNames,
                argumentTypes
        );
    }

    private static int findArgIndex(String[] argumentNames, String argument) throws InvalidInfraException {
        for (int i = 0; i < argumentNames.length; i++)
            if (argumentNames[i].equals(argument))
                return i;

        throw new InvalidInfraException(String.format("signal function argument not found: %s", argument));
    }

    private static SignalExpr parseSignalExpr(
            Infra.Builder builder,
            String[] argumentNames,
            RJSSignalExpr expr
    ) throws InvalidInfraException {
        var type = expr.getClass();
        if (type == RJSSignalExpr.OrExpr.class) {
            return new SignalExpr.OrExpr(parseInfixOp(builder, argumentNames, (RJSSignalExpr.InfixOpExpr) expr));
        } else if (type == RJSSignalExpr.AndExpr.class) {
            return new SignalExpr.AndExpr(parseInfixOp(builder, argumentNames, (RJSSignalExpr.InfixOpExpr) expr));
        } else if (type == RJSSignalExpr.NotExpr.class) {
            var notExpr = (RJSSignalExpr.NotExpr) expr;
            return new SignalExpr.NotExpr(parseSignalExpr(builder, argumentNames, notExpr.expression));
        } else if (type == RJSSignalExpr.SignalAspectCheck.class) {
            var signalExpr = (RJSSignalExpr.SignalAspectCheck) expr;
            var argIndex = findArgIndex(argumentNames, signalExpr.signal.argumentName);
            var aspect = builder.aspects.get(signalExpr.hasAspect.id);
            return new SignalExpr.SignalAspectCheck(argIndex, aspect);
        } else
            throw new InvalidInfraException("unsupported signal expression");
    }

    private static SignalExpr[] parseInfixOp(
            Infra.Builder builder,
            String[] argumentNames,
            RJSSignalExpr.InfixOpExpr expr
    ) throws InvalidInfraException {
        var arity = expr.expressions.length;
        var expressions = new SignalExpr[arity];
        for (int i = 0; i < arity; i++)
            expressions[i] = parseSignalExpr(builder, argumentNames, expr.expressions[i]);
        return expressions;
    }
}
