{
  lib,
  buildPythonPackage,
  fetchPypi,
  pydantic,
}:
buildPythonPackage rec {
  pname = "geojson-pydantic";
  version = "0.3.1";

  src = fetchPypi {
    inherit pname version;
    sha256 = "1clj89s39qyc510sylyx5fcfx9lpk7g8mi64rbzw067hcd5n2hk5";
  };

  doCheck = false;

  propagatedBuildInputs = [pydantic];

  meta = with lib; {
    maintainers = with maintainers; [flomonster];
    description = "GeoJson support for pydantic";
  };
}
