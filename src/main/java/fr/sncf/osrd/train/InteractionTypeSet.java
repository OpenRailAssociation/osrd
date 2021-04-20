package fr.sncf.osrd.train;

import fr.sncf.osrd.utils.SortedArraySet;

import java.util.Arrays;

public class InteractionTypeSet extends SortedArraySet<InteractionType> {
    public InteractionTypeSet() {}

    public InteractionTypeSet(InteractionType[] interactionsType) {
        this.addAll(Arrays.asList(interactionsType));
    }

    public boolean interactWithHead() {
        return this.contains(InteractionType.HEAD);
    }

    public boolean interactWithTail() {
        return this.contains(InteractionType.TAIL);
    }

    public boolean interactWhenSeen() {
        return this.contains(InteractionType.SEEN);
    }
}