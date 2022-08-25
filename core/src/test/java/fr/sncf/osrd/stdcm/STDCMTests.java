package fr.sncf.osrd.stdcm;

import fr.sncf.osrd.api.stdcm.STDCM;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;

import java.util.List;

import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.infra.InfraHelpers.makeSingleTrackRJSInfra;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertNotNull;

public class STDCMTests {
     @Test
    public void emptyTimetable() {
         var rjsInfra = makeSingleTrackRJSInfra();
         var infra = infraFromRJS(rjsInfra);
         var firstRoute = infra.findSignalingRoute("route_forward_first_half", "BAL3");
         var secondRoute = infra.findSignalingRoute("route_forward_second_half", "BAL3");
         var res = STDCM.run(
                 infra,
                 REALISTIC_FAST_TRAIN,
                 0,
                 0,
                 List.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                 List.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                 List.of()
         );
         assertNotNull(res);
     }
}
