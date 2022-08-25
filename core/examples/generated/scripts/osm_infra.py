#!/usr/bin/env python3

from osm_lib.network_graph import NetworkGraph


RER_NETWORK_ID = 1848693
PARIS_METRO_ID = 10713004
TRANSILIEN_NETWORK_ID = 8557336
GRAND_PARIS_NETWORK_ID = 14262489
TGV_NETWORK_ID = 1732455
TER_NETWORK_ID = 2826659
INTERCITES_NETWORK_ID = 1751207
OUIGO_NETWORK_ID = 5945165
IC_ECO_NETWORK_ID = 5945362


def build_railjson():
    G = NetworkGraph.from_multiple_relations_ids(
        RER_NETWORK_ID,
        PARIS_METRO_ID,
        TRANSILIEN_NETWORK_ID,
        TGV_NETWORK_ID,
        TER_NETWORK_ID,
        INTERCITES_NETWORK_ID,
        OUIGO_NETWORK_ID,
        IC_ECO_NETWORK_ID,
    )

    G.to_railjson()


if __name__ == "__main__":

    build_railjson()
