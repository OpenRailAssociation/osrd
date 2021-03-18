package fr.sncf.osrd.train;

public enum TrainInteractionType {
    HEAD,
    TAIL,
    BOTH;

    public boolean interactsWithTail() {
        return this != HEAD;
    }

    public boolean interactsWithHead() {
        return this != TAIL;
    }
}
