package fr.sncf.osrd.infra.parsing.railml;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings(value = "URF_UNREAD_FIELD")
class NetRelation {
    public enum Position {
        START,
        END,
        ;

        static Position coordParse(String intrinsicCoord) {
            assert intrinsicCoord.equals("0") || intrinsicCoord.equals("1");
            if (intrinsicCoord.equals("0"))
                return START;
            return END;
        }
    }

    final String id;
    final Position positionOnA;
    final String elementA;
    final Position positionOnB;
    final String elementB;

    NetRelation(String id, String positionOnA, String elementA, String positionOnB, String elementB) {
        this.id = id;
        this.positionOnA = Position.coordParse(positionOnA);
        this.elementA = elementA;
        this.positionOnB = Position.coordParse(positionOnB);
        this.elementB = elementB;
    }
}
