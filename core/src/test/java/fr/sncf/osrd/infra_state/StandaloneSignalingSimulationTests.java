package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.infra.InfraHelpers.getSignalingRoute;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3SignalState;
import fr.sncf.osrd.infra_state.implementation.SignalizationEngine;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.infra_state.implementation.standalone.StandaloneSignalingSimulation;
import fr.sncf.osrd.infra_state.implementation.standalone.StandaloneState;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class StandaloneSignalingSimulationTests {

    @Test
    public void simpleTinyInfraSignalUpdates() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var barA = infra.getTrackSection("ne.micro.bar_a");
        var fooA = infra.getTrackSection("ne.micro.foo_a");
        var path = TrainPathBuilder.from(
                List.of(
                        getSignalingRoute(infra, "rt.buffer_stop_c->tde.track-bar"),
                        getSignalingRoute(infra, "rt.tde.track-bar->tde.switch_foo-track"),
                        getSignalingRoute(infra, "rt.tde.switch_foo-track->buffer_stop_a")
                ),
                new TrackLocation(barA, 200),
                new TrackLocation(fooA, 0)
        );
        var length = 10;
        var infraState = StandaloneState.from(path, length);
        var signalizationEngine = SignalizationEngine.from(infra, infraState);
        var events = StandaloneSignalingSimulation.runWithoutEnvelope(path, infraState, signalizationEngine);
        assertEquals(
                Set.of(
                        new SignalUpdateID(0, "il.sig.S7", BAL3.Aspect.RED),
                        new SignalUpdateID(175, "il.sig.C2", BAL3.Aspect.RED),
                        new SignalUpdateID(175 + length, "il.sig.S7", BAL3.Aspect.YELLOW),
                        new SignalUpdateID(10175 + length, "il.sig.C2", BAL3.Aspect.YELLOW),
                        new SignalUpdateID(path.length() + length, "il.sig.C2", BAL3.Aspect.GREEN),
                        new SignalUpdateID(path.length() + length, "il.sig.C6", BAL3.Aspect.YELLOW)
                ),
                convertEventList(events)
        );
    }

    @Test
    public void lineInfraTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("one_line/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var routes = new ArrayList<SignalingRoute>();
        routes.add(getSignalingRoute(infra, "rt.buffer_stop.0->detector.0"));
        for (int i = 0; i < 9; i++)
            routes.add(getSignalingRoute(infra, String.format("rt.detector.%d->detector.%d", i, i + 1)));
        routes.add(getSignalingRoute(infra, "rt.detector.9->buffer_stop.1"));
        var path = TrainPathBuilder.from(
                routes,
                new TrackLocation(infra.getTrackSection("track.0"), 0),
                new TrackLocation(infra.getTrackSection("track.9"), 0)
        );
        var length = 100;
        var infraState = StandaloneState.from(path, length);
        var signalizationEngine = SignalizationEngine.from(infra, infraState);
        var events = StandaloneSignalingSimulation.runWithoutEnvelope(path, infraState, signalizationEngine);

        // Checks that every signal has been red at least once
        var redSignals = new HashSet<String>();
        for (var e : events)
            if (e.state() instanceof BAL3SignalState bal3State)
                if (bal3State.aspect.equals(BAL3.Aspect.RED))
                    redSignals.add(e.signal().getID());
        for (var signal : infra.getSignalMap().values())
            assertTrue(redSignals.contains(signal.getID()));
    }

    @Test
    public void lineInfraEnvelopeTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("one_line/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var routes = new ArrayList<SignalingRoute>();
        routes.add(getSignalingRoute(infra, "rt.buffer_stop.0->detector.0"));
        for (int i = 0; i < 9; i++)
            routes.add(getSignalingRoute(infra, String.format("rt.detector.%d->detector.%d", i, i + 1)));
        routes.add(getSignalingRoute(infra, "rt.detector.9->buffer_stop.1"));
        var path = TrainPathBuilder.from(
                routes,
                new TrackLocation(infra.getTrackSection("track.0"), 0),
                new TrackLocation(infra.getTrackSection("track.9"), 0)
        );
        var speed = 10;
        var envelope = makeConstantSpeedEnvelope(path.length(), speed);
        var length = 100;
        var infraState = StandaloneState.from(path, length);
        var signalizationEngine = SignalizationEngine.from(infra, infraState);
        var events = StandaloneSignalingSimulation.run(path, infraState, signalizationEngine, envelope);
        for (var e : events)
            assertTrue(e.position() / speed >= e.time());
    }

    /** Converts a list of event into a set of simpler record structure, for easier equality testing */
    private static Set<SignalUpdateID> convertEventList(List<StandaloneSignalingSimulation.SignalEvent<?>> events) {
        var res = new HashSet<SignalUpdateID>();
        for (var e : events) {
            assert e.state() instanceof BAL3SignalState;
            res.add(new SignalUpdateID(e.position(), e.signal().getID(), ((BAL3SignalState) e.state()).aspect));
        }
        return res;
    }

    private record SignalUpdateID(double position, String id, BAL3.Aspect aspect){}

    private static Envelope makeConstantSpeedEnvelope(double length, double speed) {
        var builder = new EnvelopeBuilder();
        builder.addPart(EnvelopePart.generateTimes(
                new double[] {0, length},
                new double[] {speed, speed}
        ));
        return builder.build();
    }
}
