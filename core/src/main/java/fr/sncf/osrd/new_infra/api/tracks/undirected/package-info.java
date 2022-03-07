/**
 * <p>An undirected graph of tracks.</p>
 * <p>Not all edge paths are allowed: using two consecutive switch branches from the same switch is forbidden.</p>
 *
 * <pre>
 *                     x========+
 *                   /
 *  +==============x-----x=========:=======+
 *
 *  = stands for track sections
 *  - and / stands for switch branches
 *  x stands for switch endpoints
 *  + stands for track ends
 *  : stands for track links
 * </pre>
 */
package fr.sncf.osrd.new_infra.api.tracks.undirected;
