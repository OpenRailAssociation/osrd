{ps}: let
  kdTree = ./kdtree.nix;
  geojsonPydantic = ./geojson-pydantic.nix;
in [
  ps.black
  ps.flake8
  ps.intervaltree
  ps.isort
  ps.mock
  ps.numpy
  ps.pillow
  ps.psycopg
  ps.psycopg2
  ps.pyyaml
  ps.requests
  ps.websockets
  (ps.callPackage (import kdTree) {})
  (ps.callPackage (import geojsonPydantic) {inherit (ps) pydantic;})

  # DATA SCIENCE
  ps.ipykernel
  ps.jupyterlab
  ps.shapely
  ps.pyproj
  ps.ipympl
  ps.matplotlib
  ps.networkx

  ps.progress
  ps.tqdm
  ps.ipywidgets

  # TOOLS
  ps.python-lsp-server
]
