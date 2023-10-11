{
  lib,
  buildPythonPackage,
  fetchPypi,
}:
buildPythonPackage rec {
  pname = "kdtree";
  version = "0.16";

  src = fetchPypi {
    inherit pname version;
    sha256 = "0d3m7pir24vp2sjg85anigv9xya4z5fh7qvlp7xf01bah73zcv9q";
  };

  doCheck = false;

  meta = with lib; {
    maintainers = with maintainers; [flomonster];
    description = "Kdtree";
  };
}
