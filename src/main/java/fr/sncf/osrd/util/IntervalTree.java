package fr.sncf.osrd.util;

import java.util.function.Consumer;

public class IntervalTree<T> {
    public IntervalNode<T> root;

    public IntervalTree() {
        this.root = null;
    }

    /**
     * Insert a new node in the tree
     * @param node the node that will be inserted into the tree
     */
    public void insert(IntervalNode<T> node) {
        root = insert(root, node);
    }

    private IntervalNode<T> insert(IntervalNode<T> tree, IntervalNode<T> node) {
        // when the tree is empty
        if (tree == null)
            return node;

        // insert like in a BST
        if (tree.begin > node.begin)
            tree.leftChild = insert(tree.leftChild, node);
        else
            tree.rightChild = insert(tree.rightChild, node);

        tree.height = Math.max(height(tree.leftChild), height(tree.rightChild)) + 1;
        tree.maxEnd = findMax(tree);

        // balance the tree
        if (heightDiff(tree) < -1) {
            if (heightDiff(tree.rightChild) > 0)
                tree.rightChild = rightRotate(tree.rightChild);
            return leftRotate(tree);
        } else if (heightDiff((tree)) > 1) {
            if (heightDiff(tree.leftChild) < 0)
                tree.leftChild = leftRotate(tree.leftChild);
            return rightRotate(tree);
        }

        return tree;
    }

    private IntervalNode<T> leftRotate(IntervalNode<T> node) {
        IntervalNode<T> right =  node.rightChild;
        node.rightChild = right.leftChild;
        right.leftChild = node;
        node.height = Math.max(height(node.leftChild), height(node.rightChild)) + 1;
        right.height = Math.max(height(right.leftChild), height(right.rightChild)) + 1;
        node.maxEnd = findMax(node);
        right.maxEnd = findMax(right);
        return right;
    }

    private IntervalNode<T> rightRotate(IntervalNode<T> node) {
        IntervalNode<T> left =  node.leftChild;
        node.leftChild = left.rightChild;
        left.rightChild = node;
        node.height = Math.max(height(node.leftChild), height(node.rightChild)) + 1;
        left.height = Math.max(height(left.leftChild), height(left.rightChild)) + 1;
        node.maxEnd = findMax(node);
        left.maxEnd = findMax(left);
        return left;
    }

    private int height(IntervalNode<T> node) {
        return node == null ? 0 : node.height;
    }

    private int heightDiff(IntervalNode<T> node) {
        return node == null ? 0 : height(node.leftChild) - height(node.rightChild);
    }

    private double findMax(IntervalNode<T> node) {
        var maxEnd = node.end;

        if (node.leftChild != null)
            maxEnd = Math.max(maxEnd, node.leftChild.maxEnd);

        if (node.rightChild != null)
            maxEnd = Math.max(maxEnd, node.rightChild.maxEnd);

        return maxEnd;
    }

    /**
     * Confirm whether the node's interval overlaps with a given interval
     * @param consumer the consumer that will accept nodes whose interval overlap with the search interval
     * @param begin the lower bound of the search interval
     * @param end the lower bound of the search interval
     */
    public void findOverlappingIntervals(Consumer<IntervalNode<T>> consumer, double begin, double end) {
        findOverlappingIntervals(this.root, consumer, begin, end, Double.NEGATIVE_INFINITY);
    }

    private static <T> void findOverlappingIntervals(
            IntervalNode<T> node,
            Consumer<IntervalNode<T>> consumer,
            double begin,
            double end,
            double minBegin
    ) {
        if (node == null)
            return;

        // stop if the subtree has no intersection with our search interval
        if (begin < minBegin && end < minBegin || end > node.maxEnd && begin > node.maxEnd)
            return;

        // if all the subtree is contained in our search interval
        if (begin <= minBegin && end >= node.maxEnd) {
            getAllChildren(node, consumer);
            return;
        }

        if (node.overlapsWith(begin, end))
            consumer.accept(node);

        findOverlappingIntervals(node.leftChild, consumer, begin, end, minBegin);
        findOverlappingIntervals(node.rightChild, consumer, begin, end, node.begin);
    }

    private static <T> void getAllChildren(IntervalNode<T> node, Consumer<IntervalNode<T>> consumer) {
        if (node == null)
            return;

        getAllChildren(node.leftChild, consumer);
        consumer.accept(node);
        getAllChildren(node.rightChild, consumer);
    }
}