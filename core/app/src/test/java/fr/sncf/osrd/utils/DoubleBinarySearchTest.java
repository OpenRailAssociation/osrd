package fr.sncf.osrd.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

public class DoubleBinarySearchTest {
    @Test
    public void increasingTest() {
        var search = new DoubleBinarySearch(0, 10, 4, 0.001, false);
        for (int i = 0; i < 1000 && !search.complete(); i++) {
            var input = search.getInput();
            var output = input * input * input;
            search.feedback(output);
        }
        assertTrue(search.complete());
        assertEquals(1.59, search.getResult(), 0.01);
    }

    @Test
    public void decreasingTest() {
        var search = new DoubleBinarySearch(0, 10, 0, 0.001, true);
        for (int i = 0; i < 1000 && !search.complete(); i++) {
            var input = search.getInput();
            var output = 4 - input * input * input;
            search.feedback(output);
        }
        assertTrue(search.complete());
        assertEquals(1.59, search.getResult(), 0.01);
    }
}
