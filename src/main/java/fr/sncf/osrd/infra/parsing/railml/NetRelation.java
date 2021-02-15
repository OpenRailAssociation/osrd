package fr.sncf.osrd.infra.parsing.railml;

import static fr.sncf.osrd.infra.graph.EdgeEndpoint.*;

import fr.sncf.osrd.infra.graph.EdgeEndpoint;

final class NetRelation {
    public static EdgeEndpoint coordParse(String intrinsicCoord) {
        assert intrinsicCoord.equals("0") || intrinsicCoord.equals("1");
        if (intrinsicCoord.equals("0"))
            return BEGIN;
        return END;
    }

    final String id;
    final EdgeEndpoint positionOnA;
    /** id of the start netElement */
    final String elementA;
    final EdgeEndpoint positionOnB;
    /** id of the end netElement */
    final String elementB;

    NetRelation(String id, String positionOnA, String elementA, String positionOnB, String elementB) {
        this.id = id;
        this.positionOnA = coordParse(positionOnA);
        this.elementA = elementA;
        this.positionOnB = coordParse(positionOnB);
        this.elementB = elementB;
    }
}
