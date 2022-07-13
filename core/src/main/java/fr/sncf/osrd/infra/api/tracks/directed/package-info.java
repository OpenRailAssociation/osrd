/**
 * <p>A directed graph of tracks.</p>
 * <p>This package is very similar to {@link fr.sncf.osrd.infra.api.tracks.undirected}, except that:</p>
 * <ul>
 *     <li>For each edge in an undirected graph, there is a forward and a backward edge in the directed graph</li>
 *     <li>The directed graph, by design, does not allow impossible paths, whereas the undirected graph does</li>
 * </ul>
 */
package fr.sncf.osrd.infra.api.tracks.directed;
