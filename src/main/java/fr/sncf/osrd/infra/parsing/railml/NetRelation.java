package fr.sncf.osrd.infra.parsing.railml;

class NetRelation {
    final String id;
    final boolean atZeroOnA;
    final String elementA;
    final boolean atZeroOnB;
    final String elementB;

    NetRelation(String id, String positionOnA, String elementA, String positionOnB, String elementB) {
        this.id = id;
        this.atZeroOnA = positionOnA.equals("0");
        this.elementA = elementA;
        this.atZeroOnB = positionOnB.equals("0");
        this.elementB = elementB;
    }
}
