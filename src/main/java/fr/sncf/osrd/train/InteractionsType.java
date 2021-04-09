package fr.sncf.osrd.train;

import fr.sncf.osrd.utils.SortedArraySet;

import java.util.Arrays;

public class InteractionsType extends SortedArraySet<InteractionType> {
    public InteractionsType() {}

    public InteractionsType(InteractionType[] interactionsType) {
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